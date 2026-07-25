import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import test from 'node:test';

import {
  EXECUTION_AUTHORITY_V2_PATH,
  EXECUTION_AUTHORITY_V2_SCHEMA_PATH,
  EXPECTED_EXECUTION_AUTHORITY_V2_REGISTRATION,
  executionAuthorityV2CommandResult,
  loadExecutionAuthorityV2,
  parseExecutionAuthorityV2Evidence,
  parseJsonObjectWithUniqueKeys,
  readPinnedAuthorityFile,
  resolveExecutionAuthorityV2,
  sha256Hex,
  validateExecutionAuthorityV2Evidence,
  validateExecutionAuthorityV2,
  validateExecutionAuthorityV2Manifest,
  validateExecutionAuthorityV2Schema,
} from './lib/execution-authority-v2.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const cliPath = join(root, 'scripts/execution-authority-v2.mjs');
const execFileAsync = promisify(execFile);

function validManifest() {
  return {
    schemaVersion: 'execution-authority.v2',
    authorityId: 'r0-execution-authority-20260721-v2',
    amendment: {
      id: 'R0-TRUSTED-KERNEL-AMENDMENT-01',
      path: '.harness/changes/docs-r0-trusted-kernel-amendment-20260720/amendment.md',
      approvedSourceDigest:
        '2ba59cbe4d4032d8f372d1dd757e03edb78038b38de6d657380f357100a83e38',
    },
    effectiveBase: {
      ref: 'origin/feature-chaotang-ext',
      sha: '5e432ea45796738902fcd74948a34918e781bda7',
    },
    approvalEvidence: {
      ownerApprovalPath:
        '.harness/changes/docs-r0-w01-amendment-repin-20260721-20260721/owner_approval/exact-h-approval.md',
      ownerApprovalSha256:
        '7016c61934dd81f62b7fb69667214c77b16c78674a091529f149385cf790606b',
      reviewPath:
        '.harness/changes/docs-r0-w01-amendment-repin-20260721-20260721/claude_code_review/exact-h-final.md',
      reviewSha256: 'ecca3dcafef5fad5ce609acbfaeb75d18719e95690ff8ee9343e0906b24c606e',
      reviewVerdict: 'GO',
      approver: 'lyt',
      candidateH: '5e432ea45796738902fcd74948a34918e781bda7',
      tree: '50f0b0c852fccdd6a3119cbffd180ea65ed78df6',
      approvedScope: ['R0-W01'],
    },
    activeWorkPackage: 'R0-W01',
    workPackageLedger: [
      { id: 'R0-W00', status: 'MERGED_AND_VERIFIED' },
      { id: 'R0-W01', status: 'ACTIVE' },
    ],
    professionalReassignment: {
      requiredBefore: ['REAL_CUSTOMER_DATA', 'R0-W08', 'R0-W09'],
      rolesRequired: ['security', 'legal', 'release'],
      assignments: { security: 'lyt', legal: 'lyt', release: 'lyt' },
      defaultOwner: 'lyt',
    },
  };
}

function validGovernance() {
  return {
    status: 'APPROVED_FOR_W01',
    approvedSourceDigest: '2ba59cbe4d4032d8f372d1dd757e03edb78038b38de6d657380f357100a83e38',
    candidateSourceDigest: '2ba59cbe4d4032d8f372d1dd757e03edb78038b38de6d657380f357100a83e38',
    effectiveBase: {
      ref: 'origin/feature-chaotang-ext',
      sha: 'ccc2d74a2e439830e9c6ae7adcefb5ee8c05c150',
    },
  };
}

