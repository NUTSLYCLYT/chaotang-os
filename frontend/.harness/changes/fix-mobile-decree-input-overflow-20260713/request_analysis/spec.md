# 需求说明

## 背景

润色和下旨按钮越出手机视口。

## 范围

slot 操作行 mobile wrap、sm nowrap。

## 非目标

不改桌面外观。

## 验收标准

390px production overflow 检查为空。

## 风险

窄屏操作行会增加一行高度。

## 验证计划

node test、tsc、build、final harness。
