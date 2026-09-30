import { fileURLToPath } from "node:url"
import { join, dirname } from "node:path"

const Plugin_Path = join(dirname(fileURLToPath(import.meta.url)), "..").replace(/\\/g, "/")

export default {
  name: "spark-Plugin",
  title: "抖音续火花",
  description: "对配置的抖音好友，每日定时主动发送续火花表情维持火花",
  author: "DouYin",
  // 锅巴面板 web 图标：使用官方"续火花"贴纸图片（已下载到本地，避免直链 403）
  iconPath: join(Plugin_Path, "resources", "images", "icon.png"),
  link: null,
  isV3: true,
  isV2: false,
  showInMenu: "auto",
}