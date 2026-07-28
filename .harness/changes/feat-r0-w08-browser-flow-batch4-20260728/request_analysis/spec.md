# 规格说明：feat-r0-w08-browser-flow-batch4-20260728

## 背景

W08 已完成 `36/36` 黄金合同矩阵，browser flow 已达到 `7/10`。本 Packet 收满真实后端浏览器验收的最后三条，覆盖幂等防重、刷新后状态保持、归档后只读回放。

## 当前实现与证据

| 分类 | 结论 | 证据路径 / 命令与时间 | 验证方式 / Owner | 是否阻塞 |
| --- | --- | --- | --- | --- |
| 已确认事实 | base EXT HEAD 为 `33bf3813d8f944ebf9aa1f0521ea61875216ff9a` | `git rev-parse HEAD` / 20260728 | git | 否 |
| 已确认事实 | base tree 为 `6f5128978c13099f07bc6ac9c94d0a6ff77d0441` | `git rev-parse HEAD^{tree}` / 20260728 | git | 否 |
| 已确认事实 | R0-W08 authority 为 GO | `node scripts/execution-authority-v2.mjs --authorize --work-package R0-W08` / 20260728 | authority v2 | 否 |
| 已确认事实 | W08 Batch 4 browser tests 通过 | `pnpm exec playwright test --config=playwright.w08-browser-batch4.config.ts` / 20260728 | Playwright | 否 |

## 数据流与调用链

`register/login` -> `/__w07/seed` -> `/shangshufang` -> duplicate artifact delivery click -> READY reload readback -> PDF/DOCX/JSON downloadable buttons -> decision archive -> `/shiguan` exact read-only audit replay。

## 接口、数据结构与事实源

| 契约 | 生产者 / 事实源 | 消费者 | 兼容性与验证 |
| --- | --- | --- | --- |
| Delivery idempotency | ContractReviewPanel + backend artifact API | browser action | one POST observed after double click |
| Delivery readback | backend contracts API | ContractReviewPanel | READY persists after reload |
| Archive read-only replay | backend Shiguan readback | `/shiguan` | read-only audit and no old action buttons |

## 范围

- 新增 W08 Batch 4 Playwright config。
- 新增 W08 Batch 4 browser spec。
- 记录 RED/GREEN、截图 SHA-256 和剩余缺口。

## 非目标

- 不修改后端 idempotency implementation。
- 不修改前端 runtime behavior。
- 不执行非开发用户验收。
- 不启动 W09。

## 风险与回滚边界

- 风险：中途本地 EXT 被推进到 `33bf3813`，旧 isolated worktree authority 一度 STOP；已 fast-forward 到最新 EXT 后重新验证。
- 风险：provider preflight 输出缺少 `DEEPSEEK_API_KEY`，但本测试链路不依赖真实 LLM provider。
- 回滚：删除本 Packet、`frontend/playwright.w08-browser-batch4.config.ts` 和 `frontend/e2e/w08-browser-flow-batch4.spec.ts`。

## 验收标准

- Playwright Batch 4 输出 `3 passed`。
- root/frontend harness doctor 通过。
- W08 authority 通过。
- diff check 通过。

## 验证计划

- `pnpm install --frozen-lockfile`
- `pnpm exec playwright test --config=playwright.w08-browser-batch4.config.ts`
- `node scripts/execution-authority-v2.mjs --authorize --work-package R0-W08`
- `pnpm harness:doctor`
- `node scripts/harness-doctor.mjs`
- `git diff --check`
