# 变更摘要：fix-ext-court-truth-gate-r0-w08-20260808

> 执行权威：`R0-W08 / GO / APPROVED_WORK_PACKAGE`

| 字段 | 值 |
| --- | --- |
| Change ID | fix-ext-court-truth-gate-r0-w08-20260808 |
| 状态 | IMPLEMENTED_CANDIDATE / PENDING_INTEGRATION |
| Owner | Codex |
| 日期 | 2026-08-08 |

## 目标

修复仅靠检索相关度导致的校真假绿，并收窄可信度章的标识符误报。

## 修改

- `backend/src/knowledge_vet.py`：相关度 + 主题重合 + 业务数字核对。
- `backend/src/confidence_tag.py`：跳过日期、复合标识符和标题序号。
- `backend/tests/test_court_vet_adversarial.py`：固定高分证据的可证伪契约。
