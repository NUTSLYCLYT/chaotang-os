# Verification

状态：`IMPLEMENTED_LOCAL_OBSERVE_PENDING`。任何 test adapter 结果只证明逻辑，不证明真实时间或外部权威已配置。

- `node --test scripts/rollout-controller.nodetest.mjs scripts/rollout-watch.nodetest.mjs` → 41 passed, 0 failed（含 9 个 raw-fact 攻击子测）。
- `node --test scripts/rollout-authority-integration.nodetest.mjs` → 1 passed, 0 failed；真实 bwrap 固定路径、Unix socket、head/append/verify、错 policy、manual/reconcile 错绑定与 one-use replay 均验证，finally 后 PID/socket/temp 均不存在。
- `node --test scripts/multi-agent-contracts.nodetest.mjs scripts/multi-agent-lease.nodetest.mjs scripts/resource-lock.nodetest.mjs scripts/lease-attestation.nodetest.mjs scripts/worktree-manager.nodetest.mjs scripts/release-commander.nodetest.mjs scripts/test-identity.nodetest.mjs scripts/release-evidence.nodetest.mjs scripts/recovery-drill.nodetest.mjs scripts/rollout-controller.nodetest.mjs scripts/rollout-watch.nodetest.mjs` → 136 passed, 0 failed。
- `node --test --test-concurrency=1 frontend/scripts/safe-prod-wrappers.nodetest.mjs` → 8 passed, 0 failed。
- `node --experimental-strip-types --test frontend/scripts/safe-prod-lifecycle.nodetest.ts` → 13 passed, 0 failed。
- `node scripts/harness-doctor.mjs` → 0 errors, 0 warnings。
- `(cd backend && python3 scripts/harness_doctor.py)` → 0 errors, 0 warnings。
- `(cd frontend && pnpm exec tsc --noEmit -p tsconfig.json)` → 0 errors。
- `node scripts/no-broad-kill-check.mjs` → GREEN, 214 tracked production script files checked。
- `sha256sum scripts/reference/chaotang-rollout-authority.mjs` → `ec9be4dd130395f4cc4cec645aac596f09188c0d5d938728be99b296d0b566e9`，与 committed policy 相同。

真实 Observe 尚未启动。外部 required check、独立 S8 release authority、rollout anchor、真实墙钟阶段与连续 20 次 production release 尚未满足。
