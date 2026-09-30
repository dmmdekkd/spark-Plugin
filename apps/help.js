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

#${r}添加 <昵称|uid>   将抖音好友加入续火花目标
#${r}移除 <uid>         将目标移出续火花列表
#${r}列表          查看续火花目标用户
#${r}状态          查看全局配置与在线账号
#${r}定时 HH:MM  设置每日主动续火花时间（off 关闭）
#${r}推送       立即向列表内目标用户手动推送续火花
#${r}更新       从远程仓库拉取插件最新代码并自动重启

目标用户列表与火花表情也可在锅巴面板配置`)
    return true
  }
}