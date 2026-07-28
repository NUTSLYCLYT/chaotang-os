# 上书房输入条极简样式设计

## Goal

将上书房底部中间的下旨输入条从装饰型视觉收束为文字优先的极简控件，同时不改变任何提交或附件行为。

## Confirmed design

- 输入条为纯深色背景，仅保留一圈 1px 金色边线。
- 删除输入条本身及其内部控件的渐变、发光、模糊、悬浮位移和过渡效果。
- “下旨”保留为主操作，但使用深色底、金色文字和 1px 金线，不使用金色填充。
- 附件控件显示为中文“上传附件”，不再使用图标；其隐藏 file input、选择事件和禁用状态不变。
- 润色、输入框、费用提示均使用纯色，保持现有布局与可访问标签。

## Scope and boundaries

- Only change `DevStudyWorkspace.tsx`, `DevStudyWorkspace.module.css`, their source-contract tests, and the associated task record.
- Do not change the `/study` route, the same-origin decree POST, file-selection semantics, fee notice content, or `CourtQuickDock` layout.

## Verification

- Add a source-contract assertion that rejects gradients and icon-only attachment text in composer styles/source.
- Run the focused study and court-visual test suite, then lint, typecheck, and build.
- Record unrelated global-suite and harness failures separately if they persist.
