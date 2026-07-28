# Task: 上书房输入条复用底栏边线

> This task follows `docs/decisions/0028-decree-evidence-flow-governance-baseline.md`.

## Status

Implemented

## Product Definition

- User confirmation: 2026-07-28, confirm the composer outer border should exactly match the bottom quick dock border.
- Problem: composer outer border and quick dock top border use different color values.
- Goal: composer outer border uses `rgba(240, 198, 106, 0.28)`, matching `CourtQuickDock`.
- Non-goals: changing internal dark-gold controls, behavior, layout, or APIs.

## Acceptance Criteria

- [x] Composer outer border exactly equals the bottom quick dock top-border declaration.
- [x] Internal composer controls remain dark gold.

## Delivery Constraints

- Scope: study composer CSS, related test, and this task file.
- Compatibility: styling only; all existing interactions remain unchanged.
- Skill plan: brainstorming, writing-plans, test-driven-development, verification-before-completion.
- Codex-only: no.

## Affected Modules

- 模块：上书房下旨输入区边线。
- 允许路径：`frontend/src/features/study-visual/DevStudyWorkspace.module.css`, `frontend/src/features/study-visual/DevStudyWorkspace.test.ts`, and this task file.
- Dependencies: `CourtQuickDock` border token as read-only reference.

## Technical Plan

- `docs/superpowers/plans/2026-07-28-study-composer-dock-border-match.md`

## Implementation Report

- Composer outer border now exactly uses `1px solid rgba(240, 198, 106, 0.28)` from `CourtQuickDock`.
- Internal controls retain dark gold `#a77c35`.
- Focused study test and lint passed; scoped diff check passed.

## Acceptance Review

- Result: Accepted.
- Evidence: border assertion failed before the CSS change and passed afterwards.
- Failed items: None.
