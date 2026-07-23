# dev 全站视觉外壳迁移

## Status

Ready

## Product Definition

- 用户确认：2026-07-23，用户明确要求“所有页面的视觉外壳，保留当前已有业务”。
- 问题：当前工程仅保留少量页面和新的认证/BFF 契约，视觉上与 `dev` 的朝堂页面体系不一致。
- 目标用户：已登录的朝堂用户，以及访问登录前入口的访客。
- 目标：以 `dev` 为视觉唯一来源，迁移现有页面的视觉外壳，并为 `dev` 独有页面建立受保护的视觉入口；现有业务流程与后端契约继续由当前工程负责。
- 非目标：不复制 `dev` 的旧 API、客户端直连、模拟数据、蜂群状态机、附件/模式功能或任何未在当前工程定义的业务；不改变现有 `/study` 下旨、`/shiguan` 史馆、认证、会话和 BFF 行为。

## Acceptance Criteria

- [ ] `/`、`/enter`、`/login`、`/register`、`/invite` 与 `/invite/[code]` 的视觉外壳与 `dev` 对应入口一致，同时保持当前认证流程。
- [ ] `/study`、`/shiguan` 分别呈现 `dev` 上书房、史馆视觉外壳，且保留当前下旨与史馆业务。
- [ ] `dev` 的大殿、指挥中心、军机处、六部、专署/锦衣卫对应页面具有受保护的当前工程路由和 `dev` 视觉外壳；没有对应业务时明确展示“功能筹备中”，不伪造数据或操作。
- [ ] 所有受保护页面继续由服务端会话校验；浏览器不直连后端、不暴露后端地址或会话标识。
- [ ] 桌面与窄屏下共享 Header、背景、底部 Dock/页面滚动不遮挡主要内容。
- [ ] 每批页面完成后通过其测试、前端 lint/typecheck/test/build；全站最终通过 harness 检查。

## Delivery Constraints

- 范围：`frontend/src/app/**`、`frontend/src/components/**`、`frontend/src/features/**`、`frontend/public/**`、相应测试与本任务文件；具体允许路径由架构盘点后按页面批次锁定。
- 兼容性：必须保留现有 `/study`、`/shiguan`、认证/BFF、`requireUser` 和所有既有 API 契约；新增页面不能发起真实模型调用。
- 风险与限制：`dev` 的页面组件绑定旧业务和依赖，不能直接复制；资源和纯视觉组件可迁移，业务逻辑必须重新接入当前契约。
- 技能计划：`brainstorming`、`writing-plans`、`subagent-driven-development`、`test-driven-development`、`verification-before-completion`。
- Codex-only：是；禁止 Claude CLI、Claude runner 与 gstack-claude。

## Affected Modules

- 模块：登录前入口、共享朝堂壳、上书房、史馆、大殿与指挥中心、军机处、六部、专署与锦衣卫。
- 允许路径：待架构盘点后按批次登记；不得在多个写入 Agent 之间共享同一文件范围。
- 依赖模块：当前认证/BFF、`requireUser`、`backendClient`、现有下旨和史馆契约。

## Technical Plan

- 架构边界：先建立可复用的纯视觉组件和路由壳；页面只消费视觉组件与当前工程已有的服务端契约。`dev` 业务模块仅作视觉参考。
- 接口与依赖：不新增浏览器到 FastAPI 的调用；受保护路由使用现有会话校验。缺少业务能力的新页面只提供静态、明确的筹备状态。
- 实施顺序：
  1. 只读盘点并建立 `dev → 当前路由` 映射与资源清单。
  2. 迁移共享 Header、背景、Dashboard 页面壳和响应式规则。
  3. 完成已存在业务页面 `/study`、`/shiguan` 的视觉适配。
  4. 并行迁移互不重叠的新页面组：大殿/指挥中心/军机处、六部、专署/锦衣卫。
  5. 完成登录前入口的视觉回归、保护路由与全站视觉验收。
- 验证计划：每个模块先写视觉结构/契约测试，再做 lint、typecheck、test、build；最终运行 `node scripts/check_harness.mjs` 和 `git diff --check`。真实下旨不作为自动化验收步骤。
- 技术风险：共享壳容易造成路由间样式泄漏；必须使用 CSS Module 和局部组件，新增路由需避免与现有认证重定向冲突。

## Implementation Report

- 改动摘要：待实施。
- 自审：待实施。
- 验证：待实施。
- 实际使用的 skill：待实施。
- 验证命令与结果：待实施。
- 未运行项与原因：待实施。
- 剩余风险：待实施。

## Acceptance Review

- 验收结果：Pending
- 验收证据：待实施。
- 未通过项：待实施。
