# 规格说明：fix-k0c-block-legacy-court-flywheel-write-20260714

## 背景

史馆 CourtDoc 的 `feed_flywheel` 按钮会把前端提交的普通 `doc/headline` 直接传给 `court_flywheel.archive_session_to_knowledge()`，最终调用 `KnowledgeRAG.add_texts()`。该路径不要求 canonical DecisionTask、FinalMemorial、EmperorDecision、ShiguanArchive 或可信 outcome，形成第二个知识事实 writer。K0C-1 只封禁这一条旁路，并保留旧客户端的显式错误契约。

## 当前实现与证据

| 分类 | 结论 | 证据路径 / 命令与时间 | 验证方式 / Owner | 是否阻塞 |
| --- | --- | --- | --- | --- |
| 已确认事实 | 旧接口返回 200 并调用 RAG `add_texts()` | `backend/web/routers/court.py` 变更前逻辑；首轮 RED 为 `200 != 409` | 聚焦 pytest / Backend owner | 是，已封禁 |
| 已确认事实 | `court_doc_builder` 与 `scribe_archive_docs` 均向新客户端下发旧动作 | 两条 producer RED 均失败 | 聚焦 pytest / Backend owner | 是，已移除 |
| 已确认事实 | 前端 mock、adapter allowlist 与 ArchiveCard 仍接受/渲染旧动作 | adapter RED 保留了 `feed_flywheel` | Node test / Frontend owner | 是，已移除 |
| 已确认事实 | inventory 已登记该入口族但此前为 `DISCOVERED + replacement MISSING` | `.harness/manifest/capability-entry-inventory.json` | Node governance test / Root owner | 已更新为 MIGRATE_REQUIRED |
| 推测 | 无；本轮不假设 canonical promotion 已存在 | 不适用 | 不脑补 | 否 |
| 未知问题 | 该入口历史真实调用量与调用者尚无 runtime telemetry | inventory telemetry 仍为 `null` | Backend owner / K0C-C0B | 是，禁止删除入口 |
| 未知问题 | 同一入口族的 register/bureau writers 及其他 legacy knowledge writers 尚未逐项处置 | capability inventory + K0C blueprint | Project owner | 是，K0C 未整体完成 |

## 数据流与调用链

旧数据流：`CourtDoc producer -> feed_flywheel action -> /api/court/action -> dispatch ok -> court_flywheel -> KnowledgeRAG.add_texts -> parallel knowledge fact`。

K0C-1 后：`新 producer/mock -> adapter 过滤 -> UI 不渲染 feed_flywheel`；`旧客户端重放 -> /api/court/action -> legacy_write_tripwire -> HTTP 409 LEGACY_WRITE_BLOCKED -> 零业务状态/知识写入`。目标数据流仍是 `DecisionTask -> FinalMemorial -> EmperorDecision -> ShiguanArchive -> authenticated Outcome -> canonical promotion`，本轮没有伪造尚未实施的 promotion writer。

## 接口、数据结构与事实源

| 契约 | 生产者 / 事实源 | 消费者 | 兼容性与验证 |
| --- | --- | --- | --- |
| `ActionRequest.action=feed_flywheel` | stale/legacy 客户端 | court router | HTTP 409；`success=false`；结构化 data |
| `LEGACY_WRITE_BLOCKED` | `src.legacy_write_tripwire` | API/UI/遥测 | 包含 `entryId` 与 `canonicalTarget`，不得返回假成功 |
| 史馆 CourtDoc `actions` | `court_doc_builder` / `scribe_archive_docs` | 前端按钮层 | 不再包含 `feed_flywheel` |
| `CourtDocAction` / adapter allowlist | 前端 scribe lib | ArchiveCard | 旧动作被过滤，组件无渲染分支 |
| capability entry | 根 inventory | governance test/owner | `MIGRATE_REQUIRED`；telemetry 仍 null；不得删除 |

## 范围

仅封禁 `feed_flywheel` 直接知识写入、移除前后端生产/接受/渲染路径、登记 planned canonical replacement，并增加正反例测试与证据。

## 非目标

不实现 canonical promotion；不修改知识索引 schema；不清理历史数据；不封禁本入口族其他动作；不触碰 8099/Q&A/Vault/brain DB/Qdrant；不修复当前 20 个全量失败；不做发布身份或回滚演练。

## 边界条件

| 条件 | 预期行为 | 证据 / 验证 |
| --- | --- | --- |
| 新客户端读取史馆文书 | 无 `feed_flywheel` 动作 | producer tests |
| 旧客户端重放有效动作 | 409 + `LEGACY_WRITE_BLOCKED` | API test |
| 请求带任意 doc/headline | tripwire 在状态/幂等/RAG 之前返回 | RAG zero-call assertion + code order review |
| 其他 CourtDoc action | 保持既有行为且不触发 RAG | regression test |
| 未登记 writer 调用 tripwire | policy fail closed，不静默允许 | unit behavior + code review |

## 风险与回滚边界

主要风险是只移除按钮却保留可调用 API，或只阻断 API却让用户继续看到坏按钮。本纵切同时处理 producer 和 stale-client boundary。恢复旧写权会重新制造双主写，不能作为普通回滚；故障时只允许恢复只读展示或通过后续 canonical promotion 修复。

## 计划确认记录

- 批准人：用户（“只做三个闭环…把这个也做了”）
- 批准日期：2026-07-14
- 批准范围：K0C 全路线；按一次一个最小闭环实施，本轮 K0C-1
- 明确未批准：伪造黄金/outcome、删除历史数据、恢复 legacy writer、跳过验证宣称全部完成

## 验收标准

有效 RED；旧入口 409 且 RAG 零调用；两个 producer 不再下发动作；其他 action 回归通过；inventory 保持不可删除；compile、聚焦与相邻测试、doctor、diff/security 全部通过。

## 验证计划

先跑单接口 RED，再跑 backend producer RED 和 frontend adapter RED；最小实现后运行聚焦/相邻 pytest、前端 Node test/type/build、root Node governance、JSON Schema、三层 doctor、Python compile、scoped secret/diff scan。当前 3050 属于 foreign workspace，不能拿它证明本变更浏览器体验；真实候选浏览器验证留给可信发布身份闭环，保持未验证。
