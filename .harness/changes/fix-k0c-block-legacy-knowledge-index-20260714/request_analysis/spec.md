# 规格说明：fix-k0c-block-legacy-knowledge-index-20260714

## 背景

`POST /api/knowledge/index` 无请求数据契约，认证后直接调用 `get_rag().add_directory()`，可把扫描目录内容晋升为检索事实而不经过 DecisionTask、最终奏折、皇帝裁决、史馆归档或可信 outcome。K0C-3 只封禁这个 API；CLI、IMA 等独立写链不在本轮。

## 当前实现与证据

| 分类 | 结论 | 证据路径 / 命令与时间 | 验证方式 / Owner | 是否阻塞 |
| --- | --- | --- | --- | --- |
| 已确认事实 | 旧 index 返回 200 并调用 `get_rag().add_directory()` | `backend/web/routers/knowledge.py` 变更前逻辑；RED：`200 != 409` | 聚焦 pytest / Backend owner | 是，已封禁 |
| 已确认事实 | 仓库内未发现前端调用 `/api/knowledge/index` | `rg 'knowledge/index' frontend backend` | 静态调用者扫描 | 否 |
| 已确认事实 | CLI 与 IMA 仍各自调用 `add_directory()` | `backend/cli.py:912`、`backend/src/ima_knowledge_store.py:66` | code review | 是，K0C 后续 |
| 推测 | 无；不把“无前端引用”等同线上调用量为零 | 不适用 | 不脑补 | 否 |
| 未知问题 | API 历史真实调用量与外部调用者 | inventory telemetry 为 `null` | 后续 runtime telemetry | 是，禁止删除 |

## 数据流与调用链

旧链：`client -> auth -> POST /api/knowledge/index -> get_rag().add_directory -> scan docs -> vector index fact -> 200`。

K0C-3 后：`stale client -> auth -> legacy_write_tripwire -> 409 LEGACY_WRITE_BLOCKED -> RAG zero call`。目标链仍是 `authenticated Outcome -> canonical promotion -> index consumer`，本轮不伪造未实施的 promotion。

## 接口、数据结构与事实源

| 契约 | 生产者 / 事实源 | 消费者 | 兼容性与验证 |
| --- | --- | --- | --- |
| `POST /api/knowledge/index` | stale/external client | knowledge router | 固定 409；OpenAPI 不再声明 200 |
| blocked detail | centralized tripwire | API client/future telemetry | 复用 `legacy-knowledge-api-writers` family |
| RAG side effect | 旧 handler（已移除） | vector index | pytest 证明 `add_directory()` 零调用 |
| frontend OpenAPI snapshot | backend OpenAPI | TS callers | responses 同步为 409/422 |

## 范围

只封禁 API index writer并同步机器清单、契约、迁移说明和施工蓝图。

## 非目标

不处理 CLI、IMA、8099、Q&A、Vault/brain DB/Qdrant；不删除历史索引；不实现 canonical promotion；不把 n8n 纳入业务事实写链；不清零 20 个全量失败或处理发布身份。

## 边界条件

| 条件 | 预期行为 | 证据 / 验证 |
| --- | --- | --- |
| 合法认证请求 | 409 exact envelope，RAG 零调用 | 聚焦 pytest |
| 空 body | 同上；endpoint 不需要解析 body | 聚焦 pytest |
| stale caller | 明确失败，不返回假成功 | API contract |
| search/stats/sources/health | 保持只读既有契约 | 相邻 router tests |
| CLI/IMA 写链 | 明确保留为未知风险，不在本轮漂白 | static scan + blueprint |

## 风险与回滚边界

主要风险是只改运行时却让 OpenAPI/前端继续宣称 200，故同步四层契约。恢复 index 直写会重建第二事实源，不属于安全回滚；异常时只能修复只读检索或建设 canonical promotion。

## 计划确认记录

- 批准人：用户（“下一步”）
- 批准日期：2026-07-14
- 批准范围：K0C-3 单入口纵切
- 明确未批准：顺带接入 n8n、修改 CLI/IMA、删除数据、伪造 telemetry/outcome

## 验收标准

有效 RED；index 固定 409；RAG 零调用；OpenAPI/前端快照无 200；相邻测试、tsc、governance、doctor、compile、diff/security 全部通过。

## 验证计划

运行聚焦 RED→GREEN；随后执行知识 router 相邻 pytest、frontend tsc、capability governance、Python compile、三层 doctor、diff check 与 scoped secret scan。浏览器仍受 foreign 3050/可信发布身份阻断，本 API 无 UI 调用者，不伪造浏览器证据。
