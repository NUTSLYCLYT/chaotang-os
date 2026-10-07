# Codex 开发提示词：兵部 Revenue OS

> 复制本文件内容给 Codex 执行。当前仓库 authority 为 `STOP`；未取得 Owner/M0 对本 exact task 的 GO 前，只能进行只读检查、设计校验和测试合同准备，不得修改产品代码、提交、推送、合并或部署。

## 角色

你是朝堂 OS 的主力实施工程师，负责在独立 worktree 中把兵部 Revenue OS 的 P0 垂直切片落地。你必须遵循仓库根 `AGENTS.md`、`frontend/AGENTS.md`、`backend/AGENTS.md`、ADR 0028 和 `docs/gongbu-standard-dev-mode.md`。Codex 负责目标冻结、设计审查和验收；实施位按项目授权执行；合并前必须有异构模型红蓝互审记录。

## 模型与执行位策略

- 默认实施路径是仓库现有 DeepSeek harness，即现有 LiteLLM 网关、OpenCode/Runtime 入口和项目既有检查，不得另造第四套 harness。
- 主实现使用 `litellm/deepseek-chat`；架构推理、风险复核和红蓝互审使用 `litellm/deepseek-reasoner`。Codex 负责产品定义、设计审查、authority 门禁和最终验收。
- Claude CLI、Claude runner、gstack-claude、其他模型或外部 Agent 不得作为默认依赖。只有 DeepSeek harness 明确不可用并获得用户显式授权时，才可临时兜底；必须在审查文档记录失败原因、替代模型、影响范围和回退方式。
- 所有模型调用必须经过现有 harness/网关；禁止在产品代码中直连 OpenAI/DeepSeek 等供应商 API，禁止把密钥、私有 dotenv、真实模型输出写入仓库。

## 工作区

- 项目主仓库：`H:\\ChaotangSource\\chaotang-os-ext-dev-20260925`
- 本次 worktree：`H:\\ChaotangSource\\worktrees\\bingbu-revenue-os-20261007`
- 分支：`codex/bingbu-revenue-os-20261007`
- 不得触碰主工作区中的未跟踪文件。

## 任务目标

实现“CSV/JSON 销售事实 → 兵部作战台 → 重点商机 → 销售会审包 → 动作草稿”的 P0 闭环：

1. 统一销售领域模型和确定性校验。
2. 导入销售数据，支持 preview/commit、幂等和错误行定位。
3. 提供兵部总览、商机列表、商机详情、证据时间线和会审包。
4. 调用现有 Runtime Skills/证据协议生成结构化 DecisionPacket；不要新造 Agent Runtime。
5. 生成 ActionDraft，但禁止执行任何外部副作用。
6. 保持现有朝堂下旨、军机处、六部、锦衣卫、史馆、认证和 `/study` 契约不变。

## 开始前必须检查

按顺序执行并记录结果：

```powershell
Set-Location 'H:\\ChaotangSource\\worktrees\\bingbu-revenue-os-20261007'
Get-Content .\\AGENTS.md
Get-Content .\\frontend\\AGENTS.md
Get-Content .\\backend\\AGENTS.md
Get-Content .\\docs\\decisions\\0028-decree-evidence-flow-governance-baseline.md
Get-Content .\\docs\\gongbu-standard-dev-mode.md
node scripts/check_harness.mjs
node scripts/harness-doctor.mjs --check
node scripts/product-authority.mjs --status
```

同时核对 `docs/gongbu-standard-dev-mode.md`、`backend/app/langgraph_runtime/deepseek_config.py`、`deepseek_client.py` 和 `deepseek_graph.py`，确认当前 DeepSeek harness 的入口与模型别名；不要自行创建新的 provider、client 或 runtime。默认只做离线检查和 fake model 测试，除非用户另行授权，不运行真实模型调用。

如果 authority 仍为 STOP：停止产品施工，只报告阻塞原因和所需 exact task/approval，不绕过门禁。

## 允许修改的路径（取得 GO 后）

```text
backend/app/bingbu/**
backend/app/api/bingbu.py
backend/tests/test_bingbu_*.py
frontend/src/app/bingbu/**
frontend/src/app/api/bingbu/**
frontend/src/features/bingbu/**
frontend/src/lib/backendClient.bingbu*.ts
frontend/src/**/bingbu*.test.ts
frontend/AGENTS.md（仅在新增命令/边界时）
backend/AGENTS.md（仅在新增命令/边界时）
docs/product/tasks/2026-10-07-bingbu-revenue-os-contract.md
docs/decisions/2026-10-07-bingbu-revenue-os.md
docs/reviews/2026-10-07-bingbu-revenue-os-review.md
```

禁止修改：ADR 0028、`.harness/`、product authority、既有认证/史馆/锦衣卫契约、remote、钩子、模型密钥、私有 dotenv、部署配置和无关文件。

## 先写 RED，再写 GREEN

先为以下行为补测试并观察失败：

- 领域模型拒绝非法阶段、负金额、空负责人和不完整唯一下一步。
- owner 从认证上下文注入，客户端传入 owner ID 被拒绝或忽略。
- CSV/JSON preview 能返回行级错误；commit 幂等且不会重复写入。
- overview/opportunities/detail/timeline/decision-packet 契约严格校验。
- 缺证据时返回 `degraded` 和 `evidence_gaps`，不得编造事实。
- war-room 只生成 DecisionPacket/ActionDraft，不触发外部动作。
- action draft 状态只能按确定性状态机迁移；P0 永远不能进入 `EXECUTED`。
- 401/403/404/422/503 错误脱敏；双账号数据隔离。
- 前端 loading/empty/error/no-evidence/窄屏状态存在且不依赖真实网络。

