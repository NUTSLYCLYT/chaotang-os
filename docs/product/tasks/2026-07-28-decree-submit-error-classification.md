# 任务：下旨失败原因分类与验收

> 所有任务必须遵循 `docs/decisions/0028-decree-evidence-flow-governance-baseline.md`；本任务不改变其中规定的下旨业务流。

## Status

Accepted

## Product Definition

- 用户确认：用户于 2026-07-28 明确确认采用“准确归因 + 保持既有 120 秒时限”的方案，并要求多 Agent 实现及验收。
- 问题：下旨请求超时或中断时，页面统一显示“无法连接朝堂后端”，即使后端实际可用，造成误导。
- 目标用户：在上书房提交旨意的已登录用户。
- 目标：保留后端不可达提示；将客户端请求超时明确展示为下旨处理超时；继续保留配置、模型和校验失败的现有分类；移除上书房的静态模型费用提示。
- 非目标：不改变 ADR 0028 业务流、不增加真实模型调用、不调整 120 秒时限、不改为异步任务、不移除提交中的加载状态或错误反馈。

## Acceptance Criteria

- [ ] 下旨客户端能将由自身超时中止导致的请求结果标识为独立的 `timeout` 分类。
- [ ] 上书房向用户展示“下旨处理超时”的明确文案，且不声称后端未启动。
- [ ] 真实网络不可达仍使用原有“无法连接朝堂后端”文案。
- [ ] 校验、配置和模型失败的既有错误分类不回归。
- [ ] 自动化测试覆盖超时、网络不可达及既有 HTTP 分类；测试不触发真实模型调用。
- [ ] 上书房不再渲染“下旨会触发真实司议、部议、军机处会审与丞相汇总，并可能产生多次模型调用费用；请确认后提交。”，且没有残留 `feeNotice` 样式。
- [ ] 独立验收包含前后端健康链路验证与改动相关测试，并记录结果。

## Delivery Constraints

- 范围：只调整前端下旨 BFF、浏览器提交边界、上书房错误映射与静态费用提示、相关测试及本任务的交付证据。
- 兼容性：保持 `POST /api/decrees/chancellor` 与 `POST /api/v1/decrees/chancellor` 路径和成功响应契约不变。
- 风险与限制：无法从已丢失的历史请求中反推出具体断点；修复只保证后续请求不会把客户端超时误报为后端未启动。
- 技能计划：`systematic-debugging`、`test-driven-development`、`subagent-driven-development`、`verification-before-completion`。
- Codex-only：是；不使用 Claude CLI、Claude runner 或 gstack-claude。

## Affected Modules

- 模块：上书房下旨 BFF 与 UI 错误状态。
- 允许路径：`frontend/src/lib/backendClient.ts`、`frontend/src/lib/backendClient.test.ts`、`frontend/src/app/api/decrees/chancellor/route.ts`、`frontend/src/app/api/decrees/chancellor/route.test.ts`、`frontend/src/app/study/decreeStatus.ts`、`frontend/src/app/study/decreeStatus.test.ts`、`frontend/src/app/study/studySubmission.ts`、`frontend/src/app/study/studySubmission.test.ts`、`frontend/src/features/study-visual/DevStudyWorkspace.tsx`、`frontend/src/features/study-visual/DevStudyWorkspace.module.css`、`frontend/src/features/study-visual/DevStudyWorkspace.test.ts`、`docs/product/tasks/2026-07-28-decree-submit-error-classification.md`、`docs/superpowers/specs/2026-07-28-decree-submit-error-classification-design.md`、`docs/superpowers/plans/2026-07-28-decree-submit-error-classification-plan.md`。
- 依赖模块：FastAPI 下旨接口保持只读契约依赖，无后端实现改动。

## Technical Plan

- 架构复核确认错误链路为 `backendClient.ts` → 下旨 BFF → `studySubmission.ts` → `decreeStatus.ts`；浏览器提交边界的已知错误白名单必须包含 `timeout`，否则 BFF 的 504 会降级为 `unknown`。
- 客户端仅在自身注入计时器的回调已触发并中止请求时返回 `timeout`；未触发该回调的外部 `AbortError` 与其他网络异常保持为 `network`。
- BFF 将 `timeout` 映射为 504 和固定脱敏文案，浏览器提交边界与 UI 映射保持相同分类。
- 上书房两个 composer 均删除静态费用提示和 `feeNotice` 样式；保留提交按钮、办理中、本地提示及错误反馈。

## Implementation Report

- 改动摘要：新增下旨 `timeout` 错误分类，BFF 返回 504，浏览器提交边界接受该分类，上书房显示“下旨处理超时，请稍后重试。”；移除了两处静态费用提示、残留“费用提示”引导文字及 `feeNotice` 样式。
- 自审：实现只在本地超时回调触发时返回 `timeout`；外部 `AbortError` 回归为 `network`。未修改 120 秒时限、下旨路径、成功响应契约、FastAPI 或 ADR 0028 业务流。
- 实际使用的 skill：`brainstorming`、`systematic-debugging`、`test-driven-development`、`subagent-driven-development`、`verification-before-completion`、`requesting-code-review`、`codex-engineering-workflow`。
- 验证命令与结果：
  - `npm test -- src/lib/backendClient.test.ts src/app/api/decrees/chancellor/route.test.ts src/app/study/decreeStatus.test.ts src/app/study/studySubmission.test.ts src/features/study-visual/DevStudyWorkspace.test.ts`：PASS，115/115。
  - `npm run lint`：PASS。
  - `npm run typecheck`：PASS。
  - `GET http://127.0.0.1:8000/health` 与 `GET http://127.0.0.1:3000/health`：均为 HTTP 200；未请求下旨 POST，未调用真实模型。
  - `git diff --check`（本任务前端文件范围）：PASS。
- 未运行项与原因：未进行真实下旨，以避免真实模型调用与归档副作用；未运行全量 `npm test`，当前工作区存在大量用户未提交的无关改动，已运行全部改动相关测试、lint、typecheck 和健康链路。
- 剩余风险：模型处理若超过 120 秒仍会超时，但现在会被准确说明为处理超时；未调整该产品时限。最终审查提出“BFF 超时脱敏文案可增加精确断言”的 Minor 建议，当前行为已由固定映射实现且不阻塞验收。

## Acceptance Review

- 验收结果：Accepted
- 验收证据：独立架构复核、两轮任务级代码审查、最终全量改动审查及独立测试验收均已完成。最终验证显示 115 项相关测试、lint、typecheck 均通过，前后端 `/health` 均返回 HTTP 200；未触发真实下旨。
- 未通过项：无。
