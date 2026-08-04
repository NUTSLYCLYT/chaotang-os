# 司级 Agent 受控 Tool Use 设计

日期：2026-08-03
状态：已由用户确认，待书面复核
范围：39 个司级 Agent；不扩展六部、军机处或丞相的 Tool Use

## 背景与目标

项目已经为军机处、六部和 39 个司建立独立 Runtime Skill，并通过共享 executor 在任何模型、Evidence 或下游 Agent 副作用前完成身份、层级、报告类型和服务权限校验。现有 Evidence Protocol 仍是事实取证的唯一入口，来源顺序固定为史馆优先、管理员批准的只读 MCP 补缺。

本设计为 39 个司级 Agent 增加受控 Tool Use：模型可以提出工具调用，但系统拥有审批权和执行权。第一期只提供少量共享只读工具实现，每个司通过其独立 Runtime Skill 获得独立 Tool Policy。设计不增加 LangGraph 业务节点，不创建第二条 Evidence/MCP 通道，也不允许任意代码、SQL、文件、网络或写操作。

## 已选择方案

采用“模型提议，系统审批，受控执行”的混合方案：

1. 模型根据当前司的 Tool Catalog 生成 `ToolCallProposal`。
2. `ToolPolicyGate` 校验身份、Skill、工具、参数、数据域、case scope、业务状态和预算。
3. `ToolExecutor` 只执行已批准的内部只读能力。
4. `ResultGate` 校验 schema、裁剪和脱敏结果，并绑定批准数据与 Evidence 引用。
5. 模型使用受控的 `ToolResultEnvelope` 继续分析并生成 `BureauReport`。

模型永远不获得 Python 函数、数据库连接、MCP client、凭证、文件路径或 provider 配置。系统在工具产生任何副作用前完成审批；拒绝时底层工具调用计数必须为零。

## 组件边界

### Tool Descriptor Registry

保存四类共享工具的名称、版本、输入和输出 schema、风险级别、确定性、默认预算及处理器标识。Registry 只描述工具，不授予 Agent 权限。

### Bureau Tool Policy

作为现有 `RuntimeSkillDefinition` 的组成部分，每个司必须声明：

- `allowed_tools`
- `tool_argument_constraints`
- `allowed_data_domains`
- `required_data_refs`
- `max_tool_calls`
- `max_tool_rounds`
- `max_result_rows`
- `max_result_bytes`

39 个司共享工具实现，但必须拥有 39 份显式、唯一、专业域匹配的 Tool Policy。启动时验证数量、身份、Skill 绑定、工具集合、数据域和参数约束；缺失、重复、未知工具或跨域权限均 fail closed。

### Tool Policy Gate

输入当前 case/decree、系统确定的 Agent 和 Skill 身份、Tool Policy、模型提案及剩余预算。Gate 不信任模型提交的 `agent_id`、`skill_id` 或权限字段，以系统上下文覆盖并核对这些值。只有 Gate 能把提案推进为 `APPROVED`。

### Tool Executor

根据已批准的 descriptor 调用固定处理器。处理器不能从模型参数取得凭证、URL、数据库对象或任意表达式。Tool Executor 位于现有 `run_authorized_runtime_operation` 内部，不能成为绕过 Agent 级服务授权的第二执行入口。

### Result Gate

验证结果 schema、case scope、数据引用归属、行数、字段数和字节预算；删除秘密、内部路径、provider 原始异常和未批准字段。只有通过 Result Gate 的结果能够返回模型。

### Tool Audit Sink

为提议、批准、拒绝、执行、失败和结果裁剪生成系统拥有的审计记录。审计与现有 Runtime Skill 审计和 Evidence/MCP 审计关联，但不记录凭证、完整提示词、MCP 原始响应、秘密字段或底层异常正文。

## Tool Call 契约

模型输出的提案至少包含：

