import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cp, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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

async function runCliWithManifest(manifest, args = ['--status']) {
  const fixtureRoot = await mkdtemp(join(tmpdir(), 'ext-branch-convergence-'));
  try {
    await mkdir(join(fixtureRoot, 'scripts'));
    await mkdir(join(fixtureRoot, '.harness', 'manifest'), { recursive: true });
    await cp(new URL('ext-branch-convergence.mjs', import.meta.url), join(fixtureRoot, 'scripts', 'ext-branch-convergence.mjs'));
    await writeFile(
      join(fixtureRoot, '.harness', 'manifest', 'ext-branch-convergence.v1.json'),
      JSON.stringify(manifest),
      'utf8',
    );
    return spawnSync(process.execPath, ['scripts/ext-branch-convergence.mjs', ...args], {
      cwd: fixtureRoot,
      encoding: 'utf8',
    });
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
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

test('Git relation verifier rejects unreachable candidates and false duplicate containment', async () => {
  const { verifyConvergenceGitRelations } = await loadModule();
  const manifest = {
    assetFamilies: [{ id: 'EXAMPLE_FAMILY', canonicalDonor: 'task/example' }],
    branches: [
      validRecord({
        candidateCommits: ['deadbee', 'feed123'],
      }),
      validRecord({
        branch: 'task/example-rebased',
        tip: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        candidateCommits: [],
        disposition: 'DUPLICATE',
        canonicalDonor: false,
        containedBy: 'task/example',
        authorityPackage: null,
      }),
    ],
  };
  const errors = await verifyConvergenceGitRelations(manifest, {
    resolveCommit: async (commit) => (commit === 'deadbee' ? null : 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'),
    isAncestor: async () => false,
    isPatchEquivalent: async () => false,
  });

  assert.deepEqual(errors, [
    'candidate commit missing: task/example deadbee',
    'candidate commit is not reachable from source tip: task/example feed123',
    'duplicate relation unproved: task/example-rebased is neither contained by nor patch-equivalent to task/example',
  ]);
});

test('Git relation verifier accepts a rebased duplicate only with patch-equivalence proof', async () => {
  const { verifyConvergenceGitRelations } = await loadModule();
  const manifest = {
    assetFamilies: [{ id: 'EXAMPLE_FAMILY', canonicalDonor: 'task/example' }],
    branches: [
      validRecord(),
      validRecord({
        branch: 'task/example-rebased',
        tip: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        candidateCommits: [],
        disposition: 'DUPLICATE',
        canonicalDonor: false,
        containedBy: 'task/example',
        authorityPackage: null,
      }),
    ],
  };
  const errors = await verifyConvergenceGitRelations(manifest, {
    resolveCommit: async () => '1234567890abcdef1234567890abcdef12345678',
    isAncestor: async (ancestor) => ancestor === '1234567890abcdef1234567890abcdef12345678',
    isPatchEquivalent: async () => true,
  });

  assert.deepEqual(errors, []);
});

test('Git relation verifier requires a DUPLICATE to resolve directly to its asset family canonical donor', async () => {
  const { verifyConvergenceGitRelations } = await loadModule();
  const manifest = {
    assetFamilies: [{ id: 'EXAMPLE_FAMILY', canonicalDonor: 'task/example-canonical' }],
    branches: [
      validRecord({ branch: 'task/example-canonical' }),
      validRecord({
        branch: 'task/example-intermediate',
        canonicalDonor: false,
        containedBy: 'task/example-canonical',
      }),
      validRecord({
        branch: 'task/example-duplicate',
        canonicalDonor: false,
        disposition: 'DUPLICATE',
        containedBy: 'task/example-intermediate',
        authorityPackage: null,
      }),
    ],
  };
  const errors = await verifyConvergenceGitRelations(manifest, {
    resolveCommit: async () => '1234567890abcdef1234567890abcdef12345678',
    isAncestor: async () => true,
    isPatchEquivalent: async () => true,
  });

  assert.deepEqual(errors, [
    'duplicate relation must resolve directly to family canonical donor: task/example-duplicate containedBy task/example-intermediate expected task/example-canonical',
  ]);
});

test('CLI rejects every material schema-invalid manifest shape that the handwritten validator previously missed', async () => {
  const base = validManifest({
    snapshot: { ...validManifest().snapshot, sourceRefCount: 99 },
    branches: Array.from({ length: 99 }, (_, index) => validRecord({
      branch: `task/example-${index}`,
      canonicalDonor: index === 0,
    })),
  });
  base.assetFamilies[0].canonicalDonor = 'task/example-0';
  const cases = [
    ['unknown top-level field', ['manifest has an invalid field set'], (manifest) => ({ ...manifest, unexpected: true })],
    ['invalid calendar date-time', ['snapshot.capturedAt must be an ISO 8601 date-time'], (manifest) => ({
      ...manifest,
      snapshot: { ...manifest.snapshot, capturedAt: '2026-02-30T00:00:00+08:00' },
    })],
    ['invalid asset family id', ['assetFamilies[0].id must match ^[A-Z][A-Z0-9_]+$'], (manifest) => ({
      ...manifest,
      assetFamilies: [{ ...manifest.assetFamilies[0], id: 'invalid-family' }],
      branches: [{ ...manifest.branches[0], assetFamily: 'invalid-family' }],
    })],
    ['duplicate uniqueItems', [
      'branches[0].candidateCommits must contain unique entries',
      'branches[0].targetOwners must contain unique entries',
      'branches[0].targetFiles must contain unique entries',
      'branches[0].proofCommands must contain unique entries',
    ], (manifest) => ({
      ...manifest,
      branches: [{
        ...manifest.branches[0],
        candidateCommits: ['1234567890ab', '1234567890ab'],
        targetOwners: ['root', 'root'],
        targetFiles: ['scripts/example.mjs', 'scripts/example.mjs'],
        proofCommands: ['node --test scripts/example.nodetest.mjs', 'node --test scripts/example.nodetest.mjs'],
      }, ...manifest.branches.slice(1)],
    })],
    ['duplicate asset families', ['assetFamilies must contain unique entries'], (manifest) => ({
      ...manifest,
      assetFamilies: [{ ...manifest.assetFamilies[0] }, { ...manifest.assetFamilies[0] }],
    })],
    ['wrong nullable field types', [
      'assetFamilies[0].canonicalDonor must be a string or null',
      'branches[0].containedBy must be a string or null',
      'branches[0].authorityPackage must be a string or null',
      'branches[0].checkpoint must be a string or null',
      'branches[0].reviewReceipt must be a string or null',
      'branches[0].integrationCommit must be a 40-character lowercase commit hash or null',
      'branches[0].blockedReason must be a string or null',
    ], (manifest) => ({
      ...manifest,
      assetFamilies: [{ ...manifest.assetFamilies[0], canonicalDonor: 1 }],
      branches: [{
        ...manifest.branches[0],
        containedBy: false,
        authorityPackage: 1,
        checkpoint: false,
        reviewReceipt: false,
        integrationCommit: false,
        blockedReason: false,
      }],
    })],
    ['empty required arrays', ['assetFamilies must contain at least one entry', 'branches must contain exactly 99 entries'], (manifest) => ({
      ...manifest,
      assetFamilies: [],
      branches: [],
      snapshot: { ...manifest.snapshot, sourceRefCount: 0 },
    })],
  ];

  for (const [name, expectedErrors, mutate] of cases) {
    const result = await runCliWithManifest(mutate(base));
    assert.equal(result.status, 1, `${name}: ${result.stderr || result.stdout}`);
    const output = JSON.parse(result.stdout);
    assert.equal(output.decision, 'FAIL', name);
    for (const expectedError of expectedErrors) {
      assert.ok(output.errors.includes(expectedError), `${name}: ${JSON.stringify(output.errors)}`);
    }
  }
});

test('CLI projects malformed manifest containers as structured validation failures before any projection', async () => {
  const cases = [
    ['branches:null', (manifest) => ({ ...manifest, branches: null })],
    ['assetFamilies:{}', (manifest) => ({ ...manifest, assetFamilies: {} })],
  ];
  const modes = [
    ['--check'],
    ['--status'],
    ['--family', 'EXAMPLE_FAMILY'],
    ['--family', 'NOT_A_FAMILY'],
  ];

  for (const [shape, mutate] of cases) {
    for (const args of modes) {
      const result = await runCliWithManifest(mutate(validManifest()), args);
      assert.equal(result.status, 1, `${shape} ${args.join(' ')}: ${result.stderr || result.stdout}`);
      assert.equal(result.stderr, '', `${shape} ${args.join(' ')} must not throw to stderr`);
      const output = JSON.parse(result.stdout);
      assert.equal(output.decision, 'FAIL', `${shape} ${args.join(' ')}`);
      assert.ok(Array.isArray(output.errors), `${shape} ${args.join(' ')} must include validation errors`);
      assert.ok(output.errors.length > 0, `${shape} ${args.join(' ')} must have validation errors`);
      assert.notEqual(output.decision, 'NOT_FOUND', `${shape} ${args.join(' ')} must not conceal invalid state as NOT_FOUND`);
    }
  }
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
