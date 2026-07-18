# 任务：新增史馆统一归档与旧案召回

## Status

Accepted

## Product Definition

- 用户确认：用户于 2026-07-17 通过“自动交付：新增史馆功能”明确委托 Codex 在无阻塞问题时自动确认、交付和验收。
- 问题：现有奏折决策链缺少统一、可追溯且能被后续决策复用的历史记录；决策依据、责任主体和结果散落后，既无法可靠复盘，也容易把演示或降级材料误当成真实事实。
- 目标用户：需要审阅历史事项的决策负责人，以及在后续奏折处理中参与会审的军机处、六部和丞相 Agent。
- 目标：新增“史馆”业务能力，统一保存奏折、决策、任务结果、知识条目和宣传材料；为决策记录参与部门、过程、结论、时间和责任主体；为证据记录来源及 `LIVE`、`MIXED`、`FALLBACK` 真实度标签；支持结果复盘与统计；按事项类型或所属部门召回相似旧案，并把可引用的历史经验与踩坑教训提供给军机处、六部和后续决策。
- 非目标：本次不接入外部史料、搜索引擎或向量数据库，不自动宣称证据客观真实，不新增用户/权限/多租户体系，不删除或迁移历史数据，不公开部署，不自动执行任何现实动作，也不把宣传材料默认视为事实证据。
- 最小假设：史馆采用仓库现有技术栈内可离线测试的本地持久化方案；五类档案使用统一基础契约并允许类型专属字段。`LIVE/MIXED/FALLBACK` 表示本次证据内容来自真实运行、真实与演示/降级混合、或完全来自演示/降级来源，而不是史馆对事实真伪作出的裁决。成功率按 `达成 / (达成 + 未达成 + 部分达成)` 计算，`持续观察` 与尚未复盘记录不进入分母；待复盘数量为尚未设置任何复盘状态的档案数。旧案召回先采用可解释的事项类型/所属部门匹配与稳定排序，不把模型生成内容伪装成数据库检索结果。

## Acceptance Criteria

- [x] 史馆提供统一档案契约，支持 `MEMORIAL`（奏折）、`DECISION`（决策）、`TASK_RESULT`（任务结果）、`KNOWLEDGE`（知识条目）和 `PUBLICITY`（宣传材料）五类记录；每条档案具有稳定唯一 ID、类型、标题、正文或摘要、事项类型、所属部门、创建时间和可选关联档案 ID，写入后可读取且跨应用进程重启保留。
- [x] 写入与读取接口严格校验类型、非空文本、部门、时间和关联关系；不存在的档案返回稳定 404，非法输入返回稳定 422；不提供删除接口，不覆盖已有 ID，不返回运行栈、密钥或私有配置。
- [x] 决策档案必须额外保存非空参与部门列表、决策过程、结论、决策时间和责任主体；缺失、空白或重复参与部门的决策档案无法作为成功记录保存，读取时完整返回决策留痕。
- [x] 每条档案可保存零个或多个结构化证据，证据至少包含来源说明和严格枚举的 `LIVE`、`MIXED`、`FALLBACK` 标签；未知标签、空白来源或非法嵌套字段被拒绝，前端明确展示标签含义，宣传材料不被自动提升为 `LIVE`。
- [x] 史馆支持把事项复盘状态设置为 `ACHIEVED`（达成）、`NOT_ACHIEVED`（未达成）、`PARTIAL`（部分达成）或 `OBSERVING`（持续观察），并保存复盘时间与可选说明；重复更新得到最后一次明确状态且不产生重复档案。
- [x] 统计接口和史馆页面展示档案总数、四类复盘状态数量、待复盘数量与成功率；成功率严格按产品定义计算，分母为零时返回可预测的 `null`/未统计状态而不是伪造 `0%`。
- [x] 旧案召回接口可按事项类型或所属部门至少一个条件查找相似档案，采用可解释、确定性的匹配和排序，支持有界结果数量；返回稳定的匹配原因、历史结论、复盘状态、经验与踩坑教训，且不会把无关记录或未持久化的模型内容冒充旧案。
- [x] 六部办理和军机处会审在有匹配旧案时能收到带档案 ID、来源标签、经验与教训的只读旧案上下文，后续丞相最终决策也能看到这份上下文；没有匹配或史馆暂不可用时保留现有奏折处理能力，并明确记录“无旧案/召回失败”的降级路径，不把召回失败伪装成已有历史经验。
- [x] 当前奏折流程成功完成后，至少把原奏折与最终决策以关联档案写入史馆；归档失败不得把未保存记录报告为成功，且不得改变现有 `POST /api/v1/decrees/chancellor` 的请求体、既有成功字段和脱敏错误分类。
- [x] 前端提供可访问的史馆页面，能够浏览和按五类档案、事项类型、部门筛选，查看决策留痕与证据标签，更新复盘状态，查看统计，并发起旧案召回；空状态、加载状态、校验失败、后端不可达和未知错误均有明确中文反馈。
- [x] 新增实现保持 `frontend -> BFF -> backend API -> 史馆存储/Agent` 单向依赖，数据库或运行态档案文件不进入 Git；如新增持久化选型、业务边界或 Agent 依赖方向，使用 ADR 记录并同步 `ARCHITECTURE.md`、scoped `AGENTS.md`、CI/harness 中的长期契约。
- [x] 离线测试覆盖五类归档、决策必填字段、证据标签、进程重建后读取、复盘状态与统计边界、召回排序/限量/无结果、Agent 旧案注入与降级、自动奏折/决策关联归档、API/BFF/UI 严格解析及连续调用隔离；backend lint/全量测试、frontend lint/typecheck/test/build、四组 harness/self-test 与 `git diff --check` 全部通过，不读取私有 dotenv、不访问真实模型或外部网络。

