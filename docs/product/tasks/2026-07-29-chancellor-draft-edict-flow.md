# 任务：丞相案例驱动拟旨流程

> 所有任务必须阅读并遵循 `docs/decisions/0028-decree-evidence-flow-governance-baseline.md`；本任务只在下旨入口之前增加无执行副作用的拟旨准备，不改变下旨后的会审、证据和归档拓扑。

## Status

Implemented

## Product Definition

- 用户确认：用户于 2026-07-29 明确要求项目中的丞相 Agent 加载 `chancellor-draft-edict`，并确认新增独立拟旨流程。
- 问题：当前 `/study` 只能咨询或直接下旨，运行时丞相不会读取新 Skill，用户的模糊意图无法先经过案例驱动澄清与草案确认。
- 目标用户：希望用自然语言提出模糊需求、由丞相帮助说清后再下旨的已登录用户。
- 目标：新增受认证的拟旨 Agent、API、BFF 和上书房交互；拟旨加载仓库 Skill，生成案例建议或完整草案，只有 `DRAFT_READY` 草案才能进入现有下旨流程。
- 非目标：不改变六部/军机处/锦衣卫/史馆执行拓扑；不在拟旨阶段创建 Mission、通知部门、采证或归档；不把咨询历史当拟旨；不新增自动交易或其他现实执行能力。

## Acceptance Criteria

- [x] 用户于 2026-07-29 选择并确认“保守补全、直接成旨”：首轮拟旨优先生成大神级完整草案，安全默认值作为丞相建议或暂定边界完整展示，无真实阻断时直接进入 `DRAFT_READY`。
- [x] 自动补全不得扩大现实权限；高风险授权、必要材料、冲突或安全问题继续阻断。
- [x] 用户输入模糊需求并点击【拟旨】后，收到“理解、专业案例、推荐理由、暂定假设、自然修改提示、状态”的案例驱动响应，而不是问卷。
- [x] 拟旨运行时从 `.agents/skills/chancellor-draft-edict/SKILL.md` 加载规则；文件缺失、越界、空内容或缺少核心锚点时失败关闭并返回脱敏错误。
- [x] 拟旨请求不调用现有下旨图、六部、军机处、锦衣卫或史馆，也不创建 Mission。
- [x] 用户修改后生成带版本号、版本指纹和完整字段的草案；只有 `DRAFT_READY` 启用【下旨】。
- [x] 下旨只消费用户看见的当前草案文本；草案被修改或指纹不匹配时禁止继续旧版本。
- [x] 正式下旨仍走现有 `POST /api/v1/decrees/chancellor`，保持 ADR 0028 的办理与一旨一条 `REPLY`。
- [x] 前后端校验失败、配置失败、模型失败、网络失败均返回稳定脱敏分类。
- [x] 自动化测试使用假模型和内存请求，不触发真实 DeepSeek、真实下旨或外网。

## Delivery Constraints

- 范围：`.agents/skills/chancellor-draft-edict/`、`backend/app/agents/chancellor_draft/`、`backend/app/api/chancellor_draft.py`、`backend/app/main.py`、对应后端测试、`frontend/src/lib/backendClient.ts`、`frontend/src/app/api/drafts/chancellor/`、`frontend/src/app/study/`、相关测试、ADR/计划/Harness。
- 兼容性：保持认证 Bearer 转发、后端地址仅服务端可见、现有咨询与下旨端点、错误脱敏、同步调用和 ADR 0028 拓扑。
- 风险与限制：当前工作区有其他未提交后端与文档改动；不得覆盖或混入。首版草案状态在当前浏览器按认证用户隔离，不承诺跨设备恢复。
- 技能计划：`brainstorming`、`writing-plans`、`test-driven-development`、`codex-engineering-workflow`、`record-decision`、`verification-before-completion`。
- Codex-only：是；禁止 Claude CLI、Claude runner 与 gstack-claude。

## Affected Modules

- 模块：候选模块“丞相拟旨域”、上书房拟旨交互、现有下旨版本门禁、Harness 治理。
- 允许路径：`.agents/skills/chancellor-draft-edict/**`、`backend/app/agents/chancellor_draft/**`、`backend/app/api/chancellor_draft.py`、`backend/app/main.py`、`backend/tests/test_chancellor_draft_*.py`、`frontend/src/lib/backendClient.ts`、`frontend/src/lib/backendClient.test.ts`、`frontend/src/app/api/drafts/chancellor/**`、`frontend/src/app/study/**`、`docs/product/tasks/2026-07-29-chancellor-draft-edict-flow.md`、`docs/superpowers/specs/2026-07-29-chancellor-draft-edict-flow-design.md`、`docs/superpowers/plans/2026-07-29-chancellor-draft-edict-flow.md`、`docs/decisions/0033-chancellor-draft-edict-flow.md`、`scripts/check_harness.mjs`。
- 依赖模块：认证、DeepSeek 模型构建、现有上书房、现有正式下旨 BFF/API。

## Technical Plan

- 架构边界：独立拟旨 Agent 只消费对话和 Skill，输出严格结构化拟旨状态；正式下旨图不读取对话历史，只消费已展示并固化的旨意文本。
- 接口与依赖：新增 `POST /api/v1/chancellor-drafts` 和同源 `POST /api/drafts/chancellor`；请求携带严格交替消息和可选前版指纹，响应携带案例/草案、状态、版本与指纹。
- 实施顺序：Skill 加载器与图 → FastAPI 契约 → Next.js 客户端/BFF → `/study` 状态与 UI → 下旨版本门禁 → 文档/Harness。
- 验证计划：后端定向 pytest、前端 node:test、lint/typecheck/build、Harness 与 `git diff --check`；全程假模型。
- 技术风险：模型输出 schema 漂移、Skill 文件部署缺失、当前 `StudyClient` 状态复杂、浏览器草案缓存与旧版咨询缓存隔离。

## Implementation Report

- 改动摘要：新增 Skill 运行时加载器、独立拟旨图、认证 FastAPI/BFF、上书房双按钮交互，以及用户/版本/指纹/正文绑定的一次性下旨门禁。
- 自审：拟旨域未导入六部、军机处、锦衣卫或史馆；正式下旨图保持 ADR 0028 拓扑；用户修改输入会废止浏览器中的旧草案。
- 验证：后端全量测试、ruff、前端全量测试、lint、typecheck、build、Harness self-test 和 diff check 均已执行。
- 实际使用的 skill：`brainstorming`、`writing-plans`、`test-driven-development`、`codex-engineering-workflow`、`record-decision`、`verification-before-completion`。
- 最终权威验证结果：后端 `2008 passed, 1 skipped`；前端 `399 passed`；Ruff、前端 lint/typecheck/生产构建、Harness normal/self-tests、Hook self-test 与 diff check 均通过。
- 运行时验收：已调用一次真实模型验证模糊意图拟旨；未真实下旨，避免创建 Mission 或业务归档。
- 剩余风险：一次性草案授权为进程内状态，仅适用于当前单进程 MVP；多实例部署前必须迁移到共享、原子、带过期时间的存储。

## Acceptance Review

- 验收结果：PASS / Complete
- 2026-07-29 最终升级复验：Skill 校验通过；后端全量 `2008 passed, 1 skipped`，Ruff 通过；前端全量 `399 passed`，lint、typecheck、build 通过；Harness 与两组 self-test、`git diff --check` 均已重新执行。
- 真实模型证据：输入“我要炒股赚钱”返回顶层与草案层 `DRAFT_READY`、版本 1、空材料缺口、非空假设和旨意正文、非空 64 字符指纹；范围覆盖通用市场环境、行业与公司研究、估值、风险、观察条件、失效条件和可复用决策模板，排除项为空。
- 权限边界证据：专项测试覆盖跨用户、篡改、旧版本、重复消费、编辑失效、唯一底部【下旨】及拟旨不执行；真实检查只调用拟旨图，未调用 Mission、下旨或史馆接口。浏览器只读检查发现已有认证的 `/study` 页面，但未填写、未点击，也未创建或修改用户数据。
- 外部验证说明：真实【下旨】会创建 Mission 与 `REPLY`，需要单独明确授权；它是独立外部验证，不是本任务完成条件。
