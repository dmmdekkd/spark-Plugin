import { Config, Data } from "#components"
import { refreshListCache } from "../guoba/schemas/index.js"
import { execSync } from "node:child_process"
import { Plugin_Path } from "../constants/Path.js"

export class SparkSet extends plugin {
  constructor() {
    super({
      name: "火花设置",
      dsc: "抖音续火花管理指令",
      event: "message",
      priority: Config.admin.priority,
      rule: [
        { reg: `^#?${Config.admin.reg}(添加)\\s+(\\d+)\\s+(.+)$`, fnc: "addFor", permission: "master" },
        { reg: `^#?${Config.admin.reg}(移除|删除)\\s+(\\d+)\\s+(.+)$`, fnc: "removeFor", permission: "master" },
        { reg: `^#?${Config.admin.reg}(添加)\\s+(.+)$`, fnc: "add", permission: "master" },
        { reg: `^#?${Config.admin.reg}(移除|删除)\\s+(.+)$`, fnc: "remove", permission: "master" },
        { reg: `^#?${Config.admin.reg}列表$`, fnc: "list", permission: "master" },
        { reg: `^#?${Config.admin.reg}状态$`, fnc: "status", permission: "master" },
        { reg: `^#?${Config.admin.reg}(定时|cron)(\\s+\\d{1,2}:\\d{2}|\\s+off)?$`, fnc: "daily", permission: "master" },
        { reg: `^#?${Config.admin.reg}(定时|cron)\\s+(\\d+)\\s+(\\d{1,2}:\\d{2}|off)$`, fnc: "dailyFor", permission: "master" },
        { reg: `^#?${Config.admin.reg}(推送|手动续火花|立即续火花)$`, fnc: "push", permission: "master" },
        { reg: `^#?${Config.admin.reg}(更新|update)$`, fnc: "update", permission: "master" },
      ],
    })
  }

  /** 添加指定账号的续火花目标：#火花添加 <账号id> <昵称/备注/uid>（对离线账号无效，需在线才能反查好友） */
  async addFor() {
    const m = this.e.msg.match(new RegExp(`^#?${Config.admin.reg}添加\\s+(\\d+)\\s+(.+?)\\s*$`))
    const id = m[1]
    const key = m[2].trim()
    if (!Data.accounts().includes(id)) return this.reply(`账号 ${id} 未登录，请先使用 #抖音bot登录`), true
    if (!Data.online().includes(id)) return this.reply(`账号 ${id} 当前离线，请先使用 #抖音bot登录（离线时无法反查好友）`), true
    const f = await Data.findFriendIn(id, key).catch(() => null)
    if (!f) return this.reply(`账号 ${id} 的好友列表中未找到「${key}」\n请确认已与对方互为好友或互发过消息`), true
    const list = Data.usersOf(id)
    if (list.includes(f.uid)) return this.reply(`「${f.uid}」已在账号 ${id} 目标列表中`), true
    list.push(f.uid)
    Config.modify("SparkSet", id, "users", list)
    const show = f.remark || f.nickname || f.uid
    this.reply(
      `已添加续火花目标：${show}（uid：${f.uid}，账号 ${id}）` +
        (f.chatId ? "" : `\n⚠ 暂无可发送会话，每日定时将跳过（请先与对方互发消息建立会话）`),
    )
    return true
  }

  /** 移除指定账号的续火花目标：#火花移除 <账号id> <昵称/备注/uid> */
  async removeFor() {
    const m = this.e.msg.match(new RegExp(`^#?${Config.admin.reg}(?:移除|删除)\\s+(\\d+)\\s+(.+?)\\s*$`))
    const id = m[1]
    const key = m[2].trim()
    if (!Data.accounts().includes(id)) return this.reply(`账号 ${id} 未登录`), true
    let uid = key
    const f = await Data.findFriendIn(id, key).catch(() => null)
    if (f) uid = f.uid
    const list = Data.usersOf(id)
    const i = list.indexOf(uid)
    if (i < 0) return this.reply(`账号 ${id} 的「${key}」不在目标列表中`), true
    list.splice(i, 1)
    Config.modify("SparkSet", id, "users", list)
    this.reply(`已从账号 ${id} 移除「${key}」`)
    return true
  }