## Delivery Constraints

- 范围：候选业务模块为史馆领域模型与持久化、史馆 HTTP API、旧案召回与奏折决策链集成、史馆 BFF/页面、架构治理与离线回归；具体允许路径由程序团队负责人经只读架构分析后收窄。
- 兼容性：保留现有健康检查、DeepSeek 配置与脱敏链、六部 39 司目录、丞相 single/multi 路由、分层回奏与三项建议契约；旧案召回不得要求真实模型或外部服务才能测试。
- 风险与限制：史馆会持久化用户输入和决策内容，但本轮不设计敏感数据分级、权限或删除能力，因此仅限本地开发边界；测试必须使用临时数据库/目录。不得读取、修改、打印或提交 `backend/.env.example`，不得运行真实模型 smoke，不得提交、推送、部署或创建外部资源。

## Affected Modules

- 模块：史馆领域与持久化 —— **已由前次会话完成实现**（`backend/app/shiguan/{__init__,models,errors,db,validation,storage,recall,archive_decree}.py` 与 `test_shiguan_models.py`/`test_shiguan_storage.py`/`test_shiguan_validation.py`/`conftest.py` fixture 均已存在），经 solution-architect 只读复核确认满足 AC1-AC6，本轮不重写，仅由 test-engineer 复核测试充分性；`recall.py`、`archive_decree.py` 属于本模块允许路径，已建好并测试完毕，模块3只读复用。
- 允许路径：`backend/app/shiguan/**`、`backend/tests/test_shiguan_models.py`、`backend/tests/test_shiguan_storage.py`、`backend/tests/test_shiguan_validation.py`、`backend/tests/conftest.py`、`.gitignore`
- 依赖模块：现有 FastAPI/Pydantic 基础与本地运行环境
- 模块：史馆 API 与旧案召回
- 允许路径：`backend/app/api/shiguan.py`、`backend/app/main.py`（仅新增史馆路由与异常处理器的 import 及接入代码，不改动 `GET /health` 与既有丞相路由代码路径）、`backend/tests/test_shiguan_api.py`、`backend/tests/test_shiguan_recall.py`
- 依赖模块：史馆领域与持久化
- 模块：奏折决策链史馆集成
- 允许路径：`backend/app/agents/ministries/agent.py`、`backend/app/agents/junjichu/agent.py`、`backend/app/agents/chancellor/graph.py`、`backend/app/api/decrees.py`（仅新增归档调用，不改响应体/请求体/既有成功字段/错误分类）、`backend/tests/test_chancellor_graph.py`、`backend/tests/test_ministries_agent.py`、`backend/tests/test_junjichu_agent.py`、`backend/tests/test_decrees_api.py`、`backend/tests/test_shiguan_archive_decree.py`（职责为集成测试：验证 `POST /api/v1/decrees/chancellor` 成功路径确实调用 `archive_chancellor_decree` 并落库，不重复模块1已覆盖的单元测试）
- 依赖模块：史馆 API/领域、六部、军机处、丞相图
- 模块：史馆前端体验
- 允许路径：`frontend/src/app/shiguan/**`、`frontend/src/app/api/shiguan/**`、`frontend/src/lib/backendClient.ts`（仅新增导出函数，不改 fetchHealth/submitDecree 既有签名）、`frontend/src/lib/backendClient.test.ts`
- 依赖模块：史馆 API
- 模块：架构治理与回归验证
- 允许路径：`docs/decisions/0015-shiguan-archive-persistence.md`（新建）、`ARCHITECTURE.md`、`backend/AGENTS.md`、`frontend/AGENTS.md`、`.github/workflows/harness.yml`（如需要）
- 依赖模块：以上全部模块

