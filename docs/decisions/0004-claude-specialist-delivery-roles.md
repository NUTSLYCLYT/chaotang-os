# 决策 0004：建立按业务模块交付的 Claude Code 专业角色

## Status

Accepted — 2026-07-16

## Context

ADR 0003 把 Claude Code 定义为程序团队，但没有区分架构设计、业务模块交付和测试质量职责。
让一个上下文同时承担所有工作会弱化所有权边界，也不利于隔离大量探索和测试输出。Claude
Code 支持项目级 custom subagents，可以为重复出现的专业职责设置独立提示、工具和权限。

当前仓库没有前后端技术栈，也没有 worktree 或并行合并机制，因此不能假设多个有写权限的角色
可以安全并行，或预先写入具体框架知识。前端和后端是代码层；如果把它们作为交付角色，同一个
用户功能会在两者间反复交接。业务模块更适合作为端到端交付责任边界。

## Decision

- Claude Code 主会话担任程序团队负责人，拥有任务状态、`Technical Plan` 和
  `Implementation Report` 的写入权。
- 在 `.claude/agents/` 新增三个项目级 subagents：
  - `solution-architect` 使用 `plan` 权限，只读分析边界、接口、风险和验证策略。
  - `module-engineer` 使用 `acceptEdits`，按任务登记的模块和允许路径端到端修改相关前后端代码。
  - `test-engineer` 使用 `acceptEdits`，在实现后补充相关测试并独立验证。
- 执行顺序为架构分析、逐模块实现、测试验证、负责人汇总。共享工作区中的写角色不在后台
  并行运行；专业角色不修改产品任务文件，也不继续生成下级角色。
- 产品任务使用 `Affected Modules` 登记业务模块、允许路径和依赖；`Technical Plan` 保存负责
  人审查后的架构输出和实施/验证顺序。

## Consequences

- 好处：一个模块角色对用户功能端到端负责，减少前后端交接；允许路径和 scoped `AGENTS.md`
  同时保留代码层边界，测试证据在交付前独立收集。
- 代价：顺序调用增加时间与模型使用量；主会话仍需审查各角色输出，custom subagent 不是无需
  监督的自动团队。
- 当前只建立通用 `module-engineer`，不猜测实际业务模块。真实模块边界稳定后，再为反复出现且
  有独立上下文需求的模块增加 `<module>-engineer`；前后端技术规则仍放在 scoped 文档或 skill。
- `.claude/agents/` 是 Claude Code 专属实现，不为 Codex 复制无意义的对称角色；harness 检查
  三个文件的名称、工具、权限和关键边界。

## Verification

- `node scripts/check_harness.mjs`
- `node scripts/check_harness.mjs --self-test`
- `node .agents/hooks/check-harness.mjs --self-test`
- 在 Claude Code 中运行 `/agents`，确认三个项目角色可见；用一个最小 `Ready` 任务演练模块交付。
