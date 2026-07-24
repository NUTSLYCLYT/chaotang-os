# 任务：fix-r0-w05-postmerge-closeout-20260724

WIP 永远为 1；任务按 RED→GREEN→review 串行执行。

## 任务 1：冻结 base 与 closeout RED

- 目标：证明 PR merge 身份，并让真实仓库 closeout 期望命中当前 ACTIVE 缺口。
- 前置条件：Product Owner exact approval；远端 base=`ad77c16d`。
- 输入：PR #17 refs、merge parents/tree、现有 authority tests。
- 输出：独立 worktree、真实 W05/W06 closeout tests、目标 RED。
- 涉及文件：authority v2 nodetest、本 change。
- 状态 / 数据变化：只增加测试/证据，不改 manifest。
- 验证命令与证据：27 tests 中 25 passed / 2 target failed。
- 回滚边界：revert 本 Packet；不触碰 merged 产品实现。
- 完成定义：两个失败都因 activeWorkPackage 仍是 R0-W05。
- 状态：完成。

## 任务 2：最小 closeout GREEN 与证据纠偏

- 目标：原子关闭 W05 且不激活 W06，恢复当前证据准确性。
- 前置条件：任务 1 RED 已观察。
- 输入：approved closeout transition、post-merge review MUST。
- 输出：manifest 两字段变化；W05 当前证据；本 change。
- 涉及文件：根 `.harness/` 与 authority test；禁止产品路径。
- 状态 / 数据变化：W05=MERGED_AND_VERIFIED；activeWorkPackage=null。
- 验证命令与证据：27/27 GREEN；W05/W06 均 STOP/NO_ACTIVE_WORK_PACKAGE。
- 回滚边界：仅通过另行批准治理 revert；不恢复产品写入。
- 完成定义：机器与文档共同进入 quiescent closeout。
- 状态：完成；27 authority tests 全绿，W05/W06 均
  `STOP/NO_ACTIVE_WORK_PACKAGE`，当前证据已纠偏。

## 任务 3：广域验证与 exact review

- 目标：冻结可独立拒绝、验证、回滚的本地 closeout 候选。
- 前置条件：任务 2 GREEN。
- 输入：完整 allowlist diff 与 RED/GREEN 证据。
- 输出：本地 exact SHA、独立 review 结论。
- 涉及文件：仅任务 1–2 allowlist。
- 状态 / 数据变化：local commit；不 push/merge；W06 继续 STOP。
- 验证命令与证据：authority/amendment/doctors/diff/clean。
- 回滚边界：未来获批后 `git revert <candidate>`；本轮不执行。
- 完成定义：exact review 0 MUST。
- 状态：进行中；authority/amendment/doctors/diff/allowlist 已通过，待本地
  exact candidate 与独立 review。
