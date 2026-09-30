import { Config } from "#components"
import admin from "./admin.js"
import buildSparkSet from "./SparkSet.js"
import { refreshListCache, stickerBase } from "./listCache.js"

// 面板最近一次实时拉取结果（仅内存暂存展示用，不落盘）；贴纸用内置基底首发，首次打开即有下拉
let latest = { status: "preparing", friends: [], stickers: stickerBase() }

/** 构建锅巴面板 schema：每次被调用先触发实时拉取更新下拉（好友/贴纸），保证面板打开即最新 */
export function buildSchemas() {
  refreshListCache()
    .then(d => {
      latest = d
    })
    .catch(() => {})
  return [admin, buildSparkSet(latest)].flat()
}

/** 锅巴面板读取当前配置值：返回嵌套结构（前端按 schema.field 的 a.b.c 点号路径通过 lodash get 回填） */
export function getConfigData() {
  const { admin, SparkSet } = Config
  return {
    admin: {
      priority: admin.priority,
      reg: admin.reg,
    },
    SparkSet: {
      users: SparkSet.users,
      // 归一化为数组：锅巴 tags 多选组件需要数组回填（兼容旧版单值字符串）
      sparkEmoji: Array.isArray(SparkSet.sparkEmoji) ? SparkSet.sparkEmoji : [SparkSet.sparkEmoji],
      dailyCron: SparkSet.dailyCron,
    },
  }
}

/** 递归写入：兼容锅巴后端展平后的扁平格式（{ "SparkSet.users": [...] }）与直接传嵌套格式两种调用 */
function applyFlat(obj, prefix = "") {
  for (const [k, v] of Object.entries(obj ?? {})) {
    const path = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === "object" && !Array.isArray(v)) applyFlat(v, path)
    else Config.modify(...path.split("."), v)
  }
}

/** 锅巴面板保存配置 */
export async function setConfigData(data, { Result }) {
  applyFlat(data || {})
  return Result.ok({}, "已保存，配置已实时生效")
}

export { refreshListCache }