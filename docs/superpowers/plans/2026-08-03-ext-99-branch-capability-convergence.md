# EXT 99-Branch Capability Convergence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give all 99 local branches a verified disposition and converge every approved, non-duplicated capability into `feature-chaotang-ext` without importing obsolete authority, dirty worktree state, duplicate history, or a second product control plane.

**Architecture:** Treat convergence as a checkpointed integration graph, not a 99-way Git merge. A machine-readable ledger reduces refs into asset families; each approved family enters EXT through one isolated Packet with its own authority, RED baseline, minimal adaptation, independent review, exact-H evidence, and rollback boundary. Historical reviews and superseded implementations remain provenance, not product commits.

**Tech Stack:** Git worktrees and plumbing commands, Node.js root Harness, Python/FastAPI/SQLAlchemy/Alembic backend, Next.js/TypeScript frontend, pytest, Node test runner, Playwright, machine-readable JSON authority and convergence manifests.

## Global Constraints

- The only integration target is `feature-chaotang-ext`.
- The captured planning baseline is HEAD `b78a4f8f4ea84d01de5255cbc1c4e566b2f8932f`, tree `615ac60452170c891f023c5d845472e327c6bebe`.
- Re-resolve HEAD, tree, worktree cleanliness, remote relation, and authority before every Packet; the captured baseline is not permanent authority.
- Current machine authority is `GO / APPROVED_WORK_PACKAGE` for `R0-W08` only.
- A general approval, this plan, a review, or a clean candidate does not activate another work package.
- Do not use the dirty root worktree as an implementation or integration source.
- Preserve `backend/knowledge/docs/ima_archived/` in the EXT worktree as pre-existing user-owned untracked state.
- Do not copy dirty files from any donor worktree. Read committed Git objects by exact ref or commit only.
- Do not wholesale merge historical branches and do not batch cherry-pick branch histories.
- Never merge review-only, authority-only, archive, superseded, duplicate, revert-only, or WIP refs as product functionality.
- Use an isolated clean worktree for every Packet and a separate clean integration worktree for the final EXT update.
- One Packet owns one asset family and one rollback boundary.
- Behavior changes require a focused RED test or a captured failing baseline before implementation.
- Every nontrivial Packet requires an independent read-only review against the exact candidate.
- Do not push, deploy, operate port 3050, migrate a persistent database, use real customer contracts, or operate real RAG data under this plan.
- Browser claims require real-backend Playwright evidence; backend dry-runs and declarative matrices cannot substitute for browser or external-user evidence.
- Database evidence is limited to pytest-owned or isolated temporary databases.
- Parameters, ownership, tenant/user identity, artifact lineage, hashes, and authority must fail closed.

---

## Design Decision

### Considered approaches

| Approach | Benefit | Failure mode | Decision |
| --- | --- | --- | --- |
| Merge all 99 refs | Preserves every commit graph mechanically | Imports obsolete authority, repeated reviews, stale deletions, conflicting schemas, demos, and unrelated product lines | Rejected |
| Cherry-pick every apparently useful commit | More selective than merge | Patch order becomes a hidden second architecture; duplicate and superseded patches are hard to prove | Rejected |
| Asset-family Packets on current EXT | Preserves approved capabilities while keeping current authority and product facts canonical | Requires explicit mapping, tests, and more review gates | Selected |

The completion metric is `99/99 disposition coverage` plus `100% of approved capabilities integrated or explicitly blocked`. It is not `99 merge commits`.

## Graph Contract

### State

The convergence graph persists one record per branch with these fields:

```json
{
  "branch": "task/r0-w08-full-loop-remediation-v9-20260730",
  "tip": "32a1c5729b57",
  "assetFamily": "W08_FULL_CONTRACT_LOOP",
  "candidateCommits": ["3d8964a1", "07c83a58", "32a1c572"],
  "disposition": "ABSORB_ADAPT",
  "canonicalDonor": true,
  "containedBy": null,
  "authorityPackage": "R0-W08",
  "targetOwners": ["root", "backend", "frontend"],
  "targetFiles": [],
  "proofCommands": [],
  "status": "PLANNED",
  "checkpoint": null,
  "reviewReceipt": null,
  "integrationCommit": null,
  "blockedReason": null
}
```

