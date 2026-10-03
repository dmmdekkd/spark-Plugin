import { douyinAccounts, onlineAccounts, fetchFriends, fetchStickers } from "../guoba/schemas/listCache.js"
import Config from "./Config.js"
import loader from "../../../lib/plugins/loader.js"

class Data {
  /** 已登录抖音账号 id 列表（含离线，读 data/DouYin/<id>/device.json，用于配置归属/分组） */
  accounts() {
    return douyinAccounts()
  }

  /** 在线抖音账号 id 列表（内存实时，用于实际发送/拉取） */
  online() {
    return onlineAccounts()
  }

  /**
   * 指定账号的子配置（完全独立：只读该账号自身字段，不回退全局配置）
   * 旧版全局字段已在锅巴面板首次打开时一次性迁移到各账号组，之后互不影响
   */
  subCfg(selfId) {
    return (Config.SparkSet && Config.SparkSet[selfId]) || {}
  }

  /** 指定账号配置的续火花目标（uid 列表，独立配置） */
  usersOf(selfId) {
    const cfg = this.subCfg(selfId)
    return Array.isArray(cfg.users) ? cfg.users.map(String).filter(Boolean) : []
  }

  /** 指定账号配置的火花表情列表（独立配置，未配置默认空） */
  emojiListOf(selfId) {
    const cfg = this.subCfg(selfId)
    const raw = cfg?.sparkEmoji
    return (Array.isArray(raw) ? raw : raw != null ? [raw] : []).map(String).filter(Boolean)
  }

  /** 指定账号的每日定时 cron（独立配置，未配置默认空） */
  dailyCronOf(selfId) {
    return this.subCfg(selfId).dailyCron ?? ""
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

  /** 实时拉取好友列表并构建索引（跨全部账号，用于查找好友归属） */
  async buildIndex() {
    const friends = await fetchFriends().catch(() => [])
    return this._buildIndex(friends)
  }

  /** 实时按备注名/昵称/uid 查询单个好友（跨全部账号） */
  async findFriend(key) {
    const k = String(key)
    const idx = await this.buildIndex()
    return idx.byRemark.get(k) || idx.byNick.get(k)?.[0] || idx.byUid.get(k) || null
  }

  /** 实时在指定账号的好友中按备注名/昵称/uid 查询单个好友 */
  async findFriendIn(selfId, key) {
    const friends = (await fetchFriends().catch(() => [])).filter(f => f.byId === selfId)
    const idx = this._buildIndex(friends)
    const k = String(key)
    return idx.byRemark.get(k) || idx.byNick.get(k)?.[0] || idx.byUid.get(k) || null
  }

  /**
   * 解析指定账号的续火花目标：只反查该账号好友列表中的 uid
   * @returns {{ resolved: Array<{target, uid, byId, chatId, nickname, remark}>, missing: string[] }}
   */
  async resolveTargets(selfId, users) {
    const friends = (await fetchFriends().catch(() => [])).filter(f => f.byId === selfId)
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
        byId: f.byId || "",
        chatId: f.chatId || "",
        nickname: f.nickname || "",
        remark: f.remark || "",
      })
    }
    return { resolved, missing }
  }

  /** 为每个在线账号按各自 dailyCron 重建"每日续火花"定时任务（账号上下线/配置变化时调用，实时生效） */
  syncDailyTasks() {
    const tasks = loader.task || []
    // 先取消旧任务已注册的 cron job：createTask 只对数组内的任务执行 i.job?.cancel()，
    // 被下方 filter 移出数组的任务不会再被遍历到，残留 job 会与新建 job 同时触发导致重复续火花
    for (const t of tasks)
      if (String(t.name).startsWith("每日续火花") && t.job?.cancel) t.job.cancel()
    loader.task = tasks.filter(t => !String(t.name).startsWith("每日续火花"))
    for (const id of this.accounts()) {
      const cron = this.dailyCronOf(id)
      if (!cron) continue
      loader.task.push({
        name: `每日续火花（${id}）`,
        cron,
        fnc: async () => {
          await this.dailyTask(id)
        },
        log: false,
      })
    }
    loader.createTask()
  }

  /** 每日定时任务：逐账号发送该账号配置的目标与表情（onlyId 指定仅执行某账号，否则全部在线账号） */
  async dailyTask(onlyId) {
    const stats = { total: 0, ok: 0, fail: 0 }
    const accounts = onlyId ? [onlyId] : this.accounts()
    if (!accounts.length) {
      logger.warn("[抖音续火花] 无在线抖音账号，定时任务跳过")
      return stats
    }
    // 实时拉取官方贴纸 名称→贴纸 id（id 由 SDK 自动解析签名直链；URL 配置则原样使用）
    const stickers = await fetchStickers().catch(() => [])
    const emojiOf = new Map()
    for (const s of stickers) {
      if (s.value) emojiOf.set(s.value, s.uriKey || s.url)
    }
    for (const selfId of accounts) {
      const users = this.usersOf(selfId)
      stats.total += users.length
      if (!users.length) continue
      const emojiList = this.emojiListOf(selfId)
      const bot = Bot[selfId]
      if (!emojiList.length) {
        stats.fail += users.length
        logger.warn(`[抖音续火花] 账号 ${selfId} 未配置火花表情，本轮跳过`)
        continue
      }
      if (!bot?.sdk?.msg) {
        stats.fail += users.length
        logger.warn(`[抖音续火花] 账号 ${selfId} 不在线，本轮跳过`)
        continue
      }
      const emojiIds = emojiList.map(e => emojiOf.get(String(e)) || e)
      const { resolved, missing } = await this.resolveTargets(selfId, users)
      stats.fail += missing.length
      for (const t of missing) {
        logger.warn(`[抖音续火花] 账号 ${selfId}：目标 ${t} 未在好友列表，本轮跳过`)
      }
      let sent = 0
      for (const t of resolved) {
        const chatId = bot.fl?.get(t.uid)?.chatId || t.chatId
        const name = t.remark || t.nickname || t.uid
        if (!chatId) {
          stats.fail++
          logger.warn(`[抖音续火花] 目标 ${name}（${t.uid}）暂无可发送会话，本轮跳过（请先与对方互发消息）`)
          continue
        }
        let ok = true
        for (const e of emojiIds) {
          try {
            await bot.sdk.msg.send(chatId, { type: "emoji", emoji: e })
            sent++
            logger.mark(`[抖音续火花] 续火花成功：${name}（账号 ${selfId}，表情 ${emojiList[emojiIds.indexOf(e)]}）`)
          } catch (err) {
            ok = false
            stats.fail++
            logger.error(`[抖音续火花] 续火花失败：${name}（账号 ${selfId}，表情 ${emojiList[emojiIds.indexOf(e)]}）${err.message}`)
          }
        }
        if (ok) stats.ok++
      }
      if (sent) logger.info(`[抖音续火花] 账号 ${selfId} 本次共续火花 ${sent} 个表情`)
    }
    return stats
  }
}

export default new Data()