## 后端实现约束

- 先阅读现有 `app/agents/runtime_skills`、`app/agents/evidence_protocol`、认证和 storage 实现，复用它们的契约。
- 新增 `backend/app/bingbu/` bounded context；API 只负责 Pydantic 契约、认证、错误映射和调用 service。
- 不把 HTTP、数据库、模型调用写进 Agent/领域模型。
- DecisionPacket 必须区分 `facts`、`assumptions`、`recommendations`、`evidence_gaps`、`redlines`、`next_action`、`cross_bureau_impacts`、`unresolved_items`。
- 所有外部适配器默认 disabled；P0 只允许 fixture/CSV/JSON，Twenty 适配器只做 P1 设计或只读 stub。
- 所有模型调用使用 fake model 注入；测试不得读取私有 dotenv、访问公网或消耗真实额度。
- 实现与复审遵循 DeepSeek harness 路由：`deepseek-chat` 主实现，`deepseek-reasoner` 独立复审；测试环境不得因 harness 不可用而静默切换其他模型。
- 所有写入必须带 request/trace/idempotency/audit 元数据。

## API 契约

实现并测试：

```text
GET  /api/v1/bingbu/overview
GET  /api/v1/bingbu/opportunities
GET  /api/v1/bingbu/opportunities/{id}
GET  /api/v1/bingbu/opportunities/{id}/timeline
GET  /api/v1/bingbu/decision-packets/{id}
GET  /api/v1/bingbu/imports/{id}
POST /api/v1/bingbu/imports/preview
POST /api/v1/bingbu/imports/commit
POST /api/v1/bingbu/war-rooms
POST /api/v1/bingbu/action-drafts
POST /api/v1/bingbu/action-drafts/{id}/approve
POST /api/v1/bingbu/action-drafts/{id}/reject
```

严格遵循现有 FastAPI 路由注册、`CurrentUser`、稳定错误和 JSON schema 风格。浏览器端不能直连 FastAPI。

## 前端实现约束

页面：

```text
/bingbu
/bingbu/opportunities/[id]
/bingbu/war-room/[id]
/bingbu/import
```

- 复用现有朝堂 Header、认证、BFF 和 CSS 约定。
- `src/lib/backendClient.ts` 是唯一后端网络入口；Route Handler 使用相对路径和显式 `.ts` 扩展名以支持 Node `node:test`。
- 总览优先展示重点商机、阶段停滞、证据缺口、待会审和唯一下一步；不要做纯 KPI 墙。
- 外部动作只能显示“生成草稿/申请审批”，不能出现无审批执行按钮。
- 状态不只靠颜色；支持 loading、empty、error、no-evidence、unauthorized 和 360px 窄屏。
- 文本可缩放不截断；动效遵守 `prefers-reduced-motion`；对比度至少 4.5:1。

## 结构化交付物

完成后必须生成：

1. `docs/decisions/2026-10-07-bingbu-revenue-os.md`：记录数据模型、API、审批边界、外部项目隔离和取舍。
2. `docs/reviews/2026-10-07-bingbu-revenue-os-review.md`：记录 DeepSeek harness 异构红蓝互审，至少包含 `deepseek-chat` 实施位、`deepseek-reasoner` 复审位、时间、owner、期限、来源和结论；若使用兜底模型，必须记录显式授权和例外原因。
3. 测试报告：backend ruff/pytest、frontend lint/typecheck/test/build、Harness 命令及失败/修复记录。
4. Git diff 中不得出现密钥、私有路径、真实客户数据、网络响应正文或真实模型输出。

## 验收命令

```powershell
Set-Location 'H:\\ChaotangSource\\worktrees\\bingbu-revenue-os-20261007'
Set-Location backend
.venv\\Scripts\\python.exe -m ruff check .
.venv\\Scripts\\python.exe -m pytest tests/test_bingbu_*.py -q
.venv\\Scripts\\python.exe -m pytest -q
Set-Location ..\\frontend
npm run lint
npm run typecheck
npm test
npm run build
Set-Location ..
node scripts/check_harness.mjs
node scripts/harness-doctor.mjs --check
node scripts/product-authority.mjs --status
```

不得用真实模型 smoke、公网接口、MCP 凭据或真实 CRM 账号代替离线测试。只有用户另行授权且离线门禁通过后，才可以设计外部集成验收。

## 停止条件

遇到以下任一情况立即停止并报告，不自行扩大范围：

- authority 为 STOP 或 exact task 未选定。
- 需要修改 ADR 0028、Harness、权限模型或现有史馆/锦衣卫契约。
- 需要引入新的模型供应商、外部账号、真实 CRM 写入或付费服务。
- DeepSeek harness 不可用且没有用户对替代模型的显式授权。
- 需要复制 AGPL/Commons Clause 项目代码进入朝堂。
- 测试失败的根因不清，或同一门禁连续三次失败。

## 最终回复格式

报告：

- 实际修改文件
- 未修改文件和原因
- API/领域契约
- 已通过的验证命令及证据
- 未验证项目
- 风险和下一步
- worktree 路径、分支、HEAD、干净/脏状态

不要声称完成了未实际运行的测试、审查、外部集成或部署。
