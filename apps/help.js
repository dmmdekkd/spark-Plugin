import { Config } from "#components"

export class SparkHelp extends plugin {
  constructor() {
    super({
      name: "火花帮助",
      dsc: "抖音续火花帮助",
      event: "message",
      priority: Config.admin.priority,
      rule: [
        { reg: `^#?${Config.admin.reg}(帮助|菜单|说明)?$`, fnc: "help", permission: "master", log: false },
      ],
    })
  }

  async help() {
    const r = Config.admin.reg
    this.reply(`抖音续火花插件
对配置的目标抖音好友，由每日定时任务主动发送"续火花"表情维持火花
支持多抖音账号，每个账号独立的续火花配置

#${r}添加 <昵称|uid>   将抖音好友加入续火花目标（自动归属对应账号）
#${r}添加 <账号id> <昵称|uid>  添加到指定账号
#${r}移除 <uid>         从全部账号移除目标
#${r}移除 <账号id> <昵称|uid>  从指定账号移除
#${r}列表          查看各账号续火花目标用户
#${r}状态          查看各账号配置与在线状态
#${r}定时 HH:MM  设置全部账号每日主动续火花时间（off 关闭）
#${r}定时 <账号id> HH:MM  单独设置指定账号定时
#${r}推送       立即向各账号目标用户手动推送续火花
#${r}更新       从远程仓库拉取插件最新代码并自动重启

目标用户列表与火花表情也可在锅巴面板配置：面板为每个抖音账号生成独立配置板块，目标用户下拉只显示该账号自己的好友，互不影响
可用 #${r}状态 查看各账号 ID`)
    return true
  }
}