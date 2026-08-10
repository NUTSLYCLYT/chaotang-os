# 规格说明：feat-r0-w08-browser-flow-batch3-20260728

## 背景

W08 已完成 `36/36` 黄金合同矩阵，browser flow 已达到 `4/10`。本 Packet 继续扩展真实后端浏览器验收，覆盖三种 artifact 下载、未登录边界和同租户跨用户归档回放拒绝。

## 当前实现与证据

| 分类 | 结论 | 证据路径 / 命令与时间 | 验证方式 / Owner | 是否阻塞 |
| --- | --- | --- | --- | --- |
| 已确认事实 | base EXT HEAD 为 `f11cbb445f2daa1e128a51cf3bc4c3cdd8544c87` | `git rev-parse HEAD` / 20260728 | git | 否 |
| 已确认事实 | R0-W08 authority 为 GO | `node scripts/execution-authority-v2.mjs --authorize --work-package R0-W08` / 20260728 | authority v2 | 否 |
| 已确认事实 | W08 Batch 3 browser tests 通过 | `pnpm exec playwright test --config=playwright.w08-browser-batch3.config.ts` / 20260728 | Playwright | 否 |

## 数据流与调用链

`register/login` -> `/__w07/seed` -> `/shangshufang` -> artifact delivery -> PDF/DOCX/JSON downloads -> unauthenticated direct-open denial -> owner archive creation -> second-user `/shiguan` replay denial。

## 接口、数据结构与事实源

| 契约 | 生产者 / 事实源 | 消费者 | 兼容性与验证 |
| --- | --- | --- | --- |
| Artifact downloads | backend artifact API | ContractReviewPanel | PDF/DOCX/JSON download events |
| Authenticated read model | backend contracts API | `/shangshufang` | unauthenticated no-panel assertion |
| Archive owner boundary | backend Shiguan readback | `/shiguan` | same-tenant different-user error assertion |

## 范围

- 新增 W08 Batch 3 Playwright config。
- 新增 W08 Batch 3 browser spec。
- 记录 RED/GREEN、截图 SHA-256 和剩余缺口。

## 非目标

- 不新增跨租户 seed fixture。
- 不修改后端 auth/tenant 逻辑。
- 不完成剩余 `3/10` browser flow。
- 不执行非开发用户验收。
- 不启动 W09。

## 风险与回滚边界

- 风险：当前 `/api/auth/register` 将用户挂到 default tenant；跨租户 browser proof 需要后续专门 fixture，不应把本 Packet 说成跨租户证明。
- 风险：provider preflight 输出缺少 `DEEPSEEK_API_KEY`，但本测试链路不依赖真实 LLM provider。
- 回滚：删除本 Packet、`frontend/playwright.w08-browser-batch3.config.ts` 和 `frontend/e2e/w08-browser-flow-batch3.spec.ts`。

## 验收标准

- Playwright Batch 3 输出 `3 passed`。
- root/frontend harness doctor 通过。
- W08 authority 通过。
- diff check 通过。

## 验证计划

- `pnpm install --frozen-lockfile`
- `pnpm exec playwright test --config=playwright.w08-browser-batch3.config.ts`
- `node scripts/execution-authority-v2.mjs --authorize --work-package R0-W08`
- `pnpm harness:doctor`
- `node scripts/harness-doctor.mjs`
- `git diff --check`
