# API 契约

前端不再拥有运行时 BFF 层。不要新增 `src/app/api/**` route handler 来承接生产运行逻辑或代理运行服务。

## 当前原则

- 浏览器数据通过类型化前端 adapter 调用明确 API 或外部来源。
- 运行事实源以根级 manifest、API 契约和明确验证输出为准。
- 前端可以做展示、编排入口、错误态和 source label，但不能伪造运行执行结果。
- 接口对齐期间不改 UI 层：不动页面布局、视觉样式、组件层级、导航结构、交互动线或文案表达。
- 不新增前端 BFF：不新增 `src/app/api/**`、Next route handler、server action 或前端服务端业务代理来承接后端业务。

## 当前契约清单

2026-07-09 的前后端契约对齐以根级文档和自动盘点为准：

| 文档 | 用途 |
| --- | --- |
| `docs/frontend-backend-contract-alignment-plan-2026-07-09.md` | 实施阶段、边界、优先级、验证矩阵与回滚方案 |
| `docs/api-contract-inventory-2026-07-09.md` | 人读 API 盘点结果 |
| `docs/api-contract-inventory-2026-07-09.json` | 机器可读 API 盘点结果 |
| `docs/api-contract-boundary-audit-2026-07-09.md` | 不动 UI / 不新增前端 BFF 的边界审计 |
| `docs/api-contract-boundary-audit-2026-07-09.json` | 机器可读边界审计 |
| `docs/api-contract-p0-matrix-audit-2026-07-09.md` | P0 业务域 contract / backend owner / test 证据矩阵 |
| `docs/api-contract-all-matrix-audit-2026-07-09.md` | 全量前端已用 API route 的 contract / backend owner / test / envelope / source 证据矩阵 |
| `docs/api-contract-exact-test-audit-2026-07-09.md` | 全量前端已用 API route 的精确后端测试覆盖证据 |
| `docs/api-contract-alias-retirement-audit-2026-07-09.md` | PATH_ALIAS owner / retireWhen / transport test 退役门禁 |
| `docs/api-contract-client-layer-audit-2026-07-09.md` | P0 business API client/adapter layer audit without UI or frontend BFF changes |
| `docs/api-contract-frontend-access-audit-2026-07-09.md` | 前端访问层收敛审计，列出仍需迁移到 client/adapter 的散点调用 |
| `docs/api-contract-response-envelope-audit-2026-07-09.md` | 后端响应信封审计，列出标准信封与 legacy exceptions |
| `docs/api-contract-source-label-audit-2026-07-09.md` | 后端 source label 审计，列出业务事实源与非业务例外 |
| `docs/api-contract-openapi-2026-07-09.json` | 后端 FastAPI OpenAPI 契约快照 |
| `docs/api-contract-route-snapshot-2026-07-09.json` | 后端 method/path/response signature 差异快照 |
| `docs/api-contract-stability-report-2026-07-09.md` | OpenAPI diff / generated TS types / breaking change 检查报告 |
| `frontend/src/lib/contracts/backend-openapi-2026-07-09.d.ts` | 前端 adapter 可引用的生成类型快照，不属于 UI 层 |
| `.harness/changes/docs-frontend-backend-contract-alignment-plan-20260709/` | 根级跨线变更记录 |

当前盘点状态：

- 91 个具体前端调用。
- 298 个后端 route。
- 75 `MATCHED`。
- 16 `PATH_ALIAS`。
- 0 `MISSING_BACKEND`。
- 0 `SHAPE_DRIFT`。
- 0 个前端 BFF 变更。
- 0 个本轮新增 UI 层变更。
- 8 个 Windows 权限异常路径已记录在 inventory，不得用前端 mock 或 BFF 掩盖。
- `PATH_ALIAS` 行已经包含后端 owner 与退役条件；新调用应直接使用 canonical backend path。

验证命令：

