# Coding Report v1: chore-harness-migration-20260708

## Files Changed

- Added `.harness/agents/frontend-owner.md`.
- Added `.harness/rules/product-boundaries.md`, `project-structure.md`, `coding-standard.md`, `dev-workflow.md`.
- Added `.harness/wiki/architecture.md`, `domain-model.md`, `api-contracts.md`, `document-index.md`, `release-operations.md`.
- Added nine `.harness/skills/*/SKILL.md` files.
- Added five `.harness/skills/coding-skill/specs/*.md` layer specs adapted from the reference scaffold.
- Added `.harness/templates/change-template/**`.
- Added `scripts/harness-doctor.mjs`, `scripts/new-change.mjs`, and cross-platform `scripts/install-git-hooks.mjs`.
- Added `docs/HARNESS-USAGE-GUIDE.md` and `docs/AUTHORING-GUIDE.md`.
- Updated `package.json`, root `AGENTS.md`, frontend `AGENTS.md`, frontend `CLAUDE.md`, and `README.md`.

## Key Decisions

- Kept the existing `harness/` directory intact because it stores domain evaluation assets, not the agent operating system.
- Created `.harness/` for the new agent-facing architecture, matching the reference project's convention.
- Preserved historical `AGENTS.md` content and added a new Harness map at the top.
- Fixed the existing `prepare` entry by adding the missing Node hook installer, because pnpm script execution was blocked by a missing `scripts/install-git-hooks.mjs`.
- Extended `harness-doctor` to validate human/agent entrypoint documents, not only the `.harness` tree.
- Extended `harness-doctor` to validate the coding layer spec files.
- Extended `harness-doctor` to fail a delivered change that still contains unresolved template markers.

## Verification

- `node scripts/new-change.mjs chore harness-migration` succeeded and created this directory.
- `node scripts/harness-doctor.mjs` passed.
- `pnpm harness:doctor` passed after restoring the `prepare` entry.
