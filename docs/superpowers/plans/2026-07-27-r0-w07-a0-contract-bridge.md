# R0-W07-A0 Contract Bridge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> `superpowers:subagent-driven-development` or `superpowers:executing-plans`.
> Every behavior change requires an observed RED before GREEN. This plan is
> `NON_AUTHORIZING`; implementation starts only after exact scope approval.

**Goal:** First make one synthetic contract flow runnable through the real backend and existing
`/shangshufang` and `/shiguan`, then harden mission persistence, lineage consistency and recovery
before W08.

**Architecture:** Checkpoint A uses `DecisionTask` as the canonical root and stores exact
`MissionContractV1` snapshots in existing `CourtLoopRun` rows. A backend
`ContractTaskReadModelV1` joins current review, memorial, artifact delivery and archive receipt and
owns `allowed_actions`. Checkpoint B replaces the compatibility repository with database-enforced
mission revisions and adds authenticated cross-session PARTIAL recovery and consistent reads.

**Tech Stack:** Python 3, Pydantic v2, SQLAlchemy 2, Alembic, FastAPI, pytest, React, TypeScript,
Node test runner, Playwright.

## Global Constraints

- Parent work package is exactly `R0-W07`; W07-A0 is not a ledger item.
- Begin from the latest accepted local `feature-chaotang-ext` exact H, not from this design branch.
- Run v1 integrity check and v2 W07 authorization before material implementation.
- Only `/shangshufang` and `/shiguan` may change as product surfaces.
- No new page, Agent, BFF, department, task state, completion state or decision system.
- Generated OpenAPI types are the frontend contract source.
- `ShangshufangPage.tsx` and `ShiguanPage.tsx` require hunk-level integration and one writer each.
- No raw resume token in URL, localStorage, read model, log or screenshot.
- No mock response may prove a real-backend acceptance gate.
- No push, deployment, persistent database migration or listener 3050 operation.
- Checkpoint A verdict is at most `RUNNABLE_MINIMUM`.
- Checkpoint B must pass before W08 activation is prepared.

## File Ownership

| Window | Owner | Files | Out of scope |
| --- | --- | --- | --- |
| Backend Contract | W07 Contract Agent | `backend/src/contracts/`, `backend/web/schemas/` | routers, pages |
| Backend Runtime | W07 Runtime Agent | `backend/src/contract_*`, `backend/web/routers/contracts.py` | frontend |
| Artifact Lineage | W06/W07 Bridge Agent | `backend/src/artifacts/`, focused artifact tests | renderer/storage rewrite |
| Schema Hardening | W07 Persistence Agent | `backend/src/db/models.py`, one Alembic file | migration execution |
| Frontend Feature | W07 Frontend Agent | `frontend/src/features/contract-review/` | page layout |
| Protected Pages | one nominated writer | exact two page files | any other page |
| QA | Codex QA | tests/evidence only | production implementation |

---

## Gate 0: Create the Authorized Implementation Packet

**Files:**
- Create: `.harness/changes/feat-r0-w07-a0-contract-bridge-20260727/`
- No product files.

- [ ] **Step 1: Bind exact base**

```bash
git status --short --branch
git rev-parse HEAD
git rev-parse HEAD^{tree}
git merge-base --is-ancestor HEAD feature-chaotang-ext
```

Expected: clean isolated worktree at the latest accepted EXT H.

- [ ] **Step 2: Prove authority**

```bash
node scripts/execution-authority.mjs --check
node scripts/execution-authority-v2.mjs --authorize --work-package R0-W07
```

Expected: v1 `VALID_INACTIVE_GUARD`; v2 `GO / APPROVED_WORK_PACKAGE`.

- [ ] **Step 3: Freeze scope**

Packet records owner, exact file list, no-go list, Checkpoint A/B exit gates, proof commands and
one-writer locks. Stop on any authority or ownership conflict.

- [ ] **Step 4: Capture baseline**

