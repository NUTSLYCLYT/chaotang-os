# Codex Skill Preflight Gate Design

## Status

Approved — 2026-07-24。用户确认采用全局指令、仓库规则和 Codex Hook 三层门禁。

## Problem

Skill 的 `description` 和 `SKILL.md` 即使声明 MUST，也仍依赖模型在每个新回合主动完成路由。
长对话、任务惯性和 worktree 切换可能导致适用 skill 被漏读，出现用户可见故障未及时执行
`record-failure` 等流程错误。

## Design

- 在用户级 `~/.codex/config.toml` 增加 `developer_instructions`，要求每个用户回合在任何回复或
  工具调用前读取 `using-superpowers`、重新匹配并完整读取适用 skill、在 commentary 声明用途。
- 在仓库根 `AGENTS.md` 增加确定性映射：故障使用 `systematic-debugging`，用户可见故障或假绿
  使用 `record-failure`，实现使用 `brainstorming`/`test-driven-development`，完成声明和提交
  使用 `verification-before-completion`，worktree 操作使用 `using-git-worktrees`，实质工程任务
  使用 `codex-engineering-workflow`。
- 在项目 `.codex/hooks.json` 注册 `UserPromptSubmit` command hook。该 hook 每个回合输出一条
  `systemMessage`，重复提醒 skill preflight 和 Git 工作区核对要求。
- Hook 不读取或解析 transcript，不记录用户提示词，不写运行态文件，也不尝试证明模型内部状态。
  它是确定性提醒和可观察门禁，不替代系统/开发者指令。

## Error Handling

- Hook 对空输入、非法 JSON 和缺字段输入仍输出同一条安全提醒并以 0 退出，避免因遥测格式变化
  阻断 Codex。
- Hook 输出只包含固定 JSON，不回显输入，不泄露提示词或仓库数据。
- 项目 Hook 只有在仓库被 Codex 标记为 trusted 后生效；全局 `developer_instructions` 作为独立
  防线继续生效。

## Verification

- Node 测试先在 hook 脚本不存在时失败，再验证合法输入和非法输入都得到固定 `systemMessage`。
- JSON 解析验证 `.codex/hooks.json` 已注册 `UserPromptSubmit` 和既有 `Stop` hook。
- 运行 `node scripts/check_harness.mjs`、其 self-test、Codex hook 测试和 `git diff --check`。
