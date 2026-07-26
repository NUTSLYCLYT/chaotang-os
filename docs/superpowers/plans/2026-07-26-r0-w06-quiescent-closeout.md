# R0-W06 Quiescent Closeout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close R0-W06 as `MERGED_AND_VERIFIED` with no active work package, without auto-activating R0-W07.

**Architecture:** Preserve the existing W06 approval evidence as historical provenance while changing only the v2 ledger state and real-repository authority expectations. A root closeout Packet records the local integration evidence, production exclusions, independent review, and rollback boundary.

**Tech Stack:** Node.js test runner, execution-authority v2 JSON manifest/resolver, root harness doctor, Git.

## Global Constraints

- Base every Event 1 change on local EXT
  `bdc5865fd20ffe7c026a571e9c2b14262b6edde2`.
- The accepted W06 Packet is
  `ea4260c2932b24fb5903bd92322a4e398214856d`.
- W06 becomes `MERGED_AND_VERIFIED`; `activeWorkPackage` becomes `null`.
- Do not add an R0-W07 ledger row during Event 1.
- W06 and W07 must both return `STOP / NO_ACTIVE_WORK_PACKAGE`.
- Retain existing W06 approval evidence bytes and digests unchanged.
- Do not modify the authority schema, resolver, CLI, root entry documents, or
  product code during Event 1.
- No push, deployment, database migration, listener operation, real customer
  data, or production claim.

## File Map

| File | Responsibility |
| --- | --- |
| `.harness/manifest/execution-authority.v2.json` | Single machine-readable quiescent authority state |
| `scripts/execution-authority-v2.nodetest.mjs` | Real-repository closeout and STOP expectations |
| `.harness/changes/fix-r0-w06-quiescent-closeout-20260726/summary.md` | Change status, exact baseline, and boundary |
| `.harness/changes/fix-r0-w06-quiescent-closeout-20260726/request_analysis/spec.md` | Closeout contract and acceptance criteria |
| `.harness/changes/fix-r0-w06-quiescent-closeout-20260726/request_analysis/tasks.md` | Task and review checklist |
| `.harness/changes/fix-r0-w06-quiescent-closeout-20260726/ci_result/ci_summary.md` | RED/GREEN and verification evidence |

---

### Task 1: Freeze The W06 Closeout Packet And Observe RED

**Files:**
- Create: `.harness/changes/fix-r0-w06-quiescent-closeout-20260726/summary.md`
- Create: `.harness/changes/fix-r0-w06-quiescent-closeout-20260726/request_analysis/spec.md`
- Create: `.harness/changes/fix-r0-w06-quiescent-closeout-20260726/request_analysis/tasks.md`
- Create: `.harness/changes/fix-r0-w06-quiescent-closeout-20260726/ci_result/ci_summary.md`
- Modify: `scripts/execution-authority-v2.nodetest.mjs`

**Interfaces:**
- Consumes: active W06 manifest at local EXT `bdc5865f`.
- Produces: failing real-repository tests for the exact quiescent state.

- [ ] **Step 1: Create the root closeout Packet**

Set the Packet state to:

```text
IMPLEMENTATION_PENDING / NOT_INTEGRATED
```

Record:

```text
baseline = bdc5865fd20ffe7c026a571e9c2b14262b6edde2
accepted_w06_packet = ea4260c2932b24fb5903bd92322a4e398214856d
target_active_work_package = null
target_w06_status = MERGED_AND_VERIFIED
NOT_DEPLOYED
NO_PUSH
NO_DB_MIGRATION
NO_LISTENER_3050_TAKEOVER
NO_R0_W07_ACTIVATION
```

- [ ] **Step 2: Replace the real-repository W06 GO test with closeout expectations**

Change the real-repository test to:

```javascript
test('CLI subprocess against the real repo is quiescent after verified W06 closeout', async () => {
  const loaded = await loadExecutionAuthorityV2(root);
  assert.deepEqual(loaded.errors, []);
  assert.equal(loaded.manifest.activeWorkPackage, null);
  assert.deepEqual(loaded.manifest.workPackageLedger.at(-1), {
    id: 'R0-W06',
    status: 'MERGED_AND_VERIFIED',
  });
  for (const workPackage of ['R0-W06', 'R0-W07']) {
    await assert.rejects(
      execFileAsync(process.execPath, [cliPath, '--authorize', '--work-package', workPackage], {
        cwd: root,
      }),
      (error) => {
        const output = JSON.parse(error.stdout);
        return output.decision === 'STOP' && output.reason === 'NO_ACTIVE_WORK_PACKAGE';
      },
    );
  }
});
```

- [ ] **Step 3: Update the neighboring real-repository STOP test**

Keep predecessor and future-package coverage without duplicating W06/W07:

```javascript
for (const workPackage of ['R0-W05', 'R0-W08', 'R0-W09']) {
  // subprocess must reject with decision STOP
}
```

- [ ] **Step 4: Run RED**

Run:

```bash
node --test scripts/execution-authority-v2.nodetest.mjs
```

Expected: FAIL because the real manifest still has W06 `ACTIVE` and
`activeWorkPackage='R0-W06'`.

- [ ] **Step 5: Commit RED and Packet scope**

```bash
git add scripts/execution-authority-v2.nodetest.mjs \
  .harness/changes/fix-r0-w06-quiescent-closeout-20260726
git commit -m "test(authority): require quiescent W06 closeout"
```

---

### Task 2: Apply The Minimal Quiescent Manifest Transition

