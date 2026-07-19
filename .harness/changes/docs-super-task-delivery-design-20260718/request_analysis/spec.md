# 规格说明：docs-super-task-delivery-design-20260718

## 背景

用户希望基于当前“上书房下旨 → 丞相 → 军机处 → 各部/各司蜂群 → 回奏”的流程，设计一套简单、有效、超出预期的超级任务系统。代表场景是“去美国看世界杯决赛”的完整旅行成果包，以及“一门生意是否要做”的全维度决策包。用户明确接受首期不引入 LangGraph，并要求形成 Markdown 文档供后续大神评审与实施拆分；后续扩展要求评估 OpenClaw、Hermes、Humen/Hume，定义知识库、可信飞轮、Agent 数量和丞相/钦天监交互。

## 当前实现与证据

| 分类 | 结论 | 证据路径 / 命令与时间 | 验证方式 / Owner | 是否阻塞 |
| --- | --- | --- | --- | --- |
| 已确认事实 | 仓库已存在 canonical 任务主链、outbox、事件账本、门下省审议、军机处读模型和基础下载 UI | `backend/src/chancellor/routing_service.py`、`backend/src/execution/`、`backend/src/menxia_veto.py`、`frontend/src/features/command-center/junjichu/` | 2026-07-18 只读代码核对 | 否 |
| 已确认事实 | 世界杯示例曾触发零命中默认户部/工部的系统性误路由 | `docs/plans/chaotang-os-department-agent-architecture-2026-07-17.md`、`backend/src/shangshufang_loop.py` | 代码与既有设计文档交叉核对 | 是，阻塞真实能力宣称 |
| 已确认事实 | 当前提交会记录门下省封驳，但正式 confirm 路径仍继续创建 outbox；第三轮兼容规则也会对无能力场景 fail-open | `backend/src/chancellor/routing_service.py`、`backend/web/routers/shangshufang.py`、`backend/src/menxia_veto.py` | 只读调用链核对 | 是，列入 P0 |
| 已确认事实 | 当前后端导出主要是 JSON/TXT，尚无任务级成果清单与多格式成果包 | `backend/web/routers/exports.py` | 只读代码核对 | 是，列入 P1 |
| 已确认事实 | 附件元数据与存储尚不满足完整企业级隔离、扫描、解析和来源可信要求 | `backend/web/routers/shangshufang.py` 与 IMA 存储路径 | 只读代码核对 | 是，阻塞敏感附件上线 |
| 已确认事实 | OpenClaw 只有可选出站脚手架与 mock 测试，纯文本协议缺租户、证据、权限和身份，正式 live adapter 未接线 | `backend/src/openclaw_client.py`、`backend/tests/test_openclaw_ready.py`、前端 live adapter factory | 2026-07-18 只读代码核对 | 是，阻塞正式主链宣称 |
| 已确认事实 | 仓库没有 Nous Hermes Agent client/端点；现有内容只是 Hermes 风格记忆、路由标签或模型别名 | `backend/src/memory_store.py`、runtime prompts、路由代码 | 2026-07-18 只读代码核对 | 是，阻塞集成宣称 |
| 已确认事实 | 旧飞轮仍存在模型报告直写 RAG、相似度代替证据、缺租户回退全局、反馈投毒与技能供应链旁路 | `backend/src/court_flywheel.py`、`knowledge_vet.py`、`truth_ledger.py`、`direct_feedback.py`、`skill_manager.py` | 2026-07-18 红队只读核对 | 是，阻塞自动学习/晋升 |
| 推测 | 用户提到的“maurse”指 Manus | 用户上下文 | 设计中仅以官方 Manus 产品模式作为参考，不影响核心方案 | 否 |
| 未知问题 | 用户所说 “Humen” 的准确产品：销售外联 Humen、语音 Hume AI，或 human-in-the-loop | 尚未收到链接 | 文档按三种解释隔离设计；选型前请用户确认 | 是，阻塞具体 PoC 选型 |
| 未知问题 | 各实时旅行与商业数据连接器的供应商、成本、授权和地区可用性 | 尚未选型 | 每个连接器 Packet 单独验证 | 是，阻塞 P2/P3 真实上线 |