function w06ActivationManifest() {
  const manifest = validManifest();
  return {
    ...manifest,
    effectiveBase: {
      ref: 'origin/feature-chaotang-ext',
      sha: '8feae838f09ad5202b21332d4280b989ab776bd7',
    },
    approvalEvidence: {
      ownerApprovalPath:
        '.harness/changes/fix-ext-g0-authority-recovery-20260725/owner_approval/exact-h-approval.md',
      ownerApprovalSha256: 'a'.repeat(64),
      reviewPath:
        '.harness/changes/fix-ext-g0-authority-recovery-20260725/claude_code_review/exact-h-final.md',
      reviewSha256: 'b'.repeat(64),
      reviewVerdict: 'GO',
      approver: 'lyt',
      candidateH: '8feae838f09ad5202b21332d4280b989ab776bd7',
      tree: '9d63f98041e5e13174dbba4c0b9d27eef1471bf9',
      approvedScope: ['R0-W06'],
    },
    activeWorkPackage: 'R0-W06',
    workPackageLedger: [
      { id: 'R0-W00', status: 'MERGED_AND_VERIFIED' },
      { id: 'R0-W01', status: 'MERGED_AND_VERIFIED' },
      { id: 'R0-W02', status: 'MERGED_AND_VERIFIED' },
      { id: 'R0-W03', status: 'MERGED_AND_VERIFIED' },
      { id: 'R0-W04', status: 'MERGED_AND_VERIFIED' },
      { id: 'R0-W05', status: 'MERGED_AND_VERIFIED' },
      { id: 'R0-W06', status: 'ACTIVE' },
    ],
  };
}

function evidenceDocument(value) {
  return [
    '# Evidence',
    '',
    '<!-- execution-authority-v2-evidence:start -->',
    '```json',
    JSON.stringify(value, null, 2),
    '```',
    '<!-- execution-authority-v2-evidence:end -->',
    '',
  ].join('\n');
}

function w06EvidenceDocuments() {
  const manifest = w06ActivationManifest();
  const owner = {
    evidenceVersion: 'execution-authority-v2-evidence.v1',
    kind: 'owner-approval',
    decision: 'APPROVED',
    approver: 'lyt',
    workPackage: 'R0-W06',
    effectiveBase: manifest.effectiveBase,
    candidateH: manifest.approvalEvidence.candidateH,
    tree: manifest.approvalEvidence.tree,
    approvedScope: ['R0-W06'],
    exclusions: [
      'NO_DEPLOYMENT',
      'NO_REAL_CUSTOMER_DATA',
      'NO_DB_MIGRATION',
      'NO_LISTENER_3050_TAKEOVER',
      'NO_R0_W07_TO_R0_W09',
      'NO_AUTOMATIC_MERGE',
      'NO_PRODUCTION_CLAIM',
    ],
    proposedActivationPath:
      '.harness/changes/fix-ext-g0-authority-recovery-20260725/proposed_activation/r0-w06-activation.json',
    proposedActivationSha256: 'c'.repeat(64),
  };
  const review = {
    evidenceVersion: 'execution-authority-v2-evidence.v1',
    kind: 'independent-review',
    verdict: 'GO',
    reviewer: 'Claude Code',
    workPackage: 'R0-W06',
    effectiveBase: manifest.effectiveBase,
    candidateH: manifest.approvalEvidence.candidateH,
    tree: manifest.approvalEvidence.tree,
    approvedScope: ['R0-W06'],
    ownerApprovalPath: manifest.approvalEvidence.ownerApprovalPath,
    ownerApprovalSha256: manifest.approvalEvidence.ownerApprovalSha256,
    proposedActivationPath: owner.proposedActivationPath,
    proposedActivationSha256: owner.proposedActivationSha256,
    diffSha256: 'd'.repeat(64),
    changedPaths: [
      '.harness/changes/fix-ext-g0-authority-recovery-20260725/',
      'scripts/lib/execution-authority-v2.mjs',
      'scripts/execution-authority-v2.nodetest.mjs',
    ],
    commands: ['node --test scripts/execution-authority-v2.nodetest.mjs'],
    productionReady: false,
  };
  return { manifest, owner, review };
}