```bash
cd backend
python3 -m pytest -q \
  tests/test_mission_contract_v1.py \
  tests/test_mission_confirmation_conflict.py \
  tests/test_contract_review_pack_v1.py \
  tests/test_artifact_delivery_api.py

cd ../frontend
pnpm exec tsx --test \
  src/features/shangshufang/api/contract-baseline.nodetest.ts \
  src/features/shangshufang/canonical-memorial-view.nodetest.ts \
  src/features/shiguan-ui/components/shiguan-drawer-honesty.nodetest.ts
pnpm exec tsc --noEmit
```

Record exact counts and failures. Existing unrelated failures are not silently waived.

---

# Checkpoint A: RUNNABLE_MINIMUM

## Task 1: Persist the Compatibility Mission Snapshot

**Files:**
- Create: `backend/src/contract_mission_repository.py`
- Create: `backend/tests/test_contract_mission_repository.py`
- Modify: `backend/web/routers/contracts.py`
- Modify: `backend/tests/test_mission_confirmation_conflict.py`

**Contract:**

```python
save_mission_snapshot(
    db: Session,
    *,
    task: DecisionTask,
    mission: MissionContractV1,
    state: Literal["draft", "confirmed"],
) -> MissionContractV1

load_current_mission_snapshot(
    db: Session,
    *,
    task: DecisionTask,
) -> MissionContractV1 | MissionBindingConflict
```

- [ ] **Step 1: Write repository RED tests**

Cover:

- snapshot survives closing and reopening a database session;
- `mission_contract_id != task.id` is rejected;
- task/tenant/user mismatch is indistinguishable from not found;
- identical revision/digest replay is idempotent;
- same revision with different digest is conflict;
- stale revision cannot replace current;
- two incompatible current rows produce `MissionBindingConflict`.

- [ ] **Step 2: Observe RED**

```bash
cd backend
python3 -m pytest -q tests/test_contract_mission_repository.py
```

Expected: collection/import failure because the repository does not exist.

- [ ] **Step 3: Implement minimal repository**

Use existing `CourtLoopRun`, reserved `loop_id="contract-mission-v1"` and canonical JSON. Recompute
`content_digest` before writing. Do not add a table, column or task status.

- [ ] **Step 4: Replace route dependence on process memory**

Draft and confirm resolve an owned `DecisionTask` and use the repository. Keep the old dict only if
an existing non-W07 test explicitly requires an isolated compatibility path; W07 read/write must
not consult it.

- [ ] **Step 5: Run GREEN and regression**

```bash
cd backend
python3 -m pytest -q \
  tests/test_contract_mission_repository.py \
  tests/test_mission_confirmation_conflict.py \
  tests/test_mission_contract_v1.py \
  tests/test_w02_h2_adversarial.py \
  tests/test_contracts_router_openapi.py
```

- [ ] **Step 6: Commit**

```bash
git add backend/src/contract_mission_repository.py \
  backend/web/routers/contracts.py \
  backend/tests/test_contract_mission_repository.py \
  backend/tests/test_mission_confirmation_conflict.py
git commit -m "feat(w07): persist compatible mission binding"
```

## Task 2: Make Mission/Task Lineage Explicit

**Files:**
- Create: `backend/src/contracts/contract_lineage_identity.py`
- Create: `backend/tests/test_contract_lineage_identity.py`
- Modify: `backend/src/contract_rework.py`
- Modify: focused W05/outbox tests only as required.

**Contract:**

```python
class ContractLineageIdentityV1(BaseModel):
    tenant_id: int
    task_id: str
    mission_contract_id: str

def require_r0_mission_binding(identity: ContractLineageIdentityV1) -> None:
    ...
```

- [ ] **Step 1: Write RED**

Reject blank ids, task/mission mismatch, tenant drift and a pack whose mission identity differs
from the task binding. Prove current W05 construction only passes because ids happen to match.

- [ ] **Step 2: Observe RED**

```bash
cd backend
python3 -m pytest -q tests/test_contract_lineage_identity.py
```

- [ ] **Step 3: Implement the exact compatibility rule**

Centralize the rule. W05 and secure-ingest consumers call it instead of assigning task id as an
undocumented shortcut. Do not create an alternate mission id mapper.

- [ ] **Step 4: Run GREEN**

```bash
cd backend
python3 -m pytest -q \
  tests/test_contract_lineage_identity.py \
  tests/test_w05_postmerge_remediation.py \
  tests/test_outbox_worker.py \
  tests/test_secure_ingest_authz_matrix.py
```

