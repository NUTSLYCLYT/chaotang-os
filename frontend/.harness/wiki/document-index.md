# 文档索引

前端文档很多。新增文档前先查这里，避免同一规则散成多份。

## 前端 harness 入口

- `AGENTS.md`：前端 agent 入口。
- `CLAUDE.md`：Claude 极简入口，指向 `AGENTS.md`。
- `.harness/agents/frontend-owner.md`：前端 owner 调度中枢。
- `.harness/rules/`：不可绕过规则。
- `.harness/skills/`：阶段化操作手册。
- `.harness/wiki/`：稳定事实库。
- `.harness/changes/`：变更审计轨迹。

## 日常指南

- `docs/HARNESS-USAGE-GUIDE.md`：日常使用 harness。
- `docs/AUTHORING-GUIDE.md`：哪些文档由谁改、何时改。

## 规则

可复用教训放进 `.harness/rules/` 或 skill checklist。一次性证据放进 `dev/notes/` 或对应 change 目录。

## API 契约

- `.harness/wiki/api-contracts.md`：前端 API 契约原则、source label、后端事实源 owner 与验证命令。
- `../../../docs/frontend-backend-contract-alignment-plan-2026-07-09.md`：根级前后端契约对齐实施方案。
- `../../../docs/api-contract-inventory-2026-07-09.md`：根级 API 调用/路由盘点证据。
- `../../../docs/api-contract-boundary-audit-2026-07-09.md`：根级不动 UI / 不新增前端 BFF 边界审计证据。
- `../../../docs/api-contract-p0-matrix-audit-2026-07-09.md`：根级 P0 业务域 contract / backend owner / test 证据矩阵。
- `../../../docs/api-contract-all-matrix-audit-2026-07-09.md`：根级全量前端已用 API route 的 contract / backend owner / test / envelope / source 证据矩阵。
- `../../../docs/api-contract-exact-test-audit-2026-07-09.md`：根级全量前端已用 API route 的精确后端测试覆盖证据。
- `../../../docs/api-contract-alias-retirement-audit-2026-07-09.md`：根级 PATH_ALIAS owner / retireWhen / transport test 退役门禁证据。
- `../../../docs/api-contract-client-layer-audit-2026-07-09.md`：根级 P0 business API client/adapter 层审计证据；不动 UI，不新增前端 BFF。
- `../../../docs/api-contract-frontend-access-audit-2026-07-09.md`：根级前端访问层收敛审计证据。
- `../../../docs/api-contract-response-envelope-audit-2026-07-09.md`：根级后端响应信封与 legacy exception 审计证据。
- `../../../docs/api-contract-source-label-audit-2026-07-09.md`：根级后端 source label 覆盖审计证据。
- `../../../docs/api-contract-implementation-audit-2026-07-09.md`：根级实施进度审计证据，区分 done / blocked / missing。
- `../../../docs/api-contract-stability-report-2026-07-09.md`：根级 OpenAPI diff / generated TS types / breaking change 门禁证据。
