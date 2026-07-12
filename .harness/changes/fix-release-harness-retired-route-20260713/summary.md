# 变更摘要：fix-release-harness-retired-route-20260713

| 字段 | 值 |
| --- | --- |
| Change ID | fix-release-harness-retired-route-20260713 |
| 类型 | fix |
| 状态 | READY_FOR_REVIEW |
| Owner | Project Agent |
| 创建日期 | 20260713 |

## 范围

- 主线：发布 harness 的资源阁/移动检查切到首发上书房，并恢复全局资源阁入口接线。
- 文件：final-release-harness、dashboard layout、ShangshufangPage、3 条回归测试与两层 change 记录。
- 验证：3 tests passed、tsc/build 通过；真实 harness 资源阁 29 图、0 破图。整体 gate 仍因其他退役路由、401 与移动溢出为 FIX。