- [ ] **Step 5: Commit**

```bash
git add backend/src/contracts/contract_lineage_identity.py \
  backend/src/contract_rework.py \
  backend/tests/test_contract_lineage_identity.py
git commit -m "fix(w07): enforce contract lineage identity"
```

## Task 3: Define the Typed Read Model and Action Resolver

**Files:**
- Create: `backend/src/contracts/contract_task_read_model.py`
- Create: `backend/src/contract_task_actions.py`
- Create: `backend/tests/test_contract_task_read_model.py`
- Create: `backend/tests/test_contract_task_actions.py`
- Modify: `backend/src/contracts/__init__.py` only if local exports require it.

- [ ] **Step 1: Write schema RED**

Test `extra="forbid"`, closed action/blocker enums, public delivery fields and exact
`ArchiveReceiptV1` identity. Assert raw token, storage path and idempotency key are rejected.

- [ ] **Step 2: Write action resolver table RED**

Table-test:

- no mission;
- mission conflict;
- evidence incomplete;
- current memorial ready;
- decision approved;
- delivery PARTIAL in current session;
- delivery PARTIAL after refresh;
- READY downloadable;
- exact archive receipt;
- FALLBACK source.

Unknown or inconsistent input must return `allowed_actions=[]`.

- [ ] **Step 3: Observe RED**

```bash
cd backend
python3 -m pytest -q \
  tests/test_contract_task_read_model.py \
  tests/test_contract_task_actions.py
```

- [ ] **Step 4: Implement minimal contracts and pure resolver**

No database calls in the resolver. No UI labels in backend enums. No new task status.

- [ ] **Step 5: Run GREEN**

```bash
cd backend
python3 -m pytest -q \
  tests/test_contract_task_read_model.py \
  tests/test_contract_task_actions.py \
  tests/test_contract_review_pack_v1.py \
  tests/test_artifact_manifest_v1.py
```

- [ ] **Step 6: Commit**

```bash
git add backend/src/contracts/contract_task_read_model.py \
  backend/src/contract_task_actions.py \
  backend/tests/test_contract_task_read_model.py \
  backend/tests/test_contract_task_actions.py
git commit -m "feat(w07): define contract task read model"
```

## Task 4: Project the Exact Backend Lineage

**Files:**
- Create: `backend/src/contract_task_projection.py`
- Create: `backend/tests/test_contract_task_projection.py`
- Create: `backend/tests/test_contract_task_read_model_api.py`
- Modify: `backend/web/routers/contracts.py`
- Modify: `backend/tests/test_contracts_router_openapi.py`

**Endpoint:**

```http
GET /api/contracts/tasks/{task_id}/read-model
```

- [ ] **Step 1: Write projection RED**

Construct database fixtures for:

- exact mission/task/pack/final/manifest/archive lineage;
- stale final memorial;
- manifest with another final version;
- archive with missing or different final hash;
- cross-tenant task;
- duplicate compatibility mission conflict;
- PARTIAL after a simulated refresh.

- [ ] **Step 2: Observe RED**

```bash
cd backend
python3 -m pytest -q \
  tests/test_contract_task_projection.py \
  tests/test_contract_task_read_model_api.py
```

- [ ] **Step 3: Implement pure projection service**

Read current rows through the supplied SQLAlchemy session. Use W06 public/verifier functions rather
than rebuilding manifest validation. Produce a receipt only from exact `ShiguanArchive` identity.

- [ ] **Step 4: Add tenant-safe endpoint**

Unknown and unauthorized task ids both return 404. Inconsistent owned data returns HTTP 200 with
blockers and no privileged action; it is not rewritten as success.

- [ ] **Step 5: Run GREEN and API regression**

```bash
cd backend
python3 -m pytest -q \
  tests/test_contract_task_projection.py \
  tests/test_contract_task_read_model_api.py \
  tests/test_contracts_router_openapi.py \
  tests/test_artifact_delivery_api.py \
  tests/test_p0b_cross_user_behavioral.py
```

- [ ] **Step 6: Commit**

