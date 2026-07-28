# Task: 上书房输入条暗金色统一

> This task follows `docs/decisions/0028-decree-evidence-flow-governance-baseline.md`.

## Status

Implemented

## Product Definition

- User confirmation: 2026-07-28, “颜色都变成暗金色，不要用亮金色”, followed by confirmation of the composer-only scope.
- Problem: the composer still contains bright-gold accents that conflict with the requested restrained visual treatment.
- Target users: authenticated users issuing a decree in `/study`.
- Goal: use one low-saturation antique-gold accent `#a77c35` across composer borders, text controls, focus, and notices.
- Non-goals: changing the rest of the study page, submission flow, attachment selection, or layout.

## Acceptance Criteria

- [x] All composer-specific gold accents use `#a77c35` or its transparent equivalent.
- [x] No bright-gold `#f0c66a` remains in composer-specific selectors.
- [x] The dark solid background and minimal 1px border treatment remain intact.

## Delivery Constraints

- Scope: `frontend/src/features/study-visual/DevStudyWorkspace.module.css`, related tests, and this task file.
- Compatibility: preserve all existing composer interaction and layout behavior.
- Risks and limits: styling only; no new UI state, route, or API behavior.
- Skill plan: brainstorming, writing-plans, test-driven-development, verification-before-completion.
- Codex-only: no.

## Affected Modules

- 模块：上书房下旨输入区色彩系统。
- 允许路径：`frontend/src/features/study-visual/DevStudyWorkspace.module.css`, `frontend/src/features/study-visual/DevStudyWorkspace.test.ts`, and this task file.
- Dependencies: 无。

## Technical Plan

- `docs/superpowers/plans/2026-07-28-study-composer-antique-gold.md`

## Implementation Report

- Replaced composer-specific opaque and transparent bright-gold accents with `#a77c35` / `rgba(167,124,53,alpha)`.
- Kept the minimal solid-background, 1px-border treatment and all component behavior unchanged.
- Added a regression assertion that the composer and submit control use dark gold.
- Verification: focused study test, lint, and production build passed.

## Acceptance Review

- Result: Accepted.
- Evidence: the dark-gold assertion failed before the CSS update and passed after it.
- Failed items: None.
