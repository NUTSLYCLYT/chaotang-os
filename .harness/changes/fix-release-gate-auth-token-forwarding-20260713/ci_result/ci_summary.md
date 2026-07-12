# CI 摘要：fix-release-gate-auth-token-forwarding-20260713

## 命令

- `npx --yes tsx --test scripts/jiqun-contract-smoke.nodetest.ts`
- `HARNESS_AUTH_TOKEN=... pnpm gate:prod-release`

## 结果

PASS：1/1 回归测试；doctor 4/4；浏览器 9/9；jiqun 5/5；最终 GREEN。
