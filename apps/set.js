import { Config, Data } from "#components"
import { refreshListCache } from "../guoba/schemas/index.js"
import { execSync } from "node:child_process"
import { Plugin_Path } from "../constants/Path.js"
import loader from "../../../lib/plugins/loader.js"

export class SparkSet extends plugin {
  constructor() {
    super({
      name: "火花设置",
      dsc: "抖音续火花管理指令",
      event: "message",
      priority: Config.admin.priority,
      rule: [
        { reg: `^#?${Config.admin.reg}(添加)\\s+(\\S+)$`, fnc: "add", permission: "master" },
        { reg: `^#?${Config.admin.reg}(移除|删除)\\s+(\\S+)$`, fnc: "remove", permission: "master" },
        { reg: `^#?${Config.admin.reg}列表$`, fnc: "list", permission: "master" },
        { reg: `^#?${Config.admin.reg}状态$`, fnc: "status", permission: "master" },
        { reg: `^#?${Config.admin.reg}(定时|cron)(\\s+\\d{1,2}:\\d{2}|\\s+off)?$`, fnc: "daily", permission: "master" },
        { reg: `^#?${Config.admin.reg}(推送|手动续火花|立即续火花)$`, fnc: "push", permission: "master" },
        { reg: `^#?${Config.admin.reg}(更新|update)$`, fnc: "update", permission: "master" },
      ],
    })
  }

  /** 添加续火花目标用户：输入昵称/备注名/uid，通过好友列表反查确认对应好友再添加 */
  async add() {
    const key = (this.e.msg.match(/\S+$/) || [])[0]
    const users = Data.users()
    if (users.includes(key)) return this.reply(`「${key}」已在目标列表中`), true
    const f = await Data.findFriend(key).catch(() => null)
    if (!f) {
      this.reply(`未在好友列表中找到「${key}」，已取消\n请确认已与对方互为好友或互发过消息`)
      return true
    }
    const store = f.uid
    if (users.includes(store)) return this.reply(`「${store}」已在目标列表中`), true
    // 命中昵称且好友列表存在重名时，提示用 uid 精确指定
    const nickDupes = ((await Data.buildIndex()).byNick.get(String(key)) || []).filter(x => x.uid !== f.uid)
    users.push(store)
    Config.modify("SparkSet", "users", users)
    const show = f.remark || f.nickname || f.uid
    this.reply(
      `已添加续火花目标：${show}（uid：${f.uid}）` +
        (nickDupes.length ? `\n⚠ 另有 ${nickDupes.length} 位同名，已选 uid ${f.uid}，可用 #${Config.admin.reg}添加 <uid> 指定` : "") +
        (f.chatId ? "" : `\n⚠ 暂无可发送会话，每日定时将跳过（请先与对方互发消息建立会话）`),
    )
    return true
  }

  /** 移除续火花目标用户（昵称/备注/uid） */
  async remove() {
    const key = (this.e.msg.match(/\S+$/) || [])[0]
    const users = Data.users()
    // 支持昵称/备注：直接输入的不是 uid 时先反查好友得到真实 uid 再匹配
    let uid = key
    if (!users.includes(key)) {
      const f = await Data.findFriend(key).catch(() => null)
      if (f) uid = f.uid
    }
    const i = users.indexOf(uid)
    if (i < 0) return this.reply(`「${key}」不在目标列表中`), true
    users.splice(i, 1)
    Config.modify("SparkSet", "users", users)
    this.reply(`已移除「${key}」`)
    return true
  }

  /** 查看续火花目标用户列表（通过好友列表缓存反查 uid 对照显示） */
  async list() {
    const users = Data.users()
    if (!users.length) {
      this.reply(`暂无续火花目标\n#${Config.admin.reg}添加 <昵称/备注名/uid> 或在锅巴面板配置`)
      return true
    }
    const { resolved, missing } = await Data.resolveTargets(users).catch(() => ({
      resolved: users.map(t => ({ target: t, uid: t })),
      missing: [],
    }))
    const lines = [`续火花目标（${users.length} 人）：`]
    for (const r of resolved) {
      const show = r.remark ? `${r.remark}（${r.nickname || "-"}）` : r.nickname || r.uid
      lines.push(`· ${show}（uid：${r.uid}）`)
    }
    for (const t of missing) lines.push(`⚠ ${t} 未在好友列表，发送将跳过（请确认已互为好友）`)
    this.reply(lines.join("\n"))
    return true
  }

  /** 查看全局配置与在线账号（同时刷新锅巴下拉列表缓存） */
  async status() {
    const cfg = Config.SparkSet
    const accounts = Data.accounts()
    const online = accounts.filter(id => Bot[id])
    // 用真实接口刷新锅巴面板下拉缓存（好友/贴纸列表）
    const cache = await refreshListCache().catch(() => null)
    const lines = [
      "火花配置",
      `每日定时：${cfg.dailyCron || "关闭"}`,
      `火花表情：${(Array.isArray(cfg.sparkEmoji) ? cfg.sparkEmoji.length : cfg.sparkEmoji) ? "已设置" : "未设置"}`,
      `目标用户（${Data.users().length} 人）：${Data.users().join("、") || "无"}`,
      `抖音在线（${online.length}/${accounts.length}）：${online.join("、") || "无"}`,
    ]
    if (cache?.status === "no-adapter") {
      lines.push("⚠ 未安装 DouYin-Plugin 抖音适配器")
    } else if (cache?.status === "preparing") {
      lines.push("抖音 Bot 准备中，请稍后再试")
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

  /** 设置每日定时主动续火花（实时生效，无需重启） */
  async daily() {
    if (/off/i.test(this.e.msg)) {
      Config.modify("SparkSet", "dailyCron", "")
      this.resetTask("")
      return this.reply("已关闭每日定时，实时生效"), true
    }
    const m = this.e.msg.match(/(\d{1,2}):(\d{2})/)
    if (!m)
      return (
        this.reply(
          `当前定时：${Config.SparkSet.dailyCron || "关闭"}\n#${Config.admin.reg}定时 HH:MM 或 #${Config.admin.reg}定时 off`,
        ),
        true
      )
    if (+m[1] > 23 || +m[2] > 59) return this.reply("格式有误，应为 HH:MM（24 小时制）"), true
    const cron = `0 ${+m[2]} ${+m[1]} * * *`
    Config.modify("SparkSet", "dailyCron", cron)
    this.resetTask(cron)
    this.reply(`已设每日定时 ${String(+m[1]).padStart(2, "0")}:${String(+m[2]).padStart(2, "0")}，实时生效`)
    return true
  }

  /** 实时重载"每日主动续火花"定时任务：改配置立即生效，无需重启 Bot */
  resetTask(cron) {
    const task = (loader.task || []).find(t => t.name === "每日主动续火花")
    if (!task) return
    if (cron) {
      task.cron = cron
      loader.createTask()
    } else {
      task.job?.cancel?.()
    }
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