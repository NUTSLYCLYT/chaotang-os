# 任务：fix-k0c-block-legacy-knowledge-upload-20260714

## 任务 1：封禁旧知识上传 writer

- 目标：在解析 body、创建目录、写文件、调用 RAG 之前 fail closed。
- 前置条件：K0C-1 集中 `legacy_write_tripwire` 已建立；canonical promotion 仍仅为 planned。
- 输入：任意 JSON 或 multipart `POST /api/knowledge/upload`。
- 输出：HTTP 409；`LEGACY_WRITE_BLOCKED`、entry ID、canonical target。
- 涉及文件：`backend/src/legacy_write_tripwire.py`、`backend/web/routers/knowledge.py`、`backend/tests/test_knowledge_write_tripwire.py`。
- 状态 / 数据变化：不得创建 upload 目录，不得写文件，不得调用 `KnowledgeRAG.add_directory()`。
- 验证命令与证据：先 RED、再聚焦/相邻 pytest；见 `ci_result/ci_summary.md`。
- 回滚边界：不得把恢复 legacy writer 当普通回滚；只允许后续迁入已验证 canonical promotion。
- 完成定义：409 契约、零 filesystem/RAG 写、相邻只读知识 API 无回归、inventory 保持不可删除。
