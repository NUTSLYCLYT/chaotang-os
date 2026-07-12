# 需求说明

## 背景

上书房 IM 绕过 transport alias，直接请求后端不存在的旧路径，导致四个会话初始化 404。

## 范围

使用后端 OpenAPI 已声明的 `/api/shangshufang/im`，同步测试拦截。

## 非目标

不新增 BFF，不修改页面布局或后端业务。

## 验收标准

production 浏览器 IM GET/POST 200 且控制台 0 error。

## 风险

旧 E2E mock 若未同步会失去拦截，因此全量搜索并同步五处。

## 验证计划

node test、tsc、build、Playwright production smoke。
