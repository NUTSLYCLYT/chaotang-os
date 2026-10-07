# Codex 产品经理与 Claude Code 程序团队协作协议

本协议只定义顺序交接和证据闭环，不假设两个客户端能够互相启动、发送消息或同时安全地
修改同一工作区。任务文件是产品定义、实现报告和验收结论的共同事实源。

## Roles

- Codex 是默认产品经理，负责发现问题、澄清目标与非目标、定义验收标准、记录用户确认、
  决定任务是否 `Ready`，并在实现后做产品验收。
- Claude Code 主会话是程序团队负责人，依次协调只读架构师、按业务模块端到端交付的工程师
  和测试工程师，负责汇总技术计划与交付报告。它不能自行扩大范围或重写验收标准。
- 自动交付中 Claude Code 被明确的配额/速率限制拒绝时，当前 Codex 任务临时担任程序团队
  负责人，并使用 `.codex/agents/` 下同名专业角色完成相同顺序；交付完成后再恢复验收职责。
- 用户拥有最终产品决定。只有用户明确确认，或明确授权 Codex 代为确认时，任务才能进入
  `Ready`。

## Task Contract

每个产品任务使用 `docs/product/tasks/TEMPLATE.md` 创建为独立 Markdown 文件，建议命名为
`YYYY-MM-DD-short-name.md`。字段所有权如下：

| 区域 | 写入者 | 用途 |
| --- | --- | --- |
| `Status` | 按状态转换方 | 当前交接状态 |
| `Product Definition` | Codex | 问题、用户、目标和非目标 |
| `Acceptance Criteria` | Codex | 可验证的产品完成条件 |
| `Delivery Constraints` | Codex | 范围、风险、兼容性和时限约束 |
| `Affected Modules` | Codex + Claude Code 负责人 | Codex 标明业务模块；负责人确认允许路径与依赖 |
| `Technical Plan` | Claude Code 负责人 | 汇总架构角色的边界、接口、步骤、风险和验证计划 |
| `Implementation Report` | Claude Code 负责人 | 汇总各专业角色的改动、自审、验证和剩余风险 |
| `Acceptance Review` | Codex | 逐条验收结果、证据与最终结论 |

状态只允许：`Draft`、`Ready`、`In Progress`、`Blocked`、`Implemented`、`Accepted`。

## Workflow

1. Codex 与用户澄清需求，创建 `Draft` 任务并写清产品定义、非目标、受影响业务模块和验收
   标准；尚未稳定的边界标为候选模块，不把猜测写成既成架构。
2. 用户确认后，Codex 记录确认依据并把状态改为 `Ready`。
3. 用户在 Claude Code 中指定该任务。团队负责人复核可实施性后改为 `In Progress`，调用
   `solution-architect` 做只读分析，把审查后的结果写入 `Technical Plan`，并为每个受影响模块
   确认允许路径；若模块边界或产品信息不足，则改为 `Blocked` 并记录最少问题。
4. 负责人按模块顺序调用 `module-engineer`，每次只传入一个模块、允许路径和相关验收标准；
   全部模块完成后调用 `test-engineer` 补测试并独立验证。专业角色不得修改任务文件，也不得在
   共享工作区并行写入。
5. 负责人最终自审并填写 `Implementation Report`，状态改为 `Implemented`。
6. 用户把同一任务交回 Codex。Codex 对照验收标准审查证据：通过则填写验收记录并改为
   `Accepted`；不通过则记录缺口并退回 `Ready`。

## Automation

用户在 Codex 桌面任务中显式调用 `$product-flow` 或输入“自动交付：<需求>”时，该调用同时
委托 Codex 在没有阻塞性产品决定时自动确认 `Ready`、通过本地 Claude CLI 执行交付、自动
验收，并在首次验收失败后再交付一次。当前 Codex 任务始终拥有产品定义和验收权。

自动流程仍遵守以下停止条件：产品验收无法定义、权限/支付/隐私/删除/迁移等高风险决定、
不可逆外部副作用、Claude 返回 `Blocked`、用户改动可能被覆盖，或第二次交付仍未通过。skill
不自动提交、推送、发布，也不让两个写角色并行修改同一工作区。

自动交付调用 Claude Code 时默认使用实时事件流：当前 Codex 任务持续展示主/子角色消息、
工具调用与结果、文件操作、Hook 和最终统计；完整 JSONL 保存到 runner 启动时打印的系统
临时目录路径，不写入仓库。实时输出对常见凭据脱敏并截断过长单条内容，完整诊断以该次
JSONL 和任务文件中的交付证据为准。

runner 仅在结构化事件明确报告 `rate_limit_event.status = rejected`、`error = rate_limit` 或
错误结果 HTTP 429 时返回 Codex 接力码 `6`；额度预警、普通实现/测试失败、权限拒绝、未登录与
`Blocked` 不切换模型。接力保留 Claude 已有 diff、任务状态和日志，先由 Codex
`solution-architect` 只读复核，再按未完成模块顺序调用 `module-engineer`，最后始终调用
`test-engineer` 独立验证。写角色不得并行，专业角色不得修改任务文件；负责人负责计划、报告和
状态。该接力仍算同一次交付尝试，不额外消耗返工机会，也不改变高风险停止条件。

## Conflict Rules

- 对话、模型记忆和口头转述与任务文件冲突时，以任务文件中最近一次经用户确认的内容为准。
- 用户在当前任务明确要求 Codex-only 时，该任务约束高于 `$product-flow` 的 Claude 默认路径：
  不得启动 Claude CLI、Claude runner 或 `gstack-claude`，由 Codex 同名专业角色按既定顺序交付。
  该选择只作用于当前任务，不改变仓库的双客户端默认架构。
- Claude Code 发现验收标准无法测试、互相冲突或需要新业务决定时必须阻塞，不能用技术选择
  偷换产品决定。
- Codex 验收时默认只读代码和验证结果，不直接修复实现；若用户明确要求 Codex 实现，应先
  说明角色切换，并继续维护同一任务的证据。自动交付的 Claude 受限接力是已预先授权的例外，
  但程序团队负责人阶段与产品验收阶段仍须明确分开。
- 两个客户端不得同时修改同一工作区。并行工作的 worktree、分支、合并所有权与小步合并节奏，
  由 **ADR 0045（`docs/decisions/0045-cross-platform-parallel-development.md`）** 统一规定；
  跨平台（Windows / WSL2）契约见 `docs/platform-strategy.md`。本协议不再对此留白。
- Claude Code 的专业角色也遵守同一限制：架构分析完成后再实施，模块写入按允许路径顺序
  执行，测试在实现之后运行。负责人拥有任务状态、`Affected Modules` 中技术字段、
  `Technical Plan` 和 `Implementation Report` 的写入权。
- 业务模块是交付责任边界；`frontend/` 与 `backend/` 是代码治理边界。模块角色跨目录时必须
  同时遵守涉及目录的 scoped `AGENTS.md`，不能借模块名绕过目录约束。

## Verification

每次修改协议、模板或角色规则后运行：

```text
node scripts/check_harness.mjs
node scripts/check_harness.mjs --self-test
node .agents/hooks/check-harness.mjs --self-test
node .agents/skills/product-flow/scripts/run-claude-delivery.mjs --self-test
```

首次启用时还应完成一次人工演练：Codex 创建并置就绪一个最小任务，Claude Code 实现并填写
报告，Codex 根据证据验收。演练不能伪造前后端技术栈或不存在的工程命令。
