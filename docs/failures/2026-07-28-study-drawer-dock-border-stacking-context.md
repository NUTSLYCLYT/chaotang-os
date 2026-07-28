# 上书房抽屉未遮住 dock 顶边

## Summary

左右抽屉虽然设置了高于底部 dock 的 `z-index`，实际仍无法遮住 dock 的 1px 金色顶边。源码契约测试错误地把数值存在当作视觉层级生效，产生了用户可见的假绿。

## Root Cause

抽屉原本渲染在 `ImmersiveCourtShell` 的 `main.content` 内；该 grid item 通过 `z-index: 1` 创建了独立层叠上下文。dock 是该层叠上下文之外的兄弟节点并使用 `z-index: 215`，因此抽屉自身的 `z-index: 216` 只能在 `content` 内排序，无法越过 dock。

## Prevention

固定浮层必须由 `ImmersiveCourtShell` 的顶层 `overlay` 插槽渲染，与 dock 成为同级节点。测试同时约束 overlay 的类型、shell 中的 DOM 顺序以及上书房必须通过该插槽挂载抽屉，禁止仅比较孤立的 `z-index` 数字。

## Detection

`frontend/src/features/court-visuals/courtVisuals.test.ts` 检查 overlay 位于 `</main>` 与 `CourtQuickDock` 之间；`frontend/src/features/study-visual/DevStudyWorkspace.test.ts` 检查抽屉只通过 `overlay={drawers}` 挂载；`frontend/src/features/study-visual/StudySideDrawers.test.ts` 继续约束 1px 重叠尺寸。

## Evidence

- `frontend/src/features/court-visuals/ImmersiveCourtShell.tsx`
- `frontend/src/features/court-visuals/types.ts`
- `frontend/src/features/study-visual/DevStudyWorkspace.tsx`
- `frontend/src/features/study-visual/StudySideDrawers.module.css`
- `frontend/src/features/court-visuals/courtVisuals.test.ts`
- `frontend/src/features/study-visual/DevStudyWorkspace.test.ts`
- `frontend/src/features/study-visual/StudySideDrawers.test.ts`
