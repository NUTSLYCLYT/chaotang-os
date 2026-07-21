# 任务：docs-r0-w01-amendment-repin-20260721-20260721

## 任务 1：基线与 dev 审计

- 目标：确认最新 EXT、G0 合入事实及 `dev` 是否有独有价值。
- 前置条件：只读。
- 输入：remote refs 与 commit graph。
- 输出：B=`ccc2d74a2e439830e9c6ae7adcefb5ee8c05c150`；`dev` unique=0，不融合。
- 状态 / 数据变化：DONE；无数据变化。

## 任务 2：RED → GREEN 重钉契约

- 目标：先证明旧 checker 无法约束新 base/Owner，再实现最小结构门。
- 输入：用户 Owner 指派、canonical amendment、root manifest/checker/doctor。
- 输出：re-pinned amendment、结构化 manifest、负例测试和 fail-closed doctor。
- 状态 / 数据变化：DONE；仅根级治理文件。
- 验证命令与证据：`node --test scripts/r0-amendment-check.nodetest.mjs`。
- 回滚边界：revert 本 change；不触及 runtime/数据库。

## 任务 3：候选验证与独立复审

- 目标：生成不可漂移的 B/H/tree/diff/amendment digest，完成三路 Claude Code 只读复审。
- 前置条件：任务 2 GREEN 且 authority 仍 STOP。
- 输出：exact-H 审查记录和托管候选证据。
- 状态：IN_PROGRESS；本地四道验证已通过，等待 exact-H 与独立复审。

## 任务 4：Product Owner 精确批准

- 目标：让 `lyt` 明确批准同一个 Amendment ID、base、H、tree、diff digest 和 amendment digest，且明确不批准 W02–W09 runtime。
- 前置条件：任务 3 无未关闭 HIGH/MEDIUM。
- 状态：PENDING；完成前不得实现 v2。
