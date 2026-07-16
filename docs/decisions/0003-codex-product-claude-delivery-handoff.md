# 决策 0003：采用 Codex 产品管理、Claude Code 程序交付的顺序协作

## Status

Accepted — 2026-07-16

## Context

既有双客户端架构只保证 Codex 与 Claude Code 读取等价的 harness 语义，明确没有定义任务
交接。现在需要让 Codex 负责产品经理工作，让 Claude Code 承担程序团队工作。如果只把角色
写在对话里，需求、验收标准和实现证据会在两个客户端之间丢失；如果直接做客户端互调或并行
编排，又会引入权限、运行环境和并发写入问题，当前没有证据证明需要这些复杂度。

## Decision

- Codex 默认负责产品定义、用户确认、任务就绪和最终验收；除非用户明确要求，不实现业务代码。
- Claude Code 默认负责技术实现、自审、测试和交付报告，不自行改变产品范围或验收标准。
- 使用 `docs/product/tasks/*.md` 作为跨客户端的共同事实源，以 `Draft`、`Ready`、
  `In Progress`、`Blocked`、`Implemented`、`Accepted` 表示顺序交接状态。
- 只有用户确认后任务才能进入 `Ready`。Claude Code 只实施用户指定的 `Ready` 任务；Codex
  根据验收标准和实现证据决定接受或退回。
- 当前不引入客户端互相调用、常驻编排服务、并行写入或 worktree 自动管理。

## Consequences

- 好处：产品决定、实现证据和验收结论可审计，客户端切换不依赖对话记忆；角色边界清楚，
  Claude Code 遇到业务歧义时有明确阻塞路径。
- 代价：用户需要在两个客户端之间发起顺序交接；任务文件需要维护状态和报告，不能做到完全
  自动化。
- `AGENTS.md`、`CLAUDE.md`、`ARCHITECTURE.md`、`docs/tooling-compatibility.md` 和知识索引
  同步记录该模型；任务协议与模板加入 harness 的长期文件检查。
- 未来只有在真实任务证明顺序交接成本过高后，才评估 GitHub Issues、MCP、分支/worktree
  隔离或自动编排。

## Verification

- `node scripts/check_harness.mjs`
- `node scripts/check_harness.mjs --self-test`
- `node .agents/hooks/check-harness.mjs --self-test`
- 按 `docs/product-collaboration.md` 完成一次 Codex → Claude Code → Codex 人工演练。