  /** 添加续火花目标用户：输入昵称/备注名/uid，通过好友列表反查确认归属账号再添加 */
  async add() {
    const key = (this.e.msg.match(new RegExp(`^#?${Config.admin.reg}添加\\s+(.+?)\\s*$`)) || [])[1]?.trim()
    const f = await Data.findFriend(key).catch(() => null)
    if (!f) {
      this.reply(`未在好友列表中找到「${key}」，已取消\n请确认已与对方互为好友或互发过消息`)
      return true
    }
    const list = Data.usersOf(f.byId || "")
    if (list.includes(f.uid)) return this.reply(`「${f.uid}」已在目标列表中`), true
    // 命中昵称且好友列表存在重名时，提示用 uid 精确指定
    const nickDupes = ((await Data.buildIndex()).byNick.get(String(key)) || []).filter(x => x.uid !== f.uid)
    list.push(f.uid)
    Config.modify("SparkSet", f.byId, "users", list)
    const show = f.remark || f.nickname || f.uid
    this.reply(
      `已添加续火花目标：${show}（uid：${f.uid}，账号 ${f.byId}）` +
        (nickDupes.length ? `\n⚠ 另有 ${nickDupes.length} 位同名，已选 uid ${f.uid}，可用 #${Config.admin.reg}添加 <账号id> <昵称/uid> 指定` : "") +
        (f.chatId ? "" : `\n⚠ 暂无可发送会话，每日定时将跳过（请先与对方互发消息建立会话）`),
    )
    return true
  }

  /** 移除续火花目标用户（昵称/备注/uid）：从全部账号配置中移除 */
  async remove() {
    const key = (this.e.msg.match(new RegExp(`^#?${Config.admin.reg}(?:移除|删除)\\s+(.+?)\\s*$`)) || [])[1]?.trim()
    let uid = key
    const f = await Data.findFriend(key).catch(() => null)
    if (f) uid = f.uid
    let removed = false
    for (const id of Data.accounts()) {
      const list = Data.usersOf(id)
      const i = list.indexOf(uid)
      if (i < 0) continue
      list.splice(i, 1)
      Config.modify("SparkSet", id, "users", list)
      removed = true
    }
    this.reply(removed ? `已移除「${key}」` : `「${key}」不在目标列表中`)
    return true
  }

  /** 查看续火花目标用户列表（分账号显示） */
  async list() {
    const lines = []
    for (const id of Data.accounts()) {
      const users = Data.usersOf(id)
      if (!users.length) continue
      const { resolved, missing } = await Data.resolveTargets(id, users).catch(() => ({
        resolved: users.map(t => ({ target: t, uid: t })),
        missing: [],
      }))
      lines.push(`账号 ${id}（${users.length} 人）：`)
      for (const r of resolved) {
        const show = r.remark ? `${r.remark}（${r.nickname || "-"}）` : r.nickname || r.uid
        lines.push(`· ${show}（uid：${r.uid}）`)
      }
      for (const t of missing) lines.push(`⚠ ${t} 未在好友列表，发送将跳过（请确认已互为好友）`)
    }
    if (!lines.length) {
      this.reply(`暂无续火花目标\n#${Config.admin.reg}添加 <昵称/备注名/uid> 或在锅巴面板配置`)
      return true
    }
    this.reply(lines.join("\n"))
    return true
  }

  /** 查看各账号配置与刷新下拉（实时接口拉取） */
  async status() {
    const accounts = Data.accounts()
    const online = new Set(Data.online())
    const cache = await refreshListCache().catch(() => null)
    const lines = ["火花配置"]
    if (!accounts.length) {
      lines.push("暂无已登录抖音账号，请先使用 #抖音bot登录 扫码登录")
    } else {
      for (const id of accounts) {
        const emoji = Data.emojiListOf(id)
        lines.push(
          `· 账号 ${id}${online.has(id) ? "（在线）" : "（离线）"}：定时 ${Data.dailyCronOf(id) || "关闭"}，表情 ${emoji.length ? `${emoji.length} 个` : "未设置"}，目标 ${Data.usersOf(id).length} 人`,
        )
      }
    }
    if (cache?.status === "no-adapter") {
      lines.push("⚠ 未安装 DouYin-Plugin 抖音适配器")
    } else if (!online.size) {
      lines.push("⚠ 所有账号离线，好友/贴纸列表未刷新")
    } else {
      lines.push(`已刷新好友 ${cache?.friends?.length ?? 0} 人、贴纸 ${cache?.stickers?.length ?? 0} 个`)
    }
    this.reply(lines.join("\n"))
    return true
  }

