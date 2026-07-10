# CI 摘要：docs-frontend-backend-contract-alignment-plan-20260709

## 命令

- `Get-Content frontend/AGENTS.md`
- `Get-Content backend/AGENTS.md`
- `rg -n "fetch\\(|jiqun-api|/api/|chaotang\\." frontend/src backend/web -g "*.ts" -g "*.tsx" -g "*.py"`
- `Get-Content frontend/src/lib/backend-api.ts`
- `Get-Content frontend/src/lib/jiqun-api.ts`
- `Get-Content frontend/src/features/bureaus/hooks/useBureauPageView.ts`
- `Get-Content backend/web/main.py | Select-Object -First 280`
- `node scripts/api-contract-inventory.mjs`
- `node scripts/api-contract-boundary-audit.mjs`
- `node scripts/api-contract-p0-matrix-audit.mjs`
- `node scripts/api-contract-all-matrix-audit.mjs`
- `node scripts/api-contract-exact-test-audit.mjs`
- `node scripts/api-contract-alias-retirement-audit.mjs`
- `node scripts/api-contract-client-layer-audit.mjs`
- `node scripts/api-contract-frontend-access-audit.mjs`
- `node scripts/api-contract-response-envelope-audit.mjs`
- `node scripts/api-contract-source-label-audit.mjs`
- `node scripts/api-contract-stability.mjs`
- `node scripts/api-contract-implementation-audit.mjs`
- `cd frontend; npx --yes tsx --test src/lib/backend-api.nodetest.ts`
- `cd frontend; npx --yes tsc --noEmit --skipLibCheck --target ES2022 --moduleResolution node src/lib/contracts/backend-openapi-2026-07-09.d.ts`
- `cd frontend; npx --yes tsc --noEmit --skipLibCheck --target ES2022 --moduleResolution node --module ESNext e2e/dadian-api-contract.spec.ts`
- `cd frontend; npx --yes tsc --noEmit`
- `cd backend; python -m pytest -q tests/test_swarm_runs_api_contract.py`
- `cd backend; python -m pytest -q tests/test_contract_alignment_p0.py tests/test_swarm_runs_api_contract.py`
- `cd backend; python -m pytest -q tests/test_dadian_api.py tests/test_libu_router.py tests/test_shangshufang_loop_api.py`
- `cd backend; python scripts/harness_doctor.py`
- `node scripts/harness-doctor.mjs`

## 结果

- 已完成方案文档。
- 已完成阶段 0 API inventory 自动化和产物生成。
- Inventory 摘要：91 个具体前端调用、298 个后端 route、8 个不可访问路径；75 MATCHED / 16 PATH_ALIAS / 0 MISSING_BACKEND / 0 SHAPE_DRIFT。
- Boundary audit 摘要：pass_with_warnings；0 个前端 BFF 变更、0 个本轮新增 UI 层变更、2 个已知 UI 工作区异常、8 个不可访问前端路径。
- Frontend access audit 摘要：needs_migration；63 个 API call site，30 个 reviewRequired，8 个不可访问路径；本轮不按边界修改 UI/component 调用方。
- Response envelope audit 摘要：pass_with_legacy_exceptions；74 个实际使用后端路由，67 个标准信封，7 个 legacy exceptions，0 个 reviewRequired。
- Transport alias node test 通过：4 tests / 4 pass。
- Generated backend OpenAPI TS declaration 语法检查通过。
- Dadian P0 Playwright contract spec 语法检查通过；完整浏览器执行仍受前端 typecheck/build 阻塞。
- Frontend `tsc --noEmit` 未通过：缺失 `frontend/src/features/bingbu/components/bingbu-quotation-verdict-panel.tsx` 与 `frontend/src/features/hubu/components/hubu-finance-preview-panel.tsx`；这两个路径当前被 Git/Windows 报为 deleted 或 permission denied，本次不按接口对齐任务修改 UI 层。
- Swarm-runs backend contract test 通过：3 tests / 3 pass。
- P0 backend alignment test 通过：26 tests / 26 pass。
- 后端专项契约测试通过：19 tests / 19 pass。
- 后端 harness doctor 通过：0 errors / 0 warnings。
- 根级 `harness-doctor` 通过：0 errors / 0 warnings。
- Contract stability audit 通过：pass，297 method/path routes，diff_checked，0 breaking changes；已生成 OpenAPI JSON、route snapshot 与 TS 类型快照。
- Implementation audit 通过：in_progress，11 done / 3 blocked / 0 missing；剩余阻塞项为前端访问层收敛、typecheck/build 与 Playwright 闭环。
- 当前工作区存在 Windows 权限异常目录，`rg` 和 Git 状态检查均报告部分 `frontend/src/features/*/components` 或 `hooks` 目录 `Access is denied`。

## 备注

- 本次不改 UI 层，不新增前端 BFF 层。
- Source label audit 摘要：pass，74 个实际使用后端路由，64 个有来源证据，10 个非业务例外，0 个 reviewRequired。
- P0 matrix audit 摘要：pass，5 个 P0 业务域，5 个证据完整，0 个 missingEvidence。
- All matrix audit 摘要：pass，91 个前端调用，74 条唯一后端路由，74 条 complete，0 个 missingEvidence。
- 全量 domain 分类已覆盖：inventory 中 unknown 调用为 0。
- Exact route test audit 摘要：pass，74 条唯一后端路由，74 条 exactRoutes，0 个 missingExactRoutes。
- Alias retirement audit 摘要：pass，16 个 PATH_ALIAS，4 个 alias group，0 个 reviewRequired。
- Client layer audit 摘要：pass，4 / 4 个 P0 business client groups complete，0 个 reviewRequired；不动 UI，不新增前端 BFF。
