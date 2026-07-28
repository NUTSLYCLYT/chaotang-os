# 任务：docs-r0-w07-closeout-decision-20260728-20260728

## Task 1: Freeze W07-A0 Accepted Facts

- 目标：记录 W07-A0 `RUNNABLE_MINIMUM` 已本地整合并通过 receipt 验收。
- 前置条件：local `feature-chaotang-ext` HEAD `6504eda2...`。
- 输入：W07-A0 Packet、two-pass Codex GO、post-integration authority/test evidence。
- 输出：本 closeout decision Packet 的 summary/spec/CI。
- 涉及文件：本 change 目录。
- 状态 / 数据变化：无 manifest 或产品状态变化。
- 验证命令与证据：`git rev-parse HEAD`、W07-A0 receipt。
- 回滚边界：revert 本 docs commit。
- 完成定义：W07-A0 accepted facts 在 Packet 中可追溯。

## Task 2: Define Closeout Candidate Boundary

- 目标：明确下一候选只能执行 W07 quiescent closeout。
- 前置条件：Task 1 完成。
- 输入：`.harness/manifest/execution-authority.v2.json` 当前 W07 ACTIVE 状态。
- 输出：允许范围、禁止范围、Required Next Approval。
- 涉及文件：本 change 目录。
- 状态 / 数据变化：不改 manifest。
- 验证命令与证据：v2 W07 authority GO、root doctor 0/0。
- 回滚边界：revert 本 docs commit。
- 完成定义：W08/W09 不会被本 Packet 激活或暗示授权。

## Task 3: Governance Verification

- [x] `git diff --check`
- [x] `node scripts/execution-authority-v2.mjs --authorize --work-package R0-W07`
- [x] `node scripts/harness-doctor.mjs`
- [x] Confirm changed files are docs-only under this Packet.

## Remaining Decision

- [ ] Product Owner approves isolated R0-W07 quiescent closeout candidate.
- [ ] Exact closeout candidate updates manifest and receives independent review.
- [ ] Accepted closeout candidate is locally integrated.