```json
{
  "tool_call_id": "tc_...",
  "agent_id": "户部.度支司",
  "skill_id": "bureau.hubu.duzhisi.v1",
  "tool_name": "inspect_approved_data",
  "purpose": "计算季度财政收入变化",
  "arguments": {
    "data_ref": "approved-data:...",
    "operation": "compare",
    "dimensions": ["quarter"],
    "metrics": ["revenue"]
  },
  "required_for": ["财政趋势判断"],
  "expected_result_schema": "period_comparison.v1"
}
```

`tool_call_id` 必须在当前调用循环内唯一。模型不能指定权限、凭证、provider、URL、数据库地址、超时、执行器或审计字段。身份字段仅用于检测伪造，实际身份始终来自系统上下文。

## 审批状态机

正常路径：

```text
PROPOSED → VALIDATING → APPROVED → EXECUTING → SUCCEEDED
```

其他终态：

- `DENIED`：Agent、Skill、工具或数据域无权限。
- `INVALID`：参数、schema、身份或引用无效。
- `BUDGET_EXCEEDED`：次数、轮次、时间、行数或字节预算不足。
- `BLOCKED`：业务状态不允许，例如材料未批准。
- `FAILED`：已批准的工具执行失败。
- `EMPTY`：工具正常执行但没有结果。
- `TRUNCATED`：结果通过受控裁剪后返回；限制必须显式披露。

终态不可由模型改写。重试必须由系统创建新的 `tool_call_id` 并引用前次调用；相同工具和规范化参数禁止重复调用。

## Tool Result 契约

```json
{
  "tool_call_id": "tc_...",
  "status": "SUCCEEDED",
  "tool_name": "inspect_approved_data",
  "result_schema": "period_comparison.v1",
  "data": {},
  "evidence_refs": ["evidence:..."],
  "approved_data_refs": ["approved-data:..."],
  "as_of": "2026-08-03T00:00:00+08:00",
  "data_quality": "PARTIAL",
  "limitations": ["第三季度数据尚未归档"],
  "audit_ref": "tool-audit:..."
}
```

事实性结果必须具有批准引用。计算结果必须保存输入引用、固定算法 ID 和版本。工具正常返回空结果与工具不可用必须区分。最终报告只能引用实际成功或受控裁剪返回的 Tool Result。

## 第一阶段 Tool Catalog

### `request_evidence`

请求事实证据，是唯一能够间接触达史馆和管理员批准只读 MCP 的工具。参数只描述事实槽位、业务含义、数据类型、时间、地域、对象、可接受来源范围和用途。系统继续执行现有 Evidence Protocol；模型不能指定 provider、凭证、URL 或数据库查询。同一事实槽位只允许一次补充请求，结果返回 Evidence 引用而不是 MCP 原始响应。

### `read_approved_materials`

读取当前 case/decree 已批准的任务材料、父任务摘要、受控上下文和附件摘要。禁止跨 case/decree、其他司内部草稿、任意文件路径、未批准附件和秘密原文字段。

### `inspect_approved_data`

读取和筛选已批准数据，不直接查询数据库。第一期只支持固定操作：`describe`、`filter`、`aggregate`、`compare`、`top_n` 和 `lookup`。字段、运算符、维度、指标、主键和结果规模均受 policy 约束；禁止 SQL、数据库表名和模型生成表达式。

### `compute_analysis`

对批准数据引用进行确定性计算。第一期支持基础算术、百分比、同比、环比、占比、差额、均值、中位数、极值、排序、分组汇总、简单趋势、阈值判断和合计一致性校验。每种算法使用固定 ID、版本和参数 schema；禁止 Python、JavaScript、Shell、文件操作和任意公式执行。

## 调用循环与预算

每个司最多执行一个受控 Tool Use 循环：模型提出零到多个提案，系统逐个审批执行，模型接收结构化结果并生成最终报告。默认预算为：

- 最多 4 次工具调用。
- 最多 2 轮提案—结果循环。
- 同一工具和规范化参数不得重复。
- Tool Result 不得自动触发另一个工具。
- 工具不能并行共享可变会话。
- 达到预算后强制生成 `DEGRADED` 或 `INSUFFICIENT` 报告。

具体司级 policy 可以在不超过系统上限的前提下降低预算，不能提高系统上限。

## 错误处理

