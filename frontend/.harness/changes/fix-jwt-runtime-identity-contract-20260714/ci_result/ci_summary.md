# CI 验证摘要

结论：VERIFIED_COMPLETE（contract）/ NOT_READY（live）

## 命令

- `node --test scripts/jwt-runtime-identity.nodetest.mjs` → 6 passed。
- `pnpm exec tsc --noEmit` → PASS。
- `NEXT_PUBLIC_API_MODE=real pnpm build` → PASS，31 routes。
- `pnpm harness:doctor` → 0 errors / 0 warnings。
- `pnpm prod:doctor -- --json` → exit 2 / STOP（预期）。

## 结果

- 新 JWT 子门报告 `runtime_auth_state_missing`、runtime/expected key id 缺失，`shouldProbe=false`；未发送 token。
- 既有 foreign 3050 与 immutable builds 缺失仍阻止 PROD。
