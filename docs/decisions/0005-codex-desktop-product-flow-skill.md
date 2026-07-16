# 决策 0005：用 Codex 桌面任务编排一键产品交付

## Status

Accepted — 2026-07-16

## Context

ADR 0003 和 0004 建立了 Codex 产品管理、Claude Code 模块交付及任务状态契约，但用户仍需
手动在两个客户端间复制任务路径和提示。独立 Codex CLI 或 SDK 适合 CI、定时和脱离桌面的
无人值守执行；当前需求是用户在 Codex 桌面应用输入一次需求后，由同一任务持续完成编排。

Codex 桌面任务已经能够执行本地命令，Claude Code 也已提供非交互 `-p` 模式和项目级角色。
因此不需要再启动第二个 Codex 进程，只需要把重复流程固化为项目 skill，并用受控 runner
启动 Claude Code。

## Decision

- 新增 Codex 专用 `.agents/skills/product-flow/`。显式调用 `$product-flow` 或输入
  “自动交付：<需求>”作为一次性授权：无阻塞时自动 `Ready`，证据完整时自动 `Accepted`。
- 当前 Codex 桌面任务始终担任产品经理、总编排器和验收方；Claude Code 只负责架构、模块
  实现和测试，不获得产品定义或验收权。
- runner 只接受 `docs/product/tasks/` 下状态为 `Ready` 的 Markdown，使用 Claude Code
  `acceptEdits` 权限，不使用跳过权限模式，不提交、推送或发布。
- 首次验收失败最多再交付一次。高风险业务决定、不可逆副作用、用户改动冲突、Claude
  `Blocked` 或第二次失败时停止并请求用户处理。
- `product-flow` 是 Codex 专用，不复制到 `.claude/skills/`；Claude 通过 `CLAUDE.md` 和
  `.claude/agents/` 接收职责。

## Consequences

- 用户日常只需输入一句“自动交付：<需求>”，不再手动切换客户端。
- 自动化仍是用户发起并保持桌面任务运行的本地流程；它不是定时服务，也不能在 Codex 桌面
  应用关闭后继续。未来需要 CI 或计划任务时再引入 Codex CLI/SDK 和隔离 worktree。
- 模型调用会增加时间和配额消耗；两次交付上限及停止条件防止无限返工。
- skill、UI 元数据、runner 和 runner 自测加入 harness 基线与 CI。

## Verification

- `node .agents/skills/product-flow/scripts/run-claude-delivery.mjs --self-test`
- `node scripts/check_harness.mjs`
- `node scripts/check_harness.mjs --self-test`
- `node .agents/hooks/check-harness.mjs --self-test`
- 在 Codex 桌面应用中显式调用 `$product-flow`，确认 skill 可见；真实产品演练需单独创建任务。
