# G3 CI 运行时契约修复（2026-10-07）

> 本任务遵循 `docs/decisions/0028-decree-evidence-flow-governance-baseline.md`；不修改 Harness 或 GitHub Actions，仅收口非保护运行时契约。

## Status

Ready

## Product Definition

- 用户确认：2026-10-07，以草案摘要 `sha256:c4fdd07dd5f424ce9148900c6cec03511790481314538f93f38905d0a3f48f2c` 确认本任务范围。
- 问题：GitHub PR #2 的 standalone 入口检查失败；SQLite 受控 schema fixture 摘要与当前实现不一致。
- 目标：让应用启动命令和当前精确 schema 契约一致，同时保留所有未知、拼接和篡改状态的 fail-closed 行为。
- 非目标：不修改 Harness、工作流、bwrap 环境、业务 API、UI、任务、权限、模型调用或远端 ext-dev。

## Acceptance Criteria

- [ ] `npm run start` 使用 standalone server，构建后入口 smoke 可真实返回页面。
- [ ] 当前旧 schema、canonical schema 和预算兼容 schema 的摘要与实现一致。
- [ ] SQLite 来源/快照拼接测试恢复通过，未知 schema 仍被拒绝。
- [ ] backend focused、backend full、ruff、frontend build、standalone smoke 和根 Harness 均得到真实结果。
- [ ] 产品子提交是批准提交的单亲子，可回退到 `8ff45c1cfd13b51ba28c1bada99108a0c25acfa0`。

## Delivery Constraints

- 允许路径严格限定为批准清单中的四个文件。
- 不改测试意图，不将摘要校验改为前缀、通配符或运行时自接受。
- 不调用外部模型、不访问生产数据、不进行部署或合并。

## Affected Modules

- 模块：前端运行入口、SQLite runtime registry 与 SQLite 契约测试
- 允许路径：`frontend/package.json`、`backend/app/operations/runtime_data_registry.py`、`backend/tests/test_readiness.py`、`backend/tests/test_sqlite_backup.py`、本任务文件

- Module 1（前端运行入口）：`frontend/package.json`；只调整 `start` 脚本，使构建产物的 standalone server 可被真实 smoke 启动。
- Module 2（SQLite runtime registry）：`backend/app/operations/runtime_data_registry.py`；只同步受控 canonical schema 摘要常量。
- Module 3（SQLite 契约测试）：`backend/tests/test_readiness.py`、`backend/tests/test_sqlite_backup.py`；只同步对应受控 fixture 摘要，保留未知、拼接和篡改负例。

允许路径严格限定为：

- `frontend/package.json`
- `backend/app/operations/runtime_data_registry.py`
- `backend/tests/test_readiness.py`
- `backend/tests/test_sqlite_backup.py`
- `docs/product/tasks/2026-10-07-g3-ci-runtime-contract-repair.md`

## Technical Plan

1. 先运行批准的 focused RED，记录当前失败。
2. 将 frontend `start` 脚本指向 `.next/standalone/server.js`，验证真实构建后启动。
3. 根据当前受控 DDL 重新计算并登记精确 schema 摘要；同步对应测试 fixture，保留负例。
4. 运行批准矩阵和差异检查，生成证据。

## Rollback

回退产品子提交到批准父提交 `8ff45c1cfd13b51ba28c1bada99108a0c25acfa0`；无数据迁移、无外部状态写入。

## Implementation Report

待产品子提交后填写实际改动、测试命令、开始/结束时间和未验证项。

## Acceptance Review

翰林院需确认 standalone 启动真实可用，SQLite 精确摘要与 fail-closed 负例同时通过；bwrap 仍单独记录为 CI 环境治理项。

