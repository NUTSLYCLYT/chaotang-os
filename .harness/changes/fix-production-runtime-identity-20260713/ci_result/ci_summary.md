# CI 摘要：fix-production-runtime-identity-20260713

## 命令

- `pnpm exec tsx --test scripts/prod-runtime-identity.nodetest.ts`
- `NEXT_PUBLIC_API_MODE=real pnpm build`
- `node scripts/prod-doctor.mjs --json`
- 3050/8081 curl GET、POST、404 对照；Playwright 真实登录。

## 结果

3 passed；build 通过；旧工作树正确 STOP，当前工作树 port-discipline PASS。整体仍因 true-chain 与上书房 IM 路径 404 未达 PROD。