```bash
git add backend/src/contract_task_projection.py \
  backend/web/routers/contracts.py \
  backend/tests/test_contract_task_projection.py \
  backend/tests/test_contract_task_read_model_api.py \
  backend/tests/test_contracts_router_openapi.py
git commit -m "feat(w07): expose canonical contract read model"
```

## Task 5: Generate and Consume the Frontend Contract

**Files:**
- Generate: `frontend/src/lib/contracts/backend-openapi-2026-07-21.d.ts`
- Generate: `docs/api-contract-openapi-2026-07-21.json`
- Generate: `docs/api-contract-route-snapshot-2026-07-21.json`
- Generate: `docs/api-contract-stability-report-2026-07-21.json`
- Generate: `docs/api-contract-stability-report-2026-07-21.md`
- Create: `frontend/src/features/contract-review/api.ts`
- Create: `frontend/src/features/contract-review/read-model.ts`
- Create: `frontend/src/features/contract-review/action-policy.ts`
- Create: `frontend/src/features/contract-review/read-model.nodetest.ts`
- Create: `frontend/src/features/contract-review/action-policy.nodetest.ts`
- Modify: contract stability manifest only if the existing generator requires it.

- [ ] **Step 1: Generate OpenAPI contract**

Use the repository script; do not handwrite a duplicate backend schema.

```bash
node scripts/api-contract-stability.mjs
```

- [ ] **Step 2: Write adapter RED**

Test:

- exact read model accepted;
- unknown action/blocker fails closed;
- PARTIAL after refresh never maps to delivered or resume;
- archive label requires a real receipt;
- FALLBACK remains visibly non-live.

- [ ] **Step 3: Observe RED**

```bash
cd frontend
pnpm exec tsx --test \
  src/features/contract-review/read-model.nodetest.ts \
  src/features/contract-review/action-policy.nodetest.ts
```

- [ ] **Step 4: Implement minimal typed adapter**

The adapter fetches only `/api/contracts/tasks/{task_id}/read-model`. It maps server actions to
existing API commands but never adds an action absent from the response.

- [ ] **Step 5: Run GREEN and typecheck**

```bash
cd frontend
pnpm exec tsx --test \
  src/features/contract-review/read-model.nodetest.ts \
  src/features/contract-review/action-policy.nodetest.ts \
  src/features/shangshufang/api/contract-baseline.nodetest.ts \
  src/features/shiguan/lib/archive-adapter.nodetest.ts
pnpm exec tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/lib/contracts/backend-openapi-*.d.ts \
  frontend/src/features/contract-review
git commit -m "feat(w07): add typed contract read adapter"
```

## Task 6: Mount the Existing Shangshufang Contract Workspace

**Files:**
- Create: `frontend/src/features/contract-review/ContractReviewPanel.tsx`
- Create: `frontend/src/features/contract-review/ContractReviewPanel.nodetest.tsx`
- Modify hunk only: `frontend/src/features/shangshufang/ShangshufangPage.tsx`

- [ ] **Step 1: Acquire protected-file ownership**

Confirm no other writer owns `ShangshufangPage.tsx`. Stop on conflict.

- [ ] **Step 2: Write component RED**

Test mission card, blockers, one primary server action, pack identity, PARTIAL honesty and
download availability. The component receives typed data; no endpoint mocking is accepted for
Checkpoint A browser proof.

- [ ] **Step 3: Observe RED**

```bash
cd frontend
pnpm exec tsx --test \
  src/features/contract-review/ContractReviewPanel.nodetest.tsx
```

- [ ] **Step 4: Implement component and hunk-level mount**

Keep existing page shell and navigation. Mount only for the current task and retain current honest
loading/error states.

- [ ] **Step 5: Run GREEN and focused regression**

```bash
cd frontend
pnpm exec tsx --test \
  src/features/contract-review/ContractReviewPanel.nodetest.tsx \
  src/features/shangshufang/canonical-memorial-view.nodetest.ts \
  src/features/shangshufang/api/contract-baseline.nodetest.ts
pnpm exec tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/contract-review/ContractReviewPanel.tsx \
  frontend/src/features/contract-review/ContractReviewPanel.nodetest.tsx \
  frontend/src/features/shangshufang/ShangshufangPage.tsx
git commit -m "feat(w07): mount contract review workspace"
```

