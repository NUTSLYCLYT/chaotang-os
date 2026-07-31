# Qintian Decision Radar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the blank `/study` right drawer with a state-driven Qintian decision radar that never invents formal forecasts.

**Architecture:** A pure TypeScript projector converts decree text, draft state, and `DecreeUiState` into a strict view model. `StudySideDrawers` renders that model and keeps existing drawer accessibility behavior.

**Tech Stack:** Next.js 16, React 19, TypeScript 5.9, Node `node:test`, CSS Modules.

## Global Constraints

- ADR 0028 remains unchanged and is the only execution authority.
- No new network endpoint, persistence, external data, probability, or formal forecast.
- Existing left drawer and chancellor consultation remain unchanged.
- Production behavior must be preceded by a failing test.

---

### Task 1: Pure decision-radar projection

**Files:**
- Create: `frontend/src/app/study/qintianDecisionRadar.ts`
- Create: `frontend/src/app/study/qintianDecisionRadar.test.ts`

**Interfaces:**
- Consumes: `DecreeUiState`, `ChancellorDraftResult | null`, and current decree text.
- Produces: `projectQintianDecisionRadar(input): QintianDecisionRadarView`.

- [x] Write tests for `GUIDE`, `FRAMING`, `DRAFT_READY`, `IN_REVIEW`, `REPLY_READY`, and `BLOCKED`, including a guard against probability/forecast claims.
- [x] Run `node --test src/app/study/qintianDecisionRadar.test.ts` and verify the module-missing RED failure.
- [x] Implement the strict view model and deterministic projector.
- [x] Run the target test and verify PASS.

### Task 2: Render and wire the right drawer

**Files:**
- Modify: `frontend/src/features/study-visual/StudySideDrawers.tsx`
- Modify: `frontend/src/features/study-visual/StudySideDrawers.module.css`
- Modify: `frontend/src/features/study-visual/StudySideDrawers.test.ts`
- Modify: `frontend/src/features/study-visual/DevStudyWorkspace.tsx`
- Modify: `frontend/src/features/study-visual/DevStudyWorkspace.test.ts`

**Interfaces:**
- Consumes: `QintianDecisionRadarView`.
- Produces: accessible right drawer sections and opens them from the existing right trigger.

- [x] Add failing source and style assertions for the radar, provenance label, six decision sections, and removal of the unavailable placeholder.
- [x] Run both target test files and verify RED.
- [x] Pass the projected radar from `DevStudyWorkspace` to `StudySideDrawers` and render it.
- [x] Add responsive, scrollable radar styles without altering existing drawer width tiers.
- [x] Run both target test files and verify PASS.

### Task 3: Verification and delivery record

**Files:**
- Modify: `docs/product/tasks/2026-07-30-qintian-decision-radar.md`

**Interfaces:**
- Consumes: implementation and fresh command output.
- Produces: reproducible acceptance evidence.

- [x] Run `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build` in `frontend/`.
- [x] Run `node scripts/check_harness.mjs` and `git diff --check`.
- [x] Self-review the diff for fake forecasts, execution bypasses, and unrelated changes.
- [x] Record exact PASS/FAIL evidence and remaining limitations in the product task.
