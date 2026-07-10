# 变更摘要：docs-frontend-backend-contract-alignment-plan-20260709

| 字段 | 值 |
| --- | --- |
| Change ID | docs-frontend-backend-contract-alignment-plan-20260709 |
| 类型 | docs |
| 状态 | DELIVERED |
| Owner | Project Agent |
| 创建日期 | 20260709 |

## 范围

- 新增并更新 `docs/frontend-backend-contract-alignment-plan-2026-07-09.md`。
- 目标是针对前后端业务与接口不匹配，输出可执行的盘点、契约、适配、后端补齐、浏览器验证与回滚方案。
- 新增 `scripts/api-contract-inventory.mjs`，落地阶段 0 的接口盘点自动化。
- 新增 `docs/api-contract-inventory-2026-07-09.json` 与 `docs/api-contract-inventory-2026-07-09.md`，记录前端调用、后端 routes、alias、缺口与不可访问路径。
- 新增 `frontend/src/lib/backend-api.nodetest.ts`，为现有 transport alias 补 P0 回归断言。
- 新增 `backend/tests/test_swarm_runs_api_contract.py`，为军机处 `/api/swarm-runs/{id}/brief` 与 `/retry` 补后端契约测试。
- 新增后端真实端点 `POST /api/auth/verify-invite` 与 `GET /api/court/backend/tasks/{task_id}`，首批 P0 缺口不通过前端 BFF 兜底。
- 新增 `backend/tests/test_contract_alignment_p0.py`，覆盖邀请码核验与 legacy task detail 响应形状。
- 新增并扩展后端兼容端点，覆盖 orchestration、qintian chat、prompt suggest、metrics、governance、scribe、shiguan、manor、军机处立案、朝堂 legacy orchestrate 与 true-chain health 等前端既有调用。
- 更新 inventory 脚本，跳过 `jiqun-api.ts` 内部动态 transport 基础函数，避免把 `/api${path}` 误判为业务缺口。
- 更新 `frontend/.harness/wiki/api-contracts.md` 与 `frontend/.harness/wiki/document-index.md`，补充后端事实源 owner、验证命令、source label 和边界。
- 新增 `scripts/api-contract-boundary-audit.mjs` 与 `docs/api-contract-boundary-audit-2026-07-09.*`，自动审计不动 UI / 不新增前端 BFF 边界。
- 为 `toBackendApiPath` 历史 alias 补 owner、验证命令和退役计划：`scripts/api-contract-inventory.mjs` 输出 owner/retireWhen，`frontend/src/lib/backend-api.ts` 和 `frontend/.harness/wiki/api-contracts.md` 记录规则。
- 新增 `scripts/api-contract-implementation-audit.mjs` 与 `docs/api-contract-implementation-audit-2026-07-09.*`，记录实施要求的 done / blocked / missing 状态。
- 新增 `scripts/api-contract-stability.mjs`、`docs/api-contract-openapi-2026-07-09.json`、`docs/api-contract-route-snapshot-2026-07-09.json`、`frontend/src/lib/contracts/backend-openapi-2026-07-09.d.ts` 与 `docs/api-contract-stability-report-2026-07-09.*`，落地 P2 OpenAPI diff、生成 TS 类型快照与契约破坏检查。
- 新增 `frontend/e2e/dadian-api-contract.spec.ts`，补阶段 4 大殿 P0 Playwright 覆盖入口；该 spec 不 mock、不走前端 BFF，页面 smoke 与后端 dadian pulse/feed 契约分开验证。
- 新增 `scripts/api-contract-frontend-access-audit.mjs` 与 `docs/api-contract-frontend-access-audit-2026-07-09.*`，补阶段 2 访问层收敛审计，列出仍需迁移到业务 client/adapter 的既有散点调用。
- 新增 `scripts/api-contract-response-envelope-audit.mjs` 与 `docs/api-contract-response-envelope-audit-2026-07-09.*`，补响应信封审计；实际使用的 74 个后端路由中 67 个为标准信封，7 个为已登记 legacy exceptions，0 个 reviewRequired。
- 本次不修改前端 UI 层，不新增前端 BFF 层，不修改后端运行逻辑。
- 已补充明确边界：接口对齐期间不要动 UI 层布局、视觉、组件层级、导航结构、交互动线或文案表达；允许范围限定为 API client、adapter、contract、view model 输入字段、后端端点与测试。
- 已补充明确边界：不要在前端新增 BFF 层、Next API route、route handler、server action 或前端服务端业务代理；缺失能力必须回到后端补真实端点，或在现有 transport 中登记临时 alias 并注明退役计划。

## 验证

- `node scripts/api-contract-inventory.mjs`：通过，生成 91 个具体前端调用、298 个后端 route、8 个不可访问路径；分类为 75 MATCHED / 16 PATH_ALIAS / 0 MISSING_BACKEND / 0 SHAPE_DRIFT。
- `node scripts/api-contract-boundary-audit.mjs`：通过但有 warning；0 个前端 BFF 变更、0 个本轮新增 UI 层变更、2 个已知 UI 工作区异常、8 个不可访问前端路径。
- `node scripts/api-contract-stability.mjs`：通过，输出 pass，297 method/path routes，diff_checked，0 breaking changes。
- `node scripts/api-contract-frontend-access-audit.mjs`：通过，输出 needs_migration；63 个 API call site，30 个 reviewRequired，8 个不可访问路径。
- `node scripts/api-contract-response-envelope-audit.mjs`：通过，输出 pass_with_legacy_exceptions；67 standard / 7 legacy exceptions / 0 reviewRequired。
- `node scripts/api-contract-implementation-audit.mjs`：通过，输出 in_progress，8 done / 3 blocked / 0 missing。
- `cd frontend; npx --yes tsx --test src/lib/backend-api.nodetest.ts`：通过，4 个 alias transport 断言。
- `cd frontend; npx --yes tsc --noEmit --skipLibCheck --target ES2022 --moduleResolution node src/lib/contracts/backend-openapi-2026-07-09.d.ts`：通过，生成 TS 契约快照语法有效。
- `cd frontend; npx --yes tsc --noEmit --skipLibCheck --target ES2022 --moduleResolution node --module ESNext e2e/dadian-api-contract.spec.ts`：通过，大殿 P0 Playwright spec 语法有效。
- `cd backend; python -m pytest -q tests/test_swarm_runs_api_contract.py`：通过，3 个 swarm-runs 契约断言。
- `cd backend; python -m pytest -q tests/test_contract_alignment_p0.py tests/test_swarm_runs_api_contract.py`：通过，26 个契约断言。
- `cd backend; python -m pytest -q tests/test_dadian_api.py tests/test_libu_router.py tests/test_shangshufang_loop_api.py`：通过，19 个专项契约断言。
- `cd backend; python scripts/harness_doctor.py`：通过，0 errors / 0 warnings。
- `cd frontend; npx --yes tsc --noEmit`：未通过；仅报缺失 `bingbu-quotation-verdict-panel` 与 `hubu-finance-preview-panel` 两个模块，对应当前工作区既有 Windows 权限异常/删除状态，本次未按边界修改 UI 文件。
- `node scripts/harness-doctor.mjs`：通过，0 errors / 0 warnings。
- 当前工作区仍有 `frontend/src/features/*/components` 权限异常，会影响全量扫描、Git 状态和部分测试；阶段 0 inventory 已把不可访问路径写入证据。
