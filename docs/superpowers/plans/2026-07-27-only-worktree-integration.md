# Only Worktree Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge `codex/harness-only-worktree` into `harness-only` while preserving the current deterministic MCP evidence pipeline and adding authentication, per-user isolation, Dadian overview, and the migrated visual workspaces.

**Architecture:** Resolve the merge by contract, not by choosing one side wholesale. Authentication supplies an outer user boundary; the existing Shiguan evidence snapshot/reference model remains the inner archive contract. Frontend route handlers forward the authenticated session while retaining strict response parsing, and the harness enforces both governance baselines.

**Tech Stack:** Python 3.11+, FastAPI, Pydantic, SQLite, pytest, Ruff, Next.js App Router, React, TypeScript, Node.js test runner, ESLint.

## Global Constraints

- Preserve all existing `harness-only` MCP market evidence and immutable archive-reference behavior.
- Add `codex/harness-only-worktree` authentication and enforce `owner_user_id` on every Shiguan read/write path.
- Never read private dotenv files or enable external network/model calls during verification.
- Preserve both branch histories with one merge commit; do not push.
- Resolve only the files already in the merge plus this plan.

---

### Task 1: Merge the backend archive and ownership contracts

**Files:**
- Modify: `backend/app/shiguan/models.py`
- Modify: `backend/app/shiguan/db.py`
- Modify: `backend/app/shiguan/storage.py`
- Modify: `backend/app/shiguan/archive_decree.py`
- Modify: `backend/app/shiguan/__init__.py`
- Test: `backend/tests/test_shiguan_storage.py`
- Test: `backend/tests/test_shiguan_archive_decree.py`

**Interfaces:**
- Consumes: `CurrentUser.user_id`, existing `ArchiveEvidenceReferenceCreate`, existing evidence reconciliation functions.
- Produces: ownership-scoped archive functions and archives that retain immutable evidence references.

- [ ] **Step 1: Establish the failing integration contract**

Run:

```powershell
backend\.venv\Scripts\python.exe -m pytest backend/tests/test_shiguan_storage.py backend/tests/test_shiguan_archive_decree.py -q
```

Expected: FAIL during collection while conflict markers exist, proving the unresolved storage/archive boundary is exercised.

- [ ] **Step 2: Merge models and storage signatures**

Retain evidence snapshot/reference types and add ownership to archive creation and lookup:

```python
def create_archive(
    payload: dict | ArchiveCreate,
    *,
    owner_user_id: str,
    db_path: Path | None = None,
) -> Archive: ...

def get_archive(
    archive_id: str,
    *,
    owner_user_id: str,
    db_path: Path | None = None,
) -> Archive: ...
```

Every SQL lookup/update must include `owner_user_id = ?`; cross-user absence continues to surface as `ArchiveNotFoundError`.

- [ ] **Step 3: Compose the schema migration**

Keep the current evidence-reference schema and add the owner column/index idempotently. Existing rows receive only the repository-approved legacy owner treatment from the source branch; no runtime database is touched by tests.

- [ ] **Step 4: Thread ownership through decree archival**

Keep `resolve_adopted_evidence_references`, pending/confirmed evidence writes, and reconciliation. Add `owner_user_id` to `archive_chancellor_decree(...)` and pass it to the atomic archive/reference write.

- [ ] **Step 5: Verify the backend archive contract**

Run the Task 1 command again. Expected: PASS with zero failed tests.

### Task 2: Merge authenticated backend APIs

**Files:**
- Modify: `backend/app/api/decrees.py`
- Modify: `backend/app/api/shiguan.py`
- Modify: `backend/app/main.py`
- Test: `backend/tests/test_decrees_api.py`
- Test: `backend/tests/test_shiguan_api.py`
- Test: `backend/tests/test_auth_api.py`

**Interfaces:**
- Consumes: `CurrentUser`, `get_current_user`, ownership-scoped Shiguan storage.
- Produces: authenticated decree/Shiguan endpoints and `/api/v1/dadian/overview`.

- [ ] **Step 1: Run the API tests in RED**

```powershell
backend\.venv\Scripts\python.exe -m pytest backend/tests/test_auth_api.py backend/tests/test_decrees_api.py backend/tests/test_shiguan_api.py -q
```

Expected: FAIL while conflict markers or incompatible call signatures remain.

- [ ] **Step 2: Merge endpoint dependencies**

Use the source branch dependency shape while retaining current response construction:

```python
def submit_decree(
    payload: ChancellorDecreeRequest,
    current_user: CurrentUser = Depends(get_current_user),
) -> ChancellorDecreeResponse: ...
```

Apply the same dependency to archive create/get/list/review/statistics/recall and Dadian overview. Pass only `current_user.user_id` into storage.

- [ ] **Step 3: Register all routers and exception handlers**

Keep existing decree, Shiguan, Jinyiwei, and health routes; add the auth router and auth exception handlers once.

- [ ] **Step 4: Verify API behavior**

Run the Task 2 command again. Expected: PASS with zero failed tests, including unauthenticated rejection and cross-user isolation.

### Task 3: Merge frontend authenticated BFF and strict clients

**Files:**
- Modify: `frontend/src/lib/backendClient.ts`
- Modify: `frontend/src/app/api/decrees/chancellor/route.ts`
- Modify: `frontend/src/app/api/decrees/chancellor/route.test.ts`
- Modify: `frontend/src/app/api/shiguan/archives/route.ts`
- Test: `frontend/src/lib/backendClient.test.ts`
- Test: `frontend/src/app/api/auth/authRoutes.test.ts`
- Test: `frontend/src/app/api/shiguan/shiguanAuthRoutes.test.ts`