  /** 手动向配置的目标用户推送续火花（立即执行，不等每日定时） */
  async push() {
    const stats = await Data.dailyTask()
    if (!stats?.total) return this.reply("暂无续火花目标，请先 #火花添加 或在锅巴面板配置"), true
    this.reply(
      stats.fail
        ? `续火花完成：成功 ${stats.ok} 人，失败 ${stats.fail} 人`
        : `续火花完成：已向 ${stats.ok} 人发送火花表情`,
    )
    return true
  }

  /** 设置每日定时（所有在线账号统一设置，实时生效） */
  async daily() {
    const accounts = Data.accounts()
    if (!accounts.length) return this.reply("暂无在线抖音账号，请先登录"), true
    if (/off/i.test(this.e.msg)) {
      for (const id of accounts) Config.modify("SparkSet", id, "dailyCron", "")
      Data.syncDailyTasks()
      return this.reply("已关闭全部账号每日定时，实时生效"), true
    }
    const m = this.e.msg.match(/(\d{1,2}):(\d{2})/)
    if (!m) {
      const lines = ["各账号定时："]
      for (const id of accounts) lines.push(`· ${id}：${Data.dailyCronOf(id) || "关闭"}`)
      lines.push(`#${Config.admin.reg}定时 HH:MM 设置全部账号；#${Config.admin.reg}定时 <账号id> HH:MM 单独设置`)
      this.reply(lines.join("\n"))
      return true
    }
    if (+m[1] > 23 || +m[2] > 59) return this.reply("格式有误，应为 HH:MM（24 小时制）"), true
    const cron = `0 ${+m[2]} ${+m[1]} * * *`
    for (const id of accounts) Config.modify("SparkSet", id, "dailyCron", cron)
    Data.syncDailyTasks()
    this.reply(`已设全部账号每日定时 ${String(+m[1]).padStart(2, "0")}:${String(+m[2]).padStart(2, "0")}，实时生效`)
    return true
  }

  /** 设置指定账号的每日定时（#火花定时 <账号id> HH:MM / off） */
  async dailyFor() {
    const m = this.e.msg.match(/(\d+)\s+(off|\d{1,2}:\d{2})/)
    const id = m[1]
    const val = m[2].toLowerCase()
    if (!Bot[id]) return this.reply(`账号 ${id} 不在线`), true
    if (val === "off") {
      Config.modify("SparkSet", id, "dailyCron", "")
      Data.syncDailyTasks()
      return this.reply(`已关闭账号 ${id} 每日定时，实时生效`), true
    }
    const t = val.match(/(\d{1,2}):(\d{2})/)
    if (+t[1] > 23 || +t[2] > 59) return this.reply("格式有误，应为 HH:MM（24 小时制）"), true
    const cron = `0 ${+t[2]} ${+t[1]} * * *`
    Config.modify("SparkSet", id, "dailyCron", cron)
    Data.syncDailyTasks()
    this.reply(`已设账号 ${id} 每日定时 ${String(+t[1]).padStart(2, "0")}:${String(+t[2]).padStart(2, "0")}，实时生效`)
    return true
  }

  /** git 更新插件：拉取远程最新代码并重启 Bot 生效 */
  async update() {
    try {
      const cmd = `git -C "${Plugin_Path}"`
      execSync(`${cmd} rev-parse --git-dir`, { stdio: "pipe" })
      const branch = execSync(`${cmd} rev-parse --abbrev-ref HEAD`, { encoding: "utf8" }).trim()
      execSync(`${cmd} fetch origin ${branch}`, { stdio: "pipe" })
      const log = execSync(`${cmd} log HEAD..origin/${branch} --oneline`, { encoding: "utf8" }).trim()
      if (!log) {
        this.reply("已是最新版本")
        return true
      }
      this.reply(`检测到 ${log.split("\n").length} 条新提交，开始更新…`)
      execSync(`${cmd} reset --hard origin/${branch}`, { stdio: "pipe" })
      this.reply("更新完成，Bot 将在 3 秒后自动重启生效…")
      setTimeout(() => process.exit(0), 3000)
    } catch (err) {
      this.reply(`更新失败：${err.message.split("\n")[0]}`)
    }
    return true
  }
}