# 单丞相多运行时 Skill 设计

## 问题

当前产品在同一个上书房中呈现一个“丞相”，后端却分别实现了咨询、拟旨和正式办理三套
Agent 图与 API：

- `chancellor_consult` 负责无副作用咨询；
- `chancellor_draft` 负责生成带版本、指纹和批准路由快照的拟旨草案；
- `chancellor` 负责正式下旨、六部/司级办理、军机处会审、证据调查和史馆归档。

这种隔离保证了权限安全，但产品领域模型仍把三个能力表达成三个丞相 Agent。身份原则、
上下文契约、能力发现、切换理由和审计语义容易漂移，也不利于增加基于史馆、军机处和钦天监
结果的长期经营跟进能力。

本设计只统一产品运行时的丞相 Agent 模型，不修改前端页面和现有 API，不把开发期
`.agents/skills/*/SKILL.md` 注入产品运行时。

## 目标与非目标

### 目标

- 产品领域中只有一个 `ChancellorAgent`。
- 咨询、拟旨、正式办理和经营跟进表示为版本化 Runtime Skill。
- 模型可以理解意图和建议下一项 Skill，但不能自行跨越授权边界。
- 现有三个 API 继续确定本次请求允许执行的 Skill，前端无需修改。
- 现有三张 LangGraph 在第一阶段继续作为 Skill handler 使用。
- 每项 Skill 独立声明上下文、服务白名单、禁止动作、授权和审计策略。
- 保持 ADR 0028 的正式下旨、六部/司级、锦衣卫证据和史馆归档基线。

### 非目标

- 不把三张图合并成一张巨型 LangGraph。
- 不让一个模型回合自由选择并执行所有 Skill。
- 不允许普通咨询直接调用六部、锦衣卫或 MCP。
- 不改变六部与 39 个司的名录和职责。
- 不改变拟旨的一次性授权、版本、指纹和批准路由快照语义。
- 不改变现有前端页面、交互入口或 BFF/后端 API 路径。
- 本阶段不实现主动通知、定时任务或新的经营跟进页面。

## 选定方案

采用“一个丞相 Agent、多个 Runtime Skill、入口限定候选集、Skill 级授权与工具隔离”：

```text
ChancellorAgent
├── consult
├── draft_decree
├── execute_decree
└── follow_up（后续阶段）
```

`ChancellorAgent` 是统一身份和调度外壳，不直接承载六部办理、MCP、证据采集或归档实现。
Runtime Skill 是产品代码中的版本化能力契约，不是面向 Codex/Claude 的 Markdown Skill。

第一阶段以兼容适配为主：

```text
consult.handler       = 现有 build_chancellor_consult_graph()
draft_decree.handler  = 现有 build_chancellor_draft_graph()
execute_decree.handler = 现有 build_chancellor_graph()
```

统一概念不等于统一执行上下文。每个 handler 只获得当前 Skill 允许的数据和服务。

## 丞相 Agent 职责

`ChancellorAgent` 只负责：

- 提供统一、版本化的丞相身份与不可逆现实动作约束；
- 接收已验证的用户、入口、请求和审计上下文；
- 从 Runtime Skill Registry 解析入口允许的唯一 Skill；
- 按该 Skill 的上下文策略裁剪输入；
- 执行授权检查并调用 handler；
- 校验 Skill 输出契约；
- 记录实际 Skill、版本、入口、授权依据和结果；
- 允许 Skill 返回下一项能力建议，但不自动执行建议。

`ChancellorAgent` 不负责：

- 自己选择或调用 MCP 工具；
- 绕过拟旨授权进入正式办理；
- 把咨询消息静默变成正式旨意；
- 在不同 Skill 之间共享未批准的原始上下文；
- 替代六部、司级、军机处、锦衣卫或史馆的领域职责。

## Runtime Skill 契约

每项 Skill 使用代码拥有的不可变描述：

```text
RuntimeSkill
├── id
├── version
├── description
├── allowed_entrypoints
├── input_schema
├── output_schema
├── context_policy
├── allowed_services
├── forbidden_actions
├── authorization_policy
├── audit_policy
└── handler
```

约束：

- `id` 与 `version` 共同标识一次可审计能力定义。
- 注册表拒绝重复 ID、未知入口和缺失策略。
- handler 不能取得未列入 `allowed_services` 的服务引用。
- 输入在调用模型或产生副作用之前完成 Pydantic/等价结构校验。
- 输出严格校验，原始模型输出和底层异常不得直接返回用户。
- Skill 描述是代码拥有的可信配置；模型返回的 Skill 名称是不可信建议。

## 核心 Skill

### `consult`

目的：澄清问题、比较方案、评估风险和准备决策。

允许：

- 使用调用方提供的有序咨询消息；
- 调用咨询模型一次；
- 返回自然语言回复和可选的下一 Skill 建议。

禁止：

- 调用六部、司级、军机处、锦衣卫、MCP或史馆写入；
- 创建正式案件、拟旨授权或业务成果；
- 声称现实动作已经执行；
- 自动调用 `draft_decree` 或 `execute_decree`。

