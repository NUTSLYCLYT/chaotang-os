# 规格说明：feat-r0-w08-browser-flow-batch1-20260728

## 背景

W08 已完成 `36/36` 黄金合同矩阵。下一阶段需要推进 `10/10 real backend browser flow`，并覆盖 ContractReviewPack 下载与 Shiguan audit replay。本 Packet 先登记第 1 条真实浏览器闭环基线。

## 当前实现与证据

| 分类 | 结论 | 证据路径 / 命令与时间 | 验证方式 / Owner | 是否阻塞 |
| --- | --- | --- | --- | --- |
| 已确认事实 | EXT exact HEAD 为 `448110ce0dfe759b4de10cbed373853c41202189` | `git rev-parse HEAD` / 20260728 | git | 否 |
| 已确认事实 | EXT tree 为 `b6678f66ce96bf22e7fa9d8632af91ebd7e2669b` | `git rev-parse HEAD^{tree}` / 20260728 | git | 否 |
| 已确认事实 | R0-W08 authority 为 GO | `node scripts/execution-authority-v2.mjs --authorize --work-package R0-W08` / 20260728 | authority v2 | 否 |
| 已确认事实 | 真实后端浏览器流通过 | `pnpm exec playwright test --config=playwright.w07.config.ts` / 20260728 | Playwright | 否 |

## 数据流与调用链

`register/login` -> `/__w07/seed` -> `/shangshufang` task read model -> artifact delivery -> JSON download -> decision -> archive receipt -> `/shiguan` exact archive replay。

## 接口、数据结构与事实源

| 契约 | 生产者 / 事实源 | 消费者 | 兼容性与验证 |
| --- | --- | --- | --- |
| Real JWT session | backend auth API | browser session helper | Playwright pass |
| Contract task read model | backend contracts API | `/shangshufang` | visible contract panel |
| Artifact delivery | backend artifact API | browser action/download | `201` and JSON download |
| Archive readback | backend Shiguan read model | `/shiguan` | exact archive panel visible |

## 范围

- 登记 W08 browser flow `1/10` 证据。
- 记录截图哈希和命令输出摘要。
- 明确本轮复用 W07 RUNNABLE_MINIMUM fixture 作为 W08 browser baseline。

## 非目标

- 不新增 W08 专属 seed route。
- 不修改运行时代码。
- 不完成剩余 `9/10` browser flow。
- 不执行非开发用户验收。
- 不启动 W09。

## 风险与回滚边界

- 风险：此证据复用 W07 fixture 名称，语义上只应计为 W08 baseline，不应宣传为完整 W08 验收。
- 风险：provider preflight 输出缺少 `DEEPSEEK_API_KEY`，但该测试链路不依赖真实 LLM provider。
- 回滚：删除本 Packet 目录。

## 验收标准

- Playwright `w07-contract-runnable-minimum.spec.ts` 通过。
- 截图证据存在并可校验 SHA-256。
- root authority 仍为 R0-W08 GO。

## 验证计划

- `pnpm install --frozen-lockfile`
- `pnpm exec playwright test --config=playwright.w07.config.ts`
- `node scripts/execution-authority-v2.mjs --authorize --work-package R0-W08`
- `git diff --check`
