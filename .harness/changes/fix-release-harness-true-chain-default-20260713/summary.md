# 变更摘要：fix-release-harness-true-chain-default-20260713

| 字段 | 值 |
| --- | --- |
| Change ID | fix-release-harness-true-chain-default-20260713 |
| 类型 | fix |
| 状态 | READY_FOR_REVIEW |
| Owner | Project Agent |
| 创建日期 | 20260713 |

## 范围

- 主线：true-chain 默认必须执行，只有显式 HARNESS_SKIP_TRUE_CHAIN=1 才允许调试跳过。
- 文件：final-release-harness、回归测试与两层 change。
- 验证：5 tests；strict true-chain PROD、study-edict PROD、页面/移动 9/9、decision PROD。
