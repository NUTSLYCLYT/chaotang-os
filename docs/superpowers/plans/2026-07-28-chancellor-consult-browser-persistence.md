# Chancellor Consult Browser Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve successful chancellor consultation history across refreshes in the current browser while isolating records by authenticated account.

**Architecture:** The protected Study server page passes only the authenticated public user ID into `StudyClient`. A focused pure persistence module owns the versioned, user-scoped localStorage key, strict decoding, 20-message cap, and failure-safe reads/writes; React restores after mount and writes only after a successful completed turn.

**Tech Stack:** Next.js App Router, React, TypeScript, browser localStorage, Node `node:test`.

## Global Constraints

- Storage key is `chaotang:consult:v1:<encoded userId>`.
- Persist messages only; never persist session IDs, pending state, or errors.
- Accept only complete alternating user/assistant pairs, with at most 20 messages.
- Storage and JSON failures must fall back safely without breaking `/study`.
- Consultation remains separate from decrees, archives, ministries, Grand Council, and evidence flows.

---

### Task 1: Account-scoped persistence boundary

**Files:**
- Create: `frontend/src/app/study/chancellorConsultPersistence.ts`
- Create: `frontend/src/app/study/chancellorConsultPersistence.test.ts`

**Interfaces:**
- Produces: `chancellorConsultStorageKey(userId)`, `loadChancellorConsultMessages(userId, storage)`, and `saveChancellorConsultMessages(userId, messages, storage)`.

- [ ] Write tests for account-specific keys, strict decoding, 20-message trimming, and storage exceptions.
- [ ] Run `node --test src/app/study/chancellorConsultPersistence.test.ts` and confirm failure because the module does not exist.
- [ ] Implement the minimal versioned persistence boundary.
- [ ] Re-run the focused test and confirm PASS.

### Task 2: Restore and save completed conversations

**Files:**
- Modify: `frontend/src/app/study/page.tsx`
- Modify: `frontend/src/app/study/StudyClient.tsx`
- Modify: `frontend/src/app/study/StudyClient.test.ts`

**Interfaces:**
- Consumes: authenticated `PublicUser.id` and Task 1 persistence functions.
- Produces: account-scoped refresh restoration and successful-turn persistence.

- [ ] Add source contract tests proving `user.id` crosses the server/client boundary and localStorage is used only through the persistence module.
- [ ] Run the focused StudyClient test and confirm RED.
- [ ] Pass `userId` into `StudyClient`, restore it after mount, and save only successful completed messages.
- [ ] Re-run focused tests and confirm PASS.

### Task 3: Governance and failure memory

**Files:**
- Create: `docs/decisions/0031-account-scoped-consult-browser-persistence.md`
- Create: `docs/failures/2026-07-28-consult-history-lost-on-refresh.md`
- Modify: `docs/decisions/0030-chancellor-consult-chat-contract.md`
- Modify: `frontend/AGENTS.md`

**Interfaces:**
- Produces: an explicit replacement for the former refresh-clears-history constraint.

- [ ] Record the account-scoped browser-only persistence decision and its privacy limitations.
- [ ] Record root cause, prevention, detection, and evidence for the user-visible loss.
- [ ] Update ADR 0030 and frontend guidance without changing ADR 0028.
- [ ] Run `node scripts/check_harness.mjs` and confirm PASS.

### Task 4: Verification

**Files:**
- Verify only.

- [ ] Run focused persistence and Study tests.
- [ ] Run `npm test`, `npm run lint`, `npm run typecheck`, and `npm run build` from `frontend/`.
- [ ] Run `node scripts/check_harness.mjs` from the repository root.
- [ ] Review the final diff for unrelated changes and do not commit or push without separate authorization.
