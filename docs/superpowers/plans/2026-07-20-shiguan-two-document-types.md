# Shiguan Two-Document-Type Implementation Plan

> **Execution note:** Use the repository `product-flow` Codex-only role chain. No Claude CLI,
> Claude runner, `gstack-claude`, commit, push, deploy, or real model call is authorized.

**Goal:** Converge the Shiguan domain, persistence, API, and UI on `MEMORIAL` (奏折) and
`REPLY` (回奏), while safely migrating deterministic legacy decree archives.

**Architecture:** Keep Pydantic as the contract source and SQLite as the local persistence
owner. Add explicit schema versioning in `app.shiguan.db`, migrate legacy data in one
transaction, replace the two-row decree archival write with one validated `REPLY`, and make
the frontend consume the same strict wire contract.

**Tech Stack:** Python 3.11, Pydantic, sqlite3, FastAPI, pytest, Ruff, Next.js App Router,
TypeScript, Node test runner, ESLint.

---

### Task 1: Lock the two-type domain contract with failing tests

**Files:**
- Modify: `backend/tests/test_shiguan_models.py`
- Modify: `backend/tests/test_shiguan_validation.py`
- Modify: `backend/app/shiguan/models.py`

**Steps:**
1. Add tests proving only `MEMORIAL` and `REPLY` are accepted, all reply-only fields are
   required for `REPLY`, and forbidden for `MEMORIAL`.
2. Run the focused tests and record the expected RED caused by the old five-type contract.
3. Replace `DECISION` and decision-only field names with the accepted reply contract.
4. Re-run focused tests and record GREEN.

### Task 2: Add fail-closed SQLite schema migration

**Files:**
- Modify: `backend/app/shiguan/db.py`
- Modify: `backend/app/shiguan/storage.py`
- Modify: `backend/tests/test_shiguan_storage.py`
- Create: `backend/tests/test_shiguan_migrations.py`

**Steps:**
1. Build version-1 databases in tests for an explicitly confirmed old decree pair, an
   unconfirmed/ambiguous relation, an unsupported legacy type, and an empty/current database.
2. Run focused migration tests and record RED.
3. Add current schema creation and a versioned, transactional migration that converts only
   explicitly confirmed legacy pairs and rolls back on unconfirmed records, ambiguity, or
   unsupported types; never infer provenance from a producer fingerprint.
4. Update row mapping and inserts to the reply field names; remove the linked-pair write API.
5. Re-run storage/migration tests and record GREEN.

### Task 3: Archive completed decrees as one reply

**Files:**
- Modify: `backend/app/shiguan/archive_decree.py`
- Modify: `backend/tests/test_shiguan_archive_decree.py`

**Steps:**
1. Replace old pair expectations with a single `REPLY` expectation containing
   `source_kind=DECREE` and the original decree in `source_text`.
2. Run focused tests and record RED.
3. Implement the minimal single-archive write while preserving the never-raise HTTP hot-path
   boundary and an assertion-friendly result object.
4. Re-run focused tests and record GREEN.

### Task 4: Converge recall and FastAPI behavior

**Files:**
- Modify: `backend/app/shiguan/recall.py`
- Modify: `backend/app/api/shiguan.py`
- Modify: `backend/tests/test_shiguan_recall.py`
- Modify: `backend/tests/test_shiguan_api.py`

**Steps:**
1. Add failing tests for reply-conclusion recall summaries, two-type filtering, strict create
   validation, review, and statistics regression coverage.
2. Update recall and HTTP documentation/typing without changing endpoint paths.
3. Run the focused backend suite and record GREEN.

### Task 5: Converge the Next.js client, BFF, and page

**Files:**
- Modify: `frontend/src/lib/backendClient.ts`
- Modify: `frontend/src/lib/backendClient.test.ts`
- Modify: `frontend/src/app/api/shiguan/archives/route.ts`
- Modify: `frontend/src/app/api/shiguan/archives/route.test.ts`
- Modify: `frontend/src/app/shiguan/archiveStatus.ts`
- Modify: `frontend/src/app/shiguan/archiveStatus.test.ts`
- Modify: `frontend/src/app/shiguan/page.tsx`

**Steps:**
1. Add failing tests for strict `MEMORIAL | REPLY` parsing, reply field mapping, BFF rejection
   of old types, labels, and filter query generation.
2. Run focused Node tests and record RED.
3. Update the frontend contract, BFF allowlist, filters, and reply card fields.
4. Re-run focused tests and record GREEN.

### Task 6: Record and enforce the architecture decision

**Files:**
- Create: `docs/decisions/0017-shiguan-memorial-reply-contract.md`
- Modify: `ARCHITECTURE.md`
- Modify: `backend/AGENTS.md`
- Modify: `frontend/AGENTS.md`
- Modify: `scripts/check_harness.mjs`
- Modify: `docs/product/tasks/2026-07-20-shiguan-two-document-types.md`

**Steps:**
1. Record ADR 0017 as superseding the five-type and pair-write portions of ADR 0015.
2. Update architecture/agent navigation to describe the two-type contract and safe migration.
3. Add ADR 0017 to the harness required-file baseline.
4. Keep the product task’s plan, implementation evidence, and acceptance review current.

### Task 7: Independent verification and browser acceptance

**Files:** No product-code changes unless a reproducible defect is found.

**Steps:**
1. Run backend Ruff and the complete pytest suite.
2. Run frontend lint, typecheck, complete tests, and production build.
3. Run harness normal/self-tests, hook self-test, product-flow runner self-test, and
   `git diff --check`.
4. Restart the backend only after offline migration tests pass; verify `/health` and the
   Shiguan read endpoints without creating records or calling a model.
5. Verify `/shiguan` in the browser shows only 全部/奏折/回奏 and no contract/console errors.
6. Have an independent Codex test-engineer audit the evidence; perform at most two bounded
   repair rounds if needed.
7. Mark the product task Accepted only after every acceptance criterion has fresh evidence.