## Technical Plan

- 架构边界：新增 `backend/app/shiguan/`（领域模型 `models.py`、异常 `errors.py`、连接管理 `db.py`、校验 `validation.py`、CRUD 与统计 `storage.py`、旧案召回 `recall.py`、奏折自动归档编排 `archive_decree.py`），与 `app/agents/**`、`app/api/**`、`app/langgraph_runtime/` 同级、职责独立（无 LLM 调用，纯确定性领域服务）。HTTP 契约层新增 `backend/app/api/shiguan.py`，挂载到 `app/main.py` 既有 `app` 实例，不改动 `GET /health` 与既有丞相路由代码路径。前端新增 `frontend/src/app/shiguan/page.tsx`（客户端组件）+ `archiveStatus.ts`（离线纯函数）+ `frontend/src/app/api/shiguan/**`（Route Handler）+ `backendClient.ts` 新增导出。持久化选型：Python 标准库 `sqlite3`（零新增生产依赖，短生命周期连接、不跨线程复用同一 Connection），默认运行态文件 `backend/data/shiguan.sqlite3`（含 WAL/SHM/journal 边车文件），同批更新 `.gitignore`；这是仓库首次确定后端持久化技术栈，新增 ADR 0015 并同步 `ARCHITECTURE.md`/`backend/AGENTS.md`。
- 接口与依赖：五类档案（MEMORIAL/DECISION/TASK_RESULT/KNOWLEDGE/PUBLICITY）共用基础字段 `id`（服务端生成，不可覆盖）、`type`、`title`（非空）、`content`（非空）、`matter_type`（非空）、`department`（非空字符串，不限定六部枚举，因决策/军机处档案不对应单一部门）、`related_archive_ids`（可选，写入时必须全部已存在，否则 422）、`evidence`（可选列表，`source` 非空 + `reality_label` 严格枚举 LIVE/MIXED/FALLBACK + 可选 `note`，`extra=forbid`）、`created_at`（服务端生成）、以及两个通用可选字段 `lessons_learned`/`pitfalls`（支持召回输出"经验与踩坑教训"，属 Product Definition 允许的通用扩展字段，非五类专属字段，已由 solution-architect 只读复核确认不违反任何"非目标"条款）。DECISION 类型额外必填：`participating_departments`（非空去重列表）、`decision_process`、`decision_conclusion`、`decision_time`、`responsible_owner`（均非空）。复盘状态独立 upsert（`status` 四态枚举 + `reviewed_at` + 可选 `note`），不产生新档案。**模块1现状**：以上领域模型、校验、存储、统计、召回、归档编排均已由前次会话在 `backend/app/shiguan/**` 实现并测试（`models.py`/`errors.py`/`db.py`/`validation.py`/`storage.py`/`recall.py`/`archive_decree.py`），经架构只读复核确认满足 AC1-AC6，本轮不重写，交由 test-engineer 复核测试充分性。HTTP 端点（模块2，新增）：`POST /api/v1/shiguan/archives`（201/422/503）、`GET /api/v1/shiguan/archives/{id}`（200/404）、`GET /api/v1/shiguan/archives`（按 type/matter_type/department 筛选，确定性排序，有界 limit，200）、`PATCH /api/v1/shiguan/archives/{id}/review`（200/404/422）、`GET /api/v1/shiguan/statistics`（200/503，成功率分母为零返回 null）、`POST /api/v1/shiguan/recall`（matter_type/department 至少一项，200/422）；请求体直传给 `storage`/`recall` 层现有函数，不重复定义平行校验模型，唯一校验权威保持在 `app.shiguan.models`/`validation`；`GET /archives` 的 `type` 查询参数用 `Literal[...] | None`；响应模型直接复用 `app.shiguan.models.Archive/Statistics/ReviewStatus` 与 `app.shiguan.recall.RecallMatch`；异常处理器仿照 `decrees.py::register_chancellor_exception_handlers` 风格，把 `ArchiveNotFoundError→404`、`ArchiveValidationError→422`、`ShiguanStorageError→503` 映射为脱敏 JSON（`errors.py` 已保证 `str(exc)` 安全可暴露）；`app/main.py` 仅新增 import + `include_router`/`register_shiguan_exception_handlers` 接入代码，不改动 `GET /health` 与既有丞相路由代码路径。丞相端点集成（模块3）：`POST /api/v1/decrees/chancellor` **不新增、不修改任何响应字段**（选项 A，最保守读法满足"不得改变既有成功字段"）；`app/api/decrees.py` 在 `response = _build_response_from_graph_result(result)` 之后、`return response` 之前调用 `archive_chancellor_decree(payload.decree_text, response)`（该函数已实现，duck-typing 读取 `departments/processing_path/rationale/council_verdict/final_verdict`，与 `ChancellorDecreeResponse` 现有字段一一对应，且已测试"永不抛出"），构造 MEMORIAL+DECISION 两条关联档案并写入，`responsible_owner` 默认"丞相"；内部吞掉全部存储异常（仅记录日志），因此"归档失败不得报告为成功"通过"响应体本就不包含归档结果字段"这一事实自然满足，验证只能在史馆 API 侧独立断言，`test_shiguan_archive_decree.py` 作为集成测试验证该调用链确实落库。旧案上下文注入（模块3，具体签名经架构复核确认可行）：`invoke_ministry_agent(department, decree_text, rationale, chat_model, *, recall_context: RecallContext | None = None)`；`invoke_junjichu_council(..., *, recall_contexts: dict[str, RecallContext] | None = None)` 与 `run_junjichu_council(..., *, recall_contexts: dict[str, RecallContext] | None = None)` **均需新增该参数**（军机处会审本身也须收到旧案上下文，不能只注入到 per-department 层）；两个 agent 包只做 `RecallContext` 类型导入，不产生 sqlite I/O 依赖。实际 sqlite 查询集中在 `chancellor/graph.py`：`_handle_single_ministry` 调用 `safe_recall_context_for_department(department)`（`recall.py`，捕获全部异常，fail-closed，区分"无匹配"/"史馆不可用"两种降级原因并用不同中文短语描述，已测试"永不抛出"）取得只读上下文并传入 `invoke_ministry_agent`；`_run_junjichu_council` 为全部 `departments` 各取一次并以 `dict[str, RecallContext]` 传入 `run_junjichu_council`；`ChancellorGraphState`（`total=False`）新增 `recall_contexts` key，`_finalize_chancellor` 的 `evidence` dict 增加 `"recall_context"` 键（`RecallContext.model_dump()` 后再 `json.dumps`）。降级文案在 `invoke_ministry_agent` 内按三种情形区分：`recall_context is None`（不改变现有 prompt，兼容既有测试）、`available and entries` 追加旧案参考文本块（含 `archive_id/historical_conclusion/review_status/lessons_learned/pitfalls`）、`available and not entries` 追加"未查得相关旧案"、`not available` 追加"旧案召回暂不可用，本次办理不含历史参考"（满足 AC7"不把召回失败伪装成已有历史经验"）。仅注入到部级/军机处/丞相三层，不注入 39 司层（验收标准原文为"六部办理和军机处会审"，不含司级，缩小回归面）；匹配维度仅用 `department`（丞相分流阶段无结构化 `matter_type` 标签，避免引入不确定性匹配）。前端（模块4）延续 `frontend/src/app/study/` 已确立的模式：`frontend/src/app/shiguan/page.tsx`（客户端组件）+ `archiveStatus.ts`（离线纯函数，供 `.test.ts` 单测）+ `frontend/src/app/api/shiguan/**`（Route Handler，相对路径 + `.ts` 扩展名导入 `backendClient.ts`）+ `backendClient.ts` 新增导出（不改 `fetchHealth`/`submitDecree` 既有签名）。持久化选型：Python 标准库 `sqlite3`（零新增生产依赖，短生命周期连接、不跨线程复用同一 Connection），默认运行态文件 `backend/data/shiguan.sqlite3`（含 WAL/SHM/journal 边车文件），`.gitignore` 已在模块1改动中覆盖 `backend/data/`、`*.sqlite3*` 全系列，无需再改；这是仓库首次确定后端持久化技术栈，新增 ADR 0015（编号未被占用，现有最高编号为 0014）并同步 `ARCHITECTURE.md`/`backend/AGENTS.md`/`frontend/AGENTS.md`（模块5）。
- 实施顺序：模块1史馆领域与持久化 → 模块2史馆 API 与旧案召回 → 模块3奏折决策链史馆集成 → 模块4史馆前端体验 → 模块5架构治理与回归验证（ADR + 文档同步 + 全量命令收尾）。
- 验证计划：模块1 `ruff check .` + 新增测试子集 + 全量 `pytest`；模块2 同上，另加 `test_health.py`/`test_decrees_api.py` 回归子集 + 全量 `pytest`；模块3 因改动 ministries/junjichu/chancellor 共享签名，必须跑全量 `pytest`；模块4 `npm run lint && npm run typecheck && npm test && npm run build` + entry 烟雾验证 `curl -i http://localhost:3000/shiguan`；模块5（最终交付前全量）：`backend` `ruff check .` + 全量 `pytest`，`frontend` `lint`+`typecheck`+`test`+`build`，`node scripts/check_harness.mjs`、`node scripts/check_harness.mjs --self-test`、`node .agents/hooks/check-harness.mjs --self-test`、`node .agents/skills/product-flow/scripts/run-claude-delivery.mjs --self-test`、`git diff --check`。测试用临时数据库路径（conftest autouse fixture monkeypatch `app.shiguan.db` 的默认路径到 `tmp_path`），"进程重启后可读取"用"关闭连接、以同一文件路径重新 connect"作为进程内可验证代理。
- 技术风险：(1) sqlite 为本仓库首次持久化选型，已通过新增 ADR 0015 处理，不视为阻塞；(2) 归档写入是本地 sqlite 操作，不推高既有 11/54 次模型调用上限，但需在 `archive_chancellor_decree` 内做好异常兜底，避免磁盘 IO 异常成为丞相端点新的挂起源；(3) TASK_RESULT/KNOWLEDGE/PUBLICITY 三类档案本轮只提供通用写入 API，无专属自动化写入触发路径与前端创建表单（验收标准未要求），属有意的不对称设计，非遗漏；(4) 前端史馆页面与奏折端点响应体解耦（选项 A），验证归档效果需要组合调用丞相端点与史馆查询接口。

