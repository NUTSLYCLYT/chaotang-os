# 任务：fix-k0c-block-legacy-court-flywheel-write-20260714

## 任务 1

- 目标：收编 `legacy-court-flywheel-writers` 中的 `feed_flywheel` 入口，使普通 CourtDoc 不能直接写知识索引。
- 前置条件：K0A/K0B 已完成；唯一 canonical terminal writer 仍是上书房 DecisionTask 主链；不实现新的 promotion writer。
- 输入：`POST /api/court/action`、史馆 CourtDoc action 生产者、`KnowledgeRAG.add_texts()` 旧调用。
- 输出：集中式 fail-closed tripwire、409 错误契约、前后端动作移除、inventory 处置更新和回归测试。
- 涉及文件：`backend/src/legacy_write_tripwire.py`、`backend/web/routers/{court,scribe}.py`、`backend/src/court_doc_builder.py`、`backend/tests/test_court_flywheel_button.py`、`frontend/src/features/scribe/{lib,components}`、capability inventory、蓝图和本 change。
- 状态 / 数据变化：不写数据库、文件、Vault 或索引；旧客户端收到 409，新客户端不再展示按钮。
- 验证命令与证据：见 `../ci_result/ci_summary.md`。
- 回滚边界：代码可回滚，但恢复 legacy 知识写权必须重新取得 owner 批准；默认只允许恢复只读兼容，不恢复旁路写。
- 完成定义：前后端生产者/类型/adapter/UI 不再暴露动作；旧请求被结构化阻断；RAG 零调用；其他动作不受影响；相邻测试、类型、build 与 doctors 通过。
