---
name: coding-skill
description: Implement scoped frontend changes while respecting Chaotang structure and evidence boundaries.
---

# Coding Skill

## Before Editing

- Read the active `spec.md` and `tasks.md`.
- Read relevant rules in `.harness/rules`.
- Search existing code with `rg` before creating new modules.
- Identify the smallest safe verification command.

## Implementation Rules

- Keep changes within scope.
- Prefer existing patterns in `src/app`, `src/features`, `src/core`, and `src/lib`.
- Do not duplicate backend swarm logic in frontend code.
- Preserve LIVE/MIXED/DEMO labels.
- Keep route handlers thin and explicit about trust boundaries.

## Layer Specs

- `specs/01-app-route-spec.md` — Next.js pages, layouts, route handlers.
- `specs/02-feature-spec.md` — feature slices and user-facing workflows.
- `specs/03-core-domain-spec.md` — CourtOS/domain engines and tests.
- `specs/04-lib-shared-spec.md` — shared utilities, adapters, contracts.
- `specs/05-styling-visual-spec.md` — visual trust, CSS, screenshots.

## Report

Write `coding/coding_report_v1.md` with:

- Files changed.
- Key decisions.
- Boundaries respected.
- Verification run or deferred.
- Follow-ups not included.
