# 规格说明：feat-shangshufang-api-integration-20260709

## 背景

用户要求按照 `docs/shangshufang-integration-plan.md` 实现上书房页面对接方案，并明确补充：UI 层面的东西不要动，只做接口对接。

当前上书房页面已有较完整的操作入口，但部分接口只停留在前端调用或契约描述层，后端缺少真实路由；另有 `home/briefing` 口径和裁决 action 字面量不一致的问题。

## 范围

- 后端：扩展 `backend/web/routers/shangshufang.py`，提供页面已有动作对应的真实 API。
- 后端测试：补充 `backend/tests/test_shangshufang_loop_api.py`，覆盖裁决 action、首页读取、蜂群深化、PACK、润色、IM、复命、金融专项和预算闭环。
- 前端：仅调整接口事实文案和契约注释，使页面展示的 endpoint 与实际后端一致。
- 文档：保留对接方案，并明确“不改 UI 层”的边界。

## 非目标

- 不改 `/shangshufang` 页面布局。
- 不改视觉风格、按钮样式、弹窗结构、三栏结构或信息架构。
- 不新增前端 UI 组件。
- 不用前端 mock 伪造后端能力。

## 验收标准

- 上书房首屏仍通过 `GET /api/court/shangshufang/home` 读取真实后端事实源。
- 前端已有裁决 action 不触发 422。
- 页面已有增强动作对应的后端路由不再 404。
- 后端返回 source label，fallback 能力不伪装成 live。
- 修改不引入 TypeScript 编译错误。
- 上书房后端回归测试通过。

## 验证计划

- `cd backend; python -m pytest -q tests/test_shangshufang_loop_api.py tests/test_hubu_financial_reporting.py`
- `cd backend; python -m pytest -q tests/test_swarm_execution_loop_api.py`
- `cd frontend; pnpm exec tsc --noEmit`
- `cd frontend; pnpm exec playwright test e2e/shangshufang-*.spec.ts`
- 根级跨线检查：`node scripts/harness-doctor.mjs`
