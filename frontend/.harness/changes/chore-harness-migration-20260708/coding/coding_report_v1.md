# Coding Report v1: chore-harness-migration-20260708

## Files Changed

- Added `.harness/agents/frontend-owner.md`.
- Added `.harness/rules/product-boundaries.md`, `project-structure.md`, `coding-standard.md`, `dev-workflow.md`.
- Added `.harness/wiki/architecture.md`, `domain-model.md`, `api-contracts.md`, `document-index.md`, `release-operations.md`.
- Added nine `.harness/skills/*/SKILL.md` files.
- 新增五个 `.harness/skills/coding-skill/specs/*.md` 分层规格。
- Added `.harness/templates/change-template/**`.
- Added `scripts/harness-doctor.mjs`, `scripts/new-change.mjs`, and cross-platform `scripts/install-git-hooks.mjs`.
- Added `docs/HARNESS-USAGE-GUIDE.md` and `docs/AUTHORING-GUIDE.md`.
- Updated `package.json`, root `AGENTS.md`, frontend `AGENTS.md`, frontend `CLAUDE.md`, and `README.md`.

## Key Decisions

- 保持现有 `harness/` 目录职责清楚：它存放前端领域评测资产，不是 agent 工作系统。
- 创建 `.harness/` 作为当前 agent 面向的工程工作系统。
- `AGENTS.md` 已改为当前三层 harness 架构入口。
- 通过补齐 Node hook installer 修复 `prepare` 入口，避免 pnpm script 因缺失 `scripts/install-git-hooks.mjs` 阻塞。
- 扩展 `harness-doctor`，验证人类/agent 入口文档，而不只验证 `.harness` 树。
- 扩展 `harness-doctor`，验证 coding layer spec 文件。
- Extended `harness-doctor` to fail a delivered change that still contains unresolved template markers.

## Verification

- `node scripts/new-change.mjs chore harness-migration` succeeded and created this directory.
- `node scripts/harness-doctor.mjs` passed.
- `pnpm harness:doctor` 通过。

