# 任务：会计司按需生成管理层综合财务报告

> 本任务遵循 `docs/decisions/0028-decree-evidence-flow-governance-baseline.md`；不得改变下旨、证据、回奏和归档主流程。

## Status

Implemented

## Product Definition

- 用户确认：用户于 2026-07-29 分段确认触发规则、Excel 内容、下载权限、失败语义与整体设计。
- 问题：会计司当前只能返回文本意见，无法根据项目内财务数据生成可下载、可追溯的管理层报告。
- 目标用户：通过上书房要求财务数据报表的企业决策者。
- 目标：只有旨意实际进入户部会计司且明确要求报表时，按需生成管理层综合财务 Excel，并在上书房回奏中提供受保护下载。
- 非目标：自动记账、付款、报税、对外报送、修改原始财务文件、会计司直达入口、同时扩展其他 38 个司。

## Acceptance Criteria

- [x] 未进入户部会计司或未明确要求报表时，不生成 Excel。
- [x] 明确要求报表时，使用 2020–2025 年本地财务数据按需生成 Excel。
- [x] 报告包含管理摘要、核心财务报表、科目趋势、异常分析、科目明细、校验结果和数据来源。
- [x] 金额、比率、同比、异常和勾稽由确定性代码或 Excel 公式计算，模型只解读已校验结果。
- [x] `.xlsx` 和旧 `.xls` 数据均通过受控适配器标准化，原文件不被覆盖。
- [x] 上书房成功回奏显示 Excel 下载入口；普通回奏保持兼容。
- [x] 下载必须认证并按成果所有者隔离，不暴露服务器路径。
- [x] 成果与旨意及唯一史馆 `REPLY` 关联，不建立第二档案体系。
- [x] 明确要求报表但生成失败时不得返回虚假完整成功。
- [x] 原始财务数据不进入 Git、日志、模型全文上下文、截图或测试夹具。

## Delivery Constraints

- 范围：会计司报表触发、财务数据标准化与校验、Excel 生成、成果元数据与下载、上书房回奏展示及相关测试和文档。
- 兼容性：保持丞相选部、部选司、单部/军机处多部、最终三条建议和一旨一条 `REPLY`；现有无成果回奏继续可用。
- 风险与限制：真实财务数据敏感；旧 `.xls` 需要受控兼容能力；同步生成可能增加响应时长；实现前需确定运行时依赖和成果生命周期。
- 技能计划：`brainstorming`、`writing-plans`、`test-driven-development`、`verification-before-completion`、`codex-engineering-workflow`；涉及工作簿时使用 `spreadsheets`。
- Codex-only：否。

## Affected Modules

- 模块：会计司报表意图与司级成果契约、财务数据加载/标准化/校验与确定性计算、七表 Excel 生成、成果存储/所有者隔离/下载、下旨响应/史馆成果引用/上书房下载入口。
- 允许路径：`backend/app/accounting_reports/**`、`backend/app/agents/bureaus/**`、`backend/app/agents/ministries/**`、`backend/app/agents/junjichu/**`、`backend/app/agents/chancellor/**`、`backend/app/api/decrees.py`、`backend/app/api/report_artifacts.py`、`backend/app/main.py`、`backend/pyproject.toml`、相关 `backend/tests/**`、`frontend/src/lib/backendClient*`、`frontend/src/app/api/decrees/chancellor/**`、`frontend/src/app/api/report-artifacts/**`、`frontend/src/app/study/**`、`frontend/src/features/study-visual/**`、`backend/AGENTS.md`、`frontend/AGENTS.md`、`ARCHITECTURE.md` 与本任务/设计/计划文档；不得把 `data/财务数据资料/**`、`backend/data/**`、运行态成果或真实财务内容纳入提交。
- 依赖模块：现有六部司级 Agent、认证所有者隔离、史馆 `REPLY` 归档和上书房 BFF/UI。

## Technical Plan

- 架构边界：采用“会计司内按需触发 + 确定性报表引擎 + 回奏成果附件”，不新增业务入口。
- 接口与依赖：下旨成功响应增加可选成果列表；成果下载使用不可猜测 ID 和当前认证用户所有权校验。
- 实施顺序：按 `docs/superpowers/plans/2026-07-29-accounting-bureau-management-report.md`，先固定合成数据契约与失败测试，再交付加载/校验、报表生成、成果存储下载、回奏投影和跨端验收。
- 验证计划：脱敏合成工作簿单元测试、会计司触发矩阵、公式与勾稽核对、下载越权测试、单部/多部/史馆回归、前端交互测试和仓库 harness。
- 技术风险：同步超时、旧 `.xls` 解析依赖、成果与 `REPLY` 原子一致性、运行文件清理和真实数据误入日志或版本控制。

