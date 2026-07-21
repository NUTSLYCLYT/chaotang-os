# 任务：docs-r0-w02-shared-contract-approval-20260721-20260721

## 任务 1：owner_approval 落盘 + ledger 原子翻转

- 目标：把对话内的 Product Owner 批准变成可核验的落盘证据，并让 execution-authority.v2 真正
  对 R0-W02 说 GO
- 前置条件：R0-W01 `MERGED_AND_VERIFIED`（PR #7 已 merge）
- 输入：AskUserQuestion 三问的用户确认结果（OurRole四值/哨兵机制/正式批准，均选"推荐"）
- 输出：`owner_approval/exact-h-approval.md` + `execution-authority.v2.json` ledger 更新
- 涉及文件：本目录 `owner_approval/exact-h-approval.md`；`.harness/manifest/execution-authority.v2.json`
- 状态 / 数据变化：`activeWorkPackage: R0-W01→R0-W02`；ledger 新增 `R0-W02:ACTIVE`，`R0-W01`
  改 `MERGED_AND_VERIFIED`；`approvalEvidence` 更新为本次批准的 candidateH/tree/approvedScope
- 验证命令与证据：见 `ci_result/ci_summary.md`
- 回滚边界：`git revert` 恢复 ledger 到只授权 R0-W01
- 完成定义：`--authorize --work-package R0-W02` 返回 GO，`--work-package R0-W03` 仍返回 STOP
