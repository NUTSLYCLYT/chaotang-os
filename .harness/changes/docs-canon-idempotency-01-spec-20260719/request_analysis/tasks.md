# 任务：docs-canon-idempotency-01-spec-20260719

## 任务 1：隔离与基线

- 目标：在独立 docs-only branch/change 上冻结 HEAD、remote、migration head 与授权边界。
- 前置条件：ABS-02/PRIV-01 已完成；业主批准继续。
- 输入：根 AGENTS、project owner/boundaries/architecture 与原本地 CANON 草案。
- 输出：change 目录与基线记录。
- 状态 / 数据变化：无 runtime/data 变化。
- 验证：`git rev-parse`、`git rev-list --left-right --count`、versions inventory。
- 状态：`COMPLETE`。

## 任务 2：current-state census

- 目标：区分 request replay、aggregate uniqueness、mutable dedup、consumer claim 与 cache。
- 输出：`idempotency-census.md`；路径/line 证据与假绿清单。
- 验证：两路独立只读调研；禁止编辑 production 文件。
- 状态：`COMPLETE`。

## 任务 3：原子规格归档

- 目标：保存 single-owner tenant/scope keyed-digest replay contract 的历史设计，不恢复产品 SSOT。
- 输出：本 change 内 `atomic-spec.md`；README/parent/catalog 保持远端删除状态。
- 完成定义：字段、UoW、rotation、retention、external effect boundary、负例、验证、rollback/STOP 自包含。
- 状态：`COMPLETE`。

## 任务 4：独立对抗复审

- 目标：分别检查架构/UoW 假绿与 privacy/key-rotation/hash-oracle。
- 输出：`request_analysis/review/architecture-review-v1..v3.md`、
  `privacy-security-review-v1..v3.md` 六份历史记录。
- 完成定义：历史 MUST_FIX 关闭只证明原草案双审完成，不授予当前产品
  `SPEC_READY / REVIEW_GO`；P21 集成必须另走 `packet_review/review-v1.md`。
- 状态：`COMPLETE / V1_NO_GO / V2_NO_GO / V3_DUAL_GO`。

## 任务 5：验证与诚实收口

- 目标：运行 focused facts regression、doctors、diff/status consistency，更新综合治理分数。
- 输出：`ci_result/ci_summary.md`、`governance-progress-assessment.md`、`rollback.md`。
- 完成定义：只提升 spec count，不提升 implementation/data/L3/cutover。
- 状态：`COMPLETE / DOCS_SCOPE_VERIFIED`。

## 任务 6：最新远端重放与发布审查

- 目标：在 P18 后远端基线保留规格成果，同时遵守 P19/P20 的证据治理与已退役 SSOT。
- 输入：checkpoint `d41c28e`、远端 `475763a`、业主保留策略。
- 输出：仅本 change 14 个 Markdown，Packet P21。
- 完成定义：三份退役 SSOT 零恢复；固定 SHA Claude GO；D6 no-ff 顺序发布。
- 状态：`REPLAYED / VALIDATED / CLAUDE_REVIEW_PENDING`。
