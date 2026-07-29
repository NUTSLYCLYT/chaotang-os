# 任务：docs-ext-full-asset-reconciliation-20260729

## 任务 1：建立资产清算基线

- 目标：确认 EXT-A9 不依赖 W09，并建立所有资产的处置方法。
- 前置条件：R0-W08 GO，R0-W09 STOP。
- 输入：git refs、worktree list、change summary list。
- 输出：`asset_reconciliation_ledger.md`。
- 涉及文件：本 Packet。
- 状态 / 数据变化：无运行态变化。
- 验证命令与证据：
  - `git worktree list --porcelain`
  - `git for-each-ref --format=... refs/heads refs/remotes`
  - `find .harness/changes backend/harness/changes frontend/.harness/changes -maxdepth 2 -name summary.md`
- 回滚边界：删除本 Packet。
- 完成定义：ledger 有 taxonomy、inventory scale、priority lanes、first batch。

## 任务 2：按资产族分组

- 目标：把 206 refs、约 145 worktree、238 change summaries 分成可审资产族。
- 前置条件：任务 1 完成。
- 输入：inventory baseline。
- 输出：asset-family table。
- 涉及文件：未来 EXT-A9 ledger updates。
- 状态 / 数据变化：docs-only。
- 验证命令与证据：ledger review。
- 回滚边界：revert ledger update。
- 完成定义：每个资产族有 lane、owner、initial disposition。

## 任务 3：第一批高价值资产取舍

- 目标：先处理部门 runtime、Jinyiwei real fetch、harness-only、temporal decision、deep module、Menxia/Gongbu/P8/P9。
- 前置条件：任务 2 至少覆盖第一批资产。
- 输入：first high-value batch。
- 输出：每项 `ABSORB` / `REBUILD` / `SUPERSEDED` / `ARCHIVE` / `REJECT` / `CONFLICT_DECISION`。
- 涉及文件：ledger 和后续 Packets。
- 状态 / 数据变化：除明确批准的 absorption Packet 外，不改产品代码。
- 验证命令与证据：按资产定义。
- 回滚边界：每个 Packet 独立回滚。
- 完成定义：第一批资产全部有 final disposition 或 blocked reason。
