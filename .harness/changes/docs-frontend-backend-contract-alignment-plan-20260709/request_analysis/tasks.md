# 任务：docs-frontend-backend-contract-alignment-plan-20260709

## 任务 1

- 目标：阅读前后端入口与现有 API 访问/路由痕迹。
- 输入：`frontend/AGENTS.md`、`backend/AGENTS.md`、前端访问层、后端 router 注册。
- 输出：实施方案的问题判断与分层策略。
- 验收：方案能指出路径命名、响应信封、事实源边界三类问题。

## 任务 2

- 目标：输出可执行 Markdown。
- 输入：项目边界规则与当前代码结构。
- 输出：`docs/frontend-backend-contract-alignment-plan-2026-07-09.md`。
- 验收：包含阶段、优先级、验证矩阵和回滚方案。

## 任务 3

- 目标：落地阶段 0 API 盘点自动化。
- 输入：`frontend/src` API 调用、`backend/web/routers` FastAPI routes、现有 `backend-api.ts` alias。
- 输出：`scripts/api-contract-inventory.mjs`、`docs/api-contract-inventory-2026-07-09.json`、`docs/api-contract-inventory-2026-07-09.md`。
- 验收：脚本可重复运行，输出 MATCHED / PATH_ALIAS / SHAPE_DRIFT / MISSING_BACKEND 分类。

## 任务 4

- 目标：为现有 transport alias 增加回归钉子。
- 输入：`frontend/src/lib/backend-api.ts`。
- 输出：`frontend/src/lib/backend-api.nodetest.ts`。
- 验收：alias 映射测试通过，不新增前端 BFF。

## 任务 5

- 目标：为 P0 后端接口补真实契约测试，不通过前端 BFF 兜底。
- 输入：`backend/web/routers/swarm_runs.py` 与现有 `swarm_service` 行为。
- 输出：`backend/tests/test_swarm_runs_api_contract.py`。
- 验收：`/api/swarm-runs/{id}/brief` 与 `/api/swarm-runs/{id}/retry` 契约测试通过。

## 任务 6

- 目标：补齐首批 P0 MISSING_BACKEND 真实后端端点。
- 输入：invite 页面契约、command-center pinned task 契约、现有 auth 与 chaotang 后端事实源。
- 输出：`POST /api/auth/verify-invite`、`GET /api/court/backend/tasks/{task_id}`、`backend/tests/test_contract_alignment_p0.py`。
- 验收：不新增前端 BFF、不改 UI；新增后端契约测试通过，inventory 缺口下降。

## 任务 7

- 目标：继续补齐剩余后端缺口，消除 MISSING_BACKEND 与 SHAPE_DRIFT。
- 输入：API inventory 剩余缺口、governance/scribe/shiguan/manor/chaotang legacy 调用契约。
- 输出：`backend/web/routers/orchestration_compat.py`、`backend/web/routers/governance_compat.py`、`backend/web/routers/court_compat.py` 扩展、`backend/web/routers/metrics.py` 扩展、`scripts/api-contract-inventory.mjs` 动态 transport 识别。
- 验收：不新增前端 BFF、不改 UI；inventory 仅剩 MATCHED 与 PATH_ALIAS；后端契约测试通过。

## 任务 8

- 目标：补阶段 1 的契约索引证据。
- 输入：根级实施方案、inventory、后端兼容端点与测试。
- 输出：`frontend/.harness/wiki/api-contracts.md`、`frontend/.harness/wiki/document-index.md`。
- 验收：契约索引列明 source label、后端 owner、验证命令、不动 UI 与不新增前端 BFF 边界。

## 任务 9

- 目标：补不动 UI / 不新增前端 BFF 的自动边界审计。
- 输入：Git 工作区状态、前端源码路径、已知 Windows 权限异常路径。
- 输出：`scripts/api-contract-boundary-audit.mjs`、`docs/api-contract-boundary-audit-2026-07-09.json`、`docs/api-contract-boundary-audit-2026-07-09.md`。
- 验收：0 个前端 BFF 变更、0 个本轮新增 UI 层变更；既有权限异常作为 warning 单独记录。

