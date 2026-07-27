# 任务：账号体系、登录保护与用户数据隔离

## Status

In Progress

## Product Definition

- 用户确认：2026-07-23；开放注册，使用“用户名或邮箱 + 密码”登录；`/study` 与 `/shiguan` 均须登录保护，并按用户隔离数据。用户选择后端保存可撤销会话、前端保存 HttpOnly Cookie 的方案。
- 问题：当前登录前页面仅展示 UI，后端没有账号、会话或用户归属模型；现有业务数据读取和写入无法从服务端强制按用户隔离。
- 目标用户：需要独立使用朝堂 OS 的注册用户。
- 目标：提供可注册、可登录、可退出的本地账号闭环；未登录用户不能使用受保护业务；后端以认证用户为唯一依据隔离奏折和史馆数据。
- 非目标：团队共享、管理员跨用户访问、密码找回、邮箱验证、第三方登录、生产部署与提交推送。

## Acceptance Criteria

- [ ] 用户可用唯一用户名和邮箱注册，并用用户名或邮箱加密码登录、退出。
- [ ] 未登录访问 `/study`、`/shiguan` 或其受保护数据接口时被拒绝或导向登录；登录后可正常使用。
- [ ] 浏览器只持有 HttpOnly、SameSite 会话 Cookie；密码不明文保存，前端不保存可用令牌。
- [ ] 后端对奏折、史馆档案、查询、统计、召回和复盘全部按当前认证用户强制过滤；用户不能通过 URL、参数或直接请求访问其他用户数据。
- [ ] 已有无归属本地数据不向任何登录账号展示。
- [ ] 前后端单元、接口及端到端受保护流程验证通过；既有健康检查和公开欢迎页保持可访问。

## Delivery Constraints

- 范围：账号、会话、认证边界、前端代理、`/study`、`/shiguan` 及其现有 BFF/后端接口。
- 兼容性：保留 Next.js、FastAPI、SQLite、既有公开欢迎页与 `/health` 契约；不向浏览器暴露后端地址或密码哈希。
- 风险与限制：此变更首次引入真实身份凭证和数据权限，需要新增 ADR、迁移策略、密钥配置说明、负向授权测试和端到端验证。
- 技能计划：`brainstorming`、`writing-plans`、`test-driven-development`、`verification-before-completion`。
- Codex-only：是；禁止 Claude CLI、Claude runner 和 `gstack-claude`。

## Affected Modules

- 模块：账户与可撤销会话、前端认证代理、受保护业务路由、史馆与奏折的用户归属。
- 允许路径：`backend/app/auth/**`、`backend/app/api/auth.py`、`backend/app/api/decrees.py`、`backend/app/api/shiguan.py`、`backend/app/main.py`、`backend/app/shiguan/**`、`backend/tests/**`、`frontend/src/app/api/**`、`frontend/src/app/login/**`、`frontend/src/app/register/**`、`frontend/src/app/study/**`、`frontend/src/app/shiguan/**`、`frontend/src/features/pre-auth/**`、`frontend/src/lib/**`、`frontend/proxy.ts`、对应测试、`ARCHITECTURE.md`、`frontend/AGENTS.md`、`backend/AGENTS.md`、`docs/decisions/0027-authenticated-user-isolation.md`、本任务、规格与实施计划。
- 依赖模块：现有 Next.js App Router、FastAPI、SQLite、`backendClient.ts`、史馆存储和丞相接口。

## Technical Plan

- 架构边界：FastAPI 是账户、会话与 owner 过滤的唯一权威；Next.js 只通过同源 BFF 保管 HttpOnly 会话 Cookie 并代理认证后的请求。
- 接口与依赖：新增注册、登录、退出和当前用户端点；现有丞相与史馆端点一律从服务端认证上下文取得 owner，不接收客户端 owner。
- 实施顺序：先完成后端密码/会话和认证契约，再完成领域 owner 过滤，再接入 BFF 和页面保护，最后双账号端到端验证。
- 验证计划：密码/会话/认证依赖单测、后端跨用户负向接口测试、前端 BFF 与路由保护测试、两账号端到端烟雾测试，以及现有前后端完整检查。
- 技术风险：这是首次引入真实凭证和授权边界；数据库迁移必须保留旧无归属数据且默认不可见，密钥和 Cookie 配置不得提交。

## Implementation Report

- 改动摘要：已新增 ADR 0027，补充 FastAPI 为身份/owner 权威、同源 BFF Cookie、会话废止、旧无 owner 数据不可见和客户端不可指定 owner 的约束；同步更新架构和前后端运行说明。后端新增源码级路由断言，守护 `/health` 保持公开且上书/史馆端点使用 `CurrentUser`/`require_current_user`。
- 详细验证、告警和未完成的双账号端到端证据见 `.superpowers/sdd/task-6-report.md`。

## Acceptance Review

- 验收结果：部分通过；文档、路由断言与完整测试已通过，双账号生产模式 BFF 端到端证据尚未形成。
- 验收证据：`ruff` 通过；后端 496 项通过；前端 lint/typecheck/test（104 项）/build 通过；Harness 与 `git diff --check` 通过。
- 未通过项：本地 fake-graph + 生产模式 BFF 中的 `POST /api/decrees/chancellor` 返回非 200，因此尚未重跑完 A/B 隔离、跨账号 404 和登出后拒绝链路。未调用真实模型或外部服务。
