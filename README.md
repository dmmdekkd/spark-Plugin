<div align="center">

# Spark Plugin

抖音「续火花」插件

基于 [DouYin-Plugin](https://github.com/dmmdekkd/DouYin-Plugin) 适配器，对配置的抖音好友每日定时主动发送「续火花」表情维持火花

</div>

## 🐬 安装教程

需要先准备 [TRSS-Yunzai](https://github.com/TimeRainStarSky/Yunzai) 与 [DouYin-Plugin](../../../Yunzai/plugins/DouYin-Plugin)（抖音适配器）

<details>
  <summary>展开/收起</summary>

#### 🔧 Yunzai 根目录执行命令安装

推荐使用 git 进行安装，以方便后续使用 `#火花更新` 升级：

```bash
git clone --depth=1 https://github.com/dmmdekkd/Spark-Plugin.git ./plugins/spark-Plugin
```

> [!NOTE]
> 如果你的网络环境较差，无法连接到 Github，可以使用代理加速下载服务
>
> ```bash
> git clone --depth=1 https://ghproxy.521002.xyz/https://github.com/dmmdekkd/Spark-Plugin.git ./plugins/spark-Plugin
> ```

</details>

## 使用教程

- `#火花添加 <昵称/备注/uid>` 将抖音好友加入续火花目标（支持昵称、备注名或 uid）
- `#火花移除 <昵称/备注/uid>` 将目标移出续火花列表
- `#火花列表` 查看续火花目标用户
- `#火花状态` 查看全局配置与在线账号
- `#火花定时 HH:MM` 设置每日主动续火花时间（`off` 关闭，修改实时生效）
- `#火花推送` 立即向列表内目标用户手动推送续火花
- `#火花更新` 更新插件（更新成功自动重启）

指令前缀 `火花` 可在配置中修改。

## 配置说明

配置文件 `Yz/config/spark-Plugin.yaml`（或通过锅巴面板修改）：

- `admin.reg` 指令前缀，默认 `火花`
- `admin.priority` 插件优先级，默认 `1000`
- `SparkSet.users` 续火花目标用户列表（存 uid），默认 `[]`
- `SparkSet.sparkEmoji` 火花表情，支持多个（官方贴纸名称或任意图片 URL），默认 `["续火花"]`
- `SparkSet.dailyCron` 每日定时任务 cron（node-schedule 五段式），默认 `0 10 0 * * *`，清空关闭

配置修改实时生效，无需重启。

## 锅巴面板（可选）

需安装 [Guoba-Plugin](https://github.com/Guoba-Plugin/Guoba-Plugin)：

- 好友列表：按备注名（昵称）下拉选择，数据从接口实时拉取，打开面板即最新
- 火花表情：内置 22 个官方贴纸（含续火花/比心/在干嘛/笑死/麻了/摇骰子等）可多选，也可直接填图片 URL，发送时 SDK 自动解析为签名直链
- 配置保存后实时生效

## 相关链接

- 许可证：MIT（[LICENSE](LICENSE)）
- DouYin-Plugin（抖音适配器）：https://github.com/dmmdekkd/DouYin-Plugin
- TRSS-Yunzai：https://github.com/TimeRainStarSky/Yunzai