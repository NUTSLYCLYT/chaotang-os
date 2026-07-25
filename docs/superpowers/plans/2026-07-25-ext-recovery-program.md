# EXT Recovery Program Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish `origin/feature-chaotang-ext` as the only trusted R0 integration line and converge only independently verified product capabilities into it.

**Architecture:** Root `.harness/` owns governance and cross-line evidence, `backend/` owns canonical contracts and runtime facts, `frontend/` owns the `/shangshufang` and `/shiguan` user surfaces, and `backend/harness/` owns acceptance evidence. Every non-EXT branch, worktree, and uncommitted change remains an Asset Pool until rebuilt as a scoped Packet in an isolated EXT-based worktree.

**Tech Stack:** Node.js authority tooling, Python/FastAPI/Pydantic/Alembic backend, Next.js/TypeScript frontend, pytest, Node test runner, Playwright, repository harness doctors.

## Global Constraints

- Integration target is exactly `origin/feature-chaotang-ext`.
- Recovery base is `8feae838f09ad5202b21332d4280b989ab776bd7`, tree `9d63f98041e5e13174dbba4c0b9d27eef1471bf9`.
- No whole-branch merge, bulk historical cherry-pick, dirty-workspace copy, or automatic file overwrite.
- One file has one writer at a time; `frontend/src/features/shangshufang/ShangshufangPage.tsx` and `frontend/scripts/prod-doctor.mjs` require hunk-level integration review.
- Product runtime work remains blocked until EXT-G0 produces a valid work-package authority decision.
- Local verification never proves deployment. Production remains `NOT_DEPLOYED`; database migration and listener `3050` takeover are excluded.
- No new Agent, product page, task state, completion state, or adjudication fact source.
- Every Packet must pass Asset ownership, isolated implementation, tests, independent QA review, Codex acceptance, and exact-EXT integration review.

---

### Task 1: EXT-G0 Authority Candidate

**Files:**
- Create: `.harness/changes/fix-ext-g0-authority-recovery-20260725/summary.md`
- Create: `.harness/changes/fix-ext-g0-authority-recovery-20260725/request_analysis/spec.md`
- Create: `.harness/changes/fix-ext-g0-authority-recovery-20260725/request_analysis/tasks.md`
- Create: `.harness/changes/fix-ext-g0-authority-recovery-20260725/owner_approval/exact-h-approval.md`
- Create: `.harness/changes/fix-ext-g0-authority-recovery-20260725/ci_result/ci_summary.md`
- Modify: `AGENTS.md`
- Modify: `.harness/agents/project-owner.md`
- Modify: `.harness/rules/project-workflow.md`
- Modify: `.harness/wiki/execution-authority.md`
- Modify: `.harness/wiki/execution-authority-v2.md`
- Modify: `.harness/manifest/execution-authority.v1.json`
- Test: `scripts/execution-authority.nodetest.mjs`
- Test: `scripts/execution-authority-v2.nodetest.mjs`

**Interfaces:**
- Consumes: permanently inactive v1 integrity guard and quiescent v2 work-package ledger.
- Produces: one documented root authorization procedure in which v1 `--check` verifies guard integrity and v2 `--authorize --work-package` is the only product execution decision.

- [ ] Record the exact recovery base, explicit W06 recovery scope, exclusions, owner, rollback, and `NOT_DEPLOYED` boundary in the new change record.
- [ ] Update the three governed root entry documents so none instructs workers to treat v1 `--authorize` as the product authorization decision.
- [ ] Keep every v1 activation field null and repin only the three governed-document SHA-256 values changed by this task.
- [ ] Keep v2 quiescent in the candidate: `activeWorkPackage = null`; do not create a premature GO.
- [ ] Add regression assertions that root entry documents identify v1 as integrity-only and v2 as the scoped authorization command.
- [ ] Run:

```bash
node --test scripts/execution-authority.nodetest.mjs
node --test scripts/execution-authority-v2.nodetest.mjs
node scripts/execution-authority.mjs --check
node scripts/execution-authority-v2.mjs --authorize --work-package R0-W06
node scripts/harness-doctor.mjs
git diff --check
```

- [ ] Confirm expected candidate behavior: v1 check is valid, v1 authorize remains STOP, and v2 W06 remains `STOP / NO_ACTIVE_WORK_PACKAGE`.
- [ ] Commit the review-ready candidate without activating W06.

### Task 2: W06-Specific Independent Review and Atomic Activation

