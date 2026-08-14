# 决策 0044：六部可信证据脊柱

## Status

Accepted — 2026-08-14（仅限 owner-scoped、只读分析和无外部副作用阶段）

## Context

EXT 六部能力已映射到 DEV 既有 46 个下游 RuntimeSkill，但“有专业方法”不等于“有可信事实与执行权限”。现有系统已经分别拥有 ADR 0018 的锦衣卫 Evidence Protocol、ADR 0027 的 `CurrentUser` owner 权威、ADR 0028 的下旨唯一入口与证据采用链、ADR 0029 的 owner-scoped 军机处案卷、ADR 0036 的 RuntimeSkill 单一注册中心，以及 ADR 0037 的司级受控只读 Tool Use。缺口是这些权威之间的受控桥梁，而不是另一套 Agent、Evidence 数据库、Runtime 注册中心或工具执行器。

如果每个部门自行定义输入、可信标记、证据读取、权限和结果格式，将出现六套互不等价的信任模型。调用者还可能通过 `owner_user_id`、`approved=true`、任意 URL/路径、工具名称或完成状态自报权限。反过来，如果把所有事实塞进同一自由文本，也无法证明结论采用了哪一份、哪个版本、属于哪个 owner 的材料。

当前账户模型只有 owner 隔离，没有已批准的 tenant authority。契约因此不能虚构 tenant：`scope_mode` 固定为 `owner_only`，`tenant_id` 必须为 `null`。未来多租户需要独立 ADR、服务端 tenant authority、迁移和隔离测试；不得通过放宽本契约提前兼容。

## Decision

采用“一条证据脊柱、六个领域投影器、双裁决”的内部架构。脊柱统一完成服务端身份装配、批准路由解析、RuntimeSkill 绑定、材料重载、Evidence/authority 判定、统一裁决和审计引用；六部投影器只把既有权威事实变成领域 facts/findings/risks，不拥有身份、路由、授权、工具或审计权威。

### 1. 输入是意图，不是权威

统一 `decision_request` 只接受：

- `request_id` 与业务 `objective`；
- 严格 `material_refs`：每项只含枚举 `kind`、不透明 `opaque_id`，以及至少一个 `expected_digest` 或正整数 `version`；
- closed `constraints`：只允许 `as_of` 与 `output_language`。

输入不接受 capability、部门、skill、owner、tenant、run/case/decree 身份、`verified`、`approved`、权限、工具、URL、路径、审计字段、结果状态或外部执行请求。Capability、部门和 RuntimeSkill 必须由服务端根据获批 `DecreeJob` route 与既有 registry 解析；owner 必须来自 `CurrentUser`。材料引用只是重载条件，调用者提供的摘要/版本不能证明内容，服务端必须重新加载并逐项匹配。

### 2. 输出是统一裁决，不是执行令

统一 `decision_envelope` 包含：owner-only scope、服务端 identity、批准 routing、RuntimeSkill binding、Evidence projection、authority decision、领域裁决、Evidence/audit 引用、稳定错误和外部副作用证明。

双裁决含义固定：

- `status=completed|degraded|failed` 只说明专业分析质量；
- `action_disposition=preview|hold|block` 说明当前输出如何被消费。

本阶段 `completed` 最多产生 `preview`；所有输出 `external_effects.authorized=false`、`mode=none`、`effect_count=0`。`WorkProduct` 可承载 preview/draft，`ConfirmationReceipt` 可证明既有人工决定，但二者在本阶段都不能升级本契约为外部写授权。任何外部写入、付款、发布、任命、通知、删除或不可逆动作需要另行获批的执行契约和 authority，不属于本 ADR。

### 3. 权威继续唯一

本脊柱不得成为第二事实源：

