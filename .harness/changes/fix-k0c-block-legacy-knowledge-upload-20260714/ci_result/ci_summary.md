# CI 摘要：fix-k0c-block-legacy-knowledge-upload-20260714

## 命令

| 命令 | 退出码 | 结果 | 证据覆盖范围 | 证据位置 / 时间 |
| --- | ---: | --- | --- | --- |
| `pytest tests/test_knowledge_write_tripwire.py`（实现前） | 1 | RED：期望 409，实际 201 | 旧 upload 文件/RAG 双写入口可复现 | 2026-07-14 本地终端 |
| `pytest` 两个知识纵切文件 | 0 | 30 passed；2 个既有 duplicate-operation-id warnings | 409、OpenAPI 无 201、RAG 零调用；相邻只读契约 | 2026-07-14 本地终端 |
| `pnpm --dir frontend exec tsc --noEmit` | 0 | 0 errors | 前端 OpenAPI 快照类型 | 2026-07-14 本地终端 |
| `node --test scripts/capability-entry-governance.nodetest.mjs` | 0 | 3 passed | inventory schema、唯一 canonical、不可删除门 | 2026-07-14 本地终端 |
| `python3 -m py_compile ...` | 0 | PASS | tripwire/router/test Python 语法 | 2026-07-14 本地终端 |
| root/frontend/backend harness doctors | 0 | 全部 0 errors, 0 warnings | 三层护栏与 change record | 2026-07-14 本地终端 |
| `git diff --check` + scoped secret scan | 0 | PASS；secret match 0 | diff 完整性与新增敏感信息 | 2026-07-14 本地终端 |

## 结果

K0C-2 已验证：`POST /api/knowledge/upload` 不再接收/解析请求体，也不再拥有目录、文件或 RAG 写实现，只返回结构化 409。测试证明 `KnowledgeRAG.add_directory()` 零调用；OpenAPI 默认状态改为 409，不再宣称成功 201。inventory 登记为 `MIGRATE_REQUIRED`，replacement 仍为 `PLANNED`，telemetry 仍为 `null`。

## 未验证项

- 同入口族 `POST /api/knowledge/index` 仍会直接调用 RAG，明确留给 K0C-3；K0C 未完成。
- multipart 分支由 tripwire 的代码顺序统一覆盖，本轮 RED→GREEN 使用 JSON 请求；尚未增加独立 multipart 重放测试。
- 当前 3050 是 foreign workspace，本轮未使用其提供浏览器证据。
- 全量 7 + 13 个既有测试失败属于第二主闭环，本纵切只运行聚焦与相邻回归。
- canonical archive/outcome promotion 尚未实现，不能把 409 当作业务闭环已经迁移。
- OpenAPI 生成时仍报告 governance compatibility router 的 2 个既有 duplicate operation ID warnings；与本入口无关，本轮未修复。

## Diff 与回滚复核

- changed files：集中 backend tripwire、knowledge router/test/迁移说明、frontend OpenAPI 快照、root inventory/wiki/blueprint/change evidence。
- diff review：不删除知识内容、不修改 schema/database、不改变只读 API；只阻断一个 legacy writer。
- 回滚是否演练：未恢复 legacy writer；恢复会重新制造双主写，不属于安全回滚。后续迁移仅能指向已验证 canonical promotion。

## 完成定义映射

| DoD | 证据 | 状态 |
| --- | --- | --- |
| upload fail closed | 409 exact envelope | PASS |
| filesystem/RAG 零写 | handler 写代码已移除；RAG `assert_not_called` | PASS |
| API/前端契约同步 | OpenAPI 仅 409 无 201；frontend tsc 0 errors | PASS |
| 相邻知识路由无新增回归 | 28 passed | PASS |
| inventory 不漂白 | governance 3 passed；telemetry null；replacement planned | PASS |
| `/knowledge/index` 单写者证明 | 本轮明确不实施 | PENDING_K0C_3 |
| 浏览器/可信发布身份 | foreign 3050 | BLOCKED_BY_RELEASE_IDENTITY |

## 声明状态

- `VERIFIED_COMPLETE_K0C_2 / K0C_REMAINS / BROWSER_EVIDENCE_BLOCKED`
