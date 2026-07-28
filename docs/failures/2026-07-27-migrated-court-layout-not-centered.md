# 迁入朝堂页面未正确居中

## Summary

迁入的部分朝堂页面在超宽屏中整体靠左，并在部分中等宽度视口下裁切右侧栏。问题来自迁入 UI 原有的布局约束，而现有验证未覆盖这些视口。

## Root Cause

共享沉浸式容器设置了 `1600px` 最大宽度，但没有在父网格中水平居中。与此同时，军机处、部院部门/衙署和仕官台的固定三栏总宽度高于各自响应式断点，造成断点触发前的不可容纳区间。

## Prevention

将最大宽度与居中规则作为共享容器的同一布局契约，并让固定列布局的响应式断点由列最小宽度、间距和场景内边距共同决定。迁移 UI 时同时核对源页面在超宽屏和断点临界区间的行为。

## Detection

前端源码契约测试验证共享容器的居中规则及固定三栏的安全断点；完成实现后运行 `npm test`。人工浏览器验收至少覆盖超过 `1600px` 的超宽屏和约 `1200px` 的中等宽度视口，因为仅检查常见桌面宽度无法发现本问题。

## Evidence

- `frontend/src/features/court-visuals/ImmersiveCourtShell.module.css`
- `frontend/src/features/junjichu-visual/JunjichuScene.module.css`
- `frontend/src/features/ministries-visual/ministries.module.css`
- `frontend/src/features/shiguan-visual/ShiguanWorkspace.module.css`
- `docs/superpowers/specs/2026-07-27-centered-court-layout-design.md`
