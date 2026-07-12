# 规格说明：fix-release-harness-true-chain-default-20260713

## 背景

HARNESS_SKIP_TRUE_CHAIN 未设置时竟默认 true，strict 模式也会静默跳过关键门禁。

## 范围

只有显式值 `1` 时跳过。

## 非目标

不增加其他跳过条件。

## 验收标准

默认报告 true-chain decision PROD/FIX 而不是 SKIPPED。

## 验证计划

source test 与 strict final harness。
