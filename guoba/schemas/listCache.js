import { existsSync, readdirSync } from "node:fs"
import path from "node:path"
import { Path } from "../../constants/Path.js"

// 已登录的抖音账号 id 列表（data/DouYin/ 下存在 device.json 即已登录上线）
const DOUYIN_BASE = path.join(Path, "data", "DouYin")
export const douyinAccounts = () => {
  if (!existsSync(DOUYIN_BASE)) return []
  return readdirSync(DOUYIN_BASE).filter(d => existsSync(path.join(DOUYIN_BASE, d, "device.json")))
}

// 抖音适配器（DouYin-Plugin）是否已安装
const DOUYIN_PLUGIN = path.join(Path, "plugins", "DouYin-Plugin")
export const douyinInstalled = () =>
  existsSync(path.join(DOUYIN_PLUGIN, "index.js")) || existsSync(path.join(DOUYIN_PLUGIN, "guoba.support.js"))

const withTimeout = (p, ms) =>
  Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("拉取数据超时")), ms))])

// 官方互动贴纸 id（im-resource 资源路径段）→ 中文名：trending 未返回 display_name 时用于补全展示名
const STICKER_NAMES = {
  "1687263281313-ts-e7bbade781abe88ab12e706e67": "续火花",
  "1700709715333-ts-e6af94e5bf832e706e67": "比心",
  "1700709660537-ts-e59ca8e5b9b2e5989b2e706e67": "在干嘛",
  "1700709792873-ts-e7ac91e593ad2e706e67": "笑死",
  "1700709833784-ts-e9babbe4ba862e706e67": "麻了",
  "1700709877574-ts-e8babae5b9b32e706e67": "躺平",
  "1687261809634-ts-e9aab0e5ad902e77656270": "摇骰子",
  "1687262043957-ts-e78c9ce68bb32e77656270": "猜拳",
  "1700709744299-ts-e5bc80e5bf832e706e67": "开心",
  "1652427775960-ts-373039313837373530383930373438333137322e706e67": "嗨",
  "1687263233752-ts-e590b9e6b3a1e6b3a12e706e67": "吹泡泡",
  "1700709932312-ts-e9bb91e4babae997aee58fb72e706e67": "黑人问号",
  "1687263059740-ts-e697a9e4b88ae5a5bd2de5a4aae998b32e706e67": "早上好",
  "1687263122037-ts-e6999ae4b88ae5a5bd2de6989fe6989f2e706e67": "晚上好",
  "1687263141266-ts-e6999ae4b88ae5a5bd2de697a9e782b9e79da12e706e67": "早点睡",
  "1687263417979-ts-e788b1e5bf832e77656270": "爱心",
  "1687263664039-ts-e5bda9e889b2e4bebfe4bebf2e77656270": "便便",
  "1687263258495-ts-e688b3e4b880e688b32e706e67": "戳一戳",
  "1687262734782-ts-e7bb9de4ba862e706e67": "绝了",
  "1687262804182-ts-e5b7b2e998852e706e67": "已阅",
  "1687263782367-ts-e89b8be7b3952e706e67": "生日祝福",
}

/**
 * 实时拉取好友列表（全部走接口，不落盘）：
 *  - 好友基础数据：DouYin-Plugin 已加载到 Bot[id].fl（含 user_id/nickname/secUid/chatId）
 *  - im().getUserProfiles(secUids) 批量补头像/昵称
 *  - 自行 POST im/user/info 批量补备注名（remark_name，SDK 未透出，失败静默）
 * 返回：Array<{label, value(uid), uid, chatId, secUid, nickname, remark, avatar}>
 */