Allowed dispositions are `ABSORB_ADAPT`, `REBUILD`, `SUPERSEDED_VERIFY`, `ARCHIVE`, `REJECT`, `DUPLICATE`, and `BLOCKED_WIP`.

Allowed statuses are `PLANNED`, `BASELINED`, `RED`, `IMPLEMENTED`, `VERIFIED`, `REVIEW_GO`, `INTEGRATED_LOCAL`, `BLOCKED`, and `CLOSED`.

### Nodes

| Node | Responsibility | Input | Output | Authority | Independent proof |
| --- | --- | --- | --- | --- | --- |
| G0 Baseline | Freeze EXT and donor identities | local refs and worktrees | HEAD/tree/status/remote snapshot | read-only | Git plumbing output |
| G1 Inventory | Register all 99 refs exactly once | G0 snapshot | schema-valid convergence manifest | R0-W08 docs/governance only | manifest self-test |
| G2 Reduction | Detect identical, contained, equivalent, stale, dirty, and WIP refs | manifest + Git graph | canonical donor per asset family | read-only | topology and patch-equivalence report |
| G3 Authority | Bind one family to one approved Packet | reduced family | GO or STOP receipt | machine authority + user approval | authority command output |
| G4 Baseline/RED | Prove current EXT behavior and missing capability | clean Packet worktree | focused RED or superseded proof | approved Packet | test/log evidence |
| G5 Adapt | Implement the smallest current-EXT change | approved RED | isolated candidate commit | approved Packet | scoped diff and focused GREEN |
| G6 Verify | Run owner-line and cross-line checks | exact candidate | verification bundle | Packet owner | tests/doctors/browser evidence |
| G7 Review | Inspect requirements and quality independently | exact candidate + original task contract | GO/NO_GO receipt | independent reviewer | signed or hashed review artifact |
| G8 Integrate | Update local EXT through the approved method | clean EXT + REVIEW_GO | one local integration commit | integration authority | exact-H/tree and post-integration tests |
| G9 External Gate | Perform required external checks | integrated candidate | external receipts | named humans/services | Gitee/Ed25519/UAT evidence |
| G10 Closeout | Close refs by disposition and publish final ledger state | all receipts | 99/99 closed ledger | Codex acceptance owner + user governor | full manifest evaluator |

### Edges and recovery

```text
G0 -> G1                  when EXT identity and 99-ref count are captured
G1 -> G2                  when schema and uniqueness checks pass
G2 -> G3                  for ABSORB_ADAPT or REBUILD families
G2 -> G10                 for proven ARCHIVE/REJECT/DUPLICATE/SUPERSEDED refs
G3 -> G4                  only when the exact work package returns GO
G3 -> BLOCKED             on STOP; prepare an amendment, do not implement
G4 -> G10                 when equal-or-stronger current behavior is proven
G4 -> G5                  on an honest capability RED
G5 -> G4                  after a failed focused check; maximum three loops per root cause
G5 -> G6                  on focused GREEN and clean scoped diff
G6 -> G5                  on deterministic verification failure
G6 -> G7                  when all required proof surfaces pass
G7 -> G5                  on actionable NO_GO findings within scope
G7 -> BLOCKED             on architecture/scope conflict or three failed repair loops
G7 -> G8                  on exact-candidate REVIEW_GO
G8 -> G6                  for fresh post-integration verification
G8 -> G9                  when the local integration candidate is exact and clean
G9 -> G10                 when required external receipts pass
G9 -> BLOCKED             when credentials, required checks, or real users are unavailable
```

No failure restarts the entire graph. Resume from the last durable Packet checkpoint.

### Governor

