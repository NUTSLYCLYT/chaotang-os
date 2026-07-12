# 规格说明：fix-release-gate-auth-token-forwarding-20260713

## 背景

外层发布门使用 `HARNESS_AUTH_TOKEN`，但 jiqun 契约烟测未识别该变量，导致受保护端点统一 401。

## 范围

仅在前端契约烟测的 token 候选链增加 `HARNESS_AUTH_TOKEN`，并增加回归测试。

## 非目标

不修改后端鉴权、API schema 或业务逻辑。

## 验收标准

单测通过，真实 8081 契约 5/5，完整 production release gate GREEN。

## 验证计划

`npx --yes tsx --test scripts/jiqun-contract-smoke.nodetest.ts`；`HARNESS_AUTH_TOKEN=... pnpm gate:prod-release`。
