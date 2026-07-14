# 规格说明：fix-k0c-block-legacy-knowledge-upload-20260714

## 背景

`POST /api/knowledge/upload` 接受任意客户端提交的文件或 JSON，直接写入 `backend/knowledge/docs/uploads`，随后调用 `KnowledgeRAG.add_directory()`。该路径不要求 canonical DecisionTask、最终奏折、皇帝裁决、史馆归档或可信 outcome，形成文件与向量索引的第二写者。K0C-2 只封禁 upload；同 router 的 `/knowledge/index` 下一闭环处理。

## 当前实现与证据

| 分类 | 结论 | 证据路径 / 命令与时间 | 验证方式 / Owner | 是否阻塞 |
| --- | --- | --- | --- | --- |
| 已确认事实 | 旧 upload 创建目录/文件并调用 `get_rag().add_directory()`，成功返回 201 | `backend/web/routers/knowledge.py` 变更前逻辑；RED：`201 != 409` | 聚焦 pytest / Backend owner | 是，已封禁 |
| 已确认事实 | upload handler 已移除 body/form、filesystem 与 RAG 写实现，只返回 tripwire | `backend/web/routers/knowledge.py` | RAG 零调用测试 + code review | 否 |
| 已确认事实 | `/knowledge/index` 是同入口族的另一直接索引 writer | `backend/web/routers/knowledge.py:api_knowledge_index` | code review / Backend owner | 是，下一闭环 |
| 推测 | 无；本轮不假设 canonical promotion 已实施 | 不适用 | 不脑补 | 否 |
| 未知问题 | upload/index 的线上真实调用者与调用量尚无 runtime telemetry | inventory telemetry 为 `null` | Backend owner / 后续 telemetry | 是，禁止删除 |
| 未知问题 | 历史 uploads 与索引中是否已有未经裁决内容 | 本轮未做数据审计 | 后续只读清点 | 否，不阻塞封禁 |

## 数据流与调用链

旧链：`client -> POST /api/knowledge/upload -> parse JSON/multipart -> mkdir/write file -> get_rag().add_directory -> parallel knowledge fact -> 201`。

K0C-2 后：`stale client -> auth -> centralized legacy_write_tripwire -> 409 LEGACY_WRITE_BLOCKED -> zero body parse/filesystem/RAG write`。目标链仍为 `DecisionTask -> FinalMemorial -> EmperorDecision -> ShiguanArchive -> authenticated Outcome -> canonical promotion`；本轮没有伪造目标 writer。

## 接口、数据结构与事实源

| 契约 | 生产者 / 事实源 | 消费者 | 兼容性与验证 |
| --- | --- | --- | --- |
| `POST /api/knowledge/upload` | stale/legacy client | knowledge router | 固定 HTTP 409，不再声明 201 |
| `LEGACY_WRITE_BLOCKED` detail | `src.legacy_write_tripwire` | API 客户端/未来遥测 | `entryId` + `canonicalTarget`；未知 entry fail closed |
| filesystem/RAG side effect | 旧实现已从 upload handler 移除 | uploads/Qdrant | handler 无写代码；测试证明 RAG 零调用 |
| capability inventory entry | 根 inventory | governance test/owner | `MIGRATE_REQUIRED`、telemetry null、不可删除 |

## 范围

仅封禁旧 upload 入口并建立运行时、测试、inventory 和 change evidence。

## 非目标

不封禁 `/knowledge/index`；不改变 search/stats/sources/health；不删除旧文件或索引；不实现 canonical promotion；不清零全量 20 失败；不处理可信发布身份。

## 边界条件

| 条件 | 预期行为 | 证据 / 验证 |
| --- | --- | --- |
| 有效 JSON 上传 | 409；handler 无 filesystem 写代码；RAG 零调用 | 聚焦 pytest + code review |
| multipart 或畸形 body | tripwire 在解析之前返回相同 409 | code order + 后续可扩展契约测试 |
| 未登记 writer ID | 集中策略抛错，禁止默认放行 | `blocked_write_detail` 实现 |
| search/stats/sources/health | 保持只读既有契约 | 相邻 router tests |
| `/knowledge/index` | 本轮仍未封禁，明确列为下一风险 | code evidence / K0C 未完成 |

## 风险与回滚边界

风险是只拦截 JSON 分支或在目录创建后才返回；故 endpoint 不再接收/解析 body，旧 filesystem/RAG 写实现也已移除，只保留统一 tripwire。恢复该入口会重建双写，不是安全回滚；后续只能把调用者迁入已验证 canonical promotion。

## 计划确认记录

- 批准人：用户（“只做三个闭环…K0C…下一步”）
- 批准日期：2026-07-14
- 批准范围：K0C 顺序实施；本轮只处理 upload
- 明确未批准：同时修改 index、删除历史知识、伪造 telemetry/outcome、跳过验证宣称 K0C 完成

## 验收标准

有效 RED；upload 固定返回 409；请求不得创建目录或调用 RAG；OpenAPI 状态不再声称 201；相邻知识 router 测试、inventory/schema、doctor、compile、diff/security 通过。

## 验证计划

同一聚焦测试完成 RED→GREEN；随后运行知识 router 相邻测试、根 capability governance、JSON Schema validator、Python compile、三层 doctor、diff check 和 scoped secret scan。当前 foreign 3050 不作为浏览器证据，可信发布身份仍在第三主闭环。