**Interfaces:**
- Consumes: session token from `frontend/src/lib/session.ts`.
- Produces: auth functions, ownership-aware Shiguan/Dadian calls, existing Jinyiwei evidence clients, and strict parsers for the union schema.

- [ ] **Step 1: Run the frontend contract tests in RED**

```powershell
Set-Location frontend
npm test -- src/lib/backendClient.test.ts src/app/api/auth/authRoutes.test.ts src/app/api/shiguan/shiguanAuthRoutes.test.ts src/app/api/decrees/chancellor/route.test.ts
```

Expected: FAIL while TypeScript conflict markers or duplicate/incomplete contracts remain.

- [ ] **Step 2: Compose `backendClient.ts`**

Retain all current Jinyiwei/evidence snapshot interfaces and parsers. Add source auth and Dadian interfaces. Consolidate shared helpers (`asRecord`, ISO date validation, error extraction) so each has one definition. Authenticated calls use:

```ts
headers: {
  Authorization: `Bearer ${options.token}`,
}
```

- [ ] **Step 3: Merge route handlers**

Route handlers obtain the session token, return the existing stable unauthenticated response when absent, and pass the token to backend clients. Preserve malformed-body validation and current backend error-to-status mapping.

- [ ] **Step 4: Verify the frontend client boundary**

Run the Task 3 command again. Expected: PASS with zero failed tests.

### Task 4: Adopt the migrated visual workspaces

**Files:**
- Modify: `frontend/src/app/shiguan/page.tsx`
- Verify: `frontend/src/app/shiguan/ShiguanClient.tsx`
- Verify: `frontend/src/app/study/StudyClient.tsx`
- Test: `frontend/src/app/shiguan/ShiguanClient.visual.test.ts`
- Test: `frontend/src/app/study/StudyClient.test.ts`
- Test: `frontend/src/app/court-entry-pages.test.ts`

**Interfaces:**
- Consumes: merged authenticated BFF routes and shared court shell components.
- Produces: server-authenticated page wrappers with source-branch visual clients.

- [ ] **Step 1: Run visual contract tests**

```powershell
Set-Location frontend
npm test -- src/app/shiguan/ShiguanClient.visual.test.ts src/app/study/StudyClient.test.ts src/app/court-entry-pages.test.ts
```

Expected: FAIL while `page.tsx` contains merge markers or an incompatible legacy implementation.

- [ ] **Step 2: Resolve the page boundary**

Use the source page as the authenticated server wrapper:

```tsx
export default async function ShiguanPage() {
  await requireUser();
  return <ShiguanClient />;
}
```

Keep all existing evidence behavior in the merged BFF contract; do not duplicate the 500-line legacy page inside the wrapper.

- [ ] **Step 3: Verify visual contracts**

Run the Task 4 command again. Expected: PASS.

### Task 5: Merge governance and harness enforcement

**Files:**
- Modify: `scripts/check_harness.mjs`
- Modify: `backend/AGENTS.md`

**Interfaces:**
- Consumes: deterministic evidence policy entries and decree-flow baseline entries.
- Produces: one harness validator that enforces both sets and self-tests both.

- [ ] **Step 1: Run harness checks in RED**

```powershell
node scripts/check_harness.mjs --self-test
```

Expected: FAIL while conflict markers remain.

- [ ] **Step 2: Compose policy guards**

Keep `DETERMINISTIC_EVIDENCE_REQUIRED_FILES`, `STATIC_POLICY_GUARDS`, and deterministic evidence repository checks. Add `DECREE_FLOW_BASELINE`, its SHA-256 pin, policy entries, and `decreeFlowBaselineErrors`. Invoke both from `validateHarness` and retain both self-test suites.

- [ ] **Step 3: Merge documentation facts**

Retain current Jinyiwei/MCP operational boundaries and add authenticated-user isolation plus decree evidence-flow boundaries. Remove all conflict markers and contradictory statements.

- [ ] **Step 4: Verify harness**

```powershell
node scripts/check_harness.mjs
node scripts/check_harness.mjs --self-test
node .agents/hooks/check-harness.mjs --self-test
node .agents/skills/product-flow/scripts/run-claude-delivery.mjs --self-test
```

Expected: all commands exit 0.

### Task 6: Full verification and merge completion

**Files:**
- Review: all merge-touched files.

**Interfaces:**
- Consumes: Tasks 1-5.
- Produces: verified merge commit on `harness-only`.

- [ ] **Step 1: Confirm no unresolved paths or markers**

```powershell
git diff --name-only --diff-filter=U
rg -n "^(<<<<<<<|=======|>>>>>>>)" .
```

Expected: both commands return no matches.

- [ ] **Step 2: Run backend verification**

```powershell
Set-Location backend
.venv\Scripts\python.exe -m ruff check .
.venv\Scripts\python.exe -m pytest
```

Expected: both exit 0.

- [ ] **Step 3: Run frontend verification**

```powershell
Set-Location frontend
npm run lint
npm run typecheck
npm test
npm run build
```

Expected: all exit 0.

- [ ] **Step 4: Inspect the final merge diff**

```powershell
git diff --check
git status --short
```

Expected: no whitespace errors and no unmerged paths.

- [ ] **Step 5: Complete the authorized merge commit**

After printing the absolute workspace, branch, HEAD, and status:

```powershell
git add --all
git commit
```

Expected: one merge commit with parents `fdb1bd57...` and `df037478...`. Do not push.