当前 `/api/v1/chancellor-consult` 强制选择该 Skill。后端继续保持无会话状态，浏览器现有
按用户隔离的咨询历史策略不在本阶段改变。

### `draft_decree`

目的：把用户输入整理为可审阅、可授权的正式旨意草案。

允许：

- 调用现有拟旨图；
- 生成规范旨意、参与部门、必选司和职责；
- 校验草案是否具备正式下旨条件；
- 在 `DRAFT_READY` 时登记当前用户的一次性拟旨授权。

禁止：

- 调用六部、司级、军机处、锦衣卫或 MCP；
- 创建正式办理案件或史馆回复；
- 自动调用 `execute_decree`。

当前 `/api/v1/chancellor-drafts` 强制选择该 Skill。现有版本、SHA-256 指纹、正文和批准路由
快照共同构成的授权边界保持不变。

### `execute_decree`

目的：执行用户明确确认且仍然有效的旨意。

授权前置条件：

- 当前用户已认证；
- 请求来自正式下旨入口；
- 正文、版本和指纹通过校验；
- 一次性拟旨授权属于当前用户且尚未消费；
- 批准路由快照通过当前六部与司级名录校验。

允许：

- 调用正式丞相图；
- 单部门交对应六部，多部门交军机处按批准顺序会审；
- 六部选择司并形成司议、部议；
- 司级节点按证据协议提出事实缺口；
- 通过锦衣卫间接使用批准的证据来源；
- 形成丞相最终总结和恰好三条建议；
- 创建案件、业务成果和史馆 `REPLY`。

禁止：

- 丞相直接调用 MCP；
- 模型改变已批准的部门集合、顺序或必选司边界；
- 未经新授权扩大旨意范围；
- 失败后自动重放已消费授权。

当前 `/api/v1/decrees/chancellor` 强制选择该 Skill。

### `follow_up`

目的：基于已有案件、史馆档案和钦天监结果发现需要关注的经营偏差。

这是后续阶段的扩展位。首期只定义契约，不接入主动通知或现有页面。

允许：

- 读取当前用户拥有的相关案件、档案和复盘结果的最小摘要；
- 返回发现、严重程度、依据对象和建议的下一 Skill。

禁止：

- 自动创建新旨意；
- 自动重启旧案件；
- 自动调用 `execute_decree`；
- 使用旧证据假装当前事实；
- 无用户边界地扫描其他账户资料。

推荐流转为 `follow_up → consult → draft_decree → execute_decree`，每一步沿用各自授权门禁。

## Skill 选择与转换

采用混合调度，但执行权由确定性代码持有。

### 一级选择

现有入口确定唯一允许执行的 Skill：

| 入口 | 强制 Skill |
| --- | --- |
| `POST /api/v1/chancellor-consult` | `consult` |
| `POST /api/v1/chancellor-drafts` | `draft_decree` |
| `POST /api/v1/decrees/chancellor` | `execute_decree` |
| 后续受控复盘事件 | `follow_up` |

模型不得覆盖一级选择。未知入口、入口与 Skill 不匹配或注册表缺失时失败关闭。

### 二级意图

模型可在当前 Skill 内识别低风险子意图，例如：

- `consult`：澄清、比较、风险评估、准备决策；
- `draft_decree`：新建、修订、补充缺失信息、就绪检查；
- `execute_decree`：采用批准快照形成单部或多部路径；
- `follow_up`：结果复盘、偏差识别、期限提醒、建议重开讨论。

二级意图不能扩大服务白名单或改变授权要求。

### 转换规则

Skill 可以返回 `suggested_next_skill`，但该字段只用于解释和后续产品行为，不构成调用授权：

| 来源 | 建议目标 | 是否可自动执行 |
| --- | --- | --- |
| `consult` | `draft_decree` | 否 |
| `draft_decree` | `execute_decree` | 否，必须明确下旨 |
| `follow_up` | `consult` | 否 |
| `follow_up` | `draft_decree` | 否 |
| 任意 Skill | `execute_decree` | 否 |

第一阶段前端可以忽略该字段，因此不需要页面或交互改动。

## 上下文隔离

统一外壳使用内部 `ChancellorInvocationContext`：

```text
ChancellorInvocationContext
├── owner_user_id
├── request_id
├── entrypoint
├── active_skill_id
├── active_skill_version
├── conversation_context?
├── source_case_ids?
├── source_archive_ids?
├── draft_authority?
├── authorization
└── audit_context
```

该对象不直接作为单一 Prompt 发送给模型。每项 Skill 的 `context_policy` 生成最小输入：

- `consult` 获得咨询消息，不获得执行授权、MCP配置或完整案件数据；
- `draft_decree` 获得本次拟旨消息和版本，不默认获得浏览器咨询历史；
- `execute_decree` 获得正式正文、已消费授权和批准路由快照；
- `follow_up` 只获得当前用户相关对象的受控摘要。

咨询历史若未来需要转为拟旨上下文，必须新增显式、可审计的“批准摘要”契约；不得由服务端
静默读取浏览器历史，也不得把整段长期聊天直接作为正式授权内容。

