# 变更摘要：fix-release-harness-retired-route-20260713

| 字段 | 值 |
| --- | --- |
| Change ID | fix-release-harness-retired-route-20260713 |
| 类型 | fix |
| 状态 | VERIFIED_COMPLETE |
| Owner | Project Agent |
| 创建日期 | 20260713 |

## 范围

- 主线：发布 harness 的资源阁/移动检查切到首发上书房，并恢复全局资源阁入口接线。
- 文件：final-release-harness、dashboard layout、ShangshufangPage、3 条回归测试与两层 change 记录。
- 验证：3 tests passed、tsc/build 通过；真实 harness 资源阁 29 图、0 破图。整体 gate 仍因其他退役路由、401 与移动溢出为 FIX。

## 2026-07-14 独立验收

- 结论：验收合入（提交 `b9d3b80`）；当前联合发布路由测试覆盖资源入口和退役路径。
- 边界：仅验收 harness/接线代码，旧浏览器截图不作为当前 release evidence。
