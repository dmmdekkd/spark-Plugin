import { pathToFileURL } from "node:url"
import fs from "node:fs/promises"
import path from "node:path"
import { Plugin_Name as AppName } from "#components"

/**
 * 加载插件目录下的指令文件
 * @param {{ AppsName: string }} opts 指令目录名
 */
export async function loadApps({ AppsName }) {
  const dir = path.resolve("plugins", AppName, AppsName)
  const apps = {}
  let count = 0
  let fail = 0
  const files = (await fs.readdir(dir).catch(() => [])).filter(f => f.endsWith(".js"))
  await Promise.all(
    files.map(async f => {
      try {
        const mod = await import(pathToFileURL(path.join(dir, f)).href)
        for (const [key, value] of Object.entries(mod)) {
          if (typeof value === "function" && value.prototype && !apps[key]) {
            apps[key] = value
            count++
          }
        }
      } catch (error) {
        fail++
        logger.error(`[${AppName}] 载入插件错误 ${path.join(dir, f)}`)
        logger.error(error)
      }
    }),
  )
  return { apps, count, fail }
}

export function logSuccess(...msgs) {
  logger.info("-------------------------")
  for (const m of msgs) logger.info(m)
  logger.info("-------------------------")
}