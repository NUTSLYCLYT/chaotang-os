# 上书房输入条暗金色统一设计

## Goal

将上书房底部中间输入条的亮金色强调统一替换为低饱和暗金色，保持此前确认的极简纯色结构。

## Confirmed design

- Composer 范围内的主暗金色固定为 `#a77c35`。
- 适用对象：外边线、输入框边线与聚焦边线、润色与上传附件文字、下旨按钮边线与文字、费用/本地提示边线与文字。
- 透明描边使用同一暗金的 rgba 等价色，不保留亮金 `#f0c66a`。
- 深色背景、1px 边线、无渐变、无发光、无模糊、无悬浮动效保持不变。

## Boundaries

- Only composer-specific selectors in `DevStudyWorkspace.module.css` change.
- Do not alter the onboarding ritual, page warning, response parchment, data flow, or any interaction.

## Verification

- Add a source-contract assertion that composer-specific CSS contains `#a77c35` and no `#f0c66a`.
- Run the focused study test and static frontend checks; report unrelated failures separately.
