# Task: 六部总览全屏展示

> This task follows `docs/decisions/0028-decree-evidence-flow-governance-baseline.md`.

## Status

Implemented

## Product Definition

- User confirmation: 2026-07-28, current conversation: “仅 /liubu 总览页去掉居中的部门弹窗” and “确定”.
- Problem: selecting a department on `/liubu` overlays the scene with a centered department rail, preventing an uninterrupted full-screen overview.
- Target users: authenticated users browsing the six-ministry overview.
- Goal: keep the `/liubu` overview canvas fully visible at all times and remove the selection-triggered department-detail overlay.
- Non-goals: changing department and office routes, data fetching, reply metrics, department/office pages, or business APIs.

## Acceptance Criteria

- [x] `/liubu` has no selection-triggered department rail, dialog, or other centered overlay.
- [x] The overview canvas fills the full content area between the persistent top navigation and bottom quick dock, while department cards remain usable links.
- [x] Existing reply metrics and loading, empty, and error states remain available.
- [x] Focused frontend tests and relevant validation pass.

## Delivery Constraints

- Scope: `frontend/src/features/ministries-visual/**`, related frontend tests, and this task file.
- Compatibility: preserve the current read-only archive data contract and all `/liubu/[code]` and `/liubu/[code]/[office]` routes.
- Risks and limits: do not reinstate legacy `dev` data or bypass ADR 0028.
- Skill plan: brainstorming, writing-plans, test-driven-development, verification-before-completion, codex-engineering-workflow.
- Codex-only: no.

## Affected Modules

- 模块：六部总览交互与视觉展示。
- 允许路径：`frontend/src/features/ministries-visual/**`、相关前端测试，以及本任务文件。
- 依赖模块：`ImmersiveCourtShell`、六部目录与只读回奏投影。

## Technical Plan

- See `docs/superpowers/plans/2026-07-28-liubu-fullscreen-overview.md`.

## Implementation Report

- Added an opt-in `fullBleedContent` shell mode and used it only for the `/liubu` overview.
- The overview canvas now fills the middle grid cell between the persistent header and quick dock; its heading and read states overlay the canvas instead of consuming layout height.
- Added focused regression coverage for the shell mode and uncapped canvas viewport.
- Verification: lint, typecheck, and 266 frontend tests passed. `next build` was blocked by the already-running `next dev` process in this shared workspace; no process was stopped.

## Acceptance Review

- Result: Pending production-build rerun after the shared development server releases the Next build lock.
- Evidence: focused full-screen tests and full lint/typecheck/test run.
- Failed items: None in this task; production build remains unverified in the current shared runtime.
