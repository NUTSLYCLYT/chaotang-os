# CI 验证摘要

结论：PARTIAL

## 命令

- `node --test ../scripts/canonical-deploy-paths.nodetest.mjs`
- `pnpm exec tsc --noEmit`
- `NEXT_PUBLIC_API_MODE=real pnpm build`
- `node --experimental-strip-types --test scripts/safe-prod-lifecycle.nodetest.ts scripts/prod-runtime-identity.nodetest.ts`
- `node --test scripts/safe-prod-wrappers.nodetest.mjs`
- `docker compose -f docker-compose.yml config -q`（临时空 `.env.box` fixture，执行后删除）
- 三层 harness doctor、后端 28 项代表 pytest、旧路径/secret/diff scan
- `pnpm prod:doctor`

## 结果

- 路径门禁 6/6、production 回归 24/24、后端代表检查 28/28、typecheck、production build、compose config、三层 doctor 与收口扫描全部通过。
- systemd unit runner 漂移已由 `fix-launch-s1-backend-service-runtime-contract-20260714` 通过 RED→GREEN 收敛；canonical 目标机仍需实际安装 venv。
- `prod:doctor` 正确 STOP：3050 属于外部工作区，且本 worktree 没有 immutable `builds`。未停止进程、未接管生产。
- 无 lint script；未运行浏览器 E2E，因为本轮不修改浏览器行为且禁止接管 3050。