| 投影 | 既有唯一权威 | 强制绑定 |
| --- | --- | --- |
| 身份 | ADR 0027 `CurrentUser` | `owner_user_id` 仅由服务端装配；跨 owner 对象按不存在处理 |
| 路由 | ADR 0028 下旨链与获批 `DecreeJob` | capability、单/多部、参与部门不可由请求选择 |
| 跨部案卷 | ADR 0029 owner-scoped 军机处案卷 | 多部必须有真实军机处完成态与 receipt；不得伪造意见 |
| 运行方法 | ADR 0036 `RuntimeSkill` registry | skill ID、版本、定义摘要必须重载匹配 |
| 证据 | ADR 0018 Evidence Protocol、冻结 EvidencePack、既有专业事实源 | 只输出引用和领域投影；不得复制或自行提升可信度 |
| 司级工具 | ADR 0037 受控只读 Tool Use | 模型提议不是 authority；上层只消费最终报告 |
| 人工决定 | `WorkProduct` 与 `ConfirmationReceipt` | 当前只证明 preview/draft 的版本与人工决定，不授予外部作用 |

### 4. 当前六部诚实就绪面

- 户部：允许从 owner-scoped 会计评估会话重载并形成真实 accounting grounding；只有内容摘要、版本、owner、期间、币种、来源回执与会计恒等式全部通过才可 `completed/preview`。
- 礼部：允许从采用的 Evidence 引用形成 citation draft；draft 是有出处的对外内容草案，不是发布授权，也不是对事实的二次认证。
- 吏部缺少已批准的人员/岗位 authority source，必须降级为 `degraded/hold` 或失败关闭。
- 刑部缺少已批准的合同/合规 authority source，必须降级为 `degraded/hold` 或失败关闭。
- 工部缺少已批准的产品/交付/质量 authority source，必须降级为 `degraded/hold` 或失败关闭。
- 兵部缺少已批准的 CRM/销售 authority source，必须降级为 `degraded/hold` 或失败关闭。

“模型知道”“提示词给出”“fixture 能跑”或候选 capsule 均不算权威源。新增领域成功分支只能通过接入一个既有、owner-scoped、服务端重载的权威源与对应对抗测试完成，不能修改错误为成功。

### 5. 失败关闭与错误稳定性

错误固定携带 `code`、`phase`、`retryable`。未知字段、类型混淆、材料不存在/摘要不符、owner 不等、路由未批准、skill 漂移、证据缺失/冲突/过期、authority 缺失/拒绝、跨部会审未完成或审计写入失败均不得输出 `completed`。`degraded` 至少携一个错误并 `hold|block`；`failed` 至少携一个错误并 `block`。

错误码集合在 `docs/contracts/six-ministry-evidence-spine.schema.json` v1 冻结。v1 只允许追加新的 schema 版本，不允许让既有错误码改变含义，也不允许用自由字符串替代机器码。

## Consequences

- 收益：新增第七个领域只需新增领域 requirement profile、投影器与评测，不复制身份、证据、权限、路由和审计系统。
- 收益：统一输出使单部、军机处跨部合议、WorkProduct preview 和 Harness 使用相同判定语义。
- 收益：closed schema 和服务端装配消除最常见的 owner/authority 自报与字段走私路径。
- 代价：成功分支受真实权威源覆盖限制；目前除户部真实 grounding 和礼部 citation draft 外，其余部门会诚实降级。
- 代价：未来 tenant、多部真实联审成功、外部执行或新专业数据源都需要单独治理变更，不能靠可选字段悄然启用。
- 限制：JSON Schema 证明形状与部分跨字段不变量，不能证明引用对象真实存在；运行时必须重载权威对象并验证 owner、摘要、版本、route、skill 和 audit。

## Verification

- `node --test scripts/six_ministry_evidence_spine_contract.test.mjs`
- 后端证据脊柱的 owner 隔离、材料绑定、六部降级、跨部会审和无副作用测试
- `node scripts/check_harness.mjs`
- `node scripts/check_harness.mjs --self-test`
- `git diff --check`
