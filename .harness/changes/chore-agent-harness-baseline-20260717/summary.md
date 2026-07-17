# 变更摘要：chore-agent-harness-baseline-20260717

| 字段 | 值 |
| --- | --- |
| Change ID | chore-agent-harness-baseline-20260717 |
| 类型 | chore |
| 状态 | VERIFIED_PARTIAL |
| Owner | Project Agent |
| 创建日期 | 20260717 |

## 范围

- 主线：M0 事实源与黄金基线冻结。
- 文件：`capability-baseline.json`、`golden-cases.md`、本 change 证据。
- 验证：记录 commit `917fbb6`、分支、能力图谱、known-red 7 项和验证命令；doctor/全量结果进入 ci_summary。
- 边界：只冻结事实，不修改运行时代码；当前工作树存在其他任务未提交改动，明确排除。
