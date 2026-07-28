# 朝堂底栏被空中轨挤窄且右入口未贴边

## Summary

共享朝堂底栏虽然背景覆盖了视口，但在没有中间模块时仍保留一条空网格轨道，导致左右入口只占两侧小块区域；“问钦天监”同时保留向左排列和固定右缩进，视觉上没有贴近右边界。

## Root Cause

底栏把“未来可能出现的中间模块”固化成永久三列布局，却没有把模块存在性建模为组件状态。右入口又使用 `justify-self: end`、`justify-content: flex-start` 和固定 `40px` 右内边距；移动端的独立网格模板与 420px 内边距覆盖还可能压过后续修复。

## Prevention

可选布局区域必须由显式的可空插槽驱动：无插槽使用两列平分，有插槽才启用三列。网格子项应显式声明列位置和 `border-box`，边缘内边距必须保留 safe-area；响应式媒体规则只能覆盖对应 modifier，不能在基础 `.dock` 上重新引入固定列结构。

## Detection

`courtQuickDockLayout.test.ts` 验证空值与元素的布局状态；`courtVisuals.test.ts` 精确提取基础及 959px、767px、420px CSS 区段，检查两列/三列模板、右侧 stretch/end 对齐、safe-area、`border-box`，并禁止旧 40px 缩进和 420px 裸覆盖。完成修改后运行 `npm test`、`npm run lint`、`npm run typecheck` 和 `npm run build`。真实页面验收还需使用已登录会话检查受保护朝堂页面。

## Evidence

- `frontend/src/features/court-visuals/CourtQuickDock.tsx`
- `frontend/src/features/court-visuals/CourtQuickDock.module.css`
- `frontend/src/features/court-visuals/courtQuickDockLayout.ts`
- `frontend/src/features/court-visuals/courtQuickDockLayout.test.ts`
- `frontend/src/features/court-visuals/courtVisuals.test.ts`
- `docs/superpowers/specs/2026-07-28-court-quick-dock-dynamic-center-slot-design.md`
- `docs/superpowers/plans/2026-07-28-court-quick-dock-dynamic-center-slot.md`