test('matching W06 machine-readable owner and review evidence permits the exact active package', () => {
  const { manifest, owner, review } = w06EvidenceDocuments();
  const parsedOwner = parseExecutionAuthorityV2Evidence(evidenceDocument(owner), 'owner approval');
  const parsedReview = parseExecutionAuthorityV2Evidence(evidenceDocument(review), 'independent review');
  assert.deepEqual(validateExecutionAuthorityV2Evidence(manifest, parsedOwner, parsedReview), []);
  const loaded = {
    manifest,
    amendmentGovernance: validGovernance(),
    errors: validateExecutionAuthorityV2Evidence(manifest, parsedOwner, parsedReview),
  };
  assert.equal(
    executionAuthorityV2CommandResult(loaded, '--authorize', [], { workPackage: 'R0-W06' }).exitCode,
    0,
  );
});

for (const {
  name,
  mutate,
  expectedError,
} of [
  {
    name: 'old-package review reuse',
    mutate: ({ review }) => {
      review.workPackage = 'R0-W05';
      review.approvedScope = ['R0-W05'];
    },
    expectedError: 'review workPackage must match activeWorkPackage',
  },
  {
    name: 'negative owner decision',
    mutate: ({ owner }) => {
      owner.decision = 'DECLINED';
    },
    expectedError: 'owner decision must be APPROVED',
  },
  {
    name: 'candidate and tree mismatch',
    mutate: ({ review }) => {
      review.candidateH = '1'.repeat(40);
      review.tree = '2'.repeat(40);
    },
    expectedError: 'review candidateH must match manifest approvalEvidence.candidateH',
  },
  {
    name: 'owner digest mismatch',
    mutate: ({ review }) => {
      review.ownerApprovalSha256 = 'e'.repeat(64);
    },
    expectedError: 'review ownerApprovalSha256 must match manifest approvalEvidence.ownerApprovalSha256',
  },
  {
    name: 'review verdict mismatch',
    mutate: ({ review }) => {
      review.verdict = 'NO_GO';
    },
    expectedError: 'review verdict must match manifest approvalEvidence.reviewVerdict',
  },
  {
    name: 'non-string review changed path',
    mutate: ({ review }) => {
      review.changedPaths = [42];
    },
    expectedError: 'review changedPaths must be a non-empty list of safe repository paths',
  },
]) {
  test(`${name} evidence fails closed and cannot produce GO`, () => {
    const fixture = w06EvidenceDocuments();
    mutate(fixture);
    const parsedOwner = parseExecutionAuthorityV2Evidence(
      evidenceDocument(fixture.owner),
      'owner approval',
    );
    const parsedReview = parseExecutionAuthorityV2Evidence(
      evidenceDocument(fixture.review),
      'independent review',
    );
    const errors = validateExecutionAuthorityV2Evidence(
      fixture.manifest,
      parsedOwner,
      parsedReview,
    );
    assert.ok(errors.some((error) => error.includes(expectedError)), errors.join('\n'));
    const result = executionAuthorityV2CommandResult(
      { manifest: fixture.manifest, amendmentGovernance: validGovernance(), errors },
      '--authorize',
      [],
      { workPackage: 'R0-W06' },
    );
    assert.equal(result.exitCode, 1);
    assert.equal(result.output.reason, 'INVALID_EXECUTION_AUTHORITY');
  });
}

test('valid W01 manifest resolves to GO for exactly the active work package', () => {
  assert.deepEqual(
    resolveExecutionAuthorityV2(validManifest(), validGovernance(), { workPackage: 'R0-W01' }),
    {
      schemaVersion: 'execution-authority.v2',
      decision: 'GO',
      activeWorkPackage: 'R0-W01',
      reason: 'APPROVED_WORK_PACKAGE',
    },
  );
});

test('malformed approvedSourceDigest is a structural error', () => {
  const manifest = { ...validManifest(), amendment: { ...validManifest().amendment, approvedSourceDigest: 'not-hex' } };
  assert.equal(
    resolveExecutionAuthorityV2(manifest, validGovernance(), { workPackage: 'R0-W01' }).reason,
    'INVALID_EXECUTION_AUTHORITY',
  );
});

