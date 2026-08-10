# 任务：docs-r0-w08-user-acceptance-task-card-20260729

## 任务 1

- 目标：新增中文非开发用户验收任务卡
- 前置条件：R0-W08 authority GO；不得生成虚假用户记录
- 输入：W08 canonical loop、acceptance rules、observer checklist
- 输出：`participant_task_card.zh-CN.md`
- 涉及文件：`backend/harness/chaotang-true-loop/product_acceptance/user_acceptance/participant_task_card.zh-CN.md`
- 状态 / 数据变化：已完成；无用户证据数据写入
- 验证命令与证据：focused W08 harness + doctors
- 回滚边界：单个任务卡文件
- 完成定义：任务卡包含目标、允许使用范围、禁止事项、完成标准和去标识化反馈要求

## 任务 2

- 目标：把任务卡纳入用户验收收集流程
- 前置条件：任务卡已创建
- 输入：README、session_runbook、submission_checklist
- 输出：runbook 要求任务卡作为唯一 task prompt；checklist 要求记录该事实
- 涉及文件：W08 user acceptance docs
- 状态 / 数据变化：已完成
- 验证命令与证据：focused W08 harness + doctors
- 回滚边界：docs-only references
- 完成定义：收集流程不依赖临场口头工程指导

## 任务 3

- 目标：补齐 Packet evidence 并完成 post-integration verification
- 前置条件：任务 1、2 完成
- 输入：change record
- 输出：VERIFIED_PARTIAL Packet
- 涉及文件：`.harness/changes/docs-r0-w08-user-acceptance-task-card-20260729/`
- 状态 / 数据变化：已完成
- 验证命令与证据：authority GO；focused W08 harness 17 passed；closeout preflight expected BLOCKED；backend/root doctors 0 errors / 0 warnings；diff check clean
- 回滚边界：change record
- 完成定义：authority、focused tests、preflight、backend/root doctors、diff hygiene 通过
