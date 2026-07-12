# 需求说明

## 背景

测试注入会话缺少真实登录产生的后端 cookie。

## 范围

为 harness context 增加 HttpOnly `token`，为 verify-study-edict 增加 COURT_TOKEN。

## 非目标

不修改应用鉴权实现。

## 验收标准

严格鉴权环境不再产生相关 401，契约门通过。

## 风险

必须显式提供 HARNESS_AUTH_TOKEN；缺失时保持既有行为。

## 验证计划

node test、strict final harness。
