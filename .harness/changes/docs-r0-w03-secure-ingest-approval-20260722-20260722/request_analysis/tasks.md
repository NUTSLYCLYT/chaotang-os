# 任务：docs-r0-w03-secure-ingest-approval-20260722-20260722

## 任务 1：owner_approval 落盘 + ledger 原子翻转

- 目标：把 Product Owner 对 R0-W03 的具名批准变成可核验证据，让 execution-authority v2 对
  R0-W03 说 GO
- 前置条件：R0-W02 `MERGED_AND_VERIFIED`，ledger 处于静默收口态
- 输入：AskUserQuestion 四问确认结果（W03正式批准/admin零例外/provider全UNKNOWN/OQ-02数值，
  均选"推荐"）
- 输出：`owner_approval/exact-h-approval.md` + `execution-authority.v2.json` ledger 更新
- 涉及文件：本目录 `owner_approval/exact-h-approval.md`；`.harness/manifest/execution-authority.v2.json`
- 状态 / 数据变化：`activeWorkPackage: null→R0-W03`；ledger 新增 `R0-W03:ACTIVE`；
  `approvalEvidence` 更新为本次批准的 candidateH/tree/approvedScope
- 验证命令与证据：见 `ci_result/ci_summary.md`
- 回滚边界：`git revert` 恢复 ledger 到静默收口态
- 完成定义：`--authorize --work-package R0-W03` 返回 GO，`--work-package R0-W04` 仍返回 STOP