## 任务 10

- 目标：补 alias owner、验证命令和退役条件。
- 输入：`frontend/src/lib/backend-api.ts`、`scripts/api-contract-inventory.mjs`、当前 PATH_ALIAS 清单。
- 输出：transport 注释、inventory owner/retireWhen 字段、`frontend/.harness/wiki/api-contracts.md` alias 退役规则。
- 验收：inventory 的 PATH_ALIAS 表含 owner 与退役条件；transport alias 测试通过。

## 任务 11

- 目标：补实施进度审计，明确哪些要求已完成、哪些被阻塞、哪些尚未实施。
- 输入：实施方案、inventory、boundary audit、契约测试与 harness doctor 结果。
- 输出：`scripts/api-contract-implementation-audit.mjs`、`docs/api-contract-implementation-audit-2026-07-09.json`、`docs/api-contract-implementation-audit-2026-07-09.md`。
- 验收：审计输出 `done / blocked / missing` 汇总；明确 Playwright 闭环仍未证明，且不动 UI / 不新增前端 BFF 边界继续生效。

## 任务 12

- 目标：补 P2 契约稳定化门禁，生成 OpenAPI、TS 类型快照并检查破坏性契约变更。
- 输入：后端 FastAPI app、现有 route snapshot、方案 P2 稳定化要求。
- 输出：`scripts/api-contract-stability.mjs`、`docs/api-contract-openapi-2026-07-09.json`、`docs/api-contract-route-snapshot-2026-07-09.json`、`frontend/src/lib/contracts/backend-openapi-2026-07-09.d.ts`、`docs/api-contract-stability-report-2026-07-09.md`。
- 验收：`node scripts/api-contract-stability.mjs` 通过；diff mode 为 `diff_checked`；breaking changes 为 0；生成类型文件只作为 adapter 契约快照，不新增 UI 或前端 BFF。

## 任务 13

- 目标：补阶段 4 大殿 P0 Playwright 覆盖入口，不用 mock 或前端 BFF 证明后端质量。
- 输入：`/dadian` 页面、后端 `/api/court/dadian/pulse` 与 `/api/court/dadian/feed` 契约。
- 输出：`frontend/e2e/dadian-api-contract.spec.ts`。
- 验收：spec 本身 TypeScript 语法检查通过；真正 Playwright 执行仍需等待前端 typecheck/build 阻塞解除。

## 任务 14

- 目标：补阶段 2 前端访问层收敛审计，识别页面/组件/Hook 中仍直接调用 API 的散点。
- 输入：`frontend/src` 可访问 TypeScript 文件、阶段 2 client/adapter 收敛规则。
- 输出：`scripts/api-contract-frontend-access-audit.mjs`、`docs/api-contract-frontend-access-audit-2026-07-09.json`、`docs/api-contract-frontend-access-audit-2026-07-09.md`。
- 验收：审计列出 API call site 分层、allowlist 命中、reviewRequired 清单和不可访问路径；不修改 UI 层，不新增前端 BFF。

## 任务 15

- 目标：补响应信封审计，确认前端实际使用的后端路由是否为标准信封或明确 legacy exception。
- 输入：`docs/api-contract-inventory-2026-07-09.json`。
- 输出：`scripts/api-contract-response-envelope-audit.mjs`、`docs/api-contract-response-envelope-audit-2026-07-09.json`、`docs/api-contract-response-envelope-audit-2026-07-09.md`。
- 验收：审计输出标准信封路由、legacy exception 路由和 reviewRequired 路由；reviewRequired 为 0。
## 任务 16

