# 任务：兵部 Revenue OS P0 垂直切片

> 所有任务必须阅读并遵循 `docs/decisions/0028-decree-evidence-flow-governance-baseline.md`；若任务与该基线冲突，必须标记为 `Blocked`，不得自行变更流程。

## Status

Ready

## Product Definition

- 用户确认：用户于 2026-10-07 明确回复“同意 所有的天才设计 我们立刻把所有的信息汇总 制定一套整体设计方案 设计UI 前后端和接口的完整设计 单拉 worktree 并写出完整的开发提示词给Codex的”，随后回复“下一步”；确认依据为同一 worktree 中的整体设计合同和 Codex 开发提示词。
- 问题：兵部已有六司分析能力，但缺少统一销售事实模型、证据化 DecisionPacket、唯一下一步、审批动作草稿和可复盘结果闭环。
- 目标用户：销售负责人、一线销售、经营负责人，以及参与报价、合同、财务和交付会审的部门负责人。
- 目标：实现 CSV/JSON 销售事实 → 兵部作战台 → 重点商机 → 销售会审包 → ActionDraft 的 P0 垂直切片；P0 只生成分析和草稿，不执行外部副作用。
- 非目标：不重写 CRM；不复制 Twenty/EspoCRM/Frappe/n8n；不修改 ADR 0028、既有下旨/史馆/锦衣卫/认证契约；不接真实 CRM 写入、邮件发送、改价、签约、付款、生产部署或公网数据源；不新造第四套 Agent Runtime、证据协议、审计账本或认证系统。

## Acceptance Criteria

- [ ] CSV/JSON preview/commit 支持字段校验、行级错误、幂等去重和 owner 隔离。
- [ ] `/bingbu` 总览能够展示漏斗、重点商机、阶段停滞、证据缺口、待会审和待审批动作。
- [ ] 商机详情能够展示客户活动时间线、唯一下一步、责任人、截止时间和证据抽屉。
- [ ] 会审包结构化区分事实、假设、建议、红线、证据缺口、跨部影响和未决事项。
- [ ] 兵部六司通过现有 Runtime Skills/证据协议工作，缺证据时返回 degraded，不编造事实。
- [ ] ActionDraft 只允许生成、审批、驳回状态；P0 不得进入外部执行状态。
- [ ] 所有受保护端点从认证上下文取得 owner，不接受客户端 owner ID；401/403/404/422/503 脱敏稳定。
- [ ] 前端包含 loading、empty、error、no-evidence、unauthorized 和 360px 窄屏状态；状态不只靠颜色表达。
- [ ] backend ruff/pytest、frontend lint/typecheck/test/build、Harness 检查和 `git diff --check` 不回归。
- [ ] 测试完全离线，使用 fake model、临时存储和 fixture；不读取私有 dotenv、不访问公网、不产生真实模型费用。

## Delivery Constraints

- 范围：产品设计和 P0 实现候选仅限 `backend/app/bingbu/**`、`backend/app/api/bingbu.py`、`backend/tests/test_bingbu_*.py`、`frontend/src/app/bingbu/**`、`frontend/src/app/api/bingbu/**`、`frontend/src/features/bingbu/**`、对应测试、必要的任务/决策/审查文档；最终 exact paths 必须由架构审查确认。
- 兼容性：保持 ADR 0028、现有 LangGraph/Runtime Skills、认证、`/study`、`/jinyiwei`、`/shiguan` 和史馆 REPLY 契约不变；浏览器只访问同源 BFF。
- 风险与限制：当前产品 authority 为 `STOP / canExecuteProductWork=false`；在 Owner/M0 选择本 exact task、独立 approval manifest 落地并取得 GO 前，不得修改产品代码、提交、推送、合并或部署。
- 技能计划：`pc-agent-design`、`spreadsheets:Spreadsheets`、`frontend-design`、`ui-ux-design-system`、`verification-before-completion`、`requesting-code-review`；外部竞情研究按需使用 `agent-reach`，默认不开公网。实施与复审优先走仓库现有 DeepSeek harness/LiteLLM：`litellm/deepseek-chat` 主实现，`litellm/deepseek-reasoner` 独立复审。
- 执行位：Codex 负责产品定义、设计审查、authority 门禁和验收；DeepSeek harness 负责主力编码、测试修复和异构红蓝复审。本任务禁止 Claude CLI、Claude runner、gstack-claude 和其他模型作为默认依赖；DeepSeek harness 不可用时，替代模型必须先取得用户显式授权并记录例外。

### 本次候选的 exact product paths