- User: final governor for scope changes, conflict decisions, new work-package activation, merge, push, deployment, and external acceptance claims.
- Machine-readable authority v2: implementation gate; its `STOP` cannot be overridden by this document.
- Codex: readiness, plan review, independent acceptance, and final 99/99 closeout owner.
- Frontend owner: browser/UI proof and frontend file ownership.
- Backend owner: runtime, schema, API, artifact, identity, and backend test proof.
- Root Harness owner: cross-line manifest, authority, and governance proof.
- Security/legal/release owners: required before real customer data, release-bound actions, or production integration.

### Checkpoints

Each Packet stores:

1. base HEAD and tree;
2. donor ref, tip, and selected commits/hunks;
3. authority receipt;
4. RED evidence;
5. candidate HEAD/tree/diff digest;
6. focused and broad verification results;
7. independent review receipt and digest;
8. local integration HEAD/tree;
9. post-integration proof;
10. rollback commits and blocked reason, if any.

## File Ownership Map

### Convergence control plane

- Create: `.harness/contracts/ext-branch-convergence.schema.json`
- Create: `.harness/manifest/ext-branch-convergence.v1.json`
- Create: `.harness/wiki/ext-branch-capability-convergence.md`
- Create: `scripts/ext-branch-convergence.mjs`
- Create: `scripts/ext-branch-convergence.nodetest.mjs`
- Update: `.harness/manifest/project-harness.json`
- Update: `.harness/wiki/harness-inventory.md`
- Update: `.harness/wiki/verification-matrix.md`
- Update: `.harness/changes/docs-ext-full-asset-reconciliation-20260729/asset_reconciliation_ledger.md`

### Packet evidence

Each implementation family creates one new root change record under `.harness/changes/`. Frontend and backend change records are added only when their owned implementation or harness changes.

### Protected current files

These are hunk-coordinated files, never wholesale donor replacements:

- `frontend/src/features/shangshufang/ShangshufangPage.tsx`
- `backend/web/routers/shangshufang.py`
- `frontend/scripts/prod-doctor.mjs`
- `.harness/manifest/execution-authority.v2.json`
- `.harness/manifest/project-harness.json`
- `backend/harness/manifest.json`

---

### Task 1: Install the 99-Ref Convergence Ledger

**Files:**
- Create: `.harness/contracts/ext-branch-convergence.schema.json`
- Create: `.harness/manifest/ext-branch-convergence.v1.json`
- Create: `scripts/ext-branch-convergence.mjs`
- Create: `scripts/ext-branch-convergence.nodetest.mjs`
- Create: `.harness/wiki/ext-branch-capability-convergence.md`
- Modify: `.harness/manifest/project-harness.json`
- Modify: `.harness/wiki/harness-inventory.md`
- Modify: `.harness/wiki/verification-matrix.md`
- Modify: `.harness/changes/docs-ext-full-asset-reconciliation-20260729/asset_reconciliation_ledger.md`

**Interfaces:**
- Consumes: local Git refs and the existing EXT-A9 reconciliation taxonomy.
- Produces: `loadConvergenceManifest()`, `validateConvergenceManifest()`, and a CLI with `--check`, `--status`, and `--family <id>`.

- [x] **Step 1: Capture the clean planning baseline**

Run:

```bash
git status --short --branch
git rev-parse HEAD HEAD^{tree}
git rev-list --left-right --count origin/feature-chaotang-ext...feature-chaotang-ext
node scripts/execution-authority.mjs --check
node scripts/execution-authority-v2.mjs --authorize --work-package R0-W08
```

Expected: EXT identity is explicit; v1 remains inactive; v2 returns GO only for R0-W08. Any unexpected tracked modification stops the task.

- [x] **Step 2: Write schema tests that reject missing or duplicate refs**

The tests must prove rejection of duplicate branch names, duplicate canonical donors, unknown dispositions, missing tip hashes, missing authority packages for implementation dispositions, and `CLOSED` entries without proof.

Run:

```bash
node --test scripts/ext-branch-convergence.nodetest.mjs
```

Expected: RED because the schema, manifest, and loader do not exist.

- [x] **Step 3: Add the schema, loader, evaluator, and all 99 records**

