// 基础设置（静态字段）
export default [
  {
    component: "SOFT_GROUP_BEGIN",
    label: "基础设置",
  },
  {
    field: "admin.priority",
    label: "插件优先级",
    tooltip: "插件优先级，数字越小越优先",
    componentProps: {
      min: 0,
    },
    component: "InputNumber",
  },
  {
    field: "admin.reg",
    label: "指令前缀",
    tooltip: "指令前缀（#火花添加 / #火花帮助 等）",
    component: "Input",
  },
]