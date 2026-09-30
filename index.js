import { Plugin_Name as AppName } from "#components"
import { loadApps, logSuccess } from "./lib/load/loadApps.js"

let apps,
  count = 0,
  fail = 0

try {
  const r = await loadApps({ AppsName: "apps" })
  apps = r.apps
  count = r.count
  fail = r.fail
  logSuccess(`${AppName} 载入成功！`, `共加载 ${count} 个指令文件，${fail} 个失败`)
} catch (error) {
  logger.error(`${AppName} 插件加载失败：`, error)
}

export { apps }