// 续火花配置（面板每次打开自动从接口实时拉取好友/贴纸下拉，无需手动刷新）
const INSTALL_NOTE =
  "未检测到抖音适配器（DouYin-Plugin）：\n1) 将 DouYin-Plugin 放入 plugins/ 目录并安装其依赖；\n2) 重启 Bot 并扫码登录抖音账号；\n3) 登录成功后重新打开本面板，下拉即自动填充"

const PREPARING_NOTE = "抖音 Bot 准备中：好友/贴纸正在从接口拉取，请稍候重新打开面板"

const EMPTY_NOTE =
  "未获取到数据：可能尚未与好友互发过消息（非好友不会出现在列表）。\n重新打开面板会自动重试，也可手动输入昵称 / 图片 URL"

export default function buildSparkSet(cache) {
  const friends = cache?.friends ?? []
  const stickers = cache?.stickers ?? []
  const status = cache?.status ?? "preparing"

  // ===== 续火花目标用户 =====
  let usersComponent = "GTags"
  let usersProps = { allowAdd: true, allowDel: true, placeholder: "暂无列表，可手动输入昵称/uid" }
  let usersBottom
  if (friends.length) {
    usersComponent = "Select"
    usersProps = { mode: "multiple", options: friends, placeholder: "从好友列表选择续火花目标" }
  } else if (status === "no-adapter") {
    usersBottom = INSTALL_NOTE
  } else if (status === "preparing") {
    usersBottom = PREPARING_NOTE
  } else {
    usersBottom = EMPTY_NOTE
  }

  // ===== 火花表情 =====
  let emojiComponent = "Input"
  let emojiProps = { placeholder: "可手动输入图片 URL" }
  let emojiBottom
  if (stickers.length) {
    emojiComponent = "Select"
    emojiProps = { mode: "tags", options: stickers, placeholder: "选择官方贴纸（展示名称）或输入图片 URL", allowClear: true }
  } else if (status === "no-adapter") {
    emojiBottom = INSTALL_NOTE
  } else if (status === "preparing") {
    emojiBottom = PREPARING_NOTE
  } else {
    emojiBottom = EMPTY_NOTE
  }

  return [
    {
      component: "SOFT_GROUP_BEGIN",
      label: "火花配置",
    },
    {
      field: "SparkSet.users",
      label: "续火花目标用户",
      tooltip: "抖音好友列表（下拉显示备注/昵称），每日定时会向这些用户主动发送续火花表情",
      component: usersComponent,
      componentProps: usersProps,
      bottomHelpMessage: usersBottom,
    },
    {
      field: "SparkSet.sparkEmoji",
      label: "火花表情",
      required: true,
      tooltip: "续火花表情：支持多个，下拉多选官方贴纸（自动转对应图片发送），也可直接输入任意图片 URL",
      component: emojiComponent,
      componentProps: emojiProps,
      bottomHelpMessage: emojiBottom,
    },
    {
      field: "SparkSet.dailyCron",
      label: "每日定时任务 cron",
      required: true,
      tooltip: "每日定时主动续火花时间（node-schedule 格式）：可在右侧预设中选择，清空关闭定时，修改实时生效",
      componentProps: {
        placeholder: "0 10 0 * * *",
      },
      component: "EasyCron",
    },
  ]
}