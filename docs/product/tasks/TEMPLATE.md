# 任务：<简短名称>

> 所有任务必须阅读并遵循 `docs/decisions/0028-decree-evidence-flow-governance-baseline.md`；若任务与该基线冲突，必须标记为 `Blocked`，不得自行变更流程。

## Status

Draft

## Product Definition

- 用户确认：<确认人、日期和依据；未确认时写“未确认”>
- 问题：<需要解决的用户问题>
- 目标用户：<谁会使用或受益>
- 目标：<这次必须产生的结果>
- 非目标：<明确不在本次范围内的内容>

## Acceptance Criteria

- [ ] <从用户视角描述、可以实际验证的完成条件>

## Delivery Constraints

- 范围：<允许修改的区域>
- 兼容性：<需要保持的行为或环境>
- 风险与限制：<已知风险、权限或时间限制>
- 技能计划：<按场景列出最小 skill 集；不需要时写“无”>
- Codex-only：<是/否；是时禁止 Claude CLI、Claude runner 与 gstack-claude>

## Affected Modules

- 模块：<由 Codex 用业务语言填写；新边界写“候选模块：名称”>
- 允许路径：<由 Claude Code 负责人经架构分析后填写，可列多个明确路径>
- 依赖模块：<没有则写“无”>

## Technical Plan

- 架构边界：<由 Claude Code 负责人根据架构角色输出填写>
- 接口与依赖：<需要新增或保持的契约>
- 实施顺序：<按模块列出端到端步骤及调用顺序>
- 验证计划：<测试层级、命令或行为验证方式>
- 技术风险：<阻塞项、回滚或兼容风险>

## Implementation Report

- 改动摘要：<由 Claude Code 填写>
- 自审：<主要发现和处理>
- 验证：<命令、结果或其他证据>
- 实际使用的 skill：<列出实际调用；没有则写“无”>
- 验证命令与结果：<逐项记录可复现证据>
- 未运行项与原因：<没有则写“无”>
- 剩余风险：<没有则写“无已知剩余风险”>

## Acceptance Review

- 验收结果：Pending
- 验收证据：<由 Codex 逐条核对>
- 未通过项：<没有则写“无”>
