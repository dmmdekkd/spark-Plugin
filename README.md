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

- `#火花添加 <昵称/备注/uid>` 将抖音好友加入续火花目标（自动归属其所在账号，支持昵称、备注名或 uid）
- `#火花添加 <账号id> <昵称/备注/uid>` 添加到指定账号（须该账号在线）
- `#火花移除 <昵称/备注/uid>` 将目标移出续火花列表（跨全部账号）
- `#火花移除 <账号id> <昵称/备注/uid>` 仅从指定账号移除
- `#火花列表` 分账号查看续火花目标用户
- `#火花状态` 查看各账号配置（含在线/离线状态）
- `#火花定时 HH:MM` 设置全部账号每日主动续火花时间（`off` 关闭）
- `#火花定时 <账号id> HH:MM` 仅设置指定账号的定时（`off` 关闭）
- `#火花推送` 立即向全部账号的目标用户手动推送续火花
- `#火花更新` 更新插件（更新成功自动重启）

指令前缀 `火花` 可在配置中修改。

## 配置说明

配置文件 `Yz/config/spark-Plugin.yaml`（或通过锅巴面板修改）：

| 配置项 | 默认值 | 说明 |
| --- | --- | --- |
| `admin.priority` | `1000` | 插件优先级，数字越小越优先 |
| `admin.reg` | `火花` | 指令前缀 |
| `SparkSet.<账号id>.users` | `[]` | 该账号的续火花目标用户（存 uid），每日由该账号发送 |
| `SparkSet.<账号id>.sparkEmoji` | `["续火花"]` | 该账号发送的火花表情，支持多个：官方贴纸名称或任意图片 URL |
| `SparkSet.<账号id>.dailyCron` | `0 10 0 * * *` | 该账号每日定时任务 cron（node-schedule 五段式），清空关闭 |

每个在线抖音账号一组独立配置；修改实时生效，无需重启。旧版全局 `SparkSet.users/sparkEmoji/dailyCron` 会自动迁移到各账号。

## 锅巴面板（可选）

需安装 [Guoba-Plugin](https://github.com/Guoba-Plugin/Guoba-Plugin)：

- **每账号独立配置板块**：打开插件配置页，面板为每个已登录抖音账号（含已有配置的离线账号）生成一块配置区，每块含「续火花目标用户 / 火花表情 / 每日定时 cron」
- 每个账号一份独立配置，修改某一账号不影响其他账号；配置只在对应账号执行；账号离线时板块保留（下拉暂不可选），上线后定时任务自动生效
- 目标用户与火花表情均为**下拉选择且实时**：目标用户下拉只显示**该账号自己的好友**（备注名/昵称显示，可搜索多选），火花表情为官方贴纸（内置 22 个可多选，在线时补充最新），数据为打开面板时实时获取；新账号扫码登录后重开面板即出现新板块
- 可用 `#火花状态` 查看各账号 ID 与配置

## 相关链接

- 许可证：MIT（[LICENSE](LICENSE)）
- DouYin-Plugin（抖音适配器）：https://github.com/dmmdekkd/DouYin-Plugin
- TRSS-Yunzai：https://github.com/TimeRainStarSky/Yunzai