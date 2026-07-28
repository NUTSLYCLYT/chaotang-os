# 规格说明：feat-r0-w08-browser-flow-batch2-20260728

## 背景

W08 已完成 `36/36` 黄金合同矩阵，并已登记 browser flow `1/10` baseline。为了先跑通完整验收面，本 Packet 将真实后端浏览器流扩展到 `4/10`。

## 当前实现与证据

| 分类 | 结论 | 证据路径 / 命令与时间 | 验证方式 / Owner | 是否阻塞 |
| --- | --- | --- | --- | --- |
| 已确认事实 | base EXT HEAD 为 `a171be762ebe8f2f3d401100e4d4b6972fc9c2ad` | `git rev-parse HEAD` / 20260728 | git | 否 |
| 已确认事实 | R0-W08 authority 为 GO | `node scripts/execution-authority-v2.mjs --authorize --work-package R0-W08` / 20260728 | authority v2 | 否 |
| 已确认事实 | W08 Batch 2 browser tests 通过 | `pnpm exec playwright test --config=playwright.w08-browser-batch2.config.ts` / 20260728 | Playwright | 否 |

## 数据流与调用链

`register/login` -> `/__w07/seed` -> `/shangshufang` -> artifact delivery -> JSON download -> decision archive -> `/shiguan` exact archive replay -> tampered archive rejection -> partial refresh readback。

## 接口、数据结构与事实源

| 契约 | 生产者 / 事实源 | 消费者 | 兼容性与验证 |
| --- | --- | --- | --- |
| Real JWT session | backend auth API | browser localStorage auth | Playwright pass |
| Contract task read model | backend contracts API | `/shangshufang` | panel/status/action assertions |
| Artifact delivery | backend artifact API | browser download action | `201` and JSON download |
| Archive receipt/readback | backend decision + Shiguan APIs | `/shiguan` | exact lineage/tamper assertions |

## 范围

- 新增 W08 Batch 2 Playwright config。
- 新增 W08 Batch 2 browser spec。
- 记录 test artifacts SHA-256。

## 非目标

- 不新增生产 API。
- 不改后端 launcher 逻辑。
- 不完成剩余 `6/10` browser flow。
- 不执行非开发用户验收。
- 不启动 W09。

## 风险与回滚边界

- 风险：backend launcher 仍命名为 W07 runnable，这是历史测试底座；本 Packet 仅复用其隔离启动能力。
- 风险：provider preflight 输出缺少 `DEEPSEEK_API_KEY`，但本测试链路不依赖真实 LLM provider。
- 回滚：删除本 Packet、`frontend/playwright.w08-browser-batch2.config.ts` 和 `frontend/e2e/w08-browser-flow-batch2.spec.ts`。

## 验收标准

- Playwright Batch 2 输出 `3 passed`。
- root/frontend harness doctor 通过。
- W08 authority 通过。
- diff check 通过。

## 验证计划

- `pnpm install --frozen-lockfile`
- `pnpm exec playwright test --config=playwright.w08-browser-batch2.config.ts`
- `node scripts/execution-authority-v2.mjs --authorize --work-package R0-W08`
- `pnpm harness:doctor`
- `node scripts/harness-doctor.mjs`
- `git diff --check`
