# 变更摘要：docs-canon-idempotency-01-spec-20260719

| 字段 | 值 |
| --- | --- |
| Change ID | docs-canon-idempotency-01-spec-20260719 |
| 类型 | docs |
| 当前状态 | P21_REVIEW_GO / AUTHORITY_INTERPRETATION_SUPERSEDED_BY_P25 / CURRENT_ENGINEERING_SPEC / RUNTIME_NOT_AUTHORIZED |
| Owner | Chaotang OS Project Owner / Backend Request Idempotency（未来 runtime） |
| 创建日期 | 20260719 |

Packet ID: P21

## 当前范围

- `atomic-spec.md` 是 CANON-IDEMPOTENCY-01 的 current engineering authority；它不属于产品 SSOT，也不证明 runtime 已实现。
- census、领域复审、P21 原 packet review 和 CI 均保留为审计证据。
- P25 只纠正 P21 的 authority 解释与错误历史叙述，不恢复 `docs/plans/canon-readiness/`、六能力父 blueprint 或 packet catalog。

## 审计历史

- P21 最初以 `ARCHIVED_SPEC_EVIDENCE` 状态合入；其精确 B/H/R/M 和 review/approval 保留在 Git 历史中，不能改写成曾批准 current authority。
- P25 以新的 B/H/R/M 审批链把 `ARCHIVED_SPEC_EVIDENCE -> CURRENT_ENGINEERING_SPEC`，并显式 supersede P21 的 authority interpretation。
- P19 只删除冻结 allowlist 内六个旧 change 目录，没有批准或执行 ABS/PRIV/CANON 文档删除。`7daf36ba42b5266a338b128abf055e164657ac9a` 是未集成兄弟线，不是被 P19 删除的中央历史。
- 当前 `docs/README.md` 把技术实施方案、API 审计和接口对接计划归对应 harness/changes；因此 current engineering spec 留在本 change，不另建产品 SSOT。

## Runtime 边界

目标 runtime 状态仍为 `ABSENT / NOT_IMPLEMENTED / NOT_AUTHORIZED`。P21/P25 均不修改 Python/TypeScript、schema、migration、数据库、KMS、provider、真实数据或既有 plaintext key/payload。
