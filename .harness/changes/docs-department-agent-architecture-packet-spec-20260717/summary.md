# 变更摘要：docs-department-agent-architecture-packet-spec-20260717

Packet ID: P6.1

| 字段 | 值 |
| --- | --- |
| Change ID | docs-department-agent-architecture-packet-spec-20260717 |
| 类型 | docs |
| 状态 | VERIFIED_COMPLETE |
| Owner | Claude Code（只读产出，不执行） |
| 创建日期 | 20260717 |

## 范围

- 主线：把 `docs/plans/chaotang-os-department-agent-architecture-2026-07-17.md` 设计提案
  拆成 5 个可独立验收的 Packet 任务书（见 `packet-spec.md`），供业主裁决是否/何时
  交 Codex 执行。本 change 本身只产出文档，不修改任何运行时代码。
- 文件：`packet-spec.md`（5 个 Packet 的范围/步骤/验收/回滚/阻断条件）。
- 验证：文档产出，无代码验证；每个 Packet 各自的验收标准写在 `packet-spec.md` 内。

## 队列位置（未决，需业主裁决）

本 change 涉及的 5 个 Packet 全部是 FULL_COURT_V1 已冻结功能宇宙之外的净新范围。
按 `execution-priority-ruling.md` 现行纪律，净新范围默认排在主线归并战役
（P0–P9，当前卡在 P6/P7 红灯未清零）之后，进 `FULL_COURT_V2_BACKLOG.md`。
本 change 只是把设计写清楚，**不代表已获准插队**——是否插队、插几个、何时插，
由业主在 `packet-spec.md` 末尾"队列裁决"一节逐项勾选。PKT-1 已获业主批准并
已由 Codex 实现（见 `feat-gongbu-storage-pipeline-engine-20260717`）；PKT-2~5
后续也已实现并独立复审（见各自 change 目录）。
