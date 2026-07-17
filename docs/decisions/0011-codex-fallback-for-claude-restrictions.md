# 决策 0011：Claude 受限时由 Codex 专业角色接力自动交付

## Status

Accepted — 2026-07-17

## Context

一键自动交付默认通过本地 Claude Code runner 调用架构、模块交付和测试角色。真实运行已经出现
Claude 会话配额耗尽：事件流先返回 `rate_limit_event.status = rejected`，随后给出 HTTP 429
结果，但 Claude 进程仍可能以 0 退出。旧 runner 只能根据任务残留的 `Ready`/`In Progress`
状态报告协议失败，无法把这种外部模型限制与普通实现失败区分开；用户需要再次授权 Codex 手工
接力，破坏了“一次输入即可交付”的目标。

仓库已有稳定的 `solution-architect`、`module-engineer`、`test-engineer` 顺序与任务字段契约。
需要在不放宽高风险停止条件、不并行写工作区、不丢失 Claude 已完成内容的前提下，让当前 Codex
桌面任务在 Claude 明确受限时继续同一套角色流程。

## Decision

- runner 结构化识别三类明确受限信号：被拒绝的 `rate_limit_event`、`error = rate_limit`、错误
  结果 HTTP 429。额度预警、普通命令/测试失败、权限拒绝、未登录和任务 `Blocked` 均不触发
  fallback。
- Claude 受限且任务尚未 `Implemented` 时，runner 返回专用退出码 `6`，保留任务状态、工作区
  diff 和完整 JSONL。若任务已经成功进入 `Implemented`，迟到的受限事件不推翻完成结果。
- 在 `.codex/agents/` 新增同名 `solution-architect`、`module-engineer`、`test-engineer` 项目角色。
  它们不固定 `model`，继承当前 Codex 会话的底层模型；架构角色使用 `read-only` sandbox，写角色
  继承父会话权限并继续受任务允许路径约束。
- 当前 Codex 任务在接力阶段临时担任程序团队负责人：先让架构角色只读复核当前状态，再让模块
  角色顺序完成尚未交付的模块，最后始终让测试角色独立验证。专业角色不修改产品任务文件，负责
  人填写 `Technical Plan`、`Implementation Report` 和交付状态。完成后当前任务退出负责人阶段，
  再以产品经理身份验收。
- Claude 受限后的 Codex 接力属于同一次交付尝试，不消耗额外返工机会。它不得扩大产品范围、
  允许路径或外部副作用，也不得绕过业务歧义、高风险冲突和第二次验收失败等停止条件。

## Consequences

- 好处：Claude 配额或速率限制不再要求用户手工重复授权；已完成的 Claude 工作可以由 Codex
  原生角色继续，且架构、逐模块实现、测试、负责人汇总的证据链保持不变。
- 好处：结构化事件和专用退出码避免从自然语言或普通失败猜测受限状态；`allowed_warning` 不会
  导致过早切换模型。
- 代价：两种客户端都需要维护角色适配文件。harness 必须检查同名角色、关键边界和 Codex 架构
  角色的只读 sandbox，防止语义漂移。
- 代价：Codex 接力会增加模型用量；中途接力还需要额外只读复核，以确认 Claude 已完成与未完成
  的模块边界。
- 正常路径仍由 Claude Code 担任程序团队；Codex 专业角色不是常态双写或并行团队，只是明确
  受限后的顺序 fallback。

## Verification

- `node .agents/skills/product-flow/scripts/run-claude-delivery.mjs --self-test`
- `node scripts/check_harness.mjs`
- `node scripts/check_harness.mjs --self-test`
- `node .agents/hooks/check-harness.mjs --self-test`
- 人工演练 runner 事件夹具：`rejected`/429 返回 6，`allowed_warning` 不返回 6；在 Codex 中确认
  三个项目角色可见并按架构、模块、测试顺序接力一个保留为 `In Progress` 的最小任务。