- 无效提案允许模型在剩余预算内修正一次。
- 越权调用立即 `DENIED`，不执行底层处理器，也不允许同义工具绕过。
- Evidence 不足返回 `PARTIAL` 或 `INSUFFICIENT`，并强制报告降级。
- 外部取证超时后取消，不自动重试其他外部来源。
- 结果过大时由 Result Gate 裁剪并标记 `TRUNCATED`。
- 模型结构输出损坏仅允许一次修正，仍失败则生成降级报告。
- executor 内部异常对模型只返回稳定错误码，安全日志保留脱敏诊断。
- 任意失败不得回退为未经审批的直接函数调用。

## 审计契约

每次提案至少记录：`tool_call_id`、case/decree、Agent、Skill、Tool Policy 版本、参数脱敏摘要和哈希、审批状态、稳定原因码、起止时间、耗时、输入输出引用、结果状态、行数、字节数、预算消耗和重试来源。

审计由系统生成，模型不能传入或修改 trace、时间、权限、结果状态和审计引用。拒绝和失败也必须产生审计；底层异常、凭证、完整提示词、秘密材料及 provider 原始响应不得进入审计。

## 兼容性与架构约束

- 扩展现有 Runtime Skill 和 Registry，不创建第二套 Agent 权限注册表。
- Tool Policy Gate 位于现有 Agent 前置授权边界内部。
- `request_evidence` 沿用 ADR 0028，不改变事实槽位、取证、采纳、引用或快照语义。
- 六部和军机处只接收最终 `BureauReport`，不能获得 Tool Client、Tool Result、Evidence/MCP 会话或批准数据对象。
- LangGraph 保持四个业务节点，不为 39 个司或工具增加节点。
- 旧 Bureau API 和“零工具调用直接生成报告”路径继续兼容。
- 第一阶段全部工具只读；不提供数据库写入、消息发送、任务变更、Shell、文件系统、通用网络、直接 MCP 或任意代码执行。

## 测试与最终验收

测试必须覆盖：

- 39 个司各有唯一 Tool Policy，以及缺失、重复、未知工具和跨域配置的启动失败。
- 四类工具输入和输出 schema 的正反例。
- 错误 Agent、Skill、Tool、case、数据域和引用的失败关闭。
- 未授权时模型、Evidence、MCP、数据库和计算处理器调用计数全部为零。
- 模型伪造身份、权限、预算、provider 和审计字段无效。
- Result Gate 拒绝跨 case、未批准引用、秘密字段和错误 schema。
- 重复调用、循环、修正次数、预算耗尽、超时、空结果和裁剪。
- 成功、拒绝、失败、空结果及裁剪审计，包含敏感异常脱敏。
- Evidence Protocol 和 ADR 0028 全部既有回归。
- 39 个司各至少一个需要工具和一个无需工具的行为测试。
- 旧 Bureau API、六部汇总、军机处会审、丞相路径和四节点拓扑保持。
- 同一最终代码、配置和验收命令连续完整通过至少 10 轮；任一失败或实质变化从第 1 轮重新计数。

真实模型、真实 MCP、生产数据库、生产写入、凭证、付费服务和外部网络不因本设计自动获得授权，若纳入最终验证必须另行明确批准。

## 完成定义

### Approved in-memory inputs

The report entry point accepts optional keyword-only `approved_data_inputs` keyed by
logical dataset name. Each value has exactly `columns`, `rows`, `values`, and `unit`.
Validation, deep-copying, and case/decree-scoped canonical ref creation happen only
inside the authorized operation. Legacy callers are unchanged and
`approved_data_refs` remains metadata-only.

- 39 个司级 Runtime Skill 均具有独立、显式并通过启动校验的 Tool Policy。
- 四类共享只读工具只能经系统审批和现有 Agent 授权边界执行。
- Tool Call、状态、结果、预算、引用和审计契约均由结构化测试固定。
- Evidence 仍只有 ADR 0028 规定的一条业务通道。
- 无工具路径、上层汇总路径和四节点 LangGraph 保持兼容。
- 最终版本通过独立审查与连续 10 轮完整验收。
