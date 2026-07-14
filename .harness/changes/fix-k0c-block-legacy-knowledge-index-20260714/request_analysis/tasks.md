# 任务：fix-k0c-block-legacy-knowledge-index-20260714

## 任务 1：封禁旧知识索引 writer

- 目标：让 `/api/knowledge/index` 无法绕过 canonical promotion 直接重建 RAG。
- 前置条件：K0C-2 已封禁同入口族 upload；集中 tripwire 已登记该 writer family。
- 输入：认证后的 `POST /api/knowledge/index`。
- 输出：HTTP 409，`LEGACY_WRITE_BLOCKED`、entry ID、canonical target。
- 涉及文件：`backend/web/routers/knowledge.py`、`backend/tests/test_knowledge_write_tripwire.py`、跨线契约与治理文档。
- 状态 / 数据变化：不得调用 `KnowledgeRAG.add_directory()`。
- 验证命令与证据：见 `ci_result/ci_summary.md`。
- 回滚边界：不得恢复 API 直接索引；后续仅允许 canonical promotion 消费者拥有写权。
- 完成定义：有效 RED→GREEN、RAG 零调用、OpenAPI/前端快照仅声明 409、相邻只读 API 无回归。