## Task 7: Mount Exact Shiguan Readback

**Files:**
- Create: `frontend/src/features/contract-review/ContractArchiveReadback.tsx`
- Create: `frontend/src/features/contract-review/ContractArchiveReadback.nodetest.tsx`
- Modify hunk only: `frontend/src/features/shiguan-ui/components/ShiguanPage.tsx`
- Modify only if needed: `frontend/src/features/shiguan/lib/archive-adapter.ts`

- [ ] **Step 1: Acquire protected-file ownership**

Confirm no concurrent writer owns `ShiguanPage.tsx`.

- [ ] **Step 2: Write RED**

Test:

- exact receipt reopens the same task read model;
- missing/mismatched receipt stays unarchived;
- FALLBACK detail remains labeled;
- pack/final/manifest identities are visible and equal.

- [ ] **Step 3: Observe RED**

```bash
cd frontend
pnpm exec tsx --test \
  src/features/contract-review/ContractArchiveReadback.nodetest.tsx
```

- [ ] **Step 4: Implement hunk-level consumer**

Do not replace the Shiguan index or add a page. The exact receipt path augments existing detail;
legacy records remain honest compatibility records.

- [ ] **Step 5: Run GREEN**

```bash
cd frontend
pnpm exec tsx --test \
  src/features/contract-review/ContractArchiveReadback.nodetest.tsx \
  src/features/shiguan/lib/archive-adapter.nodetest.ts \
  src/features/shiguan-ui/components/shiguan-drawer-honesty.nodetest.ts
pnpm exec tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/contract-review/ContractArchiveReadback.tsx \
  frontend/src/features/contract-review/ContractArchiveReadback.nodetest.tsx \
  frontend/src/features/shiguan-ui/components/ShiguanPage.tsx \
  frontend/src/features/shiguan/lib/archive-adapter.ts
git commit -m "feat(w07): reopen exact contract archive"
```

## Task 8: Prove Checkpoint A Through One Real Backend Slice

**Files:**
- Create: `frontend/e2e/w07-contract-runnable-minimum.spec.ts`
- Create/update: implementation Packet evidence files.

- [ ] **Step 1: Write browser RED**

The test uses disposable synthetic data and real backend APIs. It must fail before page integration
because the typed contract panel/readback does not exist.

- [ ] **Step 2: Execute the full slice**

Required checkpoints:

```text
create/intake
-> confirmed mission snapshot
-> evidence/review
-> current FinalMemorial + ContractReviewPack
-> authorized decision
-> PDF/DOCX/JSON manifest
-> authorized download
-> exact archive receipt
-> reopen in /shiguan
```

- [ ] **Step 3: Verify refresh honesty**

Refresh at READY and archive readback. For a seeded PARTIAL packet, refresh must show the explicit
hardening blocker and must not offer resume or delivered state.

- [ ] **Step 4: Run Checkpoint A suite**

```bash
cd backend
python3 -m pytest -q \
  tests/test_contract_mission_repository.py \
  tests/test_contract_lineage_identity.py \
  tests/test_contract_task_read_model.py \
  tests/test_contract_task_actions.py \
  tests/test_contract_task_projection.py \
  tests/test_contract_task_read_model_api.py \
  tests/test_artifact_delivery_api.py

cd ../frontend
pnpm exec tsc --noEmit
pnpm exec playwright test e2e/w07-contract-runnable-minimum.spec.ts
```

- [ ] **Step 5: Run governance verification**

```bash
node scripts/execution-authority.mjs --check
node scripts/execution-authority-v2.mjs --authorize --work-package R0-W07
node scripts/harness-doctor.mjs
cd backend && python3 scripts/harness_doctor.py
git diff --check
```

- [ ] **Step 6: Codex read-only acceptance**

Verdict may be `PASS / RUNNABLE_MINIMUM` only when all commands pass on exact H. Record:

- source H/tree;
- test counts;
- synthetic data identity;
- screenshots/traces;
- remaining Checkpoint B blockers;
- explicit `NOT_DEPLOYED`.

Do not close W07 or activate W08.

---

# Checkpoint B: PRE_W08_HARDENING

