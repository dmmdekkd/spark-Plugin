import { Config, Data } from "#components"

export class Spark extends plugin {
  constructor() {
    super({
      name: "spark-Plugin",
      dsc: "对配置的抖音好友每日定时主动发送续火花表情",
      event: "message",
      priority: Config.admin.priority,
      // 定时任务动态生成：每个在线账号按其配置的 dailyCron 独立建任务
      task: [],
    })
    // 立即 + 登录就绪后（15s）重建各账号定时任务
    Data.syncDailyTasks()
    setTimeout(() => Data.syncDailyTasks(), 15000)
  }
}