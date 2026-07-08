# Tasks: chore-harness-migration-20260708

## Task 1 — Add Harness Core

- Objective: Create the `.harness/` operating system.
- Input: `harness-engineering` reference structure and current `chaotang-web-lyt`.
- Output: agents, rules, skills, wiki, templates, MCP index.
- Acceptance: required files exist and `harness-doctor` passes.
- Dependencies: none.

## Task 2 — Connect Scripts

- Objective: Add programmable Harness entry points.
- Input: existing `package.json` and scripts directory.
- Output: `scripts/harness-doctor.mjs`, `scripts/new-change.mjs`, package scripts.
- Acceptance: doctor passes and new-change creates a rendered change folder.
- Dependencies: Task 1.

## Task 3 — Update Entry Docs

- Objective: Make current docs route agents into the new Harness structure.
- Input: root `AGENTS.md`, frontend `AGENTS.md`, frontend `README.md`.
- Output: Harness entry sections and preserved historical rules.
- Acceptance: docs point to `.harness/agents/frontend-owner.md` and `.harness/rules/*`.
- Dependencies: Task 1.

## Task 4 — Add Human Harness Guides

- Objective: Make daily Harness usage and authoring responsibilities discoverable from `docs/`.
- Input: reference scaffold docs and current Chaotang constraints.
- Output: `docs/HARNESS-USAGE-GUIDE.md`, `docs/AUTHORING-GUIDE.md`, `CLAUDE.md` Harness bootstrap.
- Acceptance: `harness-doctor` checks entrypoint references.
- Dependencies: Task 1.
