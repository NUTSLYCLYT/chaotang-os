# 变更摘要：fix-alembic-authority-review-hardening-20260717

| 字段 | 值 |
| --- | --- |
| Change ID | fix-alembic-authority-review-hardening-20260717 |
| 类型 | fix |
| 状态 | READY_FOR_CLAUDE_REVIEW |
| Owner | Project Agent |
| 创建日期 | 20260717 |

Packet ID: P5.1

## 范围

- 主线：对已进入 `feature-chaotang-ext` 的 P5 schema authority 做独立审查补强，
  不重写已落地的 outbox/运行恢复实现。
- 文件：`backend/src/schema_authority.py`、`backend/src/schema_adoption.py`、
  新增验证型 `backend/alembic/versions/015_schema_contract_guard.py`、operator/service 契约、
  定向测试与本变更记录。
- 验证：严格 RED→GREEN；只用临时 SQLite；迁移/adoption/runtime 定向回归、
  backend/root doctor、独立 packet review。
- NO_GO 回修：SQL 规范化只折叠引号外语法；单/双引号内字面量保持原样，
  `CHECK IN ('OPEN')` 与 `IN ('open')`、default `'OPEN'` 与 `'open'` 均不再等价。
- 旧 `packet_review/review-v1.md` 的 GO 已被可复现实证覆盖失效；本状态只表示修复完成、
  等待新的 Claude SHA-bound review，不构成 GO，也不允许合入 ext。
