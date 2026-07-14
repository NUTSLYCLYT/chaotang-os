# CI 摘要：fix-k0c-block-legacy-court-flywheel-write-20260714

## 命令

| 命令 | 退出码 | 结果 | 证据覆盖范围 | 证据位置 / 时间 |
| --- | ---: | --- | --- | --- |
| `pytest tests/test_court_flywheel_button.py`（实现前） | 1 | RED：旧请求仍返回 200 | 旧客户端旁路写可复现 | 2026-07-14 本地终端 |
| `pytest ... -k no_longer_advertise`（producer 修改前） | 1 | 2 RED：后端两个 producer 仍下发旧动作 | 新客户端动作事实源 | 2026-07-14 本地终端 |
| `tsx --test court-doc-adapter.nodetest.ts`（adapter 修改前） | 1 | RED：adapter 保留旧动作 | 前端边界 | 2026-07-14 本地终端 |
| `pytest` 6 个聚焦/相邻文件 | 0 | 38 passed | API tripwire、RAG 零调用、producer、action、scribe/mainline | 2026-07-14 本地终端 |
| `tsx --test court-doc-adapter.nodetest.ts` | 0 | 3 passed | 前端 adapter 过滤 | 2026-07-14 本地终端 |
| `pnpm exec tsc --noEmit` | 0 | 0 errors | 前端类型 | 2026-07-14 本地终端 |
| `NEXT_PUBLIC_API_MODE=real pnpm build` | 0 | production build compiled | 前端真实模式构建 | 2026-07-14 本地终端 |
| `node --test scripts/capability-entry-governance.nodetest.mjs` | 0 | 3 passed | 单一 canonical writer 与不可删除门 | 2026-07-14 本地终端 |
| Draft 2020-12 entry validator | 0 | 0 errors | inventory schema | 2026-07-14 本地终端 |
| root/frontend/backend harness doctors | 0 | 全部 0 errors, 0 warnings | 三层护栏 | 2026-07-14 本地终端 |
| `py_compile` + `git diff --check` + scoped secret scan | 0 | PASS；secret match 0 | 语法、diff、泄密 | 2026-07-14 本地终端 |

## 结果

K0C-1 纵切已验证：新前后端不再生产、接受或渲染 `feed_flywheel`；旧客户端调用在任何业务状态、幂等或知识写入之前收到 409 `LEGACY_WRITE_BLOCKED`；`KnowledgeRAG.add_texts()` 零调用。capability entry 进入 `MIGRATE_REQUIRED`，但 telemetry 仍为 null，不能删除。

验证过程中的非产品失败：首次从 `backend/` 运行根 Node test 导致路径不存在，改从仓库根后 3/3 通过；首次 build 未声明 `NEXT_PUBLIC_API_MODE` 被诚实门阻断，使用生产要求的 `real` 重跑成功，未使用 mock 放行变量。

## 未验证项

- 当前 3050 属于 foreign workspace，未用其做浏览器证据；不得据此宣称部署体验已验证。
- 前后端全量基线仍有 7 + 13 个失败，归第二闭环清零；本 change 只证明相关纵切无新增回归。
- 8099、Q&A、Vault/brain DB/Qdrant 及其他 legacy writer 尚未封禁，K0C 未整体完成。
- canonical archive/outcome knowledge promotion 尚未实现，因此 replacement 保持 `PLANNED`。

## Diff 与回滚复核

- changed files：集中式 backend tripwire、court/scribe producer、前端 CourtDoc type/adapter/component、跨线 inventory/wiki/blueprint、前后端测试与 change 证据。
- diff review：无数据库/schema/知识内容删除；没有恢复 BFF；只有一个 legacy write action 的封禁与 UI 移除。
- 回滚是否演练：未实际恢复 legacy writer，因为恢复会重建双主写；允许的逻辑回滚仅为只读展示修复，不能恢复 RAG 直写。

## 完成定义映射

| DoD | 证据 | 状态 |
| --- | --- | --- |
| 新客户端无旧动作 | backend producer tests + frontend adapter/type/component diff | PASS |
| 旧客户端 fail closed | API 409 structured contract | PASS |
| 零知识旁路写 | mock RAG `assert_not_called` | PASS |
| 其他动作无回归 | 聚焦/相邻 38 passed | PASS |
| inventory 不漂白 | Node governance 3 passed + schema 0 errors | PASS |
| 浏览器候选体验 | foreign 3050 不可作证 | BLOCKED_BY_RELEASE_IDENTITY |
| K0C 全部 writer 单写者证明 | 仅完成 K0C-1 | PENDING |

## 声明状态

- `VERIFIED_COMPLETE_K0C_1 / K0C_REMAINS / BROWSER_EVIDENCE_BLOCKED`
