# Task: 上书房输入条极简样式

> This task follows `docs/decisions/0028-decree-evidence-flow-governance-baseline.md`.

## Status

Implemented

## Product Definition

- User confirmation: 2026-07-28, “样式太复杂了最好只保留1px的金线就行，也不要过渡色” and “上传附件的这个改成中文，不要做图标”, followed by “确定”.
- Problem: the dock composer currently uses gradients, glows, and icon-only attachment affordance that add unnecessary visual noise.
- Target users: authenticated users issuing a decree in `/study`.
- Goal: deliver a restrained, text-forward composer with a single 1px gold border and a Chinese attachment label.
- Non-goals: changing submission, attachment selection, polish, fee notice, layout placement, or API behavior.

## Acceptance Criteria

- [x] The composer uses a solid dark background and a single 1px gold border, with no gradient, glow, blur, or transition effect in its own controls.
- [x] The submit control is text-forward and does not use a gradient or filled gold background.
- [x] The attachment control visibly reads “上传附件” and keeps its existing local file-selection behavior.
- [x] Existing composer tests and the dock-center placement remain intact.

## Delivery Constraints

- Scope: `frontend/src/features/study-visual/**`, related tests, and this task file.
- Compatibility: preserve the same-origin decree submission flow and local attachment behavior.
- Risks and limits: CSS-only appearance change plus attachment label; no new route, request, or automatic submission.
- Skill plan: brainstorming, writing-plans, test-driven-development, verification-before-completion.
- Codex-only: no.

## Affected Modules

- 模块：上书房下旨输入区视觉控件。
- 允许路径：`frontend/src/features/study-visual/**`, related frontend tests, and this task file.
- Dependencies: `CourtQuickDock` center slot.

## Technical Plan

- `docs/superpowers/plans/2026-07-28-study-composer-minimal-style.md`

## Implementation Report

- Replaced both visible attachment glyphs with the Chinese label “上传附件” while retaining their nested file inputs and `handleFiles` callback.
- Simplified the composer and submit control to solid backgrounds, 1px gold borders, and no composer-specific gradients, glow, blur, or hover motion.
- Added a source-contract regression test for the text attachment label and minimal composer rule.
- Verification: focused study test passed; lint passed; production build passed. Typecheck is blocked by unrelated missing `src/app/api/junjichu/cases/route.ts` imported by its test, and the combined court suite has one unrelated assertion that expects an older `CourtQuickDock` call shape.

## Acceptance Review

- Result: Accepted with unrelated repository failures recorded.
- Evidence: the new regression test failed before the label/style changes and passed after them; scoped diff check passed.
- Failed items: None.
