# Task: 上书房底部输入区置中

> This task follows `docs/decisions/0028-decree-evidence-flow-governance-baseline.md`.

## Status

Implemented

## Product Definition

- User confirmation: 2026-07-28, current conversation: “输入框放到底部……左边问丞相，右边问钦天监……放他俩中间” and “确认”.
- Problem: the decree composer is rendered in the study scene instead of the center of the existing bottom adviser dock.
- Target users: authenticated users drafting and submitting decrees in `/study`.
- Goal: render the existing decree composer in the bottom dock’s center slot, between 问丞相 and 问钦天监.
- Non-goals: changing the decree API, submission behavior, adviser links, attachments, local polish toggle, or the business flow.

## Acceptance Criteria

- [ ] Desktop `/study` places the composer in the center column of the bottom dock, with 问丞相 at left and 问钦天监 at right.
- [ ] The existing text, mode, attachment, polish, submit and fee-notice controls retain their behavior and accessibility hooks.
- [ ] Narrow screens retain an operable, non-overlapping bottom dock composition.
- [ ] Tests and frontend validation cover the changed component composition and responsive CSS.

## Delivery Constraints

- Scope: `frontend/src/features/study-visual/**`, `frontend/src/features/court-visuals/**`, related frontend tests, and this task file.
- Compatibility: same-origin decree submission and current UI state contract remain unchanged.
- Risks and limits: the dock center must fit without obscuring either adviser entry.
- Skill plan: brainstorming, writing-plans, test-driven-development, verification-before-completion, codex-engineering-workflow.
- Codex-only: no.

## Affected Modules

- 模块：上书房下旨输入区 and shared court quick dock.
- 允许路径：`frontend/src/features/study-visual/**`, `frontend/src/features/court-visuals/**`, related frontend tests, and this task file.
- Dependencies: `ImmersiveCourtShell`, `CourtQuickDock`, `StudyClient` state/submit contract.

## Technical Plan

- TDD contract for the center slot, composer extraction, dock handoff, and frontend verification.

## Implementation Report

- Change summary: the study composer is passed to `ImmersiveCourtShell.quickDockCenter`, which places it between the two adviser entries in the existing `CourtQuickDock` three-column layout.
- Verification: focused test first failed because the composer was not passed to the dock, then passed after the change; `npm run lint`, `npm run typecheck`, `npm test` (268 passing), and `npm run build` passed.
- Skills used: brainstorming, writing-plans, executing-plans, test-driven-development, verification-before-completion, codex-engineering-workflow.
- Not run or blocked: repository harness is blocked by unrelated malformed existing product tasks; repository-wide `git diff --check` is blocked by an existing trailing blank line in `.superpowers/sdd/task-1-brief.md`.
- Remaining risk: visual browser inspection was not run; the existing quick-dock responsive layout is covered by source-level tests.

## Acceptance Review

- Result: Pending
- Evidence: Pending implementation.
- Failed items: None.