## 数据流与调用链

```text
Browser / Shangshufang
  → GoalBrief + editable plan
  → canonical ChancellorRouteDecision
  → Menxia hard/soft veto
  → WorkPackage DAG + Outbox
  → capability workers / departments / specialists
  → Claim ledger + freshness
  → Yushi quality gate
  → FinalMemorial + ArtifactManifest
  → version-bound human approval
  → effect execution + receipt
  → Shiguan outcome
```

## 接口、数据结构与事实源

| 契约 | 生产者 / 事实源 | 消费者 | 兼容性与验证 |
| --- | --- | --- | --- |
| `GoalBriefV1` | 后端意图理解服务 | 丞相路由、计划预览 | P1 schema + contract test |
| `WorkPackageV1` | 军机处编排器 | worker、军机处页面 | P1 schema + DAG tests |
| `ClaimV1` | 工具/蜂群证据层 | 御史、丞相、成果包 | 来源/TTL/冲突测试 |
| `ArtifactManifestV1` | 成果服务 | 回奏页、下载服务 | 文件权限、hash、格式测试 |
| `ActionProposalV1` | 后端动作服务 | 人工审批、执行器 | 版本绑定、过期与幂等测试 |

## 范围

- 产品与架构蓝图。
- 世界杯与商业判断两个黄金旅程。
- 当前能力审计、优缺点、LangGraph 决策门和分阶段验收。
- OpenClaw/Hermes/Humen/Hume 的插件边界与受控接入顺序。
- 六类记忆、四个知识域、结果结算飞轮与现有 stop-ship 旁路。
- AgentBudget、丞相/钦天监交互和反暗黑用户体验。
- 根级文档入口与变更记录。

## 非目标

- 本 change 不修改前端、后端、数据库或生产配置。
- 不选择具体供应商，不承诺实时票价/库存/签证结论。
- 不创建 LangGraph 或 Temporal 运行时。
- 不安装或接入 OpenClaw、Hermes、Humen/Hume，不开启知识自动归档、共享学习或技能自动晋升。
- 不宣称 P0-P5 已实施。

## 边界条件

| 条件 | 预期行为 | 证据 / 验证 |
| --- | --- | --- |
| 无真实能力匹配 | 返回 `UNSUPPORTED_SCOPE`，不得默认部门裸 LLM 执行 | P0 负向测试 |
| 门下省硬封驳 | 不产生 outbox 派单 | P0 集成测试 |
| 动态事实过期 | 仅相关 Claim/Artifact 标记 stale 并允许局部刷新 | P2 契约/E2E |
| 审批后价格或条款改变 | 旧审批失效，执行前重新确认 | P4 安全测试 |
| 成果生成失败 | 独立重试成果，不重跑研究 | P1 集成测试 |

## 风险与回滚边界

- 风险：把设计稿误认为已实现；文档首部与每个阶段明确实现状态。
- 风险：动态能力增加复杂度；用版本化契约、黄金旅程和 WIP 顺序控制。
- 风险：LangGraph 延后导致自建编排膨胀；设置量化重新评估门。
- 回滚：删除新增蓝图和 docs 索引行，不影响任何运行时。

## 计划确认记录

- 批准人：用户
- 批准日期：2026-07-18
- 批准范围：产出详细方案与 Markdown 文档；接受首期不引入 LangGraph。
- 明确未批准：本 change 中未批准直接修改运行时、数据库、外部连接器或执行真实预订/付款。

## 验收标准

1. 文档区分事实、假设与推荐，不夸大当前能力。
2. 覆盖用户体验、角色边界、状态/数据契约、安全门、成果包、世界杯与商业示例。
3. 明确优缺点、LangGraph 取舍、市场前沿依据和 P0-P5 路线。
4. 明确外部组件边界、知识事实源、飞轮硬门、Agent 数量和丞相/钦天监 UX。
5. 根级 harness doctor 与 diff check 通过。

## 验证计划

- `node scripts/harness-doctor.mjs`
- `git diff --check`
- 核对文档中仓库路径在当前基线存在。
