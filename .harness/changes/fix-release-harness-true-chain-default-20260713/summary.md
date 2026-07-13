# 变更摘要：fix-release-harness-true-chain-default-20260713

| 字段 | 值 |
| --- | --- |
| Change ID | fix-release-harness-true-chain-default-20260713 |
| 类型 | fix |
| 状态 | VERIFIED_COMPLETE |
| Owner | Project Agent |
| 创建日期 | 20260713 |

## 范围

- 主线：true-chain 默认必须执行，只有显式 HARNESS_SKIP_TRUE_CHAIN=1 才允许调试跳过。
- 文件：final-release-harness、回归测试与两层 change。
- 验证：5 tests；strict true-chain PROD、study-edict PROD、页面/移动 9/9、decision PROD。

## 2026-07-14 独立验收

- 结论：验收合入（提交 `e2aba40`）；当前联合发布路由测试证明只有显式 `HARNESS_SKIP_TRUE_CHAIN=1` 才跳过。
- 边界：上方 PROD 是历史快照，已被当前 `prod:doctor=STOP` 取代。
