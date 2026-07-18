# 变更摘要：chore-agent-harness-baseline-20260717

Packet ID: P10

> P10 = 世界级 Agent Harness 执行方案（`docs/plans/chaotang-os-world-class-agent-harness-execution-plan-2026-07-17.md`）
> 的 M0 模块。approval envelope 的 packet_id 字段受 schema 约束必须是 `P[0-9]+` 形状，
> 与方案自身的 M0-M10 编号是两套不冲突的命名——机器契约用 P10，人类文档用 M0。

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
