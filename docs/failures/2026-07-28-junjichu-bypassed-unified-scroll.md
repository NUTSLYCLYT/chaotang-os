# 军机处绕过统一卷轴组件

## Summary

军机处案卷正文使用本地 `stagePaper` 纸面样式，因此没有呈现其他朝堂页面统一的卷轴边轴、锦边与印玺结构。

## Root Cause

军机处主舞台重构为案卷账册时保留了本地纸面容器，却没有将中央正文迁移到共享的 `EdictStage`。样式相近但组件边界不同，导致统一卷轴视觉契约未被继承。

## Prevention

需要呈现圣旨、会审案卷或只读正文的朝堂主舞台，应复用 `frontend/src/features/court-visuals/edict/EdictStage.tsx`；不得以本地纸面 CSS 重新实现卷轴结构。军机处场景测试明确断言该组件导入、渲染和 `secret` 主题。

## Detection

运行 `node --test frontend/src/features/junjichu-visual/JunjichuScene.test.ts`。该测试读取场景源码，检查共享 `EdictStage` 导入、组件渲染和 `theme="secret"`；缺少任一项即失败。

## Evidence

- [业务流基线](../decisions/0028-decree-evidence-flow-governance-baseline.md) 要求军机处仅作为真实会审的只读呈现。
- [统一卷轴组件](../../frontend/src/features/court-visuals/edict/EdictStage.tsx) 提供朝堂正文的卷轴结构。
- [军机场景](../../frontend/src/features/junjichu-visual/JunjichuScene.tsx) 现以 `EdictStage` 渲染空态与真实案卷正文。
- [回归测试](../../frontend/src/features/junjichu-visual/JunjichuScene.test.ts) 锁定接入契约。