## Task 9: Add Database-Enforced Mission Revisions

**Files:**
- Modify: `backend/src/db/models.py`
- Create: `backend/alembic/versions/026_contract_mission_revisions.py`
- Create: `backend/tests/test_contract_mission_migration.py`
- Create: `backend/tests/test_contract_mission_constraints.py`

- [ ] **Step 1: Write migration RED**

Require a dedicated table with tenant, task, mission, revision, digest, state, canonical payload
and timestamps. Require unique constraints for task/revision and mission/revision and an index for
the current lineage.

- [ ] **Step 2: Observe RED**

```bash
cd backend
python3 -m pytest -q \
  tests/test_contract_mission_migration.py \
  tests/test_contract_mission_constraints.py
```

- [ ] **Step 3: Implement forward-only schema**

The migration must not run against persistent data. Up/down verification uses only a disposable
database.

- [ ] **Step 4: Run GREEN**

```bash
cd backend
python3 -m pytest -q \
  tests/test_contract_mission_migration.py \
  tests/test_contract_mission_constraints.py \
  tests/test_schema_authority.py
```

- [ ] **Step 5: Commit**

```bash
git add backend/src/db/models.py backend/alembic/versions \
  backend/tests/test_contract_mission_migration.py \
  backend/tests/test_contract_mission_constraints.py
git commit -m "feat(w07): add canonical mission revisions"
```

## Task 10: Swap the Repository and Convert Compatibility Snapshots

**Files:**
- Modify: `backend/src/contract_mission_repository.py`
- Create: `backend/src/contract_mission_conversion.py`
- Create: `backend/tests/test_contract_mission_conversion.py`
- Modify: repository/API tests.

- [ ] **Step 1: Write RED**

Prove deterministic conversion, idempotent rerun, conflicting legacy rows fail closed, restart
survival and concurrent confirm CAS.

- [ ] **Step 2: Observe RED**

```bash
cd backend
python3 -m pytest -q \
  tests/test_contract_mission_conversion.py \
  tests/test_contract_mission_repository.py
```

- [ ] **Step 3: Implement canonical repository**

New writes use the dedicated table. Compatibility reads are conversion input only and never a
parallel current source. Do not silently pick one of conflicting rows.

- [ ] **Step 4: Run GREEN and concurrency tests**

```bash
cd backend
python3 -m pytest -q \
  tests/test_contract_mission_conversion.py \
  tests/test_contract_mission_repository.py \
  tests/test_mission_confirmation_conflict.py
```

- [ ] **Step 5: Commit**

```bash
git add backend/src/contract_mission_repository.py \
  backend/src/contract_mission_conversion.py \
  backend/tests/test_contract_mission_conversion.py \
  backend/tests/test_contract_mission_repository.py
git commit -m "feat(w07): promote mission repository"
```

## Task 11: Add Authenticated PARTIAL Recovery

**Files:**
- Modify: `backend/src/artifacts/service.py`
- Modify: `backend/web/routers/artifacts.py`
- Modify: `backend/src/contracts/contract_task_read_model.py`
- Create: `backend/tests/test_artifact_authenticated_recovery.py`
- Modify: `frontend/src/features/contract-review/api.ts`
- Modify: focused frontend tests.

- [ ] **Step 1: Write security RED**

Cover refresh/reconnect, expiry, cross-user, cross-tenant, stale manifest, duplicate resume,
already READY and audit. Assert no raw token enters any public read model.

- [ ] **Step 2: Observe RED**

```bash
cd backend
python3 -m pytest -q tests/test_artifact_authenticated_recovery.py
```

- [ ] **Step 3: Implement server recovery capability**

Resolve the sealed resume-token hash server-side after current-user authorization and exact
manifest lineage verification. Reuse W06 resume semantics and duplicate protection; do not create
a second delivery service.

- [ ] **Step 4: Run GREEN and W06 regression**

```bash
cd backend
python3 -m pytest -q \
  tests/test_artifact_authenticated_recovery.py \
  tests/test_artifact_delivery_service.py \
  tests/test_artifact_delivery_api.py \
  tests/test_artifact_manifest_access.py
```

- [ ] **Step 5: Update frontend action mapping and test refresh**