test('well-formed but mismatched approvedSourceDigest stops on digest drift', () => {
  const governance = { ...validGovernance(), approvedSourceDigest: 'a'.repeat(64) };
  assert.equal(
    resolveExecutionAuthorityV2(validManifest(), governance, { workPackage: 'R0-W01' }).reason,
    'AMENDMENT_DIGEST_DRIFT',
  );
});

test('effective base mismatch stops the resolver when it drifts from the approved candidate', () => {
  const manifest = {
    ...validManifest(),
    effectiveBase: { ref: 'origin/feature-chaotang-ext', sha: 'b'.repeat(40) },
  };
  assert.equal(
    resolveExecutionAuthorityV2(manifest, validGovernance(), { workPackage: 'R0-W01' }).reason,
    'EFFECTIVE_BASE_MISMATCH',
  );
});

test('two ACTIVE ledger entries is rejected before resolution', () => {
  const manifest = {
    ...validManifest(),
    workPackageLedger: [
      { id: 'R0-W00', status: 'ACTIVE' },
      { id: 'R0-W01', status: 'ACTIVE' },
    ],
  };
  const errors = validateExecutionAuthorityV2Manifest(manifest);
  assert.ok(errors.some((message) => message.includes('two ACTIVE entries')));
  assert.equal(
    resolveExecutionAuthorityV2(manifest, validGovernance(), { workPackage: 'R0-W01' }).reason,
    'INVALID_EXECUTION_AUTHORITY',
  );
});

test('activeWorkPackage drifting from the ledger ACTIVE entry is a structural error', () => {
  const manifest = { ...validManifest(), activeWorkPackage: 'R0-W02' };
  assert.ok(
    validateExecutionAuthorityV2Manifest(manifest).some((message) =>
      message.includes('does not match the ledger ACTIVE entry'),
    ),
  );
});

for (const badId of ['P12', 'PKT-04', 'S3']) {
  test(`legacy work package id ${badId} is rejected by format`, () => {
    assert.equal(
      resolveExecutionAuthorityV2(validManifest(), validGovernance(), { workPackage: badId })
        .reason,
      'UNKNOWN_WORK_PACKAGE_FORMAT',
    );
  });
}

test('requesting a successor package before its predecessor merges is blocked', () => {
  assert.equal(
    resolveExecutionAuthorityV2(validManifest(), validGovernance(), { workPackage: 'R0-W02' })
      .reason,
    'BLOCKED_DEPENDENCY',
  );
});

test('W01 itself is blocked if W00 is not yet MERGED_AND_VERIFIED', () => {
  const manifest = {
    ...validManifest(),
    workPackageLedger: [
      { id: 'R0-W00', status: 'ACTIVE' },
      { id: 'R0-W01', status: 'NOT_STARTED' },
    ],
    activeWorkPackage: 'R0-W00',
    approvalEvidence: { ...validManifest().approvalEvidence, approvedScope: ['R0-W00'] },
  };
  assert.equal(
    resolveExecutionAuthorityV2(manifest, validGovernance(), { workPackage: 'R0-W01' }).reason,
    'BLOCKED_DEPENDENCY',
  );
});

test('professional reassignment gate fails closed for W08/W09 and real customer data while roles are default', () => {
  const manifest = {
    ...validManifest(),
    activeWorkPackage: 'R0-W08',
    workPackageLedger: [
      { id: 'R0-W00', status: 'MERGED_AND_VERIFIED' },
      { id: 'R0-W01', status: 'MERGED_AND_VERIFIED' },
      { id: 'R0-W02', status: 'MERGED_AND_VERIFIED' },
      { id: 'R0-W03', status: 'MERGED_AND_VERIFIED' },
      { id: 'R0-W04', status: 'MERGED_AND_VERIFIED' },
      { id: 'R0-W05', status: 'MERGED_AND_VERIFIED' },
      { id: 'R0-W06', status: 'MERGED_AND_VERIFIED' },
      { id: 'R0-W07', status: 'MERGED_AND_VERIFIED' },
      { id: 'R0-W08', status: 'ACTIVE' },
    ],
    approvalEvidence: { ...validManifest().approvalEvidence, approvedScope: ['R0-W08'] },
  };
  assert.equal(
    resolveExecutionAuthorityV2(manifest, validGovernance(), { workPackage: 'R0-W08' }).reason,
    'PROFESSIONAL_REASSIGNMENT_REQUIRED',
  );
  assert.equal(
    resolveExecutionAuthorityV2(validManifest(), validGovernance(), {
      workPackage: 'R0-W01',
      realCustomerData: true,
    }).reason,
    'PROFESSIONAL_REASSIGNMENT_REQUIRED',
  );
  // Deliberately no positive fixture for this branch: no reassignment has happened in the
  // real repo yet, so this gate cannot be exercised as GO today. That is the intended
  // fail-closed default, not a coverage gap.
});

