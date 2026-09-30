// 续火花配置（每账号一个独立卡片）：为每个已登录抖音账号（含已有配置的离线账号）生成一个软分组卡片。
// 锅巴插件详情页对 PluginConfigForm 启用了 softGrouping：schemas 中以 SOFT_GROUP_BEGIN 为组标记，
// 每个组在面板顶部渲染为一个 tab（卡片），卡片内只显示该账号的配置（目标用户=该账号自己的好友、火花表情、每日定时 cron）。
// 数据均为面板打开时的实时快照：目标用户拉取该账号好友，火花表情内置 22 个贴纸兜底（在线时补充官方最新贴纸）。
// 配置按 SparkSet.<账号id>.{users,sparkEmoji,dailyCron} 独立存储，互不影响；账号离线/删除不丢配置。
import { Config } from "#components"
import { douyinAccounts, onlineAccounts, stickerBase } from "./listCache.js"

const INSTALL_NOTE =
  "未检测到抖音适配器（DouYin-Plugin）：\n1) 将 DouYin-Plugin 放入 plugins/ 目录并安装其依赖；\n2) 重启 Bot 并扫码登录抖音账号；\n3) 登录成功后重新打开本面板"
const OFFLINE_NOTE =
  "当前没有在线的抖音账号：下方各账号板块会自动出现，配置在账号上线后由定时任务生效。\n可使用 #抖音bot登录 扫码上线"

/** 板块账号集合：已登录抖音账号 ∪ 已有独立配置的账号（保证离线/已删账号配置不消失） */
function accountIds() {
  const ids = new Set(douyinAccounts())
  for (const k of Object.keys(Config.SparkSet || {})) {
    if (/^\d+$/.test(k)) ids.add(k)
  }
  return [...ids]
}

/** 贴纸下拉选项：内置 22 个官方贴纸为基底 + 实时趋势补充（value 即贴纸中文名，发送时自动解析为签名直链） */
const stickerOf = stickers => (stickers ?? []).map(s => ({ label: s.label, value: s.value }))

/** 该账号好友下拉：cache.friends 为面板打开时实时快照（每项含 byId 归属账号），按账号过滤；空时给出原因提示项而非「暂无数据」 */
function friendOptions(friends, id, hasOnline) {
  const arr = (friends ?? [])
    .filter(f => String(f.byId) === String(id))
    .map(f => ({ label: f.label || String(f.uid), value: String(f.uid) }))
  if (arr.length) return arr
  const note = hasOnline
    ? `该账号暂无好友（尚未添加，或好友正拉取中，稍后重新打开面板）`
    : `账号未在线：登录后该账号的好友会出现在下拉`
  return [{ label: note, value: "__empty__", disabled: true }]
}

/** 构建「账号配置」卡片：每个账号（含在线标注）一个 SOFT_GROUP_BEGIN 软分组（详情页渲染为独立 tab 卡片），字段以 SparkSet.<id>.* 扁平存储 */
export default function buildSparkSet(cache) {
  const status = cache?.status ?? "preparing"
  const online = new Set(onlineAccounts())
  const hasOnline = online.size > 0

  const note = status === "no-adapter" ? INSTALL_NOTE : !hasOnline ? OFFLINE_NOTE : undefined
  const stickers = cache?.stickers?.length ? cache.stickers : stickerBase()
  const ids = accountIds()

  const fields = []
  for (const id of ids) {
    const isOnline = online.has(id)
    // 每个账号一个软分组卡片（顶部分组标签可点击切换）；账号数>=1 时与「基础设置」组共同启用 softGrouping 的 tab 分组
    fields.push({ component: "SOFT_GROUP_BEGIN", label: `抖音账号 ${id}${isOnline ? "（在线）" : "（离线）"}` })
    fields.push({
      field: `SparkSet.${id}.users`,
      label: `续火花目标用户`,
      defaultValue: [],
      component: "Select",
      componentProps: {
        mode: "multiple",
        options: friendOptions(cache?.friends, id, hasOnline),
        placeholder: isOnline ? "选择该账号好友（可多选）" : "账号未在线",
        optionFilterProp: "label",
        showSearch: true,
        dropdownStyle: { maxWidth: 360 },
      },
      bottomHelpMessage: `【账号 ${id}${isOnline ? "（在线）" : "（离线）"}】下拉为该账号自己的好友（含昵称/备注补全），可多选搜索；首次打开若昵称仍在补全中可能显示部分纯数字，重开本面板即显示昵称；离线时下拉暂不可选，已保存配置保留`,
    })
    fields.push({
      field: `SparkSet.${id}.sparkEmoji`,
      label: `火花表情`,
      required: true,
      defaultValue: ["续火花"],
      component: "Select",
      componentProps: {
        mode: "multiple",
        options: stickerOf(stickers),
        placeholder: "选择火花表情（可多选）",
        optionFilterProp: "label",
        showSearch: true,
        dropdownStyle: { maxWidth: 360 },
      },
      bottomHelpMessage: "该账号发送的续火花内容：官方贴纸可多选，发送时 SDK 自动解析为签名直链",
    })
    fields.push({
      field: `SparkSet.${id}.dailyCron`,
      label: `每日定时 cron`,
      defaultValue: "0 10 0 * * *",
      component: "EasyCron",
      componentProps: { placeholder: "0 10 0 * * *" },
      bottomHelpMessage: "默认每天 10:00 自动续火花；清空不启用定时，修改保存后实时生效",
    })
  }

  return [
    {
      field: "SparkSet.blank",
      label: "抖音续火花配置",
      component: "Input",
      componentProps: { placeholder: "顶部按账号分组：每个账号一张独立配置卡片", disabled: true },
      bottomHelpMessage: note || "顶部标签每个抖音账号一张独立配置卡片（账号在线标注「在线」）；点击标签切换账号配置，新账号扫码登录后重开本面板即出现新卡片",
    },
    ...fields,
  ]
}