```bash
cd frontend
pnpm exec tsx --test src/features/contract-review/*.nodetest.ts*
pnpm exec tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add backend/src/artifacts/service.py backend/web/routers/artifacts.py \
  backend/src/contracts/contract_task_read_model.py \
  backend/tests/test_artifact_authenticated_recovery.py \
  frontend/src/features/contract-review
git commit -m "feat(w07): recover partial delivery after refresh"
```

## Task 12: Enforce Consistent Read and Fault Semantics

**Files:**
- Modify: `backend/src/contract_task_projection.py`
- Create: `backend/tests/test_contract_task_projection_consistency.py`
- Create: `frontend/e2e/w07-contract-recovery.spec.ts`
- Modify: implementation Packet evidence.

- [ ] **Step 1: Write RED**

Inject:

- final memorial changes during read;
- manifest revision changes during read;
- duplicate decision/delivery submission;
- backend restart after mission confirm;
- disconnect during delivery;
- corrupt artifact or archive hash;
- cross-tenant ids in URL.

- [ ] **Step 2: Observe RED**

```bash
cd backend
python3 -m pytest -q tests/test_contract_task_projection_consistency.py
```

- [ ] **Step 3: Implement consistent projection**

Use one transaction snapshot where supported. If the backend cannot prove consistency, return a
retryable blocker and no privileged action. Do not merge rows read at different revisions.

- [ ] **Step 4: Run GREEN and browser recovery**

```bash
cd backend
python3 -m pytest -q tests/test_contract_task_projection_consistency.py

cd ../frontend
pnpm exec playwright test \
  e2e/w07-contract-runnable-minimum.spec.ts \
  e2e/w07-contract-recovery.spec.ts
```

- [ ] **Step 5: Commit**

```bash
git add backend/src/contract_task_projection.py \
  backend/tests/test_contract_task_projection_consistency.py \
  frontend/e2e/w07-contract-recovery.spec.ts
git commit -m "fix(w07): fail closed on contract fact drift"
```

## Task 13: Final W07 Verification and Independent Review

**Files:**
- Modify: implementation Packet only.

- [ ] **Step 1: Run affected backend suite**

```bash
cd backend
python3 -m pytest -q \
  tests/test_contract_mission*.py \
  tests/test_contract_lineage_identity.py \
  tests/test_contract_task*.py \
  tests/test_w05_postmerge_remediation.py \
  tests/test_artifact*.py \
  tests/test_schema_authority.py
python3 scripts/harness_doctor.py
```

- [ ] **Step 2: Run frontend suite**

```bash
cd frontend
pnpm exec tsx --test src/features/contract-review/*.nodetest.ts*
pnpm exec tsc --noEmit
pnpm run build
pnpm exec playwright test \
  e2e/w07-contract-runnable-minimum.spec.ts \
  e2e/w07-contract-recovery.spec.ts
```

- [ ] **Step 3: Run root verification**

```bash
node scripts/execution-authority.mjs --check
node scripts/execution-authority-v2.mjs --authorize --work-package R0-W07
node scripts/harness-doctor.mjs
git diff --check
git status --short
```

- [ ] **Step 4: Run two independent Codex read-only reviews**

Each review binds exact H/tree, scope, changed paths, proof outputs and checks:

- second state/completion systems;
- browser inference;
- tenant and lineage integrity;
- raw-token leakage;
- migration and production claims;
- W08/W09 scope leakage.

Both require `GO`, `HIGH 0`, `MEDIUM 0`.

- [ ] **Step 5: Product acceptance**

Codex may issue `PASS / W07 CLOSEOUT CANDIDATE` only when Checkpoint B is complete on exact H.
This does not integrate EXT, activate W08, push, deploy, migrate a persistent database or operate
3050.

## Handoff Queue

After accepted W07 integration:

1. Governance creates a separate W08 exact-H activation Packet.
2. W08 runs 36 goldens, 10/10 real-backend browser flows and five non-developer user tests with at
   least four successes.
3. Governance creates W09 only after W08 closes.
4. W09 freezes source/build/database/listener identity and runs prod doctor plus verification loop.
5. Final state is `R0_RELEASE_CANDIDATE`, not production release.
