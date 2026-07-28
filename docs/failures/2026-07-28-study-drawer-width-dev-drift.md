# 上书房侧抽屉宽度偏离 dev

## Summary

上书房左右侧抽屉完成配色统一后，用户仍看到面板明显过宽。当前实现为桌面端 `420px`，没有同步 `dev` 同类面板的响应式宽度。

## Root Cause

上一轮只围绕颜色一致性建立验收和回归测试，未把用户界面参考源 `dev` 的几何尺寸纳入对比范围。新抽屉最初使用通用 `min(420px, 100vw)`，而 `dev` 的真实参考是小视口 `44vw`、`sm` 为 `260px`、`lg` 为 `300px`。

## Prevention

后续凡是要求“参考 dev”的视觉迁移，任务定义必须分别登记配色、尺寸、定位和响应式断点；只迁移明确授权的视觉维度，同时为每个维度建立源代码守卫或浏览器验收。

## Detection

`frontend/src/features/study-visual/StudySideDrawers.test.ts` 应直接断言侧抽屉包含与 `dev` 等价的 `44vw`、`260px`、`300px` 三档宽度以及 `max-width: 100vw`。专项测试与前端全量测试会在尺寸再次漂移时失败。

## Evidence

- 当前实现：`frontend/src/features/study-visual/StudySideDrawers.module.css`
- 回归测试：`frontend/src/features/study-visual/StudySideDrawers.test.ts`
- 参考实现：`dev:frontend/src/features/shared/components/global-edict-quick-dock.tsx`
- 产品任务：`docs/product/tasks/2026-07-28-study-drawer-dev-width.md`
