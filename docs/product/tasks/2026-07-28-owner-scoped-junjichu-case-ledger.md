# 任务：军机处私有案卷总台

> 本任务遵循 `docs/decisions/0028-decree-evidence-flow-governance-baseline.md`，并受 ADR 0029 约束；不得改变下旨唯一入口、锦衣卫边界或一旨一条 `REPLY`。

## Status

Ready

## Product Definition

- 用户确认：用户于 2026-07-28 确认采用“会审主舞台”；只允许下旨者查询自己朝堂中经过军机处的进行中与已归档案卷。
- 问题：军机处当前只显示已归档 `REPLY`，用户无法查看自身跨部会审的进行状态或将其与最终回奏连为同一案卷。
- 目标用户：已登录并通过上书房下达跨部旨意的朝堂用户。
- 目标：提供私有、可查询、连续呈现的军机处案卷总台。
- 非目标：新下旨入口、调查/补证入口、人工审批或派发、通用任务队列、旧 `dev` 业务模型迁移。

## Acceptance Criteria

- [ ] 当前用户只能查询自己下旨且经过军机处的案卷；其他用户和单部门旨意均不可见。
- [ ] 案卷在办理中、军机处会审、丞相汇总、已归档或失败之间如实显示；不会展示尚未产生的意见或证据。
- [ ] 已归档结果与进行中案卷使用同一案卷身份，并链接唯一的史馆 `REPLY`。
- [ ] 页面使用左侧案卷、中央主卷、右侧六部席位的会审主舞台；仅提供真实的上书房与史馆入口。
- [ ] 后端、BFF、前端和跨用户隔离均有离线自动化验证。

## Delivery Constraints

- 范围：军机处案卷持久化与查询、认证所有者隔离、军机处页面、相关契约和测试。
- 兼容性：保持同步串行会审、现有下旨 API 的既有字段、史馆唯一 `REPLY` 归档和现有会话安全边界。
- 风险与限制：持久化中间状态是新增数据契约；失败必须脱敏且不得留下伪完成案卷。
- 技能计划：`brainstorming`、`writing-plans`、`test-driven-development`、`verification-before-completion`、`codex-engineering-workflow`。
- Codex-only：否。

## Affected Modules

- 模块：军机处私有案卷台账与会审状态；依赖丞相、六部、军机处、史馆和认证所有者边界。
- 模块：军机处会审主舞台；依赖同源 BFF 和真实案卷查询契约。
- 允许路径：`backend/app/agents/**`、`backend/app/api/**`、`backend/app/junjichu_cases/**`、`backend/app/shiguan/**`、`backend/tests/**`、`frontend/src/app/junjichu/**`、`frontend/src/app/api/**`、`frontend/src/features/junjichu-visual/**`、`frontend/src/lib/**`、相关前端测试、`docs/decisions/**`、`docs/superpowers/plans/**`、`ARCHITECTURE.md` 和本任务文件。
- 依赖模块：ADR 0028、ADR 0027、现有认证会话、史馆 SQLite 存储。

## Technical Plan

按 [实施计划](../../superpowers/plans/2026-07-28-owner-scoped-junjichu-case-ledger.md) 执行；实施负责人先完成 Task 1 的存储契约复核，再按计划顺序交付。

## Implementation Report

2026-07-28 交付验证（未改为 `Implemented`）：

- 新增离线跨端回归：`backend/tests/test_junjichu_cases_api.py::test_decree_to_case_ledger_is_private_and_records_only_real_terminal_outcomes`。该测试用两个假认证用户和注入的图/归档结果覆盖：multi 在处理时通过只读 API 可见、成功案卷仅关联一个 `REPLY`、图失败仅留下 `FAILED/processing_failed`，以及 single 不创建军机处案卷。
- 后端目标测试和全量质量门禁未能启动：`backend/.venv/Scripts/python.exe -m pytest backend/tests/test_junjichu_cases_api.py -q` 返回 1，启动器指向不存在的 `C:\Users\Administrator\AppData\Local\Programs\Python\Python314\python.exe`；因此 `ruff check .` 与 `pytest -q` 均没有新的有效通过证据。
- 前端：`cd frontend && npm run lint` 通过；`npm run typecheck` 通过；`npm test -- --test-name-pattern="Grand Council|junjichu"` 通过（58/58）；`npm run build` 通过。完整 `npm test` 失败于既有六部视觉守护断言（共享 court shell/旧 actor label），与本任务允许路径无关。
- 仓库：`node scripts/check_harness.mjs --self-test` 通过（43 项）；`node .agents/hooks/check-harness.mjs --self-test` 通过（3 项）。`node scripts/check_harness.mjs` 因既有任务 `docs/product/tasks/2026-07-27-dev-swarm-bureau-capabilities.md` 缺少 Affected Modules 允许路径而失败。
- 结论：后端环境与两项既有回归未恢复前，不能取得全量验收证据，状态维持 `Ready`，验收维持 `Pending`。

## Acceptance Review

- 验收结果：Pending
- 验收证据：待实施负责人提供。
- 未通过项：无。
