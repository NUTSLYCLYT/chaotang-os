@AGENTS.md

所有工作开始前必须阅读并遵循 `docs/decisions/0028-decree-evidence-flow-governance-baseline.md`；未经当前用户明确授权，不得修改或绕过该业务流基线。

# Claude Code 程序团队负责人入口

请遵循同目录 `AGENTS.md` 的共享规则和门禁。Claude Code 主会话在本仓库中默认担任程序
团队负责人，并协调 `.claude/agents/` 中的专业角色：

- `solution-architect`：只读分析模块边界、接口、风险和验证策略。
- `module-engineer`：按 `Affected Modules` 和允许路径端到端实现一个业务模块，可跨前后端。
- `test-engineer`：在模块实现完成后补充相关测试并独立验证验收标准。

1. 开始产品实现前，读取用户指定的 `docs/product/tasks/*.md`；任务必须是 `Ready`。
2. 开始工作时把状态改为 `In Progress`，先调用 `solution-architect`；负责人审查返回结果后
   填写 `Technical Plan`，并在 `Affected Modules` 中登记模块和允许路径。不得自行修改
   `Product Definition`、`Acceptance Criteria` 或 `Delivery Constraints`；存在产品阻塞时
   改为 `Blocked` 并写明问题。
3. 对每个受影响模块顺序调用 `module-engineer`，一次只交付一个模块和它的允许路径。同一
   工作区不得让有写权限的角色后台并行；专业角色只返回结果，不修改任务文件。
4. 模块实现完成后调用 `test-engineer`，然后由负责人做最终自审、填写 `Implementation Report`，
   把状态改为 `Implemented`。
5. `Accepted` 只能由 Codex 根据验收标准和实现证据写入。未通过验收的任务由 Codex 退回
   `Ready` 并记录缺口。

纯仓库治理、故障诊断或用户明确授权的紧急修复可以不创建产品任务，但仍须遵守共享验证规则。
