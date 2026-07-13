# CI 摘要：fix-launch-s1-p0-canonical-deploy-paths-20260714

## 命令

- TDD：`node --test scripts/canonical-deploy-paths.nodetest.mjs`
- 类型/构建：`pnpm exec tsc --noEmit`；`NEXT_PUBLIC_API_MODE=real pnpm build`
- 回归：production lifecycle/identity/wrapper node tests；后端代表 pytest
- 部署静态检查：空 `.env.box` fixture 下 `docker compose ... config -q`；`systemd-analyze verify`
- 架构：根、前端、后端 harness doctor
- 发布诚实门：`pnpm prod:doctor`
- 收口：旧路径 scan、changed-file secret scan、`git diff --check`

## 结果

- RED：0/6 passed；六个目标分别命中旧路径。
- GREEN/最终路径门禁：6/6 passed。
- TypeScript：通过；production build：显式 `NEXT_PUBLIC_API_MODE=real` 后通过。
- production lifecycle/identity/wrapper：24/24 passed；后端代表检查：28/28 passed。
- compose config：通过；空 `.env.box` 仅为本地验证 fixture，已删除且未进入 git。
- 三层 doctor：通过；旧路径、secret 与 diff 检查：通过。
- systemd：本闭环当时发现的两个 runner 漂移已由 `fix-launch-s1-backend-service-runtime-contract-20260714` 统一；canonical 目标机仍需实际执行 venv 安装。
- `prod:doctor`：预期 STOP，证据为 `foreign_prod_3050` 与缺少 immutable `builds`。本变更不是生产 READY。
- 未提供 lint：`frontend/package.json` 没有 lint script；build 内置 TypeScript 已通过。