取得 GO 后，本次单候选只允许修改以下产品路径；若实现需要扩大范围，必须先重新登记 exact task 和 approval manifest：

```text
backend/app/main.py
backend/app/api/bingbu.py
backend/app/bingbu/__init__.py
backend/app/bingbu/models.py
backend/app/bingbu/validation.py
backend/app/bingbu/storage.py
backend/app/bingbu/service.py
backend/tests/test_bingbu_models.py
backend/tests/test_bingbu_service.py
backend/tests/test_bingbu_api.py
frontend/src/lib/backendClient.ts
frontend/src/lib/backendClient.bingbu.test.ts
frontend/src/app/api/bingbu/[...segments]/route.ts
frontend/src/app/api/bingbu/[...segments]/route.test.ts
frontend/src/app/bingbu/page.tsx
frontend/src/app/bingbu/opportunities/[id]/page.tsx
frontend/src/app/bingbu/war-room/[id]/page.tsx
frontend/src/app/bingbu/import/page.tsx
frontend/src/features/bingbu/BingbuDashboard.tsx
frontend/src/features/bingbu/bingbu.module.css
```

## Affected Modules

- 模块：候选模块“兵部 Revenue OS P0”；销售领域模型、销售导入、兵部作战读模型、DecisionPacket、ActionDraft、兵部总览 UI、BFF 和离线验收。
- 允许路径：待取得 GO 后由架构审查确认；候选路径见 `docs/product/tasks/2026-10-07-bingbu-revenue-os-contract.md` 与 `docs/prompts/2026-10-07-bingbu-revenue-os-codex-prompt.md`。
- 依赖模块：现有认证、storage、`app.agents.runtime_skills`、`app.agents.evidence_protocol`、FastAPI API 层、Next.js BFF、朝堂 Header、ADR 0028。

## Technical Plan

- 架构边界：待架构审查确认；设计方向为新增 `backend/app/bingbu/` bounded context，复用既有 Runtime Skills、证据协议和认证，不改变正式下旨图拓扑。
- 接口与依赖：新增兵部 overview/opportunities/timeline/decision-packet/import/war-room/action-draft 契约；浏览器通过同源 BFF 访问；所有写入带 request/trace/idempotency/audit 元数据。
- 实施顺序：先领域模型与 RED 测试；再导入 preview/commit；再读模型与 API；再 DecisionPacket/ActionDraft；再前端总览/详情/会审/导入；最后离线跨层验证、异构红蓝审和产品验收。
- 验证计划：后端 ruff + focused pytest + 全量 pytest；前端 lint/typecheck/test/build；DeepSeek harness check/self-test；双账号隔离、契约错误、窄屏/空态和禁止副作用测试。所有离线测试使用 fake model 注入，不直连供应商 API，不读取私有 dotenv，不消耗真实模型额度。
- 技术风险：销售事实字段和现有 storage 适配可能存在差异；外部 CRM 许可证和网络权限不纳入 P0；若必须改变 ADR 0028、认证或史馆边界，立即 Blocked 并单独立项。

## Implementation Report

- 改动摘要：Pending — 本回合只完成产品任务登记和设计合同，未修改产品代码。
- 自审：已核对现有项目 authority、ADR 0028、前后端边界、Runtime Skills 和工部标准开发模式；主工作区未被修改。
- 验证：Ready 状态、任务 ID 格式、设计合同、Codex 提示词和 worktree 隔离已核对。
- 实际使用的 skill：`pc-agent-design`；设计阶段参考 `hanlin-skill-advisor`；实现阶段待按本任务技能计划调用。模型执行策略已固定为现有 DeepSeek harness 优先，未在本设计登记回合发起真实模型调用。
- 验证命令与结果：`node scripts/check_harness.mjs` 为结构 PASS/BOOTSTRAP_OBSERVE；`node scripts/harness-doctor.mjs --check` 为 PASS；`node scripts/product-authority.mjs --status` 为 STOP/APPROVAL_NOT_SELECTED；文档围栏与空白检查通过。
- 未运行项与原因：产品 ruff/pytest/lint/typecheck/build 未运行，因为本回合没有产品代码改动且 authority 为 STOP。
- 剩余风险：尚未取得 M0 GO；exact allowed paths 尚未由架构角色冻结；外部 CRM 和真实模型均未接入。

## Acceptance Review

- 验收结果：Pending
- 验收证据：Ready 仅表示用户已确认产品目标和设计方向，不表示实现完成。
- 未通过项：产品代码尚未施工，等待 Owner/M0 选择 exact task 并授权。
