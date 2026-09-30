import YAML from "yaml"
import cfg from "../../../lib/config/config.js"
import makeConfig from "../../../lib/plugins/config.js"
import fs from "node:fs/promises"
import { Plugin_Name, Plugin_Path } from "../constants/Path.js"
import _ from "lodash"

class Config {
  plugin_name = Plugin_Name
  plugin_path = Plugin_Path

  /** 初始化配置（生成 Yz/config/spark-Plugin.yaml，供锅巴面板读写） */
  async initCfg() {
    this.config = YAML.parse(await fs.readFile(`${this.plugin_path}/config/system/config.yaml`, "utf8"))

    /** 保留 Tips 注释，作为锅巴面板中文说明 */
    const keep = {}
    for (const i in this.config) {
      keep[i] = {}
      for (const j in this.config[i]) {
        if (j.endsWith("Tips")) keep[i][j] = this.config[i][j]
      }
    }

    const { config, configSave } = await makeConfig(this.plugin_name, this.config, keep, {
      replacer: i => i.replace(/(\n.+?Tips:)/g, "\n$1"),
      watch: true,
    })
    this.config = config
    this.configSave = configSave
    return this
  }

  /** 指令配置 */
  get admin() {
    return this.config.admin
  }

  /** 火花功能配置 */
  get SparkSet() {
    return this.config.SparkSet
  }

  /**
   * 修改设置（支持多级 key：Config.modify("SparkSet", id, "users", list) / ...applyFlat 传扁平路径）
   * @param {string} name 配置名
   * @param {...any} args key1, key2, ..., value
   */
  modify(name, ...args) {
    if (typeof this.config[name] != "object") this.config[name] = {}
    const keys = args.slice(0, -1)
    const value = args[args.length - 1]
    let o = this.config[name]
    for (const k of keys.slice(0, -1)) {
      if (typeof o[k] !== "object" || o[k] === null || Array.isArray(o[k])) o[k] = {}
      o = o[k]
    }
    o[keys[keys.length - 1]] = value
    return this.configSave()
  }

  /**
   * 删除配置键（支持多级路径：Config.del("SparkSet", "users")）
   * @param {string} name 配置名
   * @param {...string} keys 逐级键名
   */
  del(name, ...keys) {
    if (typeof this.config[name] !== "object" || this.config[name] === null || !keys.length) return
    let o = this.config[name]
    for (let i = 0; i < keys.length - 1; i++) {
      if (o[keys[i]] == null || typeof o[keys[i]] !== "object") return
      o = o[keys[i]]
    }
    delete o[keys[keys.length - 1]]
    return this.configSave()
  }
}

export default await new Config().initCfg()