export async function fetchFriends() {
  const accounts = douyinAccounts()
  const friends = []
  for (const id of accounts) {
    const bot = Bot[id]
    if (!bot?.fl?.values) continue
    for (const f of bot.fl.values()) {
      const uid = String(f.user_id ?? f.uid ?? "")
      if (!uid) continue
      if (!friends.some(o => o.value === uid)) {
        friends.push({ label: uid, value: uid, uid, chatId: f.chatId || "", secUid: f.secUid || "", nickname: f.nickname || "", remark: "" })
      }
    }
  }

  const online = accounts.find(id => Bot[id]?.sdk?.im)
  if (!online) return friends
  const im = Bot[online].sdk.im()
  const secUids = friends.map(f => f.secUid).filter(Boolean)

  // 1) 批量拉好友头像/昵称（im/user/info，50 一批）
  if (secUids.length) {
    const profiles = await withTimeout(im.getUserProfiles(secUids), 8000)
    for (const f of friends) {
      const p = f.secUid ? profiles.get(f.secUid) : undefined
      if (p?.avatar) f.avatar = p.avatar
      if (p?.nickname && !f.nickname) f.nickname = p.nickname
    }
  }

  // 2) 批量拉好友备注名（im/user/info 原始响应含 remark_name，SDK 未透出，故自行 POST；失败静默）
  if (secUids.length) {
    try {
      await withTimeout(
        (async () => {
          const http = Bot[online]?.sdk?.httpInstance
          if (!http) return
          const tryHost = async host => {
            const form = new FormData()
            form.append("sec_user_ids", JSON.stringify(secUids))
            const res = await http.json(
              `${host}/aweme/v1/web/im/user/info/?device_platform=webapp&aid=6383&channel=channel_pc_web&version_code=170400&version_name=17.4.0`,
              { method: "POST", body: form, headers: { Referer: host } },
            )
            const arr = res?.data?.data
            if (!Array.isArray(arr)) return null
            const map = new Map()
            for (const o of arr) {
              if (typeof o?.remark_name === "string" && o.remark_name && typeof o?.sec_uid === "string" && o.sec_uid)
                map.set(o.sec_uid, o.remark_name)
            }
            return map
          }
          let map = null
          try {
            map = await tryHost("https://imdesktop.douyin.com")
          } catch {}
          if (!map) {
            try {
              map = await tryHost("https://www.douyin.com")
            } catch {}
          }
          if (map) for (const f of friends) if (f.secUid && map.has(f.secUid)) f.remark = map.get(f.secUid)
        })(),
        10000,
      )
    } catch {}
  }

  // 3) 构建展示 label：value 即 uid（配置按 uid 存储），label 优先备注名（昵称）
  for (const f of friends) {
    f.value = f.uid
    f.label = f.remark ? `${f.remark}（${f.nickname || f.uid}）` : f.nickname || f.uid
  }
  return friends
}

/**
 * 官方互动贴纸内置基底（22 个无节日限定）：id 即 im-resource 资源路径段，
 * 发送时 SDK 会按 id 自动解析签名直链，故不依赖 trending 在线数据即可展示与发送
 */
export const stickerBase = () =>
  Object.entries(STICKER_NAMES).map(([id, name]) => ({ label: name, value: name, uriKey: id }))

/** 实时拉取官方热门贴纸：内置 22 个为基底，trending 命中时补充最新贴纸，不落盘 */
export async function fetchStickers() {
  const stickers = stickerBase()
  const online = douyinAccounts().find(id => Bot[id]?.sdk?.sticker)
  if (!online) return stickers
  try {
    const sticker = Bot[online].sdk.sticker
    await withTimeout(
      (async () => {
        const page = await sticker.trending({ cursor: 0, count: 50 })
        for (const s of page.list ?? []) {
          const id = s.id || ""
          if (!id || stickers.some(o => o.uriKey === id)) continue
          const name = STICKER_NAMES[id] || s.name || id
          stickers.push({ label: name, value: name, uriKey: id })
        }
      })(),
      8000,
    )
  } catch (err) {
    logger.warn(`[抖音续火花] 拉取贴纸列表失败：${err.message}`)
  }
  return stickers
}

/**
 * 实时聚合拉取好友列表与官方贴纸（全部走接口，不落盘）。
 * 状态：no-adapter 未安装适配器 / preparing Bot 就绪中 / ready 已就绪
 */
export async function refreshListCache() {
  if (!douyinInstalled()) return { status: "no-adapter", douyinInstalled: false, friends: [], stickers: [], accounts: 0 }
  const accounts = douyinAccounts()
  const online = accounts.some(id => Bot[id]?.sdk?.im)
  try {
    const friends = online ? await fetchFriends() : []
    const stickers = online ? await fetchStickers() : []
    return { status: online ? "ready" : "preparing", douyinInstalled: true, friends, stickers, accounts: accounts.length }
  } catch (err) {
    logger.warn(`[抖音续火花] 拉取好友/贴纸列表失败：${err.message}`)
    return { status: "preparing", douyinInstalled: true, friends: [], stickers: [], accounts: accounts.length }
  }
}