**Files:**
- Modify: `.harness/manifest/execution-authority.v2.json`
- Modify: `.harness/changes/fix-r0-w06-quiescent-closeout-20260726/ci_result/ci_summary.md`
- Modify: `.harness/changes/fix-r0-w06-quiescent-closeout-20260726/request_analysis/tasks.md`

**Interfaces:**
- Consumes: Task 1 closeout expectations.
- Produces: structurally valid v2 authority with zero active packages.

- [ ] **Step 1: Change only the two W06 state facts**

Apply this semantic JSON change:

```json
{
  "activeWorkPackage": null,
  "workPackageLedger": [
    { "id": "R0-W00", "status": "MERGED_AND_VERIFIED" },
    { "id": "R0-W01", "status": "MERGED_AND_VERIFIED" },
    { "id": "R0-W02", "status": "MERGED_AND_VERIFIED" },
    { "id": "R0-W03", "status": "MERGED_AND_VERIFIED" },
    { "id": "R0-W04", "status": "MERGED_AND_VERIFIED" },
    { "id": "R0-W05", "status": "MERGED_AND_VERIFIED" },
    { "id": "R0-W06", "status": "MERGED_AND_VERIFIED" }
  ]
}
```

Do not change `amendment`, `effectiveBase`, `approvalEvidence`, or
`professionalReassignment`.

- [ ] **Step 2: Run GREEN**

Run:

```bash
node --test scripts/execution-authority-v2.nodetest.mjs
```

Expected: all authority-v2 tests pass.

- [ ] **Step 3: Verify exact command behavior**

Run:

```bash
node scripts/execution-authority.mjs --check
node scripts/execution-authority-v2.mjs --check
node scripts/execution-authority-v2.mjs --authorize --work-package R0-W06
node scripts/execution-authority-v2.mjs --authorize --work-package R0-W07
```

Expected:

```text
v1 = VALID_INACTIVE_GUARD
v2 check = VALID_STRUCTURE
W06 = STOP / NO_ACTIVE_WORK_PACKAGE
W07 = STOP / NO_ACTIVE_WORK_PACKAGE
```

- [ ] **Step 4: Record GREEN evidence**

Update the Packet CI summary with the RED failure reason, exact GREEN count,
command exit codes, and unchanged evidence digests.

- [ ] **Step 5: Commit the quiescent transition**

```bash
git add .harness/manifest/execution-authority.v2.json \
  .harness/changes/fix-r0-w06-quiescent-closeout-20260726
git commit -m "fix(authority): close W06 into quiescent state"
```

---

### Task 3: Verify And Independently Review Event 1

**Files:**
- Modify: `.harness/changes/fix-r0-w06-quiescent-closeout-20260726/summary.md`
- Modify: `.harness/changes/fix-r0-w06-quiescent-closeout-20260726/request_analysis/tasks.md`
- Modify: `.harness/changes/fix-r0-w06-quiescent-closeout-20260726/ci_result/ci_summary.md`

**Interfaces:**
- Consumes: clean Task 2 candidate.
- Produces: `VERIFIED_COMPLETE / ACCEPTED_NOT_INTEGRATED` Event 1 Packet.

- [ ] **Step 1: Run the complete authority verification**

Run:

```bash
node --test \
  scripts/execution-authority.nodetest.mjs \
  scripts/execution-authority-v2.nodetest.mjs
node scripts/execution-authority.mjs --check
node scripts/execution-authority-v2.mjs --check
node scripts/execution-authority-v2.mjs --authorize --work-package R0-W06
node scripts/execution-authority-v2.mjs --authorize --work-package R0-W07
node scripts/harness-doctor.mjs
git diff --check bdc5865f..HEAD
git status --short --branch
```

Expected:

- all Node tests pass;
- both W06 and W07 authorize commands exit 2 with
  `STOP / NO_ACTIVE_WORK_PACKAGE`;
- doctor reports `0 errors / 0 warnings`;
- candidate worktree is clean.

- [ ] **Step 2: Verify the change inventory**

The baseline range may contain only:

```text
.harness/manifest/execution-authority.v2.json
.harness/changes/fix-r0-w06-quiescent-closeout-20260726/**
docs/superpowers/specs/2026-07-26-r0-w06-w07-authority-transition-design.md
docs/superpowers/plans/2026-07-26-r0-w06-quiescent-closeout.md
scripts/execution-authority-v2.nodetest.mjs
```

- [ ] **Step 3: Request independent read-only review**

The reviewer must verify:

- W06 accepted and local integration evidence is real;
- the ledger has zero `ACTIVE` entries;
- W07 is absent and cannot return GO;
- W06 historical approval evidence bytes and digests are unchanged;
- no schema/resolver/product/deployment change entered Event 1;
- rollback and production boundaries are explicit.

- [ ] **Step 4: Resolve every review finding**

Any HIGH or MEDIUM finding keeps the Packet `NO-GO`. Behavioral changes require
a new RED test before correction.

- [ ] **Step 5: Record acceptance**

After independent GO, set:

```text
VERIFIED_COMPLETE / ACCEPTED_NOT_INTEGRATED
```

Record exact candidate commit/tree, test counts, reviewer verdict, zero active
packages, and all production exclusions.

- [ ] **Step 6: Commit acceptance evidence**

```bash
git add .harness/changes/fix-r0-w06-quiescent-closeout-20260726
git commit -m "docs(authority): record accepted W06 closeout"
```

Stop for explicit controlled-local-integration approval. Do not prepare
machine-readable W07 activation evidence until Event 1 has an accepted,
integrated local EXT base.
