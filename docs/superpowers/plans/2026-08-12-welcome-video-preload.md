# Welcome Video Preload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preload the welcome video on entry and provide a bounded, always-clickable transition to `/login`.

**Architecture:** Extend the pure welcome transition model to represent readiness and a single pending attend action. Keep DOM/media effects in `WelcomeGate`, with one four-second fallback timer and all terminal paths converging on `/login`.

**Tech Stack:** React 19, Next.js 16, TypeScript, Node test runner, Caddy.

## Global Constraints

- Do not modify ADR 0028, authentication, backend APIs, or business flows.
- Do not add dependencies or expose secrets.
- Preserve both direct login links and the existing visual composition.
- Do not commit or push without separate authorization.
- Run the complete final acceptance workflow 10 consecutive times on the unchanged final version.

---

### Task 1: Test and implement the bounded preload state model

**Files:**
- Modify: `frontend/src/features/welcome/welcomeTransition.test.ts`
- Modify: `frontend/src/features/welcome/welcomeTransition.ts`

**Interfaces:**
- Produces: a pure reducer describing `closed`, `waiting`, and `opening` behavior plus readiness and duplicate-click rules.

- [ ] Write tests for readiness-before-click, click-before-readiness, timeout, failure, completion, reduced motion, and duplicate click.
- [ ] Run the focused test and confirm it fails because the new events/state are absent.
- [ ] Implement the minimum pure transition behavior.
- [ ] Run the focused test and confirm it passes.

### Task 2: Mount and preload video on initial render

**Files:**
- Modify: `frontend/src/features/welcome/welcomeContent.test.ts`
- Modify: `frontend/src/features/welcome/WelcomeGate.tsx`
- Modify: `frontend/src/features/welcome/welcome.module.css`

**Interfaces:**
- Consumes: the Task 1 reducer.
- Produces: initial `preload="auto"`, hidden paused video, clickable wait state, four-second fallback, and terminal `/login` navigation.

- [ ] Add source-contract assertions for unconditional video mounting, preload, wait copy, timer cleanup, and enabled action.
- [ ] Run the focused test and confirm it fails for the missing behavior.
- [ ] Implement the React/media effects and minimal visibility styles.
- [ ] Run welcome tests and confirm they pass.

### Task 3: Cache welcome assets safely

**Files:**
- Modify: `deploy/Caddyfile`
- Modify: `scripts/check_deployment.mjs`
- Test: `scripts/check_deployment.test.mjs`

**Interfaces:**
- Produces: explicit cache handling for welcome assets without caching HTML or APIs.

- [ ] Add a deployment contract test for the scoped cache matcher.
- [ ] Run it and confirm RED.
- [ ] Add the minimum Caddy header rule and deployment check.
- [ ] Run deployment tests and confirm GREEN.

### Task 4: Record and verify the production-visible failure

**Files:**
- Create: `docs/failures/2026-08-12-welcome-media-stall.md`

- [ ] Record summary, root cause, prevention, detection, and evidence.
- [ ] Run frontend lint, typecheck, test, build, deployment tests, harness checks, and `git diff --check`.
- [ ] Repeat the unchanged full workflow until 10 consecutive rounds pass.
- [ ] Inspect the scoped diff and verify unrelated dirty files are preserved.
- [ ] Before deployment, capture current remote release, images, health, and rollback target.
- [ ] Build and deploy only the changed frontend/Caddy release, then verify interaction contracts, cache headers, health, and public HTTPS.

