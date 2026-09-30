import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs"
import path from "node:path"
import { Path } from "../../constants/Path.js"

// 抖音适配器登录数据目录：每个已登录账号一个子目录（device.json 存在即已登录）
const DOUYIN_DATA = path.join(Path, "data", "DouYin")

// 好友昵称持久化缓存：DouYin fl 的 nickname 依赖 SDK frd.list()（peer.nickname 基本为空），重启后内存 fl 昵称丢失、
// 首帧会退化纯 uid；把异步补全到的昵称/头像/备注/secUid/chatId 落盘，重启/重开面板首帧即恢复昵称。
// 落盘按「账号」分组（{ 账号id: { 好友uid: {...} } }）：同一好友可同时归属多个账号，且账号离线时也能从落盘恢复其好友昵称。
const FRIEND_CACHE = path.join(Path, "data", "spark-Plugin", "friends.json")
let _friendCache = null
/**
 * 将账号 fl 与服务器最新好友列表对齐（DouYin-Plugin 的 loadFriend 只增不删，删除的好友会一直残留）：
 * frd.list() 返回服务器当前好友集合，据此补删「已不存在的好友」并补新增/更新昵称等字段；
 * 锅巴刷新面板时先执行本函数，保证 fetched friends 反映最新的好友减少与更新。失败静默，沿用原 fl。
 */
async function syncFriendFl(id) {
  const bot = Bot[id]
  if (!bot?.sdk?.frd?.list || !bot?.fl?.set) return
  try {
    const fresh = await withTimeout(bot.sdk.frd.list(), 10000)
    const uids = new Set()
    for (const i of fresh || []) {
      const uid = String(i?.uid ?? "")
      if (!uid) continue
      uids.add(uid)
      const cur = bot.fl.get(uid) || {}
      bot.fl.set(uid, {
        ...cur,
        user_id: uid,
        nickname: i.nickname || cur.nickname,
        secUid: i.secUid || cur.secUid,
        chatId: i.chatId || cur.chatId,
      })
    }
    for (const old of [...bot.fl.values()]) {
      const uid = String(old?.user_id ?? old?.uid ?? "")
      if (uid && !uids.has(uid)) bot.fl.delete(uid)
    }
  } catch {}
}

/**
 * 读取落盘缓存：{ 账号id: { 好友uid: {...} } }（按账号分组，键=账号 id）
 */
function readFriendCache() {
  if (_friendCache) return _friendCache
  try {
    _friendCache = existsSync(FRIEND_CACHE) ? JSON.parse(readFileSync(FRIEND_CACHE, "utf8")) || {} : {}
  } catch {
    _friendCache = {}
  }
  return _friendCache
}
function saveFriendCache(friends) {
  try {
    const byId = readFriendCache()
    // 按本次列表重建「出现的账号」分组：以这批 uid 为权威集合，丢弃已删除/不再存在的旧好友，避免落盘残留
    const groups = new Map()
    for (const f of friends || []) {
      const id = String(f.byId ?? "")
      const uid = String(f.uid ?? "")
      if (!id || !uid) continue
      let sub = groups.get(id)
      if (!sub) groups.set(id, (sub = {}))
      const prev = (byId[id] || {})[uid] || {}
      sub[uid] = {
        ...(f.nickname ? { nickname: f.nickname } : {}),
        ...(f.avatar ? { avatar: f.avatar } : {}),
        ...(f.remark ? { remark: f.remark } : {}),
        ...(f.secUid ? { secUid: f.secUid } : {}),
        ...(f.chatId ? { chatId: f.chatId } : {}),
      }
      // 本轮未补全的字段保留旧值，避免覆盖掉已有昵称
      for (const k of ["nickname", "avatar", "remark", "secUid", "chatId"]) if (!sub[uid][k] && prev[k]) sub[uid][k] = prev[k]
    }
    for (const [id, sub] of groups) byId[id] = sub
    mkdirSync(path.dirname(FRIEND_CACHE), { recursive: true })
    writeFileSync(FRIEND_CACHE, JSON.stringify(byId))
    _friendCache = byId
  } catch {}
}

/**
 * 已登录抖音账号 id 列表（读取 data/DouYin/<id>/device.json，含离线账号）：
 * 用于锅巴面板分组与命令「指定账号」的基准，离线账号也能在面板展示并保留配置。
 */
export const douyinAccounts = () => {
  if (!existsSync(DOUYIN_DATA)) return []
  return readdirSync(DOUYIN_DATA).filter(id => existsSync(path.join(DOUYIN_DATA, id, "device.json")))
}

/**
 * 在线抖音账号 id 列表（内存实时判断）：
 * DouYin-Plugin 连接成功即注册到 Bot.uin 并挂载 sdk（adapter.id === "DouYin"），
 * 掉线重连失败/命令删除时即时移除；仅用于实时发送/拉取的在线判定。
 */
