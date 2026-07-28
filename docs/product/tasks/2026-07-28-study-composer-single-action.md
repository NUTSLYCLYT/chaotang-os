# Task: 上书房单一美化输入条

> This task follows `docs/decisions/0028-decree-evidence-flow-governance-baseline.md`.

## Status

Implemented

## Product Definition

- User confirmation: 2026-07-28, “把输入框美化，去掉密旨这个” and “确定”.
- Problem: the dock composer exposes a second, unnecessary 密旨 mode and has weak visual hierarchy.
- Target users: authenticated users issuing a decree in `/study`.
- Goal: provide one polished, clear, single-action decree composer.
- Non-goals: changing the POST contract, submission semantics, attachment behavior, or cost disclosure.

## Acceptance Criteria

- [x] No 密旨 mode, mode-switch UI, or mode-dependent copy remains in the composer.
- [x] The composer has a single prominent 下旨 action and a visually stronger input field.
- [x] Existing attachment, local polish, disabled, submit, and fee-notice behavior remain intact.
- [x] Responsive layout continues to fit the dock center slot.

## Delivery Constraints

- Scope: `frontend/src/features/study-visual/**`, related tests, and this task file.
- Compatibility: preserve the same-origin decree submission flow and existing protected route.
- Risks and limits: no new write path or automatic submission.
- Skill plan: brainstorming, writing-plans, test-driven-development, verification-before-completion.
- Codex-only: no.

## Affected Modules

- 模块：上书房下旨输入区。
- 允许路径：`frontend/src/features/study-visual/**`, related frontend tests, and this task file.
- Dependencies: `StudyClient` decree state and `CourtQuickDock` center slot.

## Technical Plan

- `docs/superpowers/plans/2026-07-28-study-composer-single-action.md`

## Implementation Report

- Removed mode state, secret-mode controls, and secret-dependent presentation branches.
- Kept the same decree submission callback, attachment, local polish, disabled state, and fee notice.
- Restyled the dock-center composer as a dark ink input with a gold primary submit action.
- Verification: focused tests passed; `npm run lint`, `npm run typecheck`, and `npm run build` passed. Full `npm test` has two unrelated Zhuanshu entry failures because `ZhuanshuEntryPage.tsx` is absent.

## Acceptance Review

- Result: Accepted with unrelated suite failures recorded.
- Evidence: the single-action regression test was observed failing before the implementation and passing afterwards; the scoped 14-test study/court suite passes.
- Failed items: None.
