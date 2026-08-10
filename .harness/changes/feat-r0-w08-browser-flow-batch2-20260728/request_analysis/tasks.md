# 任务：feat-r0-w08-browser-flow-batch2-20260728

## 任务 1

- 目标：新增 W08 Batch 2 real backend browser flow spec。
- 前置条件：本地 EXT `a171be76`，R0-W08 authority 为 GO。
- 输入：既有 W07 runnable backend launcher、real backend auth helper、W07 browser flow baseline。
- 输出：`frontend/e2e/w08-browser-flow-batch2.spec.ts`。
- 涉及文件：frontend E2E test only。
- 状态 / 数据变化：只使用临时 SQLite/test schema。
- 验证命令与证据：Playwright。
- 回滚边界：删除新增 spec。
- 完成定义：新增 3 个可区分 browser flow assertion groups。

## 任务 2

- 目标：新增 W08 Batch 2 Playwright config。
- 前置条件：任务 1 可运行。
- 输入：既有 `frontend/playwright.w07.config.ts`。
- 输出：`frontend/playwright.w08-browser-batch2.config.ts`。
- 涉及文件：frontend test config only。
- 状态 / 数据变化：无运行时数据变化。
- 验证命令与证据：Playwright 自动启动隔离后端 8081 和前端 3002。
- 回滚边界：删除新增 config。
- 完成定义：不绑定 3050，不复用生产状态。

## 任务 3

- 目标：登记 Packet 证据。
- 前置条件：Playwright GREEN。
- 输入：命令输出、截图哈希、authority 输出。
- 输出：本 Packet 文档。
- 涉及文件：`.harness/changes/feat-r0-w08-browser-flow-batch2-20260728/`。
- 状态 / 数据变化：无运行时数据变化。
- 验证命令与证据：doctor、authority、diff check。
- 回滚边界：删除本 Packet 目录。
- 完成定义：候选可受控 fast-forward 整合。
