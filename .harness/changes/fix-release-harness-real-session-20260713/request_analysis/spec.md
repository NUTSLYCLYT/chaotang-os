# 规格说明：fix-release-harness-real-session-20260713

## 背景

真实登录会设置后端 `token` cookie；harness 只设置前端 cookie，原生 fetch 因此 401。

## 范围

同一真实测试 token 同时种前端/后端 cookie，并作为 COURT_TOKEN 传给契约门。

## 非目标

不放宽后端鉴权、不记录 token。

## 验收标准

上书房、史馆无 401；study-edict strict gate 通过。

## 验证计划

source test 与真实 final harness。