**Files:**
- Create: `.harness/changes/fix-ext-g0-authority-recovery-20260725/claude_code_review/exact-h-final.md`
- Modify: `.harness/manifest/execution-authority.v2.json`
- Modify: `.harness/changes/fix-ext-g0-authority-recovery-20260725/summary.md`
- Modify: `.harness/changes/fix-ext-g0-authority-recovery-20260725/request_analysis/tasks.md`
- Modify: `.harness/changes/fix-ext-g0-authority-recovery-20260725/ci_result/ci_summary.md`
- Test: `scripts/execution-authority-v2.nodetest.mjs`

**Interfaces:**
- Consumes: Task 1 exact candidate and independent review bound to W06 scope, candidate commit, tree, and proposed activation bytes.
- Produces: a single ACTIVE `R0-W06` ledger entry and a W06-only GO decision.

- [ ] Have a read-only reviewer verify the candidate base/tree, owner evidence, proposed v2 manifest, changed paths, root semantics, and absence of business code.
- [ ] Reject any review that references W01–W05 scope, a different candidate, a different tree, or production readiness.
- [ ] Store the W06-specific review with its exact candidate, tree, diff digest, commands, and combined `GO` or `NO_GO`.
- [ ] On `NO_GO`, leave v2 quiescent and stop the program.
- [ ] On `GO`, atomically update v2 evidence digests, `effectiveBase`, `candidateH`, `tree`, `approvedScope`, `activeWorkPackage`, and the W06 ledger entry.
- [ ] Atomically change the change summary from `REVIEW_READY / NOT_ACTIVE` to `AUTHORIZED / ACTIVE`.
- [ ] Run:

```bash
node --test scripts/execution-authority.nodetest.mjs
node --test scripts/execution-authority-v2.nodetest.mjs
node scripts/execution-authority.mjs --authorize
node scripts/execution-authority-v2.mjs --authorize --work-package R0-W06
node scripts/harness-doctor.mjs
git diff --check
```

- [ ] Confirm v1 remains `STOP / AMENDMENT_APPROVAL_REQUIRED`, v2 returns `GO / APPROVED_WORK_PACKAGE` only for R0-W06, and no successor package is authorized.
- [ ] Stop at `CODEX_ACCEPTANCE_READY`; do not merge or push.

### Task 3: Asset Capture and Packet Ledger

**Files:**
- Create: `.harness/changes/docs-ext-asset-convergence-ledger-20260725/summary.md`
- Create: `.harness/changes/docs-ext-asset-convergence-ledger-20260725/request_analysis/spec.md`
- Create: `.harness/changes/docs-ext-asset-convergence-ledger-20260725/request_analysis/tasks.md`
- Create: `.harness/changes/docs-ext-asset-convergence-ledger-20260725/asset-ledger.md`
- Create: `.harness/changes/docs-ext-asset-convergence-ledger-20260725/ci_result/ci_summary.md`

**Interfaces:**
- Consumes: the 62-worktree/75-ref Asset Pool audit.
- Produces: immutable asset identities and one target Packet per retained capability.

- [ ] Record path, source HEAD, source tree, status summary, binary diff digest, untracked-file hashes, owner, target Packet, and disposition for every retained asset group.
- [ ] Mark current-main runtime identity, UI incident, human confirmation/reports, Task8 exact memorial binding, and browser route repair as capture-required.
- [ ] Mark old P6 and superseded W06/P16–P19 histories archive-only.
- [ ] Prohibit ref or worktree deletion until the replacement Packet is accepted.
- [ ] Run `node scripts/harness-doctor.mjs` and `git diff --check`.

### Task 4: EXT-I1 UI Runtime Incident Packet

**Files:**
- Modify only after a dedicated Packet plan freezes exact hunks under `frontend/src/middleware.ts`, `frontend/src/lib/auth.ts`, `frontend/src/lib/api/client.ts`, `frontend/src/components/AuthGate.tsx`, canonical browser tests, and the matching backend route contract tests.

**Interfaces:**
- Consumes: same-origin transport, login gating, JWT hardening, human confirmation, and canonical browser Asset Pool hunks.
- Produces: an independently tested local runtime candidate without production claims.

- [ ] Rebuild the packet from latest EXT, never from the dirty source worktree.
- [ ] Keep backend contract and frontend transport changes in separately reviewable commits.
- [ ] Verify anonymous login behavior, protected transport, tenant-safe archive reads, and the real draft/confirm/status/decision/archive browser chain.
- [ ] Preserve `VERIFIED_COMPLETE` only for workspace runtime evidence and preserve `NOT_DEPLOYED`, DB `016`, and external listener `3050`.

### Task 5: EXT-I2 Immutable Release Identity Packet

**Files:**
- Modify only after a dedicated Packet plan assigns the release identity helpers, `frontend/scripts/prod-doctor.mjs`, their Node tests, and root release evidence helpers to Window 4.

**Interfaces:**
- Consumes: source/build/database/listener identity Asset Pool hunks.
- Produces: a fail-closed composite release identity and prod-doctor hard gate.

