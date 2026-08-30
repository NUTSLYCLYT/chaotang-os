# 六部能力执行兼容契约草案

状态：阶段 1、离线草案、非生产接线。此 envelope **不得成为第二事实源**，也不授予执行权限。

## 权威映射

| 本草案字段 | 唯一权威 | 映射规则 |
| --- | --- | --- |
| `runtime_skill_binding` | `backend/app/agents/runtime_skills/models.py` 与 `backend/app/agents/runtime_skills/registry.py` | 只记录 `skill_id`、版本及定义摘要；layer、responsibility、allowed services 和 tool policy 必须实时由下游 RuntimeSkill registry 解析。 |
| `evidence` | `backend/app/agents/evidence_protocol.py` 的 `AgentEvidenceSnapshot` | 只记录 snapshot 引用及消费视图；adapter 必须加载 snapshot 并逐项比对 status、采用 ID 和缺口，证据正文、绑定、来源不得复制进本契约。 |
| `execution.human_confirmation` | `backend/app/work_products/models.py` 的 `WorkProductEnvelope` 与 `ConfirmationReceipt` | 现有 receipt 只证明 work-product version/sequence/actor decision；未来接线必须由受信适配器把 receipt 与 owner-scoped WorkProductEnvelope、run 和 preview digest 组合后签发绑定投影。envelope 自报字段不构成证明。 |
| `responsibility.authority_projection_ref` | 根级机器 authority projection | 责任归属不能扩大权限；权限由 capability/tenant/tool policy 交集决定。 |
| `tool_policy` | 现有 tool registry/policy evaluator | envelope 只携请求和 decision receipt 引用，不能声明新的工具或自批。 |

## Capsule-bound 非授权分支

`contract_role=capability-capsule-binding-candidate-not-authority` 是既有
Capability Capsule v1 的只读绑定投影，不是 RuntimeSkill adapter，也不是新的 registry、authority、
ledger 或执行器。该分支只能从 checked-in Capsule、lock 与
`backend/harness/capability_candidates/authority-manifest.json` 的 exact-zero-grant projection
机械闭合以下六个 ID；五个标准 `candidates/*` 目录与 legacy
`rites-message-quality-gate` 目录都只是兼容输入，不得迁移或复制 inventory：

- `decision-quality-gate`
- `hubu-financial-grounding`
- `hubu-payment-three-gates`
- `libu-responsibility-authority-chain`
- `rites-message-quality-gate`
- `rites-war-truthfulness`

Capsule-bound 输出固定为
`CANDIDATE_ONLY / MAPPING_UNRESOLVED / MCP_DENY / NO_EXECUTION_AUTHORITY / EXTERNAL_EFFECTS_FALSE`。
当前不存在 canonical Capsule-ID→RuntimeSkill-ID 映射，因此 `runtime_skill_id`、Tenant Principal、
membership、run 与 route 都不得由 Capsule、fixture、客户端、模型、MCP 或 A2A 猜测或注入。
`tenant_enabled=true` 只表示本地 kill guard 未熔断；与 exact-zero-grant projection 组合后仍然是零权限。
本 exact4 中只有 Pack 可以用 `CAPSULE_REFS_ONLY / DENY` 解析 checked-in Capsule 引用；Tool、Skill、
Agent、Workflow、Swarm 与 Expert 必须保持 `UNRESOLVED / DENY`、空 refs、空 edges，并在 semantic
guard 中拒绝成为已闭合视图。真实 RuntimeSkill、entrypoint、graph 或 agent identity 必须等待后续
hash-locked read-only projection/mapping successor。

未实现的来源、供应链、晋级和 receipt 状态只能如实记录为
`UNVERIFIED / NOT_MEASURED / DENY / ABSENT / UNAVAILABLE`。publisher signature、synthetic evaluation、
人工确认或 OpenTelemetry trace/span 都不能替代 Owner approval、三次独立真实任务、Qualified Use
或 durable outcome receipt。Capsule-bound 分支固定 `mcp_refs=[]`、MCP `DENY/UNAVAILABLE`、A2A
`UNSUPPORTED/DENY`；既有 server-owned RuntimeSkill 分支仍使用现行受信 registry、ToolPolicy 与 receipt。

## 七类能力边界

| 类型 | 本协议中的闭合语义 |
| --- | --- |
| Tool | 只投影既有 Tool registry/policy 中的原子调用；Capsule 不得新增工具或 side effect。 |
| Skill | 只引用既有版本和 definition digest；第三方内容保持 inert candidate。 |
| Agent | 只投影服务端既有执行身份；客户端、Pack 或 Capsule 不得声明 agent authority。 |
| Workflow | 只读展示既有 entrypoint/route/graph；不得安装、注册或动态执行。 |
| Swarm | non-empty、bounded、unique、acyclic 的只读组合；成员未知、重复、循环或超预算即拒绝。 |
| Expert | 只提供建议或证据视图，不构成 authority、confirmation 或事实源。 |
| Pack | flat、bounded、unique、sorted、content-addressed leaf refs；禁止嵌套、循环、权限聚合和激活。 |

Pack 与 Swarm 的有效权限不能取并集或空集默认放行；本分支无论组合内容为何都保持
`NO_EXECUTION_AUTHORITY`。所有 raw JSON 必须先经过现有 duplicate-key 拒绝解析，再接受 Draft 2020-12
closed-object schema 和 semantic guard；unknown field、type confusion、非有限数、过深或过长输入均失败关闭。

## 强制不变量

- `tenant_id`、`owner_user_id`、`run_id` 必须由受信入口注入，并在 evidence、preview、confirmation、tool receipt 与持久化边界逐一相等；用户或模型不能改写。
- 共享证据必须以不可变 snapshot 引用和摘要传递。`PARTIAL/BLOCKED/UNAVAILABLE` 必须列出缺口，不能输出 `READY`。
- `single` 只能包含一个部；`multi` 至少两个部，必须由军机处完成联审并携带 receipt。任一部、模型或 prompt 都不能把 `required` 降为 false。
- `PREVIEW` 永远不得获得 `ALLOW_EXECUTE`。`EXTERNAL_WRITE` 与 `IRREVERSIBLE` 在执行前必须有真实 `ConfirmationReceipt`，且 receipt 绑定当前 preview digest。
- `BLOCKED/FAILED` 必须拒绝工具；`DEGRADED/BLOCKED/FAILED` 必须携带稳定 reason code。不得把 fallback、异常吞噬或缺失证据改写成成功。
- 最终工具决策是 RuntimeSkill allowed services、根 authority projection、tenant policy、tool registry、kill switch、side-effect class 与人工确认的交集；任一缺失或拒绝即 `DENY`。

## 接口边界

所有 `*_ref` 都只是索引。未来 Runtime adapter 必须重新加载权威对象，并验证：共享 tenant/owner/run；联审参与部门和报告输入；证据 status/adopted/missing；authority capability；工具 policy、精确 tool IDs、decision 和由 registry 推导的 side-effect class；WorkProduct ID/version/content digest 与 ConfirmationReceipt。任一对象缺失或语义不相等即 `DENY/BLOCKED`。

本阶段不修改 Runtime、不注册新 capability、不创建新的 evidence/authority/tool registry，也不声明真实 Shadow、Canary 或生产验证。
