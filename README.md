# chaotang-os

`chaotang-os` 正在从空仓库重新搭建。仓库预留两个实现边界：

- `frontend/`：用户界面和浏览器侧工程。
- `backend/`：服务、数据、任务/agent 运行与评测。

当前没有批准的业务技术栈。首次选型必须经过小步验证，并在同一变更中提供真实
可运行的工程命令和 CI，不能从历史文件或目录名称推断。

## Agent 与工程入口

- 工作规则：`AGENTS.md`
- 架构边界：`ARCHITECTURE.md`
- Agentic 工作流：`docs/agentic-engineering.md`
- Codex/Claude Code 兼容基线：`docs/tooling-compatibility.md`
- Codex 产品经理 / Claude Code 程序团队交接：`docs/product-collaboration.md`
- 产品任务模板：`docs/product/tasks/TEMPLATE.md`
- Claude Code 专业角色：`.claude/agents/`
- 一键自动交付：在 Codex 中输入 `自动交付：<需求>` 或调用 `$product-flow`
- Harness 验证：`node scripts/check_harness.mjs`
- 检查器自测：`node scripts/check_harness.mjs --self-test`
- Stop hook 协议自测：`node .agents/hooks/check-harness.mjs --self-test`
- 自动交付 runner 自测：`node .agents/skills/product-flow/scripts/run-claude-delivery.mjs --self-test`