Populate the manifest from committed refs only. Every ref must have one asset family and one disposition. Every family must identify exactly one canonical donor or explicitly state that it has no product donor.

- [x] **Step 4: Verify the isolated exact-H inventory candidate**

Run:

```bash
node --test scripts/ext-branch-convergence.nodetest.mjs
node scripts/ext-branch-convergence.mjs --check
node scripts/ext-branch-convergence.mjs --status
node scripts/execution-authority-v2.mjs --authorize --work-package R0-W08
node scripts/harness-doctor.mjs
git diff --check
```

Expected: 99 unique refs, zero unknown dispositions, zero unowned implementation
families, clean exact-H/tree, and no diff error. Because this is an isolated
pre-integration candidate, authority v2 and the root doctor must fail closed for
the single reason `active-packet EXT ref must equal pinned HEAD`; any additional
error fails the Packet. This expectation is authorized by Scope Amendment 01
and does not authorize moving EXT.

- [ ] **Step 5: Request independent ledger review**

The reviewer compares the manifest against `git for-each-ref`, `git merge-base --is-ancestor`, `git cherry`, branch tips, and worktree status. The reviewer must not infer a product capability from a review-only commit.

- [ ] **Step 6: Prove post-integration closure only after separate authority**

Only after independent review GO, explicit user integration approval, an
integration lease, and a clean/coordinated EXT target may the reviewed commits
be applied using the repository-approved non-merge-candidate integration
method. On the resulting EXT exact-H, require authority v2 `GO` and root doctor
`0 errors, 0 warnings`. Scope Amendment 01 does not grant this integration
authority.

---

### Task 2: Close W08 Family Reduction and Prepare the Exact Adaptation Packet

**Hard precondition — all required before any Task 2 implementation:** Task 1
must have (1) an independent-review receipt bound to its exact candidate,
(2) a separate user integration decision, (3) an integration lease, and (4)
post-integration proof on the resulting EXT exact-H: authority v2 `GO` and
root doctor `0 errors, 0 warnings`. Scope Amendment 01 authorizes none of
these integration prerequisites. Until all four are recorded, Task 2 remains
blocked and no Task 2 implementation may begin.

**Files:**
- Create: `.harness/changes/fix-r0-w08-current-ext-convergence-20260803/`
- Compare donor commits: `3d8964a1`, `07c83a58`, `32a1c572`
- Potential backend targets: `backend/src/artifacts/service.py`, `backend/src/contract_rework.py`, `backend/src/contract_task_projection.py`, `backend/src/secure_ingest/document_text.py`, `backend/web/routers/artifacts.py`, `backend/web/routers/shangshufang.py`
- Potential frontend targets: `frontend/src/features/contract-review/`, `frontend/src/features/shangshufang/`, `frontend/src/lib/jiqun-api.ts`, W08 Playwright configs/specs

**Interfaces:**
- Consumes: current EXT W08 facts plus the committed v9 donor tree.
- Produces: one hunk-level scope amendment that separates already-covered behavior from honest missing behavior.

- [ ] **Step 1: Build a semantic coverage table for W08 v1-v9**

Map DOCX upload, MissionContract lineage, secure ingest, evidence submission, rework, FinalMemorial, ContractReviewPack, artifact authorization, three-format hashes, human decision, refresh persistence, Shiguan replay, and exact-H browser evidence.

- [ ] **Step 2: Prove current behavior before selecting hunks**

Run the focused current-EXT backend, frontend Node, and registered real-backend Playwright checks for every proposed behavior. Mark equal-or-stronger behavior `SUPERSEDED_VERIFY`; do not reapply it.

- [ ] **Step 3: Create one RED per remaining behavior gap**

Each RED must fail on current EXT and pass on the donor behavior without depending on private seeding, mock-only state, declarative matrices, or old screenshots.

- [ ] **Step 4: Present the exact scope amendment for approval**

The amendment lists selected files and hunks, protected-file owners, expected API compatibility, database effects, rollback, and proof commands. No W08 code moves before this gate.

---

