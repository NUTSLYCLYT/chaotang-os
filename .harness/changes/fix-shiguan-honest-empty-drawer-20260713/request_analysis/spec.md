# 规格说明：fix-shiguan-honest-empty-drawer-20260713

## 背景

史馆真实案卷为 0，但抽屉从静态常量展示虚构事件、决策与 AI 摘要，并提供无真实写入的归档按钮。

## 范围

保留抽屉外观，收口为真实能力边界说明，移除全部静态业务内容与伪动作。

## 非目标

不新增史册生成 API，不重做史馆页面。

## 验收标准

无静态样例引用或伪归档按钮；浏览器空态与说明一致。

## 验证计划

TDD source guard、tsc、build、production Playwright。