## Implementation Report

- 改动摘要：交付会计司精确触发、受控 `.xlsx`/`.xls` 标准化、确定性分析与七表工作簿、单 run 唯一成果、史馆归档后发布、owner 隔离下载，以及上书房 BFF/UI 成果链接；Task 10 新增合成 single/multi 跨层回归。
- 自审：跨层夹具仅使用 `tmp_path`、合成金额和 fake graph；真实 session、分析、工作簿、FastAPI 下旨、史馆归档、成果发布与下载均实际运行。multi 保持 `户部 → 工部` 顺序且仍只有一份成果。
- 验证：后端与前端 required 自动检查均通过；隐私扫描未在实现测试或前端源码发现真实公司/账号或真实源目录名。计划文档仅命中其自身审计命令文本。
- 实际使用的 skill：`using-superpowers`、`codex-engineering-workflow`、`test-driven-development`、`verification-before-completion`。
- 验证命令与结果：`backend/.venv/Scripts/python.exe -m ruff check .` PASS；`backend/.venv/Scripts/python.exe -m pytest -q` PASS（`2007 passed, 1 skipped, 1 warning`）；`frontend/npm test` PASS（`399 passed`）；`npm run lint`、`npm run typecheck`、`npm run build` PASS（Next.js 31/31 页面生成）。Task 10 跨层专项 `2 passed, 1 warning`；兼容回归与跨层复验 `3 passed, 1 warning`。治理检查 PASS：基线 72 个文件、harness self-test 44 项、stop hook 3 项、product-flow runner 25 项，`git diff --check` exit 0。
- 本地合成前后端验收：先在 `frontend/` 运行 `npm run build`，再从仓库根运行 `backend/.venv/Scripts/python.exe backend/tests/run_accounting_synthetic_acceptance.py`，结果 `synthetic-accounting-acceptance: PASS`。实际启动 fake-wired FastAPI/Uvicorn 与 Next build server；A 经 Next 注册和下旨 BFF 得到唯一成果并经同源下载 200，B 对同一 opaque ID 得到 404，openpyxl 核验七表与合成资产总额 1000。
- Review 补充复验：受影响 Ruff PASS；跨层与军机处兼容测试 `3 passed, 1 warning`；`StudyArtifactLinks` render `3 passed`；frontend typecheck/build PASS；harness self-test 44、stop hook 3、runner 25 与 diff check 均 PASS。最后一次基线主检查被并行无关任务把 `2026-07-29-chancellor-draft-edict-flow.md` 状态改为非法 `Complete` 阻塞；本任务文件仍为合法 `Implemented`，未覆盖该并行任务。
- 警告：pytest 的唯一警告为 FastAPI `TestClient` 引用 Starlette 的 httpx 弃用提示；未影响测试结果。唯一 skip 为既有套件跳过项。
- 未运行项与原因：未读取或核对 12 份真实财务文件，未调用真实 DeepSeek、MCP 或公网，未向真实运行库写入，也未做真实数据浏览器截图；这是隐私、费用和离线验收边界。合成 acceptance 验证实际 Next BFF HTTP，不驱动浏览器点击；下载链接的真实渲染、编码和可访问性由 `StudyArtifactLinks.test.ts` 的 React render 测试覆盖。因为 production build 的 `Secure` cookie 不会经 localhost HTTP 自动发送，runner 从实际注册响应取得 opaque cookie 后显式附加于本地请求；后端仍执行真实 session 与 owner 校验。
- 剩余风险：真实旧 `.xls` 数据质量、同步生成时长与部署期成果清理策略仍需在受控真实数据验收中确认；Acceptance Review 仍待 Codex 产品验收。

## Acceptance Review

- 验收结果：Pending
- 验收证据：Implementation Report 已记录自动验证与离线合成跨层证据，等待 Codex 产品验收。
- 未通过项：无自动检查未通过项；真实数据/模型验收按隐私与费用边界未运行。
