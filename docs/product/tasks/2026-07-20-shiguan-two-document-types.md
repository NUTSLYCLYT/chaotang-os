# 任务：史馆收敛为奏折与回奏两种业务档案

## Status

Accepted

## Product Definition

- 用户确认：用户于 2026-07-20 确认产品方案，并以“使用自动交付实现你的这个方案”授权自动进入 Ready 和实现。
- 问题：现有史馆把公文、处理阶段和内容属性混成五类，并把旨意原文伪装为奏折，无法准确表达业务流。
- 目标用户：使用上书房和史馆查看旨意办理、奏折与回奏的本地用户。
- 目标：史馆全链路只保留 `MEMORIAL`（奏折）和 `REPLY`（回奏）；下旨只归档一条回奏；旧数据安全迁移。
- 非目标：不新增奏折提交页面或新业务 API；不做鉴权、公开部署、全文检索、备份或删除 UI。

## Acceptance Criteria

- [x] 后端模型、存储、API 与前端契约只接受 `MEMORIAL` 和 `REPLY`。
- [x] 下旨成功后只创建一条 `REPLY`，旨意原文保存在 `source_text`，不制造假奏折。
- [x] 回奏具备来源、参与部门、办理过程、结论、时间和责任主体；奏折不得携带回奏专属字段。
- [x] 显式确认的旧 `DECISION + 自动 MEMORIAL` 可原子迁移为单条 `REPLY`。
- [x] 含不支持类型或歧义关系的旧库迁移明确失败并回滚，不静默删除或误分类。
- [x] 召回、复盘、统计保持可用，召回摘要使用回奏结论。
- [x] `/shiguan` 只显示“全部 / 奏折 / 回奏”，回奏卡片展示新的结构化字段。
- [x] 后端、前端、harness 和浏览器验收均有新鲜通过证据；不触发真实模型调用。

## Delivery Constraints

- 范围：史馆领域模型、SQLite 迁移、自动归档、召回/API、前端 BFF/页面、相关测试与架构文档。
- 兼容性：保持既有端点路径、下旨成功 HTTP 契约、复盘/统计语义和本地单实例 SQLite 边界。
- 风险与限制：迁移必须 fail-closed；现有 `/study` 未提交修复需原样保留；不得提交、推送或部署。
- 技能计划：`product-flow`、`codex-engineering-workflow`、`brainstorming`、`writing-plans`、`record-decision`、`test-driven-development`、`verification-before-completion`、浏览器验收。
- Codex-only：是；禁止 Claude CLI、Claude runner 与 `gstack-claude`。

## Affected Modules

- 模块：史馆领域契约、持久化迁移、下旨自动归档、旧案召回、HTTP/BFF、史馆页面、架构约束。
- 允许路径：`backend/app/shiguan/**`、`backend/app/api/shiguan.py`、`backend/tests/test_shiguan_*.py`、`frontend/src/lib/backendClient.ts`、`frontend/src/lib/backendClient.test.ts`、`frontend/src/app/api/shiguan/**`、`frontend/src/app/shiguan/**`、`ARCHITECTURE.md`、`backend/AGENTS.md`、`frontend/AGENTS.md`、`scripts/check_harness.mjs`、`docs/decisions/0017-shiguan-memorial-reply-contract.md`、`docs/superpowers/specs/2026-07-20-shiguan-two-document-types-design.md`、`docs/superpowers/plans/2026-07-20-shiguan-two-document-types.md`、本任务文件。
- 依赖模块：既有丞相下旨成功后的非阻塞归档钩子；不修改丞相响应契约。

## Technical Plan

- 架构边界：Codex solution-architect 确认双文种契约 GO，但旧 v1 数据没有不可伪造的
  producer/provenance 标记；任何自动删除旧关联奏折的规则都只能是启发式，必须先由用户确认
  当前库中的具体旧记录是否均为下旨自动产物。
- 接口与依赖：以 `app.shiguan.models` 为事实源，前端严格镜像；API 路径不变。
- 实施顺序：架构复核 → 后端契约/迁移 → 下旨归档与召回/API → 前端契约/BFF/UI → 独立测试验收。
- 验证计划：每模块先记录 RED 再最小实现 GREEN；最终运行后端、前端、harness、静态检查与浏览器只读验收。
- 技术风险：旧 v1 记录没有可靠 provenance；迁移期间新增记录会改变确认集合。两次副本演练
  均在集合变化时按 fail-closed 中止，旧后端停止后数据库冻结为四对，四对均经用户逐次确认。
  最终迁移前保留 `backend/data/shiguan.sqlite3.pre-reply-migration-final-4pairs.bak`，通用迁移
  仍只接受显式 `confirmed_pairs`，不得据此推断其它记录。

## Implementation Report

- 改动摘要：后端模型、校验、SQLite schema/迁移、存储、下旨归档、召回与 API 全部收敛为
  `MEMORIAL | REPLY`；下旨只写单条回奏。前端 client、BFF、筛选和卡片同步双文种契约；新增
  ADR 0017、架构文档与 harness 基线。运行库四对旧记录已备份并原子迁移为四条 `REPLY`。
- 自审：迁移不使用标题/正文启发式；未确认、错配、共享、歧义或不支持类型均整体回滚。
  独立 test-engineer 首轮发现前端缺少来源关系形状校验和 ADR 数量过期，完成一次 TDD 有限
  返工后复核 GO。现有 `/study` 配置修复保持独立路径，未混入史馆模块。
- 验证：TDD 模块 RED 分别为后端领域 15 fail、后端集成 5 fail、前端契约 3 fail；有限返工
  新增两类关系测试为 2 fail，随后均 GREEN。运行库 `user_version=2`、仅 4 条完整 `REPLY`、
  0 关系、0 孤儿证据/复盘。
- 实际使用的 skill：`product-flow`（Codex-only 角色链）、`codex-engineering-workflow`、
  `brainstorming`、`writing-plans`、`record-decision`、`test-driven-development`、
  `systematic-debugging`、`verification-before-completion`、`control-in-app-browser`。
- 验证命令与结果：后端 Ruff 通过、pytest `494 passed`；前端 `83/83`、lint、typecheck、build
  通过；harness `54` 基线、`22` 自测、`3` Hook 自测、`25` runner 自测通过；
  `git diff --check` 通过。浏览器回奏筛选 4 条、奏折筛选 0 条，控制台无 warning/error。
- 未运行项与原因：真实下旨和 DeepSeek 调用不在验证范围。
- 剩余风险：本地 SQLite 的备份仍需人工保管；未用真实模型调用验证新归档钩子，行为由离线
  回归测试覆盖。Python 项目原 `.venv` 指向失效的 Python 3.14，本次验证使用 Codex 临时
  Python 3.12 环境，运行服务亦使用该环境。

## Acceptance Review

- 验收结果：Accepted — 2026-07-20；第 1 次独立验收 NO-GO 后完成一次有限返工，复核 GO。
- 验收证据：逐条核对八项标准；后端 494、前端 83、lint/typecheck/build、harness 54/22/3/25、
  schema v2/四条 REPLY、迁移回滚测试与浏览器筛选/卡片/控制台均有新鲜证据。
- 未通过项：无。
