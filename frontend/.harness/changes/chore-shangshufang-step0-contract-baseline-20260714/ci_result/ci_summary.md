# CI 验证摘要

结论：VERIFIED_PARTIAL

## 命令

- `npx --yes tsx --test src/features/shangshufang/api/contract-baseline.nodetest.ts` → exit 0，2/2。
- `pnpm exec tsc --noEmit` → exit 0。
- `pnpm harness:doctor` → exit 0，0 errors / 0 warnings。
- `pnpm prod:doctor -- --json` → exit 2，STOP（foreign 3050 + missing builds）。

## 结果

- 新前端 characterization test 与类型通过。
- 未运行 build/E2E：无 UI/runtime 行为变化。
- 发布仍 STOP；不得声明 frontend PROD/READY。