### Task 3: Implement and Verify the W08 Current-EXT Vertical Slice

**Files:** Only the Task 2 amendment-approved W08 files.

**Interfaces:**
- Consumes: approved W08 scope amendment and honest RED tests.
- Produces: one exact candidate proving the real browser contract loop on current EXT.

- [ ] **Step 1: Create a clean isolated W08 worktree from the current EXT tip**

Confirm zero tracked and untracked changes before implementation. Do not use the dirty historical W08 v9 worktree.

- [ ] **Step 2: Apply the smallest current-EXT implementation**

Reimplement or apply selected hunks; do not replace whole protected files and do not import donor authority manifests.

- [ ] **Step 3: Run focused GREEN and full owner-line verification**

Required surfaces include focused backend tests, `pnpm test:node`, TypeScript, real-API build, API stability, frontend/backend/root doctors, and `git diff --check`.

- [ ] **Step 4: Run isolated real-backend browser evidence**

Use unused backend/frontend ports and the registered W08 Playwright configurations. Record request/response failures, browser console, backend logs, exact HEAD/tree, screenshots, downloaded bytes, SHA-256, and replay identity.

- [ ] **Step 5: Freeze exact-H and obtain independent review**

The reviewer checks tenant/user ownership, natural lineage, idempotency, token recovery, exact task replay, artifact bytes/hash/signature, Shiguan readback, and test pollution.

- [ ] **Step 6: Integrate locally only after authority GO**

Run the integration authority command against the frozen candidate. If STOP, retain the candidate and prepare an exact-H amendment; do not move EXT to satisfy the check.

---

### Task 4: Execute the W08 External Acceptance Gate

**Files:** W08 acceptance records only; no production code is changed by this task.

**Interfaces:**
- Consumes: locally integrated exact-H W08 candidate.
- Produces: honest external acceptance receipts or a stable external blocker.

- [ ] **Step 1: Execute 36 real production-chain golden contracts in an approved isolated environment**

Do not substitute fixtures or a declarative matrix. Use non-customer approved samples, record one lineage and result per run, and retain failure categories.

- [ ] **Step 2: Run five real non-developer UAT sessions**

At least four users must succeed without accompaniment. Record consented, non-fabricated task completion evidence and usability failures.

- [ ] **Step 3: Evaluate the external closeout gate**

W08 remains blocked unless both the 36-run gate and 4-of-5 UAT gate pass. Product automation PASS alone is insufficient.

---

### Task 5: Integrate the W06R Successor Repairs

**Files:**
- Donor commits: `ac99175d`, `e51ce33d`
- Candidate targets: `backend/src/artifacts/service.py`, `backend/src/db/models.py`, `backend/alembic/versions/026_artifact_manifest_tenant_not_null.py`, artifact persistence/schema tests
- Evidence donor: `governance/r0-w06-successor-evidence-20260802`

**Interfaces:**
- Consumes: closed or separately authorized W08 state and a new exact W06 integration authority receipt.
- Produces: canonical ArtifactManifest tenant identity and one verifier chain on current EXT.

- [ ] **Step 1: Request a W06 successor integration authority amendment**

The work-package ledger currently says W06 is merged and verified; the amendment must explicitly authorize only the two successor repairs rather than reopening historical W06.

- [ ] **Step 2: Reproduce tenant-null and verifier inconsistency RED tests on current EXT**

- [ ] **Step 3: Adapt the two repairs without replaying W06 governance history**

- [ ] **Step 4: Run the nine-file W06R suite and migration isolation**

Run:

```bash
cd backend
python3 -m pytest -q \
  tests/test_schema_authority.py \
  tests/test_artifact_manifest_v1.py \
  tests/test_artifact_delivery_migration.py \
  tests/test_artifact_storage.py \
  tests/test_artifact_delivery_render.py \
  tests/test_artifact_manifest_persistence.py \
  tests/test_artifact_delivery_service.py \
  tests/test_artifact_manifest_access.py \
  tests/test_artifact_delivery_api.py
python3 -m pytest -q tests/test_artifact_delivery_migration.py
python3 scripts/harness_doctor.py
python3 scripts/commit_closeout_check.py --strict
cd ..
node scripts/harness-doctor.mjs
git diff --check
```

