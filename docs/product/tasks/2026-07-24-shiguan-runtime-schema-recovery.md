# 任务：史馆运行库 schema 恢复

## Status

Implemented

## Product Definition

- 用户确认：用户于 2026-07-24 确认采用“显式预检、备份、迁移和读回验证”的修复方案。
- 问题：代码要求史馆 SQLite schema v3，但本地运行库仍为 v2；隔离测试通过而真实史馆请求失败。
- 目标用户：使用本地史馆查询、旧案召回或回奏归档的开发者。
- 目标：提供不自动改写业务数据的运行库预检和 v2→v3 显式迁移入口，并恢复当前运行库。
- 非目标：不新增 HTTP API、不自动启动迁移、不修改档案正文、不接入外部网络或凭据。

## Acceptance Criteria

- [x] `--check` 以只读 SQLite 连接报告版本、完整性、必需表和就绪状态，且不输出档案或证据正文。
- [x] `--migrate-v2-to-v3` 仅迁移健康 v2 库，先创建不可覆盖备份，再复用事务性迁移并真实读回。
- [x] 普通史馆请求继续对非 v3 库 fail-closed。
- [x] 当前 `backend/data/shiguan.sqlite3` 已备份、迁移至 v3，并可由 HTTP 查询读取。

## Delivery Constraints

- 范围：`backend/app/shiguan/maintenance.py`、史馆迁移测试、任务/设计/计划记录。
- 兼容性：保留 `db.migrate_v2_to_v3()`、`storage.list_archives()` 和现有 HTTP 契约。
- 风险与限制：备份位于 `backend/data/shiguan.sqlite3.v2-backup`，该本地运行态文件不提交 Git；迁移仅处理已验证的 v2 库。
- 技能计划：`using-superpowers`、`systematic-debugging`、`brainstorming`、`writing-plans`、`executing-plans`、`using-git-worktrees`、`test-driven-development`、`verification-before-completion`。
- Codex-only：是；未使用 Claude CLI、Claude runner 或 gstack-claude。

## Affected Modules

- 模块：史馆 SQLite 运行库维护、迁移回归测试和本地运维验证。
- 允许路径：`backend/app/shiguan/maintenance.py`、`backend/tests/test_shiguan_migrations.py`、`docs/product/tasks/`、`docs/superpowers/specs/`、`docs/superpowers/plans/`。
- 依赖模块：`app.shiguan.db`、`app.shiguan.storage`、Python 标准库 sqlite3。

## Technical Plan

- 架构边界：维护模块只提供显式本地命令；请求和服务启动不触发迁移。
- 接口与依赖：`inspect_runtime_database(path)` 只读预检；`migrate_runtime_v2_to_v3(path)` 先备份、再迁移、最后通过真实存储读取验证。
- 实施顺序：测试 RED → 维护模块 → 聚焦 GREEN → 后端离线回归 → 运行库预检/迁移/HTTP 读回。
- 验证计划：聚焦 pytest、后端 Ruff/全量 pytest、harness 和本地只读 HTTP 查询。
- 技术风险：SQLite 运行库被 Git 忽略，后续 schema 变更仍须在交付中执行真实运行库预检和显式迁移。

## Implementation Report

- 改动摘要：新增 `python -m app.shiguan.maintenance --check` 和 `--migrate-v2-to-v3`；迁移会创建 `.v2-backup`、拒绝覆盖已有备份，并在 v3 预检后调用 `storage.list_archives()` 读回。
- 自审：迁移未接入 HTTP 或启动路径；预检只读，输出仅含路径、版本、布尔状态、备份路径和档案计数。
- 验证：聚焦迁移测试 4 项通过；后端 Ruff 通过、全量 pytest 为 `1681 passed, 1 warning`；四项 harness 自检和 `git diff --check` 通过；运行库从健康 v2 迁移为 v3，读回 4 条；本地 `GET /api/v1/shiguan/archives` 返回 HTTP 200。
- 实际使用的 skill：`using-superpowers`、`systematic-debugging`、`brainstorming`、`writing-plans`、`executing-plans`、`using-git-worktrees`、`test-driven-development`。
- 未运行项与原因：无。
- 剩余风险：SQLite 备份和运行库仅保留在本机，不能由 CI 代替实际预检证据。

## Acceptance Review

- 验收结果：通过。
- 验收证据：后端 Ruff、全量 pytest、四项 harness 自检、`git diff --check`、真实运行库 v2→v3 迁移与本地 HTTP 读回均已执行。
- 未通过项：无。
