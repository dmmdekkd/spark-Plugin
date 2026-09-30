import pluginInfo from "./pluginInfo.js"
import { buildSchemas, getConfigData, setConfigData } from "./schemas/index.js"

export function supportGuoba() {
  // 每次锅巴面板请求都会重新执行本函数：dynamic 读取好友/贴纸缓存，保证下拉列表最新
  return {
    pluginInfo,
    configInfo: {
      schemas: buildSchemas(),
      getConfigData,
      setConfigData,
    },
  }
}