- [ ] **Step 5: Freeze, independently review, and integrate one W06R successor Packet**

---

### Task 6: Integrate the Jinyiwei Source-Trust Adapter

**Files:**
- Donor code commit: `208bce43`
- Donor evidence commit: `4107fe31`
- Candidate targets: `backend/src/jinyiwei_agent.py`, `backend/src/real_department_engines.py`, `backend/web/routers/jinyiwei.py`, Jinyiwei backend tests, `frontend/src/features/intel/`, `frontend/e2e/jinyiwei-source-trust.spec.ts`

**Interfaces:**
- Consumes: current EXT evidence policy and approved source allowlist.
- Produces: tenant/user-bound, source-labelled, fail-closed evidence acquisition and display.

- [ ] **Step 1: Obtain a dedicated security-reviewed authority Packet**

- [ ] **Step 2: Write RED probes for source spoofing, forbidden URL classes, missing provenance, owner crossover, timeout, and degraded source status**

- [ ] **Step 3: Adapt the donor against current EXT without exposing a raw general fetch API**

- [ ] **Step 4: Run backend security tests, frontend contract tests, and real browser source-label evidence**

- [ ] **Step 5: Freeze exact-H, obtain security and quality reviews, and integrate locally**

---

### Task 7: Integrate Evidence Truth and Trusted Kernel Hardening

**Files:**
- Anti-hallucination donor: `task/r0-anti-hallucination-01-20260720`
- Trusted-kernel donor: `docs/r0-trusted-kernel-amendment-20260720`
- Candidate modules: `backend/src/claim_evidence_gate.py`, formal memorial/finalization paths, token verification, tenant identity, schema adoption, production route guards, owned tests

**Interfaces:**
- Consumes: current evidence, FinalMemorial, identity, and migration contracts.
- Produces: durable claim-evidence binding plus production identity fail-closed behavior.

- [ ] **Step 1: Split this family into two separately reviewable Packets**

The claim-evidence Packet must not share a commit with JWT/schema changes.

- [ ] **Step 2: Prove missing claim durability and identity guard behavior with adversarial RED tests**

- [ ] **Step 3: Rebuild against current EXT APIs and current Alembic head**

- [ ] **Step 4: Run security review, migration review, focused suites, and full backend regression**

- [ ] **Step 5: Integrate each Packet independently or block it independently**

---

### Task 8: Converge Professional Agent Assets

**Files and donors:**
- K0 ledger commits ending at `675aa950`
- Ten-sample design commits `17eff7ce`, `ce6b6b06`, `334665af`
- Professional contracts and eval donor `codex/professional-agent-overlay-sdd-20260729`
- Companion delivery donor `codex/local-companion-phase1b-20260803`
- Current EXT targets must remain within root `.harness/`, `backend/`, `frontend/`, and `docs/`

**Interfaces:**
- Consumes: current EXT capability inventory and one product spine.
- Produces: RoleContract, ProfessionalTaskContract, WorkProductContract, QualityRubric, ComplexityRouter, EvalSet, and governed tool/MCP declarations without creating a parallel control plane.

- [ ] **Step 1: Absorb the K0 machine-readable inventory as a current-EXT schema**

- [ ] **Step 2: Reconcile ten sample designs against EXT Agent IDs, runtime prompts, MCP/tool surfaces, evidence policy, and maturity labels**

- [ ] **Step 3: Select one accounting work product as the first vertical slice**

Simple calculations use deterministic code, medium tasks use one expert self-review loop, and only cross-domain responsibility boundaries enter a council graph.

- [ ] **Step 4: Rebuild Companion delivery as an adapter behind current EXT authority**

Do not merge the old `backend/app` tree wholesale and do not create a second runtime state source.

- [ ] **Step 5: Verify contracts, eval cases, owner isolation, failure receipts, retries, and no-external-effect defaults**

