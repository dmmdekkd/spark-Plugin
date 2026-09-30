import { Config, Data } from "#components"
import admin from "./admin.js"
import buildSparkSet from "./SparkSet.js"
import { refreshListCache, snapshotList, stickerBase, douyinAccounts } from "./listCache.js"

// 面板最近一次实时拉取结果（仅内存暂存展示用，不落盘）；贴纸用内置基底首发，首次打开即有下拉
let latest = { status: "preparing", friends: [], stickers: stickerBase() }

/**
 * 构建锅巴面板 schema：
 * 锅巴后端同步调用 supportGuoba 并缓存 schemas，无法等待异步拉取；
 * 因此首帧先用「同步快照」注入下拉（好友=在线账号 fl 内存缓存，贴纸=内置 22 个基底），
 * 保证账号下拉/目标用户/火花表情首帧即有数据；异步 refreshListCache 补全备注/头像/最新贴纸后更新 latest 供下次使用。
 */
/**
 * 合并两批好友数据：
 * snap = friendBase() 已融合落盘昵称且覆盖全部已登录账号（含离线恢复），作为结构基底；
 * latest = 最近一次异步拉取结果（已用服务器最新集合刷新 fl，好友减少/更新已体现），作为权威集合。
 * 合并规则：latest 中出现的账号，其好友以 latest 为权威（剔除 snap 里已被删除的旧好友）；
 * 不在 latest 里的离线账号保留 snap 的落盘恢复数据。对同一 (byId, uid) 由 latest 仅补缺字段、不覆盖已有。
 */
function mergeFriends(snapFriends, latestFriends) {
  const snap = Array.isArray(snapFriends) ? snapFriends : []
  const latest = Array.isArray(latestFriends) ? latestFriends : []
  if (!latest.length) return snap
  if (!snap.length) return latest
  const map = new Map()
  for (const f of snap) map.set(`${f.byId}\u0000${f.uid}`, { ...f })
  const latestKeys = new Set()
  for (const f of latest) {
    const key = `${f.byId}\u0000${f.uid}`
    latestKeys.add(key)
    const base = map.get(key)
    if (!base) {
      map.set(key, { ...f })
      continue
    }
    // 仅在 snap 缺失对应字段时补 latest 的值，label 以已有为准（snap 已融合落盘昵称）
    for (const k of ["nickname", "remark", "avatar", "chatId", "secUid"]) {
      if (!base[k] && f[k]) base[k] = f[k]
    }
    if (base.nickname && base.label === base.uid) {
      base.label = base.remark ? `${base.remark}（${base.nickname}）` : base.nickname
    }
  }
  // 好友减少：latest 涉及的账号（在线且已从服务器刷新）好友集合以 latest 为权威，
  // 剔除 snap 中该账号下未出现在 latest 的旧好友（已被删除），保证锅巴刷新后不再显示
  const latestIds = new Set(latest.map(f => String(f.byId)))
  for (const [key, f] of map) {
    if (latestIds.has(String(f.byId)) && !latestKeys.has(key)) map.delete(key)
  }
  return [...map.values()]
}

export function buildSchemas() {
  refreshListCache()
    .then(d => {
      if (d) latest = d
    })
    .catch(() => {})
  const snap = snapshotList()
  // 同步快照与最近一次拉取结果合并：以实时快照（覆盖全部账号 + 落盘昵称）为基底，latest 仅补缺；贴纸保留更全的结果
  latest = {
    ...latest,
    ...snap,
    friends: mergeFriends(snap.friends, latest.friends),
    stickers: latest.stickers?.length ? latest.stickers : snap.stickers,
    status: snap.friends?.length ? snap.status : latest.status,
  }
  return [admin, buildSparkSet(latest)].flat()
}

// 启动预热：Bot 启动即异步拉取一次好友/贴纸缓存，用户后续打开面板时昵称已补全（backend 重启/首次打开时由 buildSchemas 再触发）
refreshListCache()
  .then(d => {
    if (d) latest = d
  })
  .catch(() => {})

/** 锅巴面板读取当前配置值：每个账号一个板块，值按 SparkSet.<账号id>.{users,sparkEmoji,dailyCron} 读取 */
export function getConfigData() {
  const { admin, SparkSet } = Config
  migrateGlobalOnce(SparkSet)
  const norm = raw => (Array.isArray(raw) ? raw : raw != null ? [raw] : [])
  // 账号集合：已登录账号 ∪ 已有独立配置的账号（离线 / 旧数据账号也回显，保证配置不丢）
  const ids = new Set(douyinAccounts())
  for (const k of Object.keys(SparkSet || {})) {
    if (/^\d+$/.test(k)) ids.add(k)
  }
  const s = {}
  for (const id of ids) {
    const sub = SparkSet?.[id] || {}
    s[id] = {
      users: Array.isArray(sub.users) ? sub.users.map(String).filter(Boolean) : [],
      sparkEmoji: norm(sub.sparkEmoji),
      dailyCron: sub.dailyCron ?? "",
    }
  }
  return { admin: { priority: admin.priority, reg: admin.reg }, SparkSet: s }
}

/**
 * 一次性迁移旧版全局配置（SparkSet.users/sparkEmoji/dailyCron）到各已登录账号组：
 * 仅账号该字段尚未配置时写入，迁移完成后删除旧全局字段，此后每个账号配置完全独立、互不影响
 */
let migrated = false
function migrateGlobalOnce(SparkSet) {
  const accounts = douyinAccounts()
  if (migrated || !SparkSet || !accounts.length) return
  const globalUsers = Array.isArray(SparkSet.users) ? SparkSet.users : null
  const hasGlobal = globalUsers !== null || SparkSet.sparkEmoji !== undefined || SparkSet.dailyCron !== undefined
  if (!hasGlobal) return
  for (const id of accounts) {
    const sub = SparkSet[id] || {}
    const patch = {}
    if (globalUsers && !Array.isArray(sub.users)) patch.users = globalUsers.slice()
    if (SparkSet.sparkEmoji !== undefined && sub.sparkEmoji === undefined) patch.sparkEmoji = SparkSet.sparkEmoji
    if (SparkSet.dailyCron !== undefined && sub.dailyCron === undefined) patch.dailyCron = SparkSet.dailyCron
    for (const [k, v] of Object.entries(patch)) Config.modify("SparkSet", id, k, v)
  }
  if (globalUsers) Config.del("SparkSet", "users")
  if (SparkSet.sparkEmoji !== undefined) Config.del("SparkSet", "sparkEmoji")
  if (SparkSet.dailyCron !== undefined) Config.del("SparkSet", "dailyCron")
  migrated = true
}

/** 从锅巴提交数据中兼容「扁平格式 { "SparkSet.123.users": [...] }」与「嵌套格式 { SparkSet: { 123: {...} } }」两种提交 */
function applyFlat(obj, prefix = "", skip) {
  for (const [k, v] of Object.entries(obj ?? {})) {
    const path = prefix ? `${prefix}.${k}` : k
    if (skip?.has(path)) continue
    if (v && typeof v === "object" && !Array.isArray(v)) applyFlat(v, path, skip)
    else Config.modify(...path.split("."), v)
  }
}

/** 锅巴面板保存配置：字段直接以 SparkSet.<账号id>.* 落盘（applyFlat 兼容扁平/嵌套两种提交格式） */
export async function setConfigData(data, { Result }) {
  applyFlat(data)
  // 保存后重建各账号定时任务，保证 cron 修改实时生效
  Data.syncDailyTasks()
  return Result.ok({}, "已保存，配置已实时生效")
}

export { refreshListCache }