## 服务与 MCP 边界

Skill 注册表只暴露领域服务，不暴露凭证：

| Skill | 允许服务 |
| --- | --- |
| `consult` | 咨询模型 |
| `draft_decree` | 拟旨模型、拟旨授权注册表 |
| `execute_decree` | 六部、司级、军机处、证据协议、史馆、受任务约束的业务成果服务 |
| `follow_up` | 当前用户范围内的案件/档案/钦天监只读查询 |

MCP 继续只存在于锦衣卫证据域：

```text
execute_decree
→ 司级 Agent 声明事实缺口
→ Evidence Protocol
→ 锦衣卫
→ 管理员批准的只读 MCP
```

丞相 Agent、Runtime Skill Router 和六部 Agent 不接触 MCP 凭证，不自行选择具体 MCP 工具。

## 错误处理与审计

每次调用至少记录：

- request ID 与当前用户；
-入口；
- 实际 Skill ID 与版本；
- 授权策略和脱敏后的授权结果；
- handler 结果类型；
- 建议的下一 Skill（若有）；
- 是否产生案件、证据调查、业务成果或归档副作用；
- 稳定的失败代码。

必须失败关闭：

- 未注册 Skill 或版本；
- 入口与 Skill 不匹配；
- 输入/输出契约无效；
- handler 请求未批准的服务；
- 正式办理缺少或违反拟旨授权；
- 模型尝试返回可执行的 Skill 切换；
- 上下文引用不属于当前用户。

错误响应延续现有稳定、脱敏映射，不回显原始模型输出、凭证、内部授权内容或第三方异常。

## 兼容与迁移

### 第一阶段：统一契约

- 增加 Runtime Skill 接口、注册表和丞相统一身份资源。
- 将现有三个 Graph 适配为三个 handler。
- 三个 API 内部通过统一 `ChancellorAgent.invoke(skill_id, context)` 调用。
- 保持 API 请求和响应契约不变。
- 保持前端调用和页面不变。

### 第二阶段：统一审计与能力建议

- 统一 Skill 调用审计。
- 在不破坏现有响应的前提下，评估是否需要对内部调用者暴露下一 Skill 建议。
- 消除三套 Prompt 中重复且可能漂移的丞相身份与安全原则。

### 第三阶段：经营跟进

- 实现 `follow_up` handler。
- 只接入当前用户范围内的史馆、军机处和钦天监只读摘要。
- 另行设计触发、呈现和用户确认流程；本设计不预先决定前端形态。

## 测试

### 注册表与路由

- 四个 Skill ID 唯一且版本有效。
- 三个现有入口只能解析到对应 Skill。
- 未知入口、未知 Skill 和入口/Skill 不匹配均在调用模型前失败。
- 模型返回其他 Skill 名称不能触发 handler。

### 上下文与权限

- `consult` 无法取得六部、锦衣卫、MCP或史馆写服务。
- `draft_decree` 无法创建正式案件或归档。
- `execute_decree` 在授权无效时不调用任何部/司或产生副作用。
- 不同 owner 的咨询、草案、案件和跟进上下文不能交叉。
- 原始咨询历史不会未经批准进入拟旨或正式执行上下文。

### 兼容回归

- 现有咨询 API 请求/响应与单模型调用语义不变。
- 现有拟旨 API、结构化草案、版本、指纹和批准路由快照语义不变。
- 现有正式下旨单部、多部、证据、业务成果与史馆归档语义不变。
- 现有前端、BFF 和浏览器咨询持久化测试无需改变产品行为。
- ADR 0028 完整性和 harness 检查继续通过。

## 验收标准

- 代码和文档只将产品运行时的丞相定义为一个 Agent。
- 咨询、拟旨、正式办理表示为三个已启用 Runtime Skill；经营跟进为明确的后续扩展 Skill。
- Runtime Skill 与开发期 Codex/Claude Skill 在命名、目录和加载路径上明确隔离。
- 三个现有 API 和前端行为保持兼容。
- 正式办理仍只能由明确下旨入口和有效一次性拟旨授权触发。
- MCP仍只能通过司级证据协议和锦衣卫间接使用。
- 现有三张 Graph 可以独立测试和演进，不因统一产品身份而被强制合并。
- 每次运行时调用可审计到 Skill ID、版本、入口、授权与副作用。

## 范围与治理

允许后续实现修改：

- `backend/app/agents` 下的丞相统一外壳、Runtime Skill 契约与适配器；
- 三个丞相 API 的内部调用方式；
- 相关后端测试和架构文档。

第一阶段明确不修改：

- 前端页面、组件、BFF路径与交互；
- ADR 0028 内容及完整性基线；
- 六部、39司、军机处、锦衣卫和史馆职责；
- MCP服务器、工具批准和凭证配置；
- 现有外部 API 请求/响应契约；
- 用户已有的其他工作区改动。

该方案改变产品运行时 Agent 的架构表达和依赖方向。进入实现前应新增 ADR 记录正式采用
“单丞相多 Runtime Skill”，并创建对应产品任务；不能仅凭本设计文档静默改变现有架构。