---

### Task 9: Rebuild Department, Temporal, and Deep-Module Projections

**Files and donors:**
- `task/backend-runtime-wiring-r1`
- `docs/temporal-decision-intelligence-design-20260727`
- `docs/deep-module-projection-design-20260726`
- Current targets: department registry, MissionContract/EvidencePacket/RiskItem/FinalMemorial/ContractReviewPack projections, backend-owned read models and tests

**Interfaces:**
- Consumes: current canonical product facts.
- Produces: typed department capability registration and read-only temporal/module projections.

- [ ] **Step 1: Write a current-EXT design proving there is one task/status fact source**

- [ ] **Step 2: Start at Observer Graph M1**

Add events/checkpoints/read projections without changing the formal write path.

- [ ] **Step 3: Add read-only department and temporal verification**

- [ ] **Step 4: Consider M2 only after M1 replay and ownership tests pass**

M3 fan-out/fan-in and M4 human gates remain separately authorized upgrades.

---

### Task 10: Selectively Adopt Governance Tooling

**Files and donors:**
- `agent/task-cp-wt-01-bootstrap-v2-20260721`
- `chore/packet-skill-lifecycle-20260721`
- `governance/harness-selective-adoption-20260722`
- `task/branch-governance-convergence-20260720`
- `archive/review-p20-d6-legacy-20260719`

**Interfaces:**
- Consumes: current root Harness and current authority v2.
- Produces: narrow worktree-path checks, Packet lifecycle validation, observe-only branch governance, and governance-record checks.

- [ ] **Step 1: Prove each missing primitive independently**

Do not replace current `.claude`, `.codex`, `.agents`, authority manifest, or project boundaries with donor copies.

- [ ] **Step 2: Adopt one helper per Packet with Node tests first**

- [ ] **Step 3: Run root doctor, complete root Node tests, and repository-structure checks**

- [ ] **Step 4: Keep branch governance observe-only until false-positive and dirty-worktree tests pass**

---

### Task 11: Close Legacy Residuals by Proof

**Files and donors:** P3, P5, P5.1, P6, P8, P9, P16, P18, historical court-loop, canonical-idempotency, archive and review families from the 99-ref manifest.

**Interfaces:**
- Consumes: current EXT tests plus historical negative cases.
- Produces: one of `SUPERSEDED`, selected test absorption, design rebuild, archive, or reject for every residual family.

- [ ] **Step 1: Compare negative tests and invariants, not branch names**

- [ ] **Step 2: Import only a missing failing test before changing current behavior**

- [ ] **Step 3: Archive historical approvals, screenshots, obsolete authority, and duplicate reviews**

- [ ] **Step 4: Record conflict decisions for sports/viewing demos, old BFF paths, parallel status systems, and old all-departments runtime assumptions**

- [ ] **Step 5: Require zero unclassified refs before closeout**

---

### Task 12: Final Local Integration and 99/99 Closeout

**Files:**
- Modify: `.harness/manifest/ext-branch-convergence.v1.json`
- Modify: `.harness/changes/docs-ext-full-asset-reconciliation-20260729/asset_reconciliation_ledger.md`
- Create: `.harness/changes/docs-ext-99-branch-closeout-<date>/`

**Interfaces:**
- Consumes: every Packet receipt, integration commit, archive reason, rejection reason, and blocker.
- Produces: one exact-H local EXT candidate and a complete disposition report.

- [ ] **Step 1: Require a clean integration worktree and exact EXT baseline**

- [ ] **Step 2: Verify every implementation commit is reachable from EXT and every non-implementation ref has a closed disposition**

- [ ] **Step 3: Run full proof surfaces**

Run:

```bash
node scripts/ext-branch-convergence.mjs --check
node scripts/harness-doctor.mjs
node --test --test-concurrency=1 scripts/*.nodetest.mjs
cd backend
python3 scripts/harness_doctor.py
python3 -m pytest -q
cd ../frontend
pnpm harness:doctor
pnpm test:node
pnpm exec tsc --noEmit
NEXT_PUBLIC_API_MODE=real pnpm build
cd ..
git diff --check
git status --short --branch
git rev-parse HEAD HEAD^{tree}
```

