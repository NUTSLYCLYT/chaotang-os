# Spec: chore-harness-migration-20260708

## Background

The user asked to modify the frontend project and current documents to follow the `harness-engineering` project architecture. The target frontend project is `chaotang-web-lyt`.

## Scope

- Add `.harness/` with agents, rules, skills, wiki, changes, templates, and MCP index.
- Preserve existing production rules and historical lessons in `AGENTS.md`.
- Add `harness:doctor` and `harness:new-change` scripts.
- Update root workspace `AGENTS.md`, frontend `AGENTS.md`, and frontend `README.md` to point to the Harness entry.
- Update `CLAUDE.md` and add durable docs for Harness usage and authoring.

## Non-goals

- No business-code refactor.
- No route, UI, auth, or backend behavior changes.
- No deletion of existing `harness/` domain evaluation assets.
- No replacement of existing historical `AGENTS.md` rules.

## Acceptance Criteria

- `.harness/agents/frontend-owner.md` exists and maps the owner workflow.
- `.harness/rules/*.md` define product boundaries, structure, coding standard, and workflow.
- `.harness/skills/*/SKILL.md` files have frontmatter.
- `coding-skill` includes layer specs adapted to `src/app`, `src/features`, `src/core`, `src/lib/shared`, and styling.
- `.harness/wiki/*.md` provides architecture, domain, API, docs, and release facts.
- `CLAUDE.md`, `README.md`, `AGENTS.md`, and Harness docs point to the new `.harness` entry.
- New change templates can create a usable audit directory.
- `node scripts/harness-doctor.mjs` passes.

## Risks

- The current codebase is much larger than the reference scaffold, so the structure rule must adapt to existing `src/app`, `src/features`, `src/core`, and `src/lib` instead of forcing a destructive migration.
- Existing `AGENTS.md` is long but contains high-value production rules; replacing it would lose safety context.

## Verification Plan

- Run `node scripts/harness-doctor.mjs`.
- Run `node scripts/new-change.mjs chore harness-migration` and verify rendered templates.
