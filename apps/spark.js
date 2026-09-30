import { Config, Data } from "#components"
import { refreshListCache } from "../guoba/schemas/index.js"

export class Spark extends plugin {
  constructor() {
    super({
      name: "spark-Plugin",
      dsc: "对配置的抖音好友每日定时主动发送续火花表情",
      event: "message",
      priority: Config.admin.priority,
      /** 每日定时任务：默认每天 00:10 对配置的全部目标用户执行主动续火花 */
      task: [
        {
          name: "每日主动续火花",
          cron: Config.SparkSet.dailyCron || "0 10 0 * * *",
          fnc: async () => {
            // 每次执行前用真实接口刷新下拉缓存（新增好友后面板即可选择）
            await refreshListCache().catch(() => {})
            await Data.dailyTask()
          },
          log: false,
        },
      ],
    })
    // Bot 登录完成后用真实接口刷新下拉缓存（好友/贴纸列表）
    setTimeout(() => refreshListCache().catch(() => {}), 15000)
  }
}