- 目标：补 source label 覆盖审计，确认前端实际使用的后端业务事实路由都有来源证据或明确非业务例外。
- 输入：`docs/api-contract-inventory-2026-07-09.json`。
- 输出：`scripts/api-contract-source-label-audit.mjs`、`docs/api-contract-source-label-audit-2026-07-09.json`、`docs/api-contract-source-label-audit-2026-07-09.md`。
- 验收：审计输出 source evidence 路由、例外路由和 reviewRequired 路由，reviewRequired 为 0；不改 UI 层，不新增前端 BFF。

## 任务 17

- 目标：补 P0 契约证据矩阵，确认方案列出的重点业务域都有前端 contract、后端 owner 与测试证据。
- 输入：`docs/frontend-backend-contract-alignment-plan-2026-07-09.md`、`frontend/src/lib/contracts/*`、`backend/web/routers/*`、`backend/tests/*`。
- 输出：`scripts/api-contract-p0-matrix-audit.mjs`、`docs/api-contract-p0-matrix-audit-2026-07-09.json`、`docs/api-contract-p0-matrix-audit-2026-07-09.md`。
- 验收：矩阵审计通过，P0 域 missingEvidence 为 0；不改 UI 层，不新增前端 BFF。

## 任务 18

- 目标：补全量契约证据矩阵，覆盖 inventory 中所有前端实际使用的唯一后端路由，而不只 P0 域。
- 输入：`docs/api-contract-inventory-2026-07-09.json`、响应信封审计、source label 审计、OpenAPI TS 快照、后端测试索引。
- 输出：`scripts/api-contract-all-matrix-audit.mjs`、`docs/api-contract-all-matrix-audit-2026-07-09.json`、`docs/api-contract-all-matrix-audit-2026-07-09.md`。
- 验收：全量矩阵审计通过，74 条唯一后端路由全部 complete，missingEvidence 为 0；不改 UI 层，不新增前端 BFF。

## 任务 19

- 目标：补全量精确测试覆盖审计，确认所有前端实际使用的唯一后端路由都有后端测试源码中的精确路径证据。
- 输入：`docs/api-contract-inventory-2026-07-09.json`、`backend/tests/**/*.py`。
- 输出：`scripts/api-contract-exact-test-audit.mjs`、`docs/api-contract-exact-test-audit-2026-07-09.json`、`docs/api-contract-exact-test-audit-2026-07-09.md`、`backend/tests/test_all_frontend_used_routes_exact_contract.py`。
- 验收：exact audit 通过，74 条唯一后端路由 exactRoutes 为 74，missingExactRoutes 为 0；不改 UI 层，不新增前端 BFF。

## 任务 20

- 目标：补 PATH_ALIAS 退役门禁，确认所有历史路径别名都有 owner、canonical route、验证命令、退役条件和 transport 测试证据。
- 输入：`docs/api-contract-inventory-2026-07-09.json`、`frontend/src/lib/backend-api.ts`、`frontend/src/lib/backend-api.nodetest.ts`。
- 输出：`scripts/api-contract-alias-retirement-audit.mjs`、`docs/api-contract-alias-retirement-audit-2026-07-09.json`、`docs/api-contract-alias-retirement-audit-2026-07-09.md`。
- 验收：alias audit 通过，16 个 PATH_ALIAS、4 个 alias group 均无 reviewRequired；不改 UI 层，不新增前端 BFF。
## Task 21

- Goal: add a P0 frontend business API client/adapter layer audit without touching UI and without adding frontend BFF.
- Input: `frontend/src/features/dadian/api/*`, `frontend/src/features/bureaus/api/*`, `frontend/src/features/shangshufang/api/*`, `frontend/src/features/command-center/junjichu/api/*`.
- Output: `scripts/api-contract-client-layer-audit.mjs`, `docs/api-contract-client-layer-audit-2026-07-09.json`, `docs/api-contract-client-layer-audit-2026-07-09.md`.
- Acceptance: audit passes with 4 / 4 complete client groups and 0 reviewRequired; implementation audit includes this evidence.
