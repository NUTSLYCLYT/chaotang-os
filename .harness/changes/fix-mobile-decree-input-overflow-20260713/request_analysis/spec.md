# 规格说明：fix-mobile-decree-input-overflow-20260713

## 背景

slot 模式操作行强制单行，按钮总宽超过 390px 视口。

## 范围

手机允许 flex wrap，sm 以上恢复单行。

## 非目标

不改变按钮、交互或桌面布局。

## 验收标准

390px 无横向溢出。

## 验证计划

node test、tsc、build、production harness。