Add the registered real-backend Playwright matrix for all user-visible absorbed capabilities.

- [ ] **Step 4: Obtain final independent requirements, quality, and security reviews**

- [ ] **Step 5: Evaluate integration infrastructure**

Required external Ed25519 verification and Gitee required checks must pass before push eligibility. A local PASS remains `IMPLEMENTED_LOCAL` while either boundary is missing.

- [ ] **Step 6: Publish the final disposition totals**

The report must show:

- exactly 99 registered source refs;
- zero unclassified refs;
- every approved capability integrated or blocked with an owner and reason;
- every duplicate points to its canonical donor;
- every superseded item has current proof;
- every archive/reject has a reason;
- exact EXT HEAD/tree and review receipts;
- external gates and unverified areas.

## Packet Ordering

```text
P00 Ledger
  -> P01 W08 reduction
  -> P02 W08 vertical slice
  -> P03 W08 external acceptance
  -> P04 W06R successor
  -> P05 Jinyiwei source trust
  -> P06 Claim-evidence truth
  -> P07 Trusted kernel
  -> P08 Professional K0
  -> P09 Accounting sample
  -> P10 Companion delivery
  -> P11 Department/temporal/module observer projections
  -> P12 Governance tooling
  -> P13 Legacy residual proof
  -> P14 Final closeout
```

P05 and P12 may be prepared in parallel after P00, but they cannot integrate out of order or without their own authority. P08 design work may proceed docs-only while runtime implementation remains gated.

## Rollback

- Before local integration: delete only the isolated candidate worktree after preserving committed evidence; EXT remains unchanged.
- After one Packet integrates locally: revert only that Packet's integration commit after proving no later Packet depends on it.
- Schema Packets: use forward repair; do not downgrade or mutate a persistent database under this plan.
- Documentation and ledger records are append-corrected; do not rewrite historical review evidence.
- A failed external gate does not revert valid local code automatically; it blocks push/release eligibility.

## Completion Criteria

The program is complete only when:

1. all 99 refs are schema-valid and classified;
2. every asset family has one canonical donor or an explicit no-donor decision;
3. every approved capability is integrated into current EXT or blocked with named authority/owner/reason;
4. no dirty donor files were copied;
5. no obsolete authority or second product control plane entered EXT;
6. all integrated Packets have fresh exact-H proof and independent review;
7. real browser evidence proves user-visible flows;
8. W08 external acceptance is honestly PASS or explicitly remains blocked;
9. Ed25519 and Gitee required-check status is reported honestly;
10. the final EXT worktree is clean except for explicitly preserved pre-existing user-owned files.

## Graph Design Score

| Area | Score | Evidence |
| --- | ---: | --- |
| Objective | 2/2 | 99/99 disposition plus approved capability convergence |
| State | 2/2 | typed manifest fields, owner, status, checkpoint, receipts |
| Nodes | 2/2 | single responsibility, I/O, authority, proof per node |
| Edges | 2/2 | deterministic conditions and failure destinations |
| Governor | 2/2 | user, authority v2, Codex, line owners, specialist owners |
| Verification | 2/2 | exact commands, browser and independent review surfaces |
| Recovery | 2/2 | Packet checkpoints and node-local retry/blocked paths |
| Observability | 2/2 | manifest, receipts, exact-H, logs, screenshots, replay |
| Security | 2/2 | identity, secrets, owner isolation, external-effect gates |
| Rollout | 2/2 | phased Packets, Observer Graph first, no big-bang merge |

**Rubric result:** 20/20 design completeness. Task 1's ledger is locally
implemented and has an exact-candidate independent `REVIEW_GO`; local
integration remains blocked by the dirty EXT target and absent separate
integration authority. All later product/family Packets (Tasks 2–12) remain
`NOT_STARTED`. This score and review do not grant authority or prove any
capability integrated.
