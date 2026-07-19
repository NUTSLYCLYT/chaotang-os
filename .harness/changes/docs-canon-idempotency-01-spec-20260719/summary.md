# 变更摘要：docs-canon-idempotency-01-spec-20260719

| 字段 | 值 |
| --- | --- |
| Change ID | docs-canon-idempotency-01-spec-20260719 |
| 类型 | docs |
| 状态 | READY_FOR_CLAUDE_REVIEW_V2 / ARCHIVED_SPEC_EVIDENCE / NOT_ACTIVE_PRODUCT_SSOT / RUNTIME_NOT_AUTHORIZED |
| Owner | Chaotang OS Project Owner / Backend Request Idempotency (future runtime) |
| 创建日期 | 20260719 |

Packet ID: P21

## 范围

- 主线：根项目护栏中的历史治理规格证据；不恢复已退役的 canonical readiness 产品文档，
  不进入 backend runtime。
- 文件：本 change 目录内保留 atomic spec、current-mechanism census、治理进度、rollback
  与架构/隐私双审历史，共 14 个 Markdown；不修改当前产品文档。
- 验证：独立 current-state census、架构/隐私对抗复审、focused 现有事实回归、root/backend doctor、`git diff --check`。

## 单一状态变化

`未集成的本地规格草案 -> 可审计的历史规格证据`。

这不把 CANON 重新设为当前产品 SSOT，也不是 `ABSENT -> TENANT_SCOPE_FAIL_CLOSED` 的
runtime 实现；后者仍为 `NOT_IMPLEMENTED / NOT_AUTHORIZED`。

## 基线与隔离

- 原始本地 checkpoint：`d41c28ea72ad23b5f33c98c53f1c7a0d5400a34e`。
- 发布基线：`origin/feature-chaotang-ext@475763a2d24308ca793b44914c8d4f38be651a05`。
- 业主已明确裁定：保留本 change 的新规格与双审证据，不恢复远端已删除的
  `docs/plans/canon-readiness/`、parent blueprint 或 packet catalog。
- 原规格从已退役产品目录迁入本 change 的 `atomic-spec.md`；原三份 SSOT 修改被丢弃。
- 静态 migration head：`016_schema_literal_contract_guard`；本文不创建或保留未来 revision 编号。
- Claude v1 固定 SHA 复审判 `PACKET_REVIEW_NO_GO`：规范性范围残留“更新退役 SSOT”
  构成 MEDIUM；另有三项 LOW。v2 已删除该授权歧义，并修正历史 review 路径、
  `SPEC_READY` 限定和历史评分表列名。

## 禁止事项

- 不改 Python/TypeScript、schema、migration、数据库、provider、feature flag、KMS 或真实数据。
- 不迁移/清理既有 plaintext key、payload、JSONL、文件 store。
- 不把 spec、现有测试通过、cache hit、unique constraint 或 outbox claim写成 canonical runtime 已完成。

PACKET_P21_READY_FOR_CLAUDE_REVIEW_V2
