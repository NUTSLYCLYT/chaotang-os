# 需求说明

## 背景

P8 要将后端御史封驳率真实读模型薄投影到既有六部总览，提供可审计的系统自检信号，不建立独立国力页。

## 范围

- 新增国力 overview 类型化 adapter，只消费 `/api/guoli/overview` 的 `yushi_rejection_rate`。
- 在六部总览顶部增加一张可关闭的指标卡。
- 展示值、样本数、窗口、来源、截止时间、DEMO 纳入情况和状态。
- 补 node 与 Playwright 行为测试。

## 非目标

- 不改大典，不新建国力页，不显示另外三个指标。
- 不新增 BFF、mock fallback、静态数据或前端比率计算。
- 不重设计六部场景和部门卡。

## 验收标准

LIVE 响应与 UI 数值一致；NO_DATA 不显示百分比；另外三个指标不渲染；开关关闭后卡片消失；typecheck/build/doctor/聚焦 Playwright 通过并留下截图。

## 风险

全屏六部画布容易遮挡卡片或在缩放时溢出；外部响应不完整可能被误当真实数据。卡片使用独立 overlay 层，adapter 在数据边界严格校验，失败时不合成本地值。

## 验证计划

- `pnpm test:node -- guoli-overview`
- `pnpm exec tsc --noEmit`
- `pnpm build`
- `pnpm harness:doctor`
- `pnpm exec playwright test e2e/guoli-thin-slice.spec.ts`
