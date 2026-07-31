# Study 侧栏边缘按钮动画假绿

## Summary

侧栏面板已经具备打开和收起动画，但左右边缘按钮固定在视口边缘，没有随面板运动；自动化测试仍全部通过。

## Root Cause

按钮和面板属于两个独立的 fixed 定位与动画系统。测试只验证面板 keyframes 和按钮静态存在，
没有验证两者共享动画阶段、位置关系或关闭期间的共同生命周期，因此形成结构性假绿。

## Prevention

边缘按钮与面板必须消费同一个 `open/closing` 状态和同一组时长、曲线、宽度变量。关闭入口只保留
一个边缘按钮组件，不再在面板内部维护另一套关闭按钮和焦点引用。

## Detection

新增契约测试锁定按钮与面板共享 `rendered`、`phase` 和关闭生命周期，并检查打开/关闭方向及箭头。
浏览器验收必须在动画中间时刻测量按钮边界与面板外沿的差值，而不能只看动画结束截图。
`node scripts/check_harness.mjs` 继续校验本失败记录章节完整性。

## Evidence

- `frontend/src/features/study-visual/StudySideDrawers.tsx`
- `frontend/src/features/study-visual/StudySideDrawers.module.css`
- `frontend/src/features/study-visual/AdvisorDrawerShell.tsx`
- `frontend/src/features/study-visual/AdvisorDrawerShell.module.css`
- `docs/superpowers/specs/2026-07-30-study-drawer-attached-toggle-design.md`