- [ ] Bind exact Git source, immutable build, database schema, listener/process identity, and release evidence.
- [ ] Reject foreign listeners, identity drift, incomplete cleanup, or evidence mismatch.
- [ ] Exclude deployment, database migration, and listener `3050` takeover.

### Task 6: EXT-W06R Artifact Delivery Recovery

**Files:**
- Modify: `backend/src/contracts/artifact_manifest.py`
- Modify: `backend/src/artifacts/service.py`
- Modify: `backend/web/routers/artifacts.py`
- Modify: `backend/src/artifacts/delivery.py`
- Modify only when required: `backend/alembic/versions/023_artifact_manifests.py`
- Modify only when required: `backend/alembic/versions/024_artifact_manifest_tenant.py`
- Test: `backend/tests/test_artifact_manifest_v1.py`
- Test: `backend/tests/test_artifact_manifest_persistence.py`
- Test: `backend/tests/test_artifact_manifest_access.py`
- Test: `backend/tests/test_artifact_delivery_render.py`

**Interfaces:**
- Consumes: existing W06 recovery baseline.
- Produces: `ArtifactManifest`, durable storage, authorized download, partial/resume semantics, retry/idempotency, and duplicate protection.

- [ ] Write failing contract tests for exact PDF/DOCX/JSON membership, identity/version/hash, stored/downloadable state, authz, expiry, PARTIAL reason, resume token, retry, idempotency, and duplicate suppression.
- [ ] Implement the minimum backend packet needed to satisfy the tests.
- [ ] Enforce:

```text
DELIVERED =
artifact generated
+ stored
+ authorized
+ downloadable
+ auditable
```

- [ ] Run migrations, focused pytest, API contract tests, harness doctor, and an independent requirements/quality review.

### Task 7: EXT-P1 Contract Backend Closure

**Files:**
- Modify: `backend/src/contracts/evidence_packet.py`
- Modify: `backend/src/contracts/contract_risk_item.py`
- Modify: `backend/src/contracts/contract_review_pack.py`
- Modify: `backend/src/shangshufang_loop.py`
- Modify: `backend/web/routers/shangshufang.py`
- Test: the corresponding evidence, risk, review-pack, final-memorial, Shangshufang-loop, and Shiguan-read tests.

**Interfaces:**
- Consumes: secure upload/parse and W06R artifact delivery.
- Produces: one canonical lineage from MissionContract through Shiguan audit replay.

- [ ] Bind every verdict to the current FinalMemorial ID, content hash, and version.
- [ ] Add claim/evidence numeric-support adversarial checks without restoring the pre-W05 persistence model.
- [ ] Ensure ContractReviewPack and ArtifactManifest retain tenant-safe audit lineage.
- [ ] Reject second task, completion, or adjudication fact sources.

### Task 8: EXT-P2 Frontend Closure

**Files:**
- Modify: `frontend/src/features/shangshufang/ShangshufangPage.tsx`
- Modify: `frontend/src/features/shangshufang/types.ts`
- Modify: `frontend/src/lib/contracts/shangshufang.ts`
- Modify: `frontend/src/lib/jiqun-api.ts`
- Modify only accepted Shiguan read-model adapters and components under `frontend/src/features/shiguan/` and `frontend/src/features/shiguan-ui/`.
- Test: focused Node contract tests and Playwright specs for Shangshufang and Shiguan.

**Interfaces:**
- Consumes: P1 typed read model and exact FinalMemorial identity.
- Produces: upload-to-download-to-audit user closure on existing pages only.

- [ ] Rebuild Task8 exact memorial binding and stale-verdict rejection.
- [ ] Consume server-owned ContractReviewPack/ArtifactManifest state; do not create client formal exports.
- [ ] Absorb reports only where a component adds value and preserves visible provenance.
- [ ] Add no Agent and no product page.

### Task 9: EXT-Q1 Acceptance and EXT-R1 Candidate

**Files:**
- Add acceptance fixtures/evidence only under `backend/harness/`, the relevant change record, and approved browser evidence locations.
- Modify release candidate identity records only after all gates pass.

**Interfaces:**
- Consumes: accepted G0, I1, I2, W06R, P1, and P2 Packets.
- Produces: `R0_RELEASE_CANDIDATE`, never a production-release claim.

- [ ] Pass 36 golden contracts.
- [ ] Pass 10/10 real-backend browser flows.
- [ ] Record five non-developer user trials with at least four successful unassisted completions.
- [ ] Freeze exact EXT candidate HEAD/tree/build/database/listener identities.
- [ ] Run the project verification loop and independent final review.
- [ ] Report deployment, migration, and listener takeover as not included.