```powershell
node scripts/api-contract-inventory.mjs
node scripts/api-contract-boundary-audit.mjs
node scripts/api-contract-p0-matrix-audit.mjs
node scripts/api-contract-all-matrix-audit.mjs
node scripts/api-contract-exact-test-audit.mjs
node scripts/api-contract-alias-retirement-audit.mjs
node scripts/api-contract-client-layer-audit.mjs
node scripts/api-contract-frontend-access-audit.mjs
node scripts/api-contract-response-envelope-audit.mjs
node scripts/api-contract-source-label-audit.mjs
node scripts/api-contract-stability.mjs
node scripts/api-contract-implementation-audit.mjs
cd frontend; npx --yes tsx --test src/lib/backend-api.nodetest.ts
cd frontend; npx --yes tsc --noEmit --skipLibCheck --target ES2022 --moduleResolution node --module ESNext e2e/dadian-api-contract.spec.ts
cd frontend; npx playwright test e2e/dadian-api-contract.spec.ts
cd backend; python -m pytest -q tests/test_contract_alignment_p0.py tests/test_swarm_runs_api_contract.py
cd backend; python -m pytest -q tests/test_dadian_api.py tests/test_libu_router.py tests/test_shangshufang_loop_api.py
node scripts/harness-doctor.mjs
```

## 后端事实源与兼容端点

短期兼容端点必须在后端实现，并明确 source label；不能搬到前端 route handler。

| 业务/路径族 | 后端 owner | 契约证据 |
| --- | --- | --- |
| `/api/auth/verify-invite` | `backend/web/routers/auth.py` | `backend/tests/test_contract_alignment_p0.py` |
| `/api/swarm-runs/*` | `backend/web/routers/swarm_runs.py` | `backend/tests/test_swarm_runs_api_contract.py` |
| `/api/court/backend/tasks/{task_id}`、`/api/court/junjichu/cases`、`/api/court/orchestrate*` | `backend/web/routers/court_compat.py` | `backend/tests/test_contract_alignment_p0.py` |
| `/api/orchestration/run`、`/api/qintian/chat`、`/api/prompt/suggest`、intel/dept dispatch | `backend/web/routers/orchestration_compat.py` | `backend/tests/test_contract_alignment_p0.py` |
| governance / scribe / shiguan / manor stream / true-chain health | `backend/web/routers/governance_compat.py` | `backend/tests/test_contract_alignment_p0.py` |
| `/api/metrics` browser event ingestion | `backend/web/routers/metrics.py` | `backend/tests/test_contract_alignment_p0.py` |

## Alias 退役规则

- `PATH_ALIAS` 只允许存在于 `frontend/src/lib/backend-api.ts` 的 `toBackendApiPath`。
- 每条 alias 的 owner、canonical path 与退役条件以 `docs/api-contract-inventory-2026-07-09.md` 为准。
- 删除 alias 前必须先运行 inventory，确认 legacy path 已没有前端调用。
- 删除 alias 后必须运行 `frontend/src/lib/backend-api.nodetest.ts` 并更新本 wiki。

## 环境变量

| 变量 | 用途 |
| --- | --- |
| `EXTERNAL_RUNTIME_API_URL` | 服务端访问运行 API 的 base URL |
| `NEXT_PUBLIC_EXTERNAL_RUNTIME_API_URL` | 浏览器可见的运行 API base URL，需谨慎暴露 |
| `NEXT_PUBLIC_CHAOTANG_API_URL` | 朝堂 API base URL |
| `NEXT_PUBLIC_API_MODE` | real / mixed / demo 等模式控制 |

## Source Label

| 标签 | 含义 |
| --- | --- |
| LIVE | 真实运行、真实模型、真实记录或真实 API 响应 |
| MIXED | 有真实来源，但存在 fallback、缓存或部分样例 |
| DEMO | 静态样例、fixture、mock 或说明性流程 |
| FALLBACK | 主来源不可用后的降级结果 |

UI 展示运行数据时，应把 source label 带到 view model 或页面说明中。

## 禁止事项

- 禁止用前端 mock 证明运行服务质量。
- 禁止用本地 route handler 临时代理来绕过 API 契约。
- 禁止把运行器、供应方 key、运行记录或质量基线搬到前端。
- 禁止把运行服务不可达时的样例数据标为 LIVE。

## 实施审计

当前实施进度以根级审计为准：

- `../../../docs/api-contract-implementation-audit-2026-07-09.md`
- `../../../docs/api-contract-implementation-audit-2026-07-09.json`

审计只记录证据和阻塞项，不替代 Playwright 浏览器验证。浏览器闭环必须等前端 typecheck/build 可运行后再执行。
