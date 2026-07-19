# 变更摘要：fix-canon-idempotency-authority-p25-20260719

Packet ID: P25

| 字段 | 值 |
| --- | --- |
| Change ID | fix-canon-idempotency-authority-p25-20260719 |
| 类型 | fix |
| 状态 | AUTHORITY_CORRECTION_READY / PACKET_REVIEW_PENDING / RUNTIME_NOT_AUTHORIZED |
| Owner | Chaotang OS Project Owner |
| 创建日期 | 20260719 |

## 单一状态变化

`CANON-IDEMPOTENCY-01 ARCHIVED_SPEC_EVIDENCE -> CURRENT_ENGINEERING_SPEC`。

P25 只纠正工程规格 authority 与历史叙述；Idempotency runtime 仍为 `ABSENT / NOT_IMPLEMENTED / NOT_AUTHORIZED`。

## 范围

- 新增本 P25 root change，记录 P19/7daf/P21 裁决、执行计划、验证和回滚。
- 更新 P21 当前树中的 `atomic-spec.md`、summary、request spec、tasks、rollback、governance assessment 和 CI 解释。
- 保持 P21 的 `packet_review/review-v1.md` 与 `approval-v1.json` 原样，避免伪造 retroactive approval。
- 不新增/恢复 `docs/plans`，不改 frontend/backend runtime、tests、schema、migration、数据库或真实数据。

## 基线

- P25 开工中央 base：`023f198077a0fb6928f554ed1be81b1afb819f40`。
- P21 merge：`f6a73f3c`；P19 merge：`08d296aa`；未集成兄弟治理提交：`7daf36ba`。
- 精确证据与路径 allowlist 见 `authority-adjudication.md`。

## 验证门

- focused current-facts regression、root/backend doctor、diff/path/whitespace 检查。
- 固定 B/H 的独立 packet review，确认 P21 历史审批不可变、P25 当前 authority 唯一且无 runtime 越权。
- review-only R、approval 和 no-ff candidate M 必须通过 D6 后才能上传中央分支。
