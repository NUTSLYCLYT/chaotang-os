# 需求说明

## 背景

关键 true-chain 门禁被默认静默跳过。

## 范围

skip 仅接受显式 `1`。

## 非目标

不改变 true-chain 判定标准。

## 验收标准

strict 报告 decision PROD 而非 SKIPPED。

## 风险

本地页面调试需要显式设置跳过变量。

## 验证计划

node test、strict final harness。
