# CI 摘要：feat-lifu-four-office-desk-20260713

## 命令

- `npx --yes tsx --test src/features/lifu/components/lifu-office-wiring.nodetest.ts src/features/lifu/lib/*.nodetest.ts`
- `pnpm exec playwright test e2e/lifu-office.spec.ts --project=chromium --workers=1`
- `pnpm exec tsc --noEmit -p tsconfig.json`
- `NEXT_PUBLIC_API_MODE=real pnpm build`
- `HARNESS_AUTH_TOKEN=... pnpm gate:prod-release`

## 结果

PASS：37/37 nodetest，6/6 Playwright，TypeScript/build 通过，release gate GREEN。
