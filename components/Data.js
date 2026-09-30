import { existsSync, readdirSync } from "node:fs"
import path from "node:path"
import { Path } from "../constants/Path.js"
import { fetchFriends, fetchStickers } from "../guoba/schemas/listCache.js"
import Config from "./Config.js"

const DATA_BASE = path.join(Path, "data", "DouYin")

class Data {
  /** 已登录的抖音账号 */
  accounts() {
    if (!existsSync(DATA_BASE)) return []
    return readdirSync(DATA_BASE).filter(d => existsSync(path.join(DATA_BASE, d, "device.json")))
  }

  /** 配置的续火花目标用户（uid 列表） */
  users() {
    return (Config.SparkSet.users || []).map(String).filter(Boolean)
  }

  /** 构建索引：备注名→好友、昵称→好友列表（重名存数组）、uid→好友 */
  _buildIndex(friends) {
    const byUid = new Map()
    const byRemark = new Map()
    const byNick = new Map()
    for (const f of friends ?? []) {
      if (f.uid) byUid.set(String(f.uid), f)
      if (f.remark) byRemark.set(String(f.remark), f)
      if (f.nickname) {
        const k = String(f.nickname)
        if (!byNick.has(k)) byNick.set(k, [])
        byNick.get(k).push(f)
      }
    }
    return { byUid, byRemark, byNick }
  }

  /** 实时拉取好友列表并构建索引 */
  async buildIndex() {
    const friends = await fetchFriends().catch(() => [])
    return this._buildIndex(friends)
  }

  /** 实时按备注名/昵称/uid 查询单个好友 */
  async findFriend(key) {
    const k = String(key)
    const idx = await this.buildIndex()
    return idx.byRemark.get(k) || idx.byNick.get(k)?.[0] || idx.byUid.get(k) || null
  }

  /**
   * 解析续火花目标：配置值存 uid，实时拉取好友列表并反查真实 uid/chatId
   * @returns {{ resolved: Array<{target, uid, chatId, nickname, remark}>, missing: string[] }}
   */
  async resolveTargets(users) {
    const friends = await fetchFriends().catch(() => [])
    const { byUid } = this._buildIndex(friends)
    const resolved = []
    const missing = []
    for (const target of users) {
      const f = byUid.get(String(target))
      if (!f) {
        missing.push(target)
        continue
      }
      resolved.push({
        target,
        uid: f.uid,
        chatId: f.chatId || "",
        nickname: f.nickname || "",
        remark: f.remark || "",
      })
    }
    return { resolved, missing }
  }

  /** 每日定时任务：对配置的目标用户主动发送"续火花"表情 */
  async dailyTask() {
    const users = this.users()
    const emoji = Config.SparkSet.sparkEmoji
    // 兼容旧版单值字符串与新版数组：统一归一化为表情列表
    const emojiList = (Array.isArray(emoji) ? emoji : [emoji]).map(String).filter(Boolean)
    if (!users.length) {
      logger.warn("[抖音续火花] 尚未配置续火花目标，请使用 #火花添加 <昵称/uid> 或在锅巴中配置")
      return
    }
    if (!emojiList.length) {
      logger.warn("[抖音续火花] 尚未设置火花表情，请使用 #火花定时 或 #火花推送 前先在锅巴面板配置 sparkEmoji")
      return
    }
    // 实时拉取官方贴纸 名称→贴纸 id 映射（id 会由 SDK 自动解析签名直链；URL 配置则原样使用）
    const stickers = await fetchStickers().catch(() => [])
    const emojiOf = new Map()
    for (const s of stickers) {
      if (s.value) emojiOf.set(s.value, s.uriKey || s.url)
    }
    const emojiIds = emojiList.map(e => emojiOf.get(String(e)) || e)
    const { resolved, missing } = await this.resolveTargets(users)
    const stats = { total: users.length, ok: 0, fail: missing.length }
    for (const t of missing) {
      logger.warn(`[抖音续火花] 目标 ${t} 未在好友列表，本轮跳过`)
    }
    for (const selfId of this.accounts()) {
      const bot = Bot[selfId]
      if (!bot) continue
      let sent = 0
      for (const t of resolved) {
        const chatId = bot.fl?.get(t.uid)?.chatId || t.chatId || t.uid
        const name = t.remark || t.nickname || t.uid
        for (const e of emojiIds) {
          try {
            await bot.sdk.msg.send(chatId, { type: "emoji", emoji: e })
            sent++
            stats.ok++
            logger.mark(`[抖音续火花] 续火花成功：${name}（uid ${t.uid}，账号 ${selfId}，表情 ${emojiList[emojiIds.indexOf(e)]}）`)
          } catch (err) {
            stats.fail++
            logger.error(`[抖音续火花] 续火花失败：${name}（uid ${t.uid}，账号 ${selfId}，表情 ${e}）${err.message}`)
          }
        }
      }
      if (sent) logger.info(`[抖音续火花] 账号 ${selfId} 本次共续火花 ${sent} 个表情`)
    }
    return stats
  }
}

export default new Data()