# 需求说明

## 背景

最终发布门的真实会话变量未传入 jiqun 烟测，使 4 个受保护端点返回 401。

## 范围

让 `buildAuthToken()` 在专用 token 之后识别 `HARNESS_AUTH_TOKEN`；增加回归测试。

## 非目标

不改后端鉴权、不改端点 schema、不改 UI。

## 验收标准

回归测试通过，8081 契约 5/5，完整发布门 GREEN。

## 风险

错误 token 优先级可导致误用会话；因此保留 jiqun 专用 token 最高优先级。

## 验证计划

`npx --yes tsx --test scripts/jiqun-contract-smoke.nodetest.ts`；`HARNESS_AUTH_TOKEN=... pnpm gate:prod-release`。
