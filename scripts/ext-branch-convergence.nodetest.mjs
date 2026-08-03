import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const root = new URL('../', import.meta.url);

const EXPECTED_SOURCE_REFS = Object.freeze([
  'agent/task-cp-wt-01-bootstrap-v2-20260721',
  'archive/integration-full-court-v1-pre-2a92646',
  'archive/p0-absorption-baseline-pre-2a92646',
  'archive/p1-dept-id-ssot-pre-f9b3e88',
  'archive/review-p19-ext-nogo-v1-20260719',
  'archive/review-p19-ext-nogo-v2-20260719',
  'archive/review-p20-d6-legacy-20260719',
  'candidate/p14-p8-p9-frontend-residual-cleanup',
  'candidate/p19-ext-nogo-evidence-cleanup',
  'chore/packet-skill-lifecycle-20260721',
  'codex/harness-only-worktree',
  'codex/integration-companion-phase1a-20260801',
  'codex/local-companion-phase-1a-clean-20260801',
  'codex/local-companion-phase-1a-plan-20260801',
  'codex/local-companion-phase1b-20260803',
  'codex/professional-agent-k0-20260803',
  'codex/professional-agent-k1a-20260803',
  'codex/professional-agent-overlay-clean',
  'codex/professional-agent-overlay-sdd-20260729',
  'dev-ext-test',
  'docs/deep-module-projection-design-20260726',
  'docs/ext-historical-asset-graph-freeze-20260731',
  'docs/ha-aos-master-graph-20260731',
  'docs/p0-p15-authority-reconciliation-20260719',
  'docs/professional-agent-ten-samples-20260803',
  'docs/r0-master-prd-v2-graph-engineering-20260731',
  'docs/r0-trusted-kernel-amendment-20260720',
  'docs/r0-w01-closeout-20260721',
  'docs/r0-w07-p0f-current-base-adaptation-20260727',
  'docs/r0-w07-p0f-scheme-a-design-20260726',
  'docs/r0-w08-graph-m0-contract-20260731',
  'docs/super-task-delivery-design-20260718',
  'docs/temporal-decision-intelligence-design-20260727',
  'feature-chaotang-release',
  'fix/r0-a-playwright-routes-20260725',
  'fix/r0-a-signal-date-20260725',
  'governance/harness-selective-adoption-20260722',
  'governance/r0-dev-ext-chain-absorption-01',
  'governance/r0-p1-integration-amendment-20260724',
  'governance/r0-w04-closeout-canonical-20260723',
  'governance/r0-w06-activation-packet-b522ee37',
  'governance/r0-w06-artifacts-20260724',
  'governance/r0-w06-authority-recovery-8feae838',
  'governance/r0-w06-codex-20260724',
  'governance/r0-w06-codex-8feae838',
  'governance/r0-w06-gate-c-atomic-fa70efcd',
  'governance/r0-w06-gate-c-design-fa70efcd',
  'governance/r0-w06-gate-c-r2-attested-fa70efcd',
  'governance/r0-w06-gate-e-p0-spec-repair-2-313599b4',
  'governance/r0-w06-gate-e-p0-spec-repair-3-313599b4',
  'governance/r0-w06-gate-e-p0-spec-repair-4-313599b4',
  'governance/r0-w06-gate-e-preconditions-design-981f3940',
  'governance/r0-w06-gate-e-preconditions-packet-313599b4',
  'governance/r0-w06-merge-20260725',
  'governance/r0-w06-merge-8feae838',
  'governance/r0-w06-p26-integration-20260725',
  'governance/r0-w06-postmerge-remediation-20260725',
  'governance/r0-w06-review-handoff-repair-3281db96',
  'governance/r0-w06-successor-evidence-20260802',
  'governance/r0-w07-constitutional-recovery-corpus-20260727',
  'governance/r0-w07-exact-h-activation-20260726',
  'governance/r0-w07-exact-h-activation-v2-20260726',
  'integration/ext-court-loop-contracts-20260719',
  'integration/hubu-accounting-agents-to-ext-20260730',
  'integration/r0-task8-on-feature-20260725',
  'review/p3-chaotang-clean',
  'task/backend-runtime-wiring-r1',
  'task/branch-governance-convergence-20260720',
  'task/census-cen-revision',
  'task/ext-a9-e1-p1-remediation-20260730',
  'task/ext-w06r-artifact-delivery-20260725',
  'task/fix-ext-nogo-evidence-cleanup-20260719',
  'task/fix-gongbu-component-scope-p18-20260719',
  'task/fix-gongbu-component-scope-p18-v4-latest-20260719',
  'task/fix-gongbu-component-scope-p18-v4-rebased-20260719',
  'task/fix-menxia-veto-enforcement-p16-20260719',
  'task/fix-p0-p15-execution-authority-reconciliation-next-20260719',
  'task/p5-1-alembic-review-hardening',
  'task/p5-alembic-single-authority',
  'task/p6-test-isolation-fix',
  'task/p8-guoli-strip',
  'task/p9-hanlin-remnant',
  'task/pkt-a2-hubu-fact-card',
  'task/r0-anti-hallucination-01-20260720',
  'task/r0-w05-task8-e2e-20260724',
  'task/r0-w08-full-loop-remediation-20260730',
  'task/r0-w08-full-loop-remediation-v2-20260730',
  'task/r0-w08-full-loop-remediation-v3-20260730',
  'task/r0-w08-full-loop-remediation-v4-20260730',
  'task/r0-w08-full-loop-remediation-v5-20260730',
  'task/r0-w08-full-loop-remediation-v6-20260730',
  'task/r0-w08-full-loop-remediation-v7-20260730',
  'task/r0-w08-full-loop-remediation-v8-20260730',
  'task/r0-w08-full-loop-remediation-v9-20260730',
  'task/resource-census-p0',
  'wip/canon-court-01a-red-20260719',
  'wip/six-capability-absorption-governance-20260719',
  'wip/six-capability-canon-docs-20260719',
  'work/canon-idempotency-01-spec-20260719',
]);

