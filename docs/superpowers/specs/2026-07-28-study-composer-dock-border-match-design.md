# 上书房输入条复用底栏边线设计

## Confirmed design

- Composer 外边框精确使用底部 `CourtQuickDock` 的 `border-top` 值：`1px solid rgba(240, 198, 106, 0.28)`。
- 输入框、按钮、附件和提示仍使用此前确认的暗金色 `#a77c35`。
- 不改变背景、圆角、结构、提交或附件行为。

## Verification

- Source-contract test compares composer border declaration with the observed quick dock border value.
- Run focused study test, lint, and build.
