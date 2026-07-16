# Codex 产品经理与 Claude Code 程序团队协作协议

本协议只定义顺序交接和证据闭环，不假设两个客户端能够互相启动、发送消息或同时安全地
修改同一工作区。任务文件是产品定义、实现报告和验收结论的共同事实源。

## Roles

- Codex 是默认产品经理，负责发现问题、澄清目标与非目标、定义验收标准、记录用户确认、
  决定任务是否 `Ready`，并在实现后做产品验收。
- Claude Code 主会话是程序团队负责人，依次协调只读架构师、按业务模块端到端交付的工程师
  和测试工程师，负责汇总技术计划与交付报告。它不能自行扩大范围或重写验收标准。
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

## Conflict Rules

- 对话、模型记忆和口头转述与任务文件冲突时，以任务文件中最近一次经用户确认的内容为准。
- Claude Code 发现验收标准无法测试、互相冲突或需要新业务决定时必须阻塞，不能用技术选择
  偷换产品决定。
- Codex 验收时默认只读代码和验证结果，不直接修复实现；若用户明确要求 Codex 实现，应先
  说明角色切换，并继续维护同一任务的证据。
- 两个客户端不得同时修改同一工作区。需要并行工作时，必须另行决定 worktree、分支和合并
  所有权，本协议不预设该机制。
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
