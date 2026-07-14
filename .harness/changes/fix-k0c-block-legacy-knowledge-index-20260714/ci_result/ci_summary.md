# CI 摘要：fix-k0c-block-legacy-knowledge-index-20260714

## 命令

| 命令 | 退出码 | 结果 | 证据覆盖范围 | 证据位置 / 时间 |
| --- | ---: | --- | --- | --- |
| `pytest ... -k index_cannot_rebuild`（实现前） | 1 | RED：期望 409，实际 200 | 旧 API 直接索引可复现 | 2026-07-14 本地终端 |
| 两个 knowledge pytest 文件 | 0 | 31 passed；2 个既有 duplicate-operation-id warnings | index/upload tripwire、OpenAPI、相邻只读 API | 2026-07-14 本地终端 |
| `pnpm --dir frontend exec tsc --noEmit` | 0 | 0 errors | 前端 409 OpenAPI 快照 | 2026-07-14 本地终端 |
| capability governance Node tests | 0 | 3 passed | inventory schema、唯一 canonical、不可删除门 | 2026-07-14 本地终端 |
| `python3 -m py_compile ...` | 0 | PASS | 后端语法 | 2026-07-14 本地终端 |
| root/frontend/backend harness doctors | 0 | 全部 0 errors, 0 warnings | 三层护栏与 change record | 2026-07-14 本地终端 |
| `git diff --check` + scoped secret scan | 0 | PASS；secret match 0 | diff 与敏感信息 | 2026-07-14 本地终端 |

## 结果

K0C-3 已验证：`POST /api/knowledge/index` 删除直接 `get_rag().add_directory()` 路径，固定返回结构化 409；测试证明 RAG 零调用。OpenAPI、前端类型快照和迁移说明不再宣称 200。该入口族仍为 `MIGRATE_REQUIRED`，因为 canonical promotion 未实施且 telemetry 为 null。

## 未验证项

- CLI `backend/cli.py:912` 与 IMA `backend/src/ima_knowledge_store.py:66` 仍有独立 `add_directory()` 写链，K0C 未完成。
- API 真实历史调用量及外部调用者未知，不能进入删除候选。
- OpenAPI 生成仍报告 governance compatibility router 的 2 个既有 duplicate operation ID warnings，与本入口无关。
- foreign 3050/可信发布身份尚未解决，本无 UI 调用者的 API 纵切未伪造浏览器证据。

## Diff 与回滚复核

- changed files：knowledge router/test/迁移说明、frontend OpenAPI 快照、root inventory/wiki/blueprint/change evidence。
- diff review：不触碰只读检索接口，不删除历史索引，不修改 CLI/IMA；只移除 API index writer。
- 回滚是否演练：未恢复直接索引；恢复会重建平行事实源，不是安全回滚。

## 完成定义映射

| DoD | 证据 | 状态 |
| --- | --- | --- |
| 有效 RED→GREEN | 200→409 聚焦测试 | PASS |
| RAG 零调用 | `assert_not_called()` | PASS |
| API/前端契约同步 | OpenAPI 无 200；tsc 0 errors | PASS |
| 相邻知识接口 | 31 passed 总计 | PASS |
| inventory 不漂白 | governance 3 passed；replacement planned | PASS |
| K0C 全部 writer | CLI/IMA 等仍存在 | PENDING |

## 声明状态

- `VERIFIED_COMPLETE_K0C_3 / K0C_REMAINS / BROWSER_EVIDENCE_BLOCKED`
