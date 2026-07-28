# 任务：feat-r0-w08-browser-flow-batch1-20260728

## 任务 1

- 目标：在 isolated worktree 内运行真实后端浏览器闭环。
- 前置条件：本地 EXT `448110ce`，R0-W08 authority 为 GO。
- 输入：既有 `frontend/playwright.w07.config.ts` 与 `frontend/e2e/w07-contract-runnable-minimum.spec.ts`。
- 输出：Playwright pass/fail 结果与截图。
- 涉及文件：无产品代码修改。
- 状态 / 数据变化：只使用临时 SQLite/test schema。
- 验证命令与证据：`pnpm exec playwright test --config=playwright.w07.config.ts`。
- 回滚边界：删除临时测试输出。
- 完成定义：`1 passed`。

## 任务 2

- 目标：将测试结果登记为 W08 browser flow `1/10` evidence。
- 前置条件：任务 1 通过。
- 输入：Playwright 输出、截图哈希、authority 输出。
- 输出：本 Packet 文档。
- 涉及文件：`.harness/changes/feat-r0-w08-browser-flow-batch1-20260728/`。
- 状态 / 数据变化：无运行时数据变化。
- 验证命令与证据：`git diff --check`、authority check。
- 回滚边界：删除本 Packet 目录。
- 完成定义：候选可受控 fast-forward 整合。