test('review verdict other than GO stops the resolver', () => {
  const manifest = {
    ...validManifest(),
    approvalEvidence: { ...validManifest().approvalEvidence, reviewVerdict: 'STOP' },
  };
  const errors = validateExecutionAuthorityV2Manifest(manifest);
  assert.ok(errors.some((message) => message.includes('reviewVerdict must be GO')));
});

test('approvedScope with more than one work package is rejected structurally', () => {
  const manifest = {
    ...validManifest(),
    approvalEvidence: {
      ...validManifest().approvalEvidence,
      approvedScope: ['R0-W01', 'R0-W02'],
    },
  };
  assert.ok(
    validateExecutionAuthorityV2Manifest(manifest).some((message) =>
      message.includes('approvedScope must contain exactly one work package id'),
    ),
  );
});

test('unknown top-level field is rejected by the closed schema', () => {
  const manifest = { ...validManifest(), extraField: true };
  assert.ok(
    validateExecutionAuthorityV2Manifest(manifest)[0].includes('unsupported top-level fields'),
  );
});

test('rollback state (no active package) resolves to STOP with a guard present, not an exception', () => {
  const manifest = {
    ...validManifest(),
    activeWorkPackage: null,
    workPackageLedger: [
      { id: 'R0-W00', status: 'MERGED_AND_VERIFIED' },
      { id: 'R0-W01', status: 'ROLLED_BACK' },
    ],
  };
  assert.deepEqual(validateExecutionAuthorityV2Manifest(manifest), []);
  assert.equal(
    resolveExecutionAuthorityV2(manifest, validGovernance(), { workPackage: 'R0-W01' }).reason,
    'NO_ACTIVE_WORK_PACKAGE',
  );
});

test('a merged-and-verified packet can enter quiescent closeout without auto-activating its successor', () => {
  // "packet completed" must never imply "next packet approved" — closeout and next-packet
  // approval are two separate, separately-evidenced governance events (amendment §10).
  const manifest = {
    ...validManifest(),
    activeWorkPackage: null,
    workPackageLedger: [
      { id: 'R0-W00', status: 'MERGED_AND_VERIFIED' },
      { id: 'R0-W01', status: 'MERGED_AND_VERIFIED' },
    ],
  };
  assert.deepEqual(validateExecutionAuthorityV2Manifest(manifest), []);
  for (const workPackage of ['R0-W01', 'R0-W02']) {
    assert.equal(
      resolveExecutionAuthorityV2(manifest, validGovernance(), { workPackage }).reason,
      'NO_ACTIVE_WORK_PACKAGE',
    );
  }
});

