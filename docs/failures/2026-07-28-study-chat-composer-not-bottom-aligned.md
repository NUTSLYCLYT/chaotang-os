# 上书房咨询输入框未贴住抽屉底部

## Summary

清除抽屉底部 padding 和表单间距后，咨询输入框仍未贴住抽屉底边。局部 CSS 契约通过，但页面布局仍不符合用户看到的结果。

## Root Cause

聊天区继续使用 `height: calc(62% - 72px)`，抽屉本身却不是纵向 flex 或 grid 容器。该百分比高度只计算一个近似值，没有任何父级布局约束把聊天区和其末尾表单推到抽屉底边；删除 padding 只能缩小空白，不能消除固定高度计算留下的剩余空间。

## Prevention

抽屉采用纵向 flex 布局：标题保持内容高度，最近回奏区保留 38% 基准，聊天区使用 `flex: 1` 接收全部剩余高度。输入表单位于聊天区末尾，消息列表使用 `flex: 1`，禁止恢复基于百分比减常量的聊天区高度公式。

## Detection

`frontend/src/features/study-visual/StudySideDrawers.test.ts` 的“chat flexes to the drawer bottom instead of using percentage height math”用例同时检查抽屉、最近回奏区和聊天区三层高度分配，并明确拒绝旧的 `calc(62% - 72px)`。

## Evidence

- `frontend/src/features/study-visual/StudySideDrawers.module.css`
- `frontend/src/features/study-visual/StudySideDrawers.test.ts`
- `docs/superpowers/specs/2026-07-28-chancellor-wechat-chat-design.md`
- `docs/superpowers/plans/2026-07-28-chancellor-wechat-chat.md`