## Implementation Report

- 改动摘要：由纯 Codex 产品、UX、架构、后端、前端与 QA 角色接力完成。后端补齐严格 review/recall 请求契约、单部门单次召回上下文、MEMORIAL+DECISION 原子归档、参与部门召回、脱敏存储错误与专用回归测试；前端修正真实召回响应解析，补齐完整决策留痕、四态统计、来源标签语义、中文错误和无障碍动态状态；新增 ADR 0015 并同步架构、scoped AGENTS 与 harness 长期基线。
- 自审：修复了前端以虚构召回字段形成的假绿、自动归档半成功风险、畸形丞相响应仍被归档、ADR 模板不合规和旧案上下文重复查询。公开 `POST /api/v1/decrees/chancellor` 请求体、既有成功字段与错误分类保持不变；未读取私有 dotenv，未调用真实模型，未使用 Claude Code。
- 验证：后端 `ruff check .` 通过、全量 `pytest` 479 passed；前端 `npm.cmd run lint`、`npm.cmd run typecheck`、`npm.cmd test`（78 passed）、`npm.cmd run build` 全部通过；harness 49 个基线、20 项 self-test、Stop hook 3 项、product-flow runner 25 项 self-test 与 `git diff --check` 全部通过。独立 QA 另跑后端相关 364 passed、前端 78 passed并给出 GO。
- 剩余风险：仅有 Starlette TestClient 对 httpx 的第三方弃用警告；史馆仍限定本地开发，不含鉴权、敏感数据分级、保留/删除策略、迁移、外部史料或公开部署。改动尚未提交。

## Acceptance Review

- 验收结果：Accepted（独立 QA：GO）
- 验收证据：R1-R9 与 A-R1-A-R9 全部 PASS。后端全量 479 passed、ruff PASS；前端 78 passed、lint/typecheck/build PASS；harness 49 个基线、20 项 self-test、Stop hook 3 项、product-flow runner 25 项 self-test、`git diff --check` 均 PASS。独立 QA 复跑后端相关 364 passed、前端 78 passed，并核对真实 diff、原子归档、单次召回、严格前后端契约、中文 UI 与 ADR/依赖方向。
- 未通过项：无。唯一非阻塞项为 Starlette TestClient 对 httpx 的第三方弃用警告；本地开发边界外的鉴权、敏感数据治理、删除/迁移与部署仍属明确非目标。
