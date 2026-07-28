# 六部总览全屏诉求被误解

## Summary

用户要求六部总览的中间主模块全屏展示。先前改动只删除了选中部门后的叠层轨道，保留了受高度和外边距限制的画布容器，因此未满足可见需求。

## Root Cause

把“不要中间的弹窗”错误收窄为“删除部门选择叠层”，没有将后续“全屏”明确落实到 `.overview`、`.canvasViewport` 和沉浸式页面外壳的尺寸约束上。

## Prevention

涉及视觉尺寸词（全屏、居中、铺满）时，验收标准必须列出受影响容器及其目标视口尺寸；在实现前以当前页面结构逐层确认全屏范围，而不是只依据交互组件名称推断。

## Detection

为 `/liubu` 视觉源测试加入针对主画布视口尺寸、外边距和溢出的断言；人工验收以桌面浏览器中画布是否从可见页面边缘铺满为准。`scripts/check_harness.mjs` 只校验治理结构，不能替代此视觉检查。

## Evidence

- `frontend/src/features/ministries-visual/MinistryOverviewScene.tsx`
- `frontend/src/features/ministries-visual/ministries.module.css`
- `docs/product/tasks/2026-07-28-liubu-fullscreen-overview.md`