test('missing manifest file produces loader errors, never a silently skipped guard', async () => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), 'chaotang-v2-missing-'));
  try {
    const loaded = await loadExecutionAuthorityV2(temporaryRoot);
    assert.equal(loaded.manifest, null);
    assert.ok(loaded.errors.length > 0);
    const result = executionAuthorityV2CommandResult(loaded, '--authorize', [], {
      workPackage: 'R0-W01',
    });
    assert.equal(result.exitCode, 1);
    assert.equal(result.output.reason, 'INVALID_EXECUTION_AUTHORITY');
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

test('ancestor symlink is rejected before reading a v2 governed path', async () => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), 'chaotang-v2-symlink-'));
  try {
    const shadow = join(temporaryRoot, 'shadow');
    await mkdir(join(shadow, 'manifest'), { recursive: true });
    await writeFile(join(shadow, 'manifest', 'execution-authority.v2.json'), '{}\n', 'utf8');
    await symlink(shadow, join(temporaryRoot, '.harness'), 'dir');
    const errors = [];
    const source = await readPinnedAuthorityFile(
      temporaryRoot,
      '.harness/manifest/execution-authority.v2.json',
      errors,
    );
    assert.equal(source, null);
    assert.ok(errors.some((message) => message.includes('symbolic links are forbidden')));
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

test('v2 manifest source rejects duplicate JSON keys', () => {
  assert.throws(
    () =>
      parseJsonObjectWithUniqueKeys(
        '{"schemaVersion":"execution-authority.v2","schemaVersion":"execution-authority.v2"}',
      ),
    /duplicate object key/i,
  );
});

test('--check proves structural validity only and never evaluates workPackage', () => {
  const loaded = { manifest: validManifest(), amendmentGovernance: validGovernance(), errors: [] };
  const result = executionAuthorityV2CommandResult(loaded, '--check', []);
  assert.equal(result.exitCode, 0);
  assert.equal(result.output.decision, 'VALID_STRUCTURE');
});

test('--authorize without --work-package stops with a specific reason', () => {
  const loaded = { manifest: validManifest(), amendmentGovernance: validGovernance(), errors: [] };
  const result = executionAuthorityV2CommandResult(loaded, '--authorize', []);
  assert.equal(result.exitCode, 2);
  assert.equal(result.output.reason, 'WORK_PACKAGE_ARGUMENT_REQUIRED');
});

test('CLI rejects an unsupported flag with exit 64', async () => {
  await assert.rejects(
    execFileAsync(process.execPath, [cliPath, '--authorize', '--bogus-flag'], { cwd: root }),
    (error) => error.code === 64,
  );
});

test('CLI subprocess against the real repo records W05 merged and enters quiescent closeout', async () => {
  const loaded = await loadExecutionAuthorityV2(root);
  assert.deepEqual(loaded.errors, []);
  assert.equal(loaded.manifest.activeWorkPackage, null);
  assert.deepEqual(loaded.manifest.workPackageLedger.at(-1), {
    id: 'R0-W05',
    status: 'MERGED_AND_VERIFIED',
  });
  await assert.rejects(
    execFileAsync(process.execPath, [cliPath, '--authorize', '--work-package', 'R0-W05'], {
      cwd: root,
    }),
    (error) => {
      const output = JSON.parse(error.stdout);
      return (
        error.code === 2 &&
        output.decision === 'STOP' &&
        output.reason === 'NO_ACTIVE_WORK_PACKAGE'
      );
    },
  );
});

test('CLI subprocess against the real repo keeps W06 stopped after W05 closeout', async () => {
  const loaded = await loadExecutionAuthorityV2(root);
  assert.deepEqual(loaded.errors, []);
  assert.equal(loaded.manifest.activeWorkPackage, null);
  assert.equal(
    loaded.manifest.workPackageLedger.some(
      (entry) => entry.id === 'R0-W06' && entry.status === 'ACTIVE',
    ),
    false,
  );
  await assert.rejects(
    execFileAsync(process.execPath, [cliPath, '--authorize', '--work-package', 'R0-W06'], {
      cwd: root,
    }),
    (error) => {
      const output = JSON.parse(error.stdout);
      return (
        error.code === 2 &&
        output.decision === 'STOP' &&
        output.reason === 'NO_ACTIVE_WORK_PACKAGE'
      );
    },
  );
});

test('root authorization procedure reserves product execution decisions for scoped v2 authorization', async () => {
  for (const path of [
    'AGENTS.md',
    '.harness/agents/project-owner.md',
    '.harness/rules/project-workflow.md',
    '.harness/wiki/harness-inventory.md',
  ]) {
    const source = await readFile(join(root, path), 'utf8');
    assert.match(source, /node scripts\/execution-authority\.mjs --check/, path);
    assert.match(
      source,
      /node scripts\/execution-authority-v2\.mjs --authorize --work-package <R0-Wxx>/,
      path,
    );
    assert.match(source, /V1_CHECK_INTEGRITY_ONLY_NON_AUTHORIZING/, path);
    assert.match(source, /V2_SCOPED_AUTHORIZE_SOLE_PRODUCT_DECISION/, path);
    assert.doesNotMatch(source, /node scripts\/execution-authority\.mjs --authorize/, path);
  }
});

test('project manifest registers the v2 authority consumer exactly', async () => {
  const projectManifest = JSON.parse(
    await readFile(join(root, '.harness/manifest/project-harness.json'), 'utf8'),
  );
  assert.deepEqual(
    projectManifest.executionAuthorityV2,
    EXPECTED_EXECUTION_AUTHORITY_V2_REGISTRATION,
  );
});

test('real repo v2 manifest evidence digests match on-disk bytes', async () => {
  assert.equal(EXECUTION_AUTHORITY_V2_PATH, '.harness/manifest/execution-authority.v2.json');
  assert.equal(
    EXECUTION_AUTHORITY_V2_SCHEMA_PATH,
    '.harness/contracts/execution-authority-v2.schema.json',
  );
  const loaded = await loadExecutionAuthorityV2(root);
  assert.deepEqual(loaded.errors, []);
  assert.deepEqual(validateExecutionAuthorityV2(loaded), []);
  assert.deepEqual(validateExecutionAuthorityV2Schema(loaded.schema), []);

  const ownerApprovalBytes = await readFile(
    join(root, loaded.manifest.approvalEvidence.ownerApprovalPath),
    'utf8',
  );
  assert.equal(sha256Hex(ownerApprovalBytes), loaded.manifest.approvalEvidence.ownerApprovalSha256);
  const reviewBytes = await readFile(join(root, loaded.manifest.approvalEvidence.reviewPath), 'utf8');
  assert.equal(sha256Hex(reviewBytes), loaded.manifest.approvalEvidence.reviewSha256);
  const amendmentBytes = await readFile(join(root, loaded.manifest.amendment.path), 'utf8');
  assert.equal(sha256Hex(amendmentBytes), loaded.manifest.amendment.approvedSourceDigest);
});

test('W06 review request owner approval is strictly machine-readable and binds the activation proposal', async () => {
  const ownerApprovalPath = join(
    root,
    '.harness/changes/fix-ext-g0-authority-recovery-20260725/owner_approval/exact-h-approval.md',
  );
  const ownerApproval = await readFile(ownerApprovalPath, 'utf8');
  const evidence = parseExecutionAuthorityV2Evidence(ownerApproval, ownerApprovalPath);
  const proposalPath = join(
    root,
    '.harness/changes/fix-ext-g0-authority-recovery-20260725/proposed_activation/r0-w06-activation.json',
  );
  const proposalBytes = await readFile(proposalPath, 'utf8');
  const proposal = parseJsonObjectWithUniqueKeys(proposalBytes, proposalPath);

  assert.equal(evidence.decision, 'APPROVED');
  assert.equal(evidence.workPackage, 'R0-W06');
  assert.equal(evidence.candidateH, '8feae838f09ad5202b21332d4280b989ab776bd7');
  assert.equal(evidence.tree, '9d63f98041e5e13174dbba4c0b9d27eef1471bf9');
  assert.equal(evidence.proposedActivationSha256, sha256Hex(proposalBytes));
  assert.deepEqual(proposal.activation.effectiveBase, evidence.effectiveBase);
  assert.deepEqual(proposal.activation.approvalEvidence.approvedScope, ['R0-W06']);
  assert.equal(proposal.activation.activeWorkPackage, 'R0-W06');
  assert.deepEqual(proposal.activation.workPackageLedger.at(-1), {
    id: 'R0-W06',
    status: 'ACTIVE',
  });
});
