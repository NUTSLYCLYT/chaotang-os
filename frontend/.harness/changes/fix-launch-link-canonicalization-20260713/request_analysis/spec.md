# 需求说明

## 背景

退役链接和双 basePath 导致现役页面控制台 404。

## 范围

统一首发路径，移除 Link/router 的 withBasePath。

## 非目标

不处理移动布局。

## 验收标准

军机处、大殿、户部 harness 全绿。

## 风险

查询参数保留，仅路由基址变化。

## 验证计划

node test、tsc、build、final harness。