export const onlineAccounts = () => {
  if (!global.Bot?.uin?.length) return []
  const ids = new Set(douyinAccounts())
  return Bot.uin.filter(id => ids.has(id) && Bot[id]?.adapter?.id === "DouYin" && Bot[id]?.sdk)
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
 * 同步读取好友基底（DouYin-Plugin 的 Bot[id].fl 是本地持久化 Map，立即可用）：
 * 遍历所有已登录账号（含离线）——在线账号用 fl + 落盘昵称融合；离线账号从落盘缓存按账号恢复其好友，
 * 保证每个账号的卡片都能展示自己的好友与昵称（不再依赖账号当前是否在线/内存 fl 是否已加载）。
 * 锅巴面板 schema 是同步注入 options 的，此函数用于「首帧」立即给出好友列表，
 * 避免异步拉取完成前下拉为空或纯数字；label 优先昵称（fl → 落盘缓存兜底），头像/备注由 fetchFriends 异步补全后覆盖并落盘。
 * 返回：Array<{label, value(uid), uid, chatId, secUid, nickname, remark, avatar, byId}>
 */
export function friendBase(accounts) {
  const cache = readFriendCache()
  const all = accounts?.length ? accounts : douyinAccounts()
  const friends = []
  for (const id of all) {
    const bot = Bot[id]
    const savedSub = cache[id] || {}
    const flVals = bot?.fl?.values ? [...bot.fl.values()] : []
    if (flVals.length) {
      // 在线：遍历该账号自己 fl 的好友（同一 uid 可同时属于多个账号，各保留一条），落盘按 uid 补充昵称/备注/头像
      for (const f of flVals) {
        const uid = String(f.user_id ?? f.uid ?? "")
        if (!uid) continue
        const s = savedSub[uid] || {}
        const nickname = f.nickname || s.nickname || ""
        const remark = s.remark || ""
        friends.push({
          label: remark ? `${remark}（${nickname || uid}）` : nickname || uid,
          value: uid,
          uid,
          byId: id,
          chatId: f.chatId || s.chatId || "",
          secUid: f.secUid || s.secUid || "",
          nickname,
          remark,
          avatar: s.avatar || "",
        })
      }
    } else {
      // 离线/内存 fl 未加载：从落盘按账号归属恢复该账号的好友（含昵称），保证离线账号卡片也能展示昵称而非空
      for (const [uid, s] of Object.entries(savedSub)) {
        if (!s || (!s.nickname && !s.avatar && !s.remark)) continue
        const nickname = s.nickname || ""
        const remark = s.remark || ""
        friends.push({
          label: remark ? `${remark}（${nickname || uid}）` : nickname || uid,
          value: uid,
          uid,
          byId: id,
          chatId: s.chatId || "",
          secUid: s.secUid || "",
          nickname,
          remark,
          avatar: s.avatar || "",
        })
      }
    }
  }
  return friends
}

/**
 * 同步快照：面板打开时无需等待即可展示的下拉数据。
 * 好友取在线账号 fl 内存缓存（昵称级），贴纸取内置 22 个基底；备注/头像等完整数据由 refreshListCache 异步补全后替换。
 */
export function snapshotList() {
  if (!douyinInstalled()) {
    return { status: "no-adapter", douyinInstalled: false, friends: [], stickers: stickerBase(), accounts: 0 }
  }
  const online = onlineAccounts()
  const hasIm = online.some(id => Bot[id]?.sdk?.im)
  return {
    status: hasIm ? "ready" : "preparing",
    douyinInstalled: true,
    friends: friendBase(),
    stickers: stickerBase(),
    accounts: douyinAccounts().length,
  }
}

/**
 * 将补全到的昵称/头像写回 DouYin fl（本地 Map），下次打开面板时 friendBase 首帧即可读到昵称，
 * 避免每次都要等异步拉取（锅巴同步注入 options 无法等待）。
 */
function backfillFl(fl, friends) {
  if (!fl?.set) return
  for (const f of friends) {
    if (!f.nickname && !f.avatar) continue
    try {
      const cur = fl.get(f.uid) || {}
      const patch = {}
      if (f.nickname && cur.nickname !== f.nickname) patch.nickname = f.nickname
      if (f.avatar && cur.avatar !== f.avatar) patch.avatar = f.avatar
      if (Object.keys(patch).length) fl.set(f.uid, { ...cur, ...patch })
    } catch {}
  }
}

/**
 * 实时拉取好友列表（基底来自各账号自己的 Bot[id].fl，异步补昵称/头像/备注后覆盖）：
 * 抖音的 im/user/info 查询基于「调用者身份」，故必须每个账号用自己的 sdk 查它自己的好友，
 * 否则第二个账号的好友用第一个账号的身份查询会返回空（表现为昵称缺失）。
 * 返回：Array<{label, value(uid), uid, chatId, secUid, nickname, remark, avatar, byId}>
 */
export async function fetchFriends() {
  const accounts = onlineAccounts()
  // 先用服务器最新集合对齐各在线账号 fl（loadFriend 只增不删，这里剔除已删除好友并补新增），
  // 保证本次拉取与落盘都反映「好友减少/更新」，锅巴刷新即获最新数据
  await Promise.all(accounts.map(id => syncFriendFl(id)))
  const friends = friendBase(accounts)
  const onlineBots = accounts.filter(id => Bot[id]?.sdk?.im)
  if (!onlineBots.length) return friends

  // 1) 每账号用自己的 sdk.im 批量补「该账号好友」的头像/昵称（im/user/info，50 一批）；成功后写回对应账号 fl，下次打开面板首帧即显示昵称
  for (const id of onlineBots) {
    const own = friends.filter(f => f.byId === id)
    const secUids = own.map(f => f.secUid).filter(Boolean)
    if (!secUids.length) continue
    try {
      const im = Bot[id].sdk.im()
      const profiles = await withTimeout(im.getUserProfiles(secUids), 8000)
      for (const f of own) {
        const p = f.secUid ? profiles.get(f.secUid) : undefined
        if (p?.avatar) f.avatar = p.avatar
        if (p?.nickname && !f.nickname) f.nickname = p.nickname
      }
      backfillFl(Bot[id].fl, own)
      const hit = own.filter(f => f.nickname).length
      if (own.length && !hit)
        logger.warn(`[抖音续火花] 账号 ${id} 的好友资料批量查询未命中（${own.length} 人）：可能该账号登录态异常，重开面板或重启 Bot 后重试`)
    } catch {}
  }

  // 1.5) 兜底：批量接口失败/未命中的好友，用「所属账号自己的 sdk」逐个单查补昵称（profileScene 查公开资料）。
  //      每个账号独立限并发 3、最多 60 个，防风控与拖慢拉取；改为后台异步执行，不阻塞本次面板拉取
  //      （当前面板用批量结果展示，后台补全结果写回 fl 与落盘，供下次打开/重启后首帧使用）。
  const limit = 3
  Promise.all(
    onlineBots.map(async id => {
      const miss = friends.filter(f => f.byId === id && f.secUid && !f.nickname).slice(0, 60)
      if (!miss.length) return
      let idx = 0
      const worker = async () => {
        while (idx < miss.length) {
          const f = miss[idx++]
          try {
            const p = await withTimeout(Bot[id].sdk.user.profileScene(f.secUid), 5000)
            if (p?.nickname) {
              f.nickname = p.nickname
              if (p?.avatar && !f.avatar) f.avatar = p.avatar
            }
          } catch {}
        }
      }
      await Promise.all(Array.from({ length: Math.min(limit, miss.length) }, worker))
      backfillFl(Bot[id].fl, miss)
      try {
        saveFriendCache(friends)
      } catch {}
    })
  ).catch(() => {})

  // 2) 批量拉好友备注名（im/user/info 原始响应含 remark_name，SDK 未透出，故自行 POST；每账号各查自己的好友，失败静默）
  await Promise.all(
    onlineBots.map(async id => {
      const own = friends.filter(f => f.byId === id)
      const secUids = own.map(f => f.secUid).filter(Boolean)
      if (!secUids.length) return
      try {
        await withTimeout(
          (async () => {
            const http = Bot[id]?.sdk?.httpInstance
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
            if (map) for (const f of own) if (f.secUid && map.has(f.secUid)) f.remark = map.get(f.secUid)
          })(),
          10000,
        )
      } catch {}
    })
  )

  // 3) 构建展示 label：value 即 uid（配置按 uid 存储），label 优先备注名（昵称），并把本轮补全结果落盘（重启/重开后首帧仍显示昵称）
  for (const f of friends) {
    f.value = f.uid
    f.label = f.remark ? `${f.remark}（${f.nickname || f.uid}）` : f.nickname || f.uid
  }
  try {
    saveFriendCache(friends)
  } catch {}
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
  const online = onlineAccounts().find(id => Bot[id]?.sdk?.sticker)
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
  const online = onlineAccounts().some(id => Bot[id]?.sdk?.im)
  try {
    const friends = online ? await fetchFriends() : []
    // 无在线账号时仍给出内置贴纸基底，保证火花表情下拉始终有数据
    const stickers = online ? await fetchStickers() : stickerBase()
    return { status: online ? "ready" : "preparing", douyinInstalled: true, friends, stickers, accounts: accounts.length }
  } catch (err) {
    logger.warn(`[抖音续火花] 拉取好友/贴纸列表失败：${err.message}`)
    return { status: "preparing", douyinInstalled: true, friends: [], stickers: stickerBase(), accounts: accounts.length }
  }
}