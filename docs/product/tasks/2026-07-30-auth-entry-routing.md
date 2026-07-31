# 任务：登录进入大殿、注册返回登录

## Status

Ready

## Product Definition

- 用户确认：用户于 2026-07-30 明确确认“登录成功后进入大殿，注册成功后还是进登录页”及推荐设计。
- 问题：当前登录与注册成功默认都进入 `/study`，且注册会自动建立浏览器会话。
- 目标用户：使用朝堂 OS 登录或创建账号的用户。
- 目标：登录默认进入 `/dadian`；注册后不自动登录并返回带成功提示的登录页。
- 非目标：不修改大殿内容，不修改账号字段，不修改下旨与证据治理基线。

## Acceptance Criteria

- [ ] 无 `next` 的登录成功后进入 `/dadian`。
- [ ] 安全的 `/dadian`、`/study`、`/shiguan` 登录回跳继续有效。
- [ ] 不可信 `next` 回退 `/dadian`。
- [ ] 注册成功后进入 `/login?registered=1`。
- [ ] 注册成功响应不保留 `courtos_session`，登录页显示“注册成功，请登录”。
- [ ] 认证失败行为与安全错误提示保持不变。
- [ ] 前端测试、lint、typecheck、build、harness 与 diff check 通过。

## Delivery Constraints

- 范围：`frontend/src/features/pre-auth/**`、`frontend/src/app/api/auth/register/**`、相关前端认证测试与本任务文档。
- 兼容性：保持现有认证 API 字段、HttpOnly Cookie 策略和安全 `next` 白名单原则。
- 风险与限制：注册产生的后端临时会话采用尽力撤销；撤销失败不得把已创建账号报告为失败。
- 技能计划：`brainstorming`、`writing-plans`、`test-driven-development`、`codex-engineering-workflow`、`verification-before-completion`。
- Codex-only：是；禁止 Claude CLI、Claude runner 与 `gstack-claude`。

## Affected Modules

- 模块：登录与注册提交、注册 BFF、登录成功提示。
- 允许路径：`frontend/src/features/pre-auth/**`、`frontend/src/app/api/auth/register/**`、`docs/product/tasks/2026-07-30-auth-entry-routing.md`、对应设计与计划文档。
- 依赖模块：`frontend/src/lib/backendClient.ts`、`frontend/src/lib/session.ts`（优先复用，不扩大修改）。

## Technical Plan

- 架构边界：登录目的地白名单与注册固定目的地分离；注册 BFF 负责浏览器会话边界。
- 接口与依赖：复用 `logoutUser`、`clearSessionCookie`，不新增后端接口。
- 实施顺序：先写失败测试，再改目的地纯函数、注册 BFF 和登录提示，最后全量验证。
- 验证计划：定向 Node 测试、前端全量检查、仓库 harness、视觉/页面契约检查。
- 技术风险：服务端撤销失败时存在一个不可被浏览器使用、等待过期的临时会话。

## Implementation Report

- 改动摘要：Task 1 将登录成功目的地收紧为精确白名单：仅接受 `/dadian`、`/study`、`/shiguan`，缺失、未知或不可信 `next` 均默认进入 `/dadian`。Task 2 在注册成功后使用新签发的 session 尽力调用注销，随后始终清除（含可能既有的）`courtos_session`；即使撤销失败，已创建账号仍返回成功且浏览器 Cookie 仍被过期。Task 3 固定返回 `/login?registered=1`，登录页仅在 `useSearchParams().get("registered") === "1"` 时显示非敏感的“注册成功，请登录”状态提示；其他值（含缺失值）不显示。提示使用 `role="status"`，并复用现有消息布局增加金/绿高对比成功态。
- 自审：Task 1 的目的地策略采用 exact literal comparison，不接受前缀、查询、片段、编码或外部 URL 绕过；Task 2 的注销使用注册响应中的新 session，不复用入站旧 Cookie，且撤销结果不覆盖账号已创建事实，响应始终过期 `courtos_session`；Task 3 的成功提示由精确 marker 与同一条件渲染结构绑定，不读取或展示账号、邮箱、session 等敏感信息。登录/注册失败提示、FastAPI 契约和 ADR 0028 治理基线均未改变；保留了目标文件中的既有并行改动，产品验收继续保持 `Pending`。
- 验证：TDD RED 确认新测试因缺少精确 marker 判断而失败（5 PASS / 1 FAIL）；GREEN 后聚焦测试 6/6 PASS。定向认证测试、lint、typecheck、全量前端测试、隔离生产构建、harness、harness self-test 与 diff check 均通过。共享目录直接 build 曾因现有 `next dev` 构建锁退出 1；随后在不停止该进程的前提下，通过复制完整 `frontend/`（含 `node_modules`、排除 `.next`）到受控临时目录运行同一 build，取得成功编译证据且未改动仓库源码。
- 实际使用的 skill：`using-superpowers`（子代理预检）、`brainstorming`（确认已批准 brief 为最小设计边界）、`test-driven-development`（RED→GREEN）、`codex-engineering-workflow`（Codex-only、允许路径和证据闭环）、`verification-before-completion`（新鲜验证）。
- 验证命令与结果：
  - `cd frontend; node --test src/features/pre-auth/authForms.test.ts`（RED）：FAIL，5 PASS / 1 FAIL；失败原因为缺少 `searchParams.get("registered") === "1"`。
  - `cd frontend; node --test src/features/pre-auth/authForms.test.ts`（GREEN）：PASS，6/6。
  - `cd frontend; node --test src/features/pre-auth/authForms.test.ts src/features/pre-auth/formValidation.test.ts src/app/api/auth/authRoutes.test.ts`：PASS，15/15。
  - `cd frontend; npm run lint`：PASS，退出 0。
  - `cd frontend; npm run typecheck`：PASS，退出 0。
  - `cd frontend; npm test`：PASS，419/419。
  - 共享目录 `cd frontend; npm run build`：历史环境失败，退出 1；Next.js 报告同一工作区已有构建进程持锁。只读检查确认现有 `next dev` PID 2604/23360 自 2026-07-28 运行；未终止用户进程、未删除锁。
  - 隔离临时目录 `npm run build`：PASS，退出 0。命令策略为复制完整 `frontend/`（含 `node_modules`、排除 `.next`）到受控临时目录后执行相同 build；Next.js 16.2.10 Turbopack 编译成功、TypeScript 成功、31/31 静态页生成；验证后已清理临时目录，仓库业务源码无变更。
  - `node scripts/check_harness.mjs`：PASS，72 个基线文件。
  - `node scripts/check_harness.mjs --self-test`：PASS，44 项。
  - `git diff --check`：PASS，退出 0；输出仅包含工作区既有 LF→CRLF 警告。
- 未运行项与原因：未运行浏览器交互或真实注册请求，避免影响运行态数据；未运行任何真实模型调用。
- 剩余风险：源码契约、类型、lint、全量单测与隔离生产构建已覆盖精确 marker 行为；未做浏览器视觉验收。

## Acceptance Review

- 验收结果：Pending
- 验收证据：实现与验证证据见上；产品验收仍需用户确认。
- 未通过项：浏览器视觉验收未运行。