async function readJson(relativePath) {
  return JSON.parse(await readFile(new URL(relativePath, root), 'utf8'));
}

function digest(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

async function loadModule() {
  return import('./ext-branch-convergence.mjs');
}

function validRecord(overrides = {}) {
  return {
    branch: 'task/example',
    tip: '1234567890abcdef1234567890abcdef12345678',
    assetFamily: 'EXAMPLE_FAMILY',
    candidateCommits: ['1234567890ab'],
    disposition: 'ABSORB_ADAPT',
    canonicalDonor: true,
    containedBy: null,
    authorityPackage: 'R0-W08',
    targetOwners: ['root'],
    targetFiles: ['scripts/example.mjs'],
    proofCommands: ['node --test scripts/example.nodetest.mjs'],
    status: 'PLANNED',
    checkpoint: null,
    reviewReceipt: null,
    integrationCommit: null,
    blockedReason: null,
    ...overrides,
  };
}

function validManifest(overrides = {}) {
  return {
    schemaVersion: 'ext-branch-convergence.v1',
    snapshot: {
      capturedAt: '2026-08-03T00:00:00+08:00',
      integrationTarget: 'feature-chaotang-ext',
      integrationHead: 'b78a4f8f4ea84d01de5255cbc1c4e566b2f8932f',
      integrationTree: '615ac60452170c891f023c5d845472e327c6bebe',
      sourceRefCount: 1,
      inventoryRule: 'LOCAL_BRANCH_NOT_ANCESTOR_OF_INTEGRATION_TARGET_AT_CAPTURE',
      authorityPackage: 'R0-W08',
      plan: 'docs/superpowers/plans/2026-08-03-ext-99-branch-capability-convergence.md',
    },
    assetFamilies: [
      {
        id: 'EXAMPLE_FAMILY',
        title: 'Example',
        canonicalDonor: 'task/example',
        decision: 'ABSORB_ADAPT',
        status: 'PLANNED',
      },
    ],
    branches: [validRecord()],
    ...overrides,
  };
}

test('project harness registers the read-only 99-ref convergence control plane', async () => {
  const project = await readJson('.harness/manifest/project-harness.json');
  const registration = project.extBranchConvergence;

  assert.equal(registration.status, 'DRAFT_OBSERVE_ONLY');
  assert.equal(registration.sourceRefCount, 99);
  assert.equal(registration.manifest, '.harness/manifest/ext-branch-convergence.v1.json');
  assert.equal(registration.contract, '.harness/contracts/ext-branch-convergence.schema.json');
  assert.equal(registration.command, 'scripts/ext-branch-convergence.mjs');
  assert.equal(registration.documentation, '.harness/wiki/ext-branch-capability-convergence.md');
  assert.ok(registration.verification.includes('node --test scripts/ext-branch-convergence.nodetest.mjs'));
  for (const path of [registration.manifest, registration.contract, registration.command, registration.documentation]) {
    await readFile(new URL(path, root));
  }
});

test('schema freezes the allowed dispositions, statuses and exact branch record shape', async () => {
  const schema = await readJson('.harness/contracts/ext-branch-convergence.schema.json');
  const record = schema.$defs.branchRecord;

  assert.equal(schema.properties.schemaVersion.const, 'ext-branch-convergence.v1');
  assert.deepEqual(record.properties.disposition.enum, [
    'ABSORB_ADAPT',
    'REBUILD',
    'SUPERSEDED_VERIFY',
    'ARCHIVE',
    'REJECT',
    'DUPLICATE',
    'BLOCKED_WIP',
  ]);
  assert.deepEqual(record.properties.status.enum, [
    'PLANNED',
    'BASELINED',
    'RED',
    'IMPLEMENTED',
    'VERIFIED',
    'REVIEW_GO',
    'INTEGRATED_LOCAL',
    'BLOCKED',
    'CLOSED',
  ]);
  assert.deepEqual([...record.required].sort(), Object.keys(validRecord()).sort());
  assert.equal(record.additionalProperties, false);
});

test('manifest freezes exactly the 99 audited source refs with one record each', async () => {
  const manifest = await readJson('.harness/manifest/ext-branch-convergence.v1.json');
  const actual = manifest.branches.map((entry) => entry.branch).sort();

  assert.equal(manifest.snapshot.sourceRefCount, 99);
  assert.equal(manifest.branches.length, 99);
  assert.deepEqual(actual, [...EXPECTED_SOURCE_REFS].sort());
  assert.equal(new Set(actual).size, 99);
  assert.ok(!actual.includes('task/ext-99-branch-ledger-20260803'));
});

test('validator rejects duplicates, unknown values, missing tips, unbound implementation and unproved closure', async () => {
  const { validateConvergenceManifest } = await loadModule();
  const duplicate = validRecord({ branch: 'task/example-copy', canonicalDonor: true });
  const manifest = validManifest({
    snapshot: { ...validManifest().snapshot, sourceRefCount: 2 },
    branches: [
      validRecord({ tip: '', disposition: 'UNKNOWN', authorityPackage: null, status: 'CLOSED' }),
      duplicate,
    ],
  });
  const errors = validateConvergenceManifest(manifest);

  assert.ok(errors.includes('branches[0].tip must be a 40-character lowercase commit hash'));
  assert.ok(errors.includes('branches[0].disposition is not allowed: UNKNOWN'));
  assert.ok(errors.includes('branches[0] CLOSED requires checkpoint proof'));
  assert.ok(errors.includes('asset family EXAMPLE_FAMILY must have exactly one canonical donor; found 2'));
});

test('validator rejects duplicate branch names and missing authority on an implementation disposition', async () => {
  const { validateConvergenceManifest } = await loadModule();
  const manifest = validManifest({
    snapshot: { ...validManifest().snapshot, sourceRefCount: 2 },
    branches: [
      validRecord({ canonicalDonor: true }),
      validRecord({ canonicalDonor: false, authorityPackage: null }),
    ],
  });
  const errors = validateConvergenceManifest(manifest);

  assert.ok(errors.includes('duplicate branch: task/example'));
  assert.ok(errors.includes('branches[1] ABSORB_ADAPT requires authorityPackage'));
});

test('validator enforces schema-level snapshot, commit, owner and proof field constraints', async () => {
  const { validateConvergenceManifest } = await loadModule();
  const manifest = validManifest({
    snapshot: {
      ...validManifest().snapshot,
      capturedAt: 'not-a-date',
      inventoryRule: 'UNTRUSTED_RULE',
      unexpected: true,
    },
    branches: [validRecord({
      candidateCommits: ['xyz'],
      targetOwners: ['emperor'],
      targetFiles: [''],
      proofCommands: [''],
    })],
  });
  const errors = validateConvergenceManifest(manifest);

  assert.ok(errors.includes('snapshot has an invalid field set'));
  assert.ok(errors.includes('snapshot.capturedAt must be an ISO 8601 date-time'));
  assert.ok(errors.includes('snapshot.inventoryRule must freeze non-ancestor local branches'));
  assert.ok(errors.includes('branches[0].candidateCommits[0] must be a 7-40 character lowercase commit hash'));
  assert.ok(errors.includes('branches[0].targetOwners[0] is not allowed: emperor'));
  assert.ok(errors.includes('branches[0].targetFiles[0] must be a non-empty string'));
  assert.ok(errors.includes('branches[0].proofCommands[0] must be a non-empty string'));
});

test('repository verifier detects a moved or missing frozen source ref without changing Git', async () => {
  const { verifyConvergenceRefs } = await loadModule();
  const manifest = validManifest();
  const moved = await verifyConvergenceRefs(manifest, {
    resolveRef: async () => 'ffffffffffffffffffffffffffffffffffffffff',
  });
  const missing = await verifyConvergenceRefs(manifest, {
    resolveRef: async () => null,
  });

  assert.deepEqual(moved, [
    'source ref moved: task/example expected 1234567890abcdef1234567890abcdef12345678 got ffffffffffffffffffffffffffffffffffffffff',
  ]);
  assert.deepEqual(missing, ['source ref missing: task/example']);
});

test('status and family projections are deterministic and do not mutate the manifest', async () => {
  const { selectConvergenceFamily, summarizeConvergence } = await loadModule();
  const manifestText = await readFile(new URL('.harness/manifest/ext-branch-convergence.v1.json', root), 'utf8');
  const manifest = JSON.parse(manifestText);
  const before = digest(manifestText);
  const summary = summarizeConvergence(manifest);
  const selected = selectConvergenceFamily(manifest, 'W08_FULL_CONTRACT_LOOP');
  const after = digest(await readFile(new URL('.harness/manifest/ext-branch-convergence.v1.json', root), 'utf8'));

  assert.equal(summary.sourceRefCount, 99);
  assert.equal(summary.closedRefCount, 0);
  assert.equal(summary.openRefCount, 99);
  assert.ok(summary.familyCount > 1);
  assert.equal(selected.family.id, 'W08_FULL_CONTRACT_LOOP');
  assert.equal(selected.branches.length, 9);
  assert.equal(selected.branches.filter((entry) => entry.canonicalDonor).length, 1);
  assert.equal(before, after);
});

test('CLI check, status and family modes return JSON and keep the manifest read-only', async () => {
  const manifestUrl = new URL('.harness/manifest/ext-branch-convergence.v1.json', root);
  const before = digest(await readFile(manifestUrl, 'utf8'));
  const run = (args) => spawnSync(process.execPath, ['scripts/ext-branch-convergence.mjs', ...args], {
    cwd: new URL('.', root),
    encoding: 'utf8',
  });

  const check = run(['--check']);
  const status = run(['--status']);
  const family = run(['--family', 'W08_FULL_CONTRACT_LOOP']);
  const after = digest(await readFile(manifestUrl, 'utf8'));

  assert.equal(check.status, 0, check.stderr || check.stdout);
  assert.equal(JSON.parse(check.stdout).decision, 'PASS');
  assert.equal(status.status, 0, status.stderr || status.stdout);
  assert.equal(JSON.parse(status.stdout).summary.sourceRefCount, 99);
  assert.equal(family.status, 0, family.stderr || family.stdout);
  assert.equal(JSON.parse(family.stdout).branches.length, 9);
  assert.equal(before, after);
});

test('CLI rejects invalid arguments and unknown families without writing state', () => {
  const invalid = spawnSync(process.execPath, ['scripts/ext-branch-convergence.mjs', '--write'], {
    cwd: new URL('.', root),
    encoding: 'utf8',
  });
  const unknown = spawnSync(process.execPath, ['scripts/ext-branch-convergence.mjs', '--family', 'NOT_A_FAMILY'], {
    cwd: new URL('.', root),
    encoding: 'utf8',
  });

  assert.equal(invalid.status, 64);
  assert.match(invalid.stderr, /Usage:/);
  assert.equal(unknown.status, 2);
  assert.equal(JSON.parse(unknown.stdout).decision, 'NOT_FOUND');
});
