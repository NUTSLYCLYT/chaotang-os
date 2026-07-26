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
  parseExecutionAuthorityV2ReviewPackage,
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
const liveAmendmentGovernance = JSON.parse(
  await readFile(join(root, '.harness/manifest/project-harness.json'), 'utf8'),
).amendmentGovernance;

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
  return structuredClone(liveAmendmentGovernance);
}

function validReviewerReassignment() {
  return {
    schemaVersion: 'reviewer-reassignment.v1',
    status: 'APPROVED',
    scope: ['R0-W07'],
    fromReviewer: 'Claude Code',
    toReviewer: 'Codex Independent QA',
    executionOwner: 'Codex',
    reviewPassesRequired: 2,
    sessionIsolation: 'FRESH_NO_FORK_CONTEXT',
    writeAccess: 'DENIED',
    candidateMutation: 'FORBIDDEN',
    expiresAfter: 'R0-W07_MERGED_AND_VERIFIED',
    baseH: '55caf0d176cd6a1bbb833ffd1872ea3f1d8a46ca',
    candidateH: '1'.repeat(40),
    tree: '2'.repeat(40),
    writingSessionId: '70da5ef5-c29f-4570-83ec-f7ee19e9bef1',
    rejectedSessionIds: [
      '019f9c33-5ae7-7b00-9c0c-1b3b3be8452d',
      '019f9c33-5b1f-7360-a217-1c3d827045d5',
      '019f9c43-e603-76c3-b30b-d78789057441',
      '019f9c43-e632-75b1-99d9-0d9b162cd3e1',
      '019f9c4f-1fef-74c2-9767-a8a653569bbd',
      '019f9c4f-201b-7d91-a2b0-e49e08a5985a',
      '019f9c5b-0cbc-72f0-a114-1b26dc852bd5',
      '019f9c5b-0cf9-7a20-a741-ce4a279dce9b',
    ],
    reviewPackagePath:
      '.harness/changes/docs-r0-reviewer-reassignment-20260726/review_inputs/candidate.diff',
    reviewPackageSha256: '3'.repeat(64),
    ownerApprovalPath:
      '.harness/changes/docs-r0-reviewer-reassignment-20260726/owner_approval/exact-h-approval.md',
    ownerApprovalSha256: '4'.repeat(64),
    reviews: [
      {
        sessionId: '22222222-2222-2222-2222-222222222222',
        path:
          '.harness/changes/docs-r0-reviewer-reassignment-20260726/codex_review/pass-1.md',
        sha256: '5'.repeat(64),
        verdict: 'GO',
        high: 0,
        medium: 0,
        writeAccess: 'DENIED',
      },
      {
        sessionId: '33333333-3333-3333-3333-333333333333',
        path:
          '.harness/changes/docs-r0-reviewer-reassignment-20260726/codex_review/pass-2.md',
        sha256: '6'.repeat(64),
        verdict: 'GO',
        high: 0,
        medium: 0,
        writeAccess: 'DENIED',
      },
    ],
    approvedBy: 'lyt',
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
    activationIntentPath:
      '.harness/changes/fix-ext-g0-authority-recovery-20260725/activation_intent/r0-w06-activation-intent.json',
    activationIntentSha256: 'c'.repeat(64),
  };
  const activationIntent = {
    schemaVersion: 'execution-authority.v2.activation-intent.v1',
    kind: 'activation-intent',
    trackedManifestPath: '.harness/manifest/execution-authority.v2.json',
    reviewPackagePath:
      '.harness/changes/fix-ext-g0-authority-recovery-20260725/review_inputs/review-7df6e4e1..e8be2ca9.diff',
    reviewPackageSha256: 'd'.repeat(64),
    effectiveBase: manifest.effectiveBase,
    approvalEvidence: {
      ownerApprovalPath: manifest.approvalEvidence.ownerApprovalPath,
      reviewPath: manifest.approvalEvidence.reviewPath,
      reviewVerdict: manifest.approvalEvidence.reviewVerdict,
      approver: manifest.approvalEvidence.approver,
      candidateH: manifest.approvalEvidence.candidateH,
      tree: manifest.approvalEvidence.tree,
      approvedScope: manifest.approvalEvidence.approvedScope,
    },
    activeWorkPackage: manifest.activeWorkPackage,
    workPackageLedger: manifest.workPackageLedger,
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
    activationIntentPath: owner.activationIntentPath,
    activationIntentSha256: owner.activationIntentSha256,
    reviewPackagePath: activationIntent.reviewPackagePath,
    diffSha256: 'd'.repeat(64),
    changedPaths: [
      '.harness/changes/fix-ext-g0-authority-recovery-20260725/claude_code_review/exact-h-final.md',
      '.harness/manifest/execution-authority.v2.json',
      'scripts/lib/execution-authority-v2.mjs',
      'scripts/execution-authority-v2.nodetest.mjs',
    ],
    commands: [
      'node --test scripts/execution-authority.nodetest.mjs',
      'node --test scripts/execution-authority-v2.nodetest.mjs',
      'node scripts/execution-authority.mjs --authorize',
      'node scripts/execution-authority-v2.mjs --authorize --work-package R0-W06',
      'node scripts/harness-doctor.mjs',
      'git diff --check',
    ],
    productionReady: false,
  };
  return { manifest, owner, activationIntent, review };
}

function reviewPackageForPaths(paths) {
  return paths
    .map(
      (path) =>
        `diff --git a/${path} b/${path}\n--- a/${path}\n+++ b/${path}\n@@ -0,0 +1 @@\n+review\n`,
    )
    .join('');
}

async function writeRepositoryFile(temporaryRoot, path, source) {
  await mkdir(join(temporaryRoot, dirname(path)), { recursive: true });
  await writeFile(join(temporaryRoot, path), source, 'utf8');
}

async function createActiveAuthorityFixture({
  mutateIntent,
  mutateOwner,
  mutateReview,
  writeIntent = true,
  activationIntentDigest,
  reviewPackageSource,
  reviewPackageDigest,
  writeReviewPackage = true,
} = {}) {
  const temporaryRoot = await mkdtemp(join(tmpdir(), 'chaotang-v2-active-'));
  const fixture = w06EvidenceDocuments();
  const owner = structuredClone(fixture.owner);
  const review = structuredClone(fixture.review);
  const intent = structuredClone(fixture.activationIntent);
  const packageSource = reviewPackageSource ?? reviewPackageForPaths(review.changedPaths);
  intent.reviewPackageSha256 = sha256Hex(packageSource);
  review.diffSha256 = reviewPackageDigest ?? sha256Hex(packageSource);
  mutateIntent?.(intent);
  const intentSource = `${JSON.stringify(intent, null, 2)}\n`;
  owner.activationIntentSha256 = activationIntentDigest ?? sha256Hex(intentSource);
  mutateOwner?.(owner);
  const ownerSource = evidenceDocument(owner);
  review.ownerApprovalSha256 = sha256Hex(ownerSource);
  review.activationIntentPath = owner.activationIntentPath;
  review.activationIntentSha256 = owner.activationIntentSha256;
  mutateReview?.(review);
  const reviewSource = evidenceDocument(review);
  const manifest = structuredClone(fixture.manifest);
  manifest.approvalEvidence.ownerApprovalSha256 = sha256Hex(ownerSource);
  manifest.approvalEvidence.reviewSha256 = sha256Hex(reviewSource);

  await writeRepositoryFile(
    temporaryRoot,
    EXECUTION_AUTHORITY_V2_PATH,
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  await writeRepositoryFile(
    temporaryRoot,
    EXECUTION_AUTHORITY_V2_SCHEMA_PATH,
    await readFile(join(root, EXECUTION_AUTHORITY_V2_SCHEMA_PATH), 'utf8'),
  );
  await writeRepositoryFile(
    temporaryRoot,
    '.harness/manifest/project-harness.json',
    `${JSON.stringify({ amendmentGovernance: validGovernance() }, null, 2)}\n`,
  );
  for (const path of [
    liveAmendmentGovernance.approvalEvidence.ownerApprovalPath,
    liveAmendmentGovernance.approvalEvidence.reviewPath,
  ]) {
    await writeRepositoryFile(
      temporaryRoot,
      path,
      await readFile(join(root, path), 'utf8'),
    );
  }
  await writeRepositoryFile(temporaryRoot, manifest.approvalEvidence.ownerApprovalPath, ownerSource);
  await writeRepositoryFile(temporaryRoot, manifest.approvalEvidence.reviewPath, reviewSource);
  if (writeIntent) {
    await writeRepositoryFile(temporaryRoot, fixture.owner.activationIntentPath, intentSource);
  }
  if (writeReviewPackage) {
    await writeRepositoryFile(temporaryRoot, fixture.review.reviewPackagePath, packageSource);
  }
  return { temporaryRoot, manifest };
}

test('matching W06 machine-readable owner and independent review evidence permits the exact active package', () => {
  const { manifest, owner, review } = w06EvidenceDocuments();
  const parsedOwner = parseExecutionAuthorityV2Evidence(evidenceDocument(owner), 'owner approval');
  const parsedReview = parseExecutionAuthorityV2Evidence(evidenceDocument(review), 'independent review');
  assert.deepEqual(
    validateExecutionAuthorityV2Evidence(manifest, validGovernance(), parsedOwner, parsedReview),
    [],
  );
  const loaded = {
    manifest,
    amendmentGovernance: validGovernance(),
    errors: validateExecutionAuthorityV2Evidence(
      manifest,
      validGovernance(),
      parsedOwner,
      parsedReview,
    ),
  };
  assert.equal(
    executionAuthorityV2CommandResult(loaded, '--authorize', [], { workPackage: 'R0-W06' }).exitCode,
    0,
  );
});

test('active temporary root authorizes only after loading the exact independent review and activation intent', async () => {
  const { temporaryRoot } = await createActiveAuthorityFixture();
  try {
    const loaded = await loadExecutionAuthorityV2(temporaryRoot);
    assert.deepEqual(loaded.errors, []);
    const result = executionAuthorityV2CommandResult(loaded, '--authorize', [], {
      workPackage: 'R0-W06',
    });
    assert.equal(result.exitCode, 0);
    assert.equal(result.output.reason, 'APPROVED_WORK_PACKAGE');
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

test('v2 loader fails closed when reviewer reassignment evidence is absent', async () => {
  const { temporaryRoot } = await createActiveAuthorityFixture();
  try {
    const governance = validGovernance();
    governance.reviewerReassignment = validReviewerReassignment();
    await writeRepositoryFile(
      temporaryRoot,
      '.harness/manifest/project-harness.json',
      `${JSON.stringify({ amendmentGovernance: governance }, null, 2)}\n`,
    );
    const loaded = await loadExecutionAuthorityV2(temporaryRoot);
    assert.ok(
      loaded.errors.some((error) =>
        error.includes('reviewerReassignment.reviewPackagePath: missing path component'),
      ),
    );
    const result = executionAuthorityV2CommandResult(loaded, '--authorize', [], {
      workPackage: 'R0-W06',
    });
    assert.equal(result.exitCode, 1);
    assert.equal(result.output.reason, 'INVALID_EXECUTION_AUTHORITY');
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

for (const {
  name,
  options,
  expectedError,
} of [
  {
    name: 'owner self-review',
    options: { mutateReview: (review) => { review.reviewer = 'lyt'; } },
    expectedError: 'reviewer must differ from manifest approvalEvidence.approver',
  },
  {
    name: 'nonexistent activation intent',
    options: {
      mutateOwner: (owner) => {
        owner.activationIntentPath = '.harness/changes/missing/activation-intent.json';
      },
      writeIntent: false,
    },
    expectedError: 'missing path component',
  },
  {
    name: 'fabricated activation intent digest',
    options: { activationIntentDigest: 'f'.repeat(64) },
    expectedError: 'activationIntentPath: digest mismatch',
  },
  {
    name: 'mismatched activation intent identity',
    options: {
      mutateIntent: (intent) => {
        intent.approvalEvidence.tree = '1'.repeat(40);
      },
    },
    expectedError: 'activation intent tree must match manifest approvalEvidence.tree',
  },
  {
    name: 'mismatched activation intent evidence path',
    options: {
      mutateIntent: (intent) => {
        intent.approvalEvidence.reviewPath = '.harness/changes/other/claude_code_review/exact-h-final.md';
      },
    },
    expectedError: 'activation intent reviewPath must match manifest approvalEvidence.reviewPath',
  },
  {
    name: 'unknown activation intent key',
    options: { mutateIntent: (intent) => { intent.unknown = true; } },
    expectedError: 'activation intent has missing or unsupported fields',
  },
  {
    name: 'arbitrary review metadata',
    options: {
      mutateReview: (review) => {
        review.changedPaths = ['README.md'];
        review.commands = ['false'];
      },
    },
    expectedError: 'review changedPaths must stay within the authority review allowlist',
  },
  {
    name: 'partial review changed paths',
    options: {
      mutateReview: (review) => {
        review.changedPaths = ['scripts/lib/execution-authority-v2.mjs'];
      },
    },
    expectedError: 'review changedPaths must exactly match the review package path set',
  },
  {
    name: 'extra review changed paths',
    options: {
      mutateReview: (review) => {
        review.changedPaths.push('scripts/execution-authority.nodetest.mjs');
      },
    },
    expectedError: 'review changedPaths must exactly match the review package path set',
  },
  {
    name: 'fabricated review package digest',
    options: { reviewPackageDigest: 'f'.repeat(64) },
    expectedError: 'reviewPackagePath: digest mismatch',
  },
  {
    name: 'missing review package',
    options: { writeReviewPackage: false },
    expectedError: 'active execution authority requires a readable review package',
  },
  {
    name: 'unsafe review package diff header',
    options: {
      reviewPackageSource:
        'diff --git a/../outside b/../outside\n--- a/../outside\n+++ b/../outside\n',
    },
    expectedError: 'review package: unsafe diff path',
  },
  {
    name: 'duplicate review package diff header',
    options: {
      reviewPackageSource: reviewPackageForPaths([
        'scripts/lib/execution-authority-v2.mjs',
        'scripts/lib/execution-authority-v2.mjs',
      ]),
    },
    expectedError: 'review package: duplicate diff path',
  },
  {
    name: 'false review verification command metadata',
    options: { mutateReview: (review) => { review.commands = ['false']; } },
    expectedError: 'review commands must exactly match the required authority verification commands',
  },
]) {
  test(`active temporary root fails closed for ${name}`, async () => {
    const { temporaryRoot } = await createActiveAuthorityFixture(options);
    try {
      const loaded = await loadExecutionAuthorityV2(temporaryRoot);
      assert.ok(loaded.errors.some((error) => error.includes(expectedError)), loaded.errors.join('\n'));
      const result = executionAuthorityV2CommandResult(loaded, '--authorize', [], {
        workPackage: 'R0-W06',
      });
      assert.equal(result.exitCode, 1);
      assert.equal(result.output.reason, 'INVALID_EXECUTION_AUTHORITY');
    } finally {
      await rm(temporaryRoot, { recursive: true, force: true });
    }
  });
}

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
    name: 'owner self-review',
    mutate: ({ review }) => {
      review.reviewer = 'lyt';
    },
    expectedError: 'reviewer must match amendmentGovernance.independentReviewer',
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
      validGovernance(),
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

test('CLI subprocess against the real repo keeps predecessor and successor packages stopped', async () => {
  const loaded = await loadExecutionAuthorityV2(root);
  assert.deepEqual(loaded.errors, []);
  for (const workPackage of ['R0-W05', 'R0-W08', 'R0-W09']) {
    await assert.rejects(
      execFileAsync(process.execPath, [cliPath, '--authorize', '--work-package', workPackage], {
        cwd: root,
      }),
      (error) => JSON.parse(error.stdout).decision === 'STOP',
    );
  }
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

test('W06 review request owner approval is strictly machine-readable and binds the activation intent', async () => {
  const ownerApprovalPath = join(
    root,
    '.harness/changes/fix-ext-g0-authority-recovery-20260725/owner_approval/exact-h-approval.md',
  );
  const ownerApproval = await readFile(ownerApprovalPath, 'utf8');
  const evidence = parseExecutionAuthorityV2Evidence(ownerApproval, ownerApprovalPath);
  const activationIntentPath = join(
    root,
    '.harness/changes/fix-ext-g0-authority-recovery-20260725/activation_intent/r0-w06-activation-intent.json',
  );
  const activationIntentBytes = await readFile(activationIntentPath, 'utf8');
  const activationIntent = parseJsonObjectWithUniqueKeys(activationIntentBytes, activationIntentPath);
  const reviewPackagePath = join(
    root,
    '.harness/changes/fix-ext-g0-authority-recovery-20260725/review_inputs/review-7df6e4e1..e8be2ca9.diff',
  );
  const reviewPackageBytes = await readFile(reviewPackagePath, 'utf8');

  assert.equal(evidence.decision, 'APPROVED');
  assert.equal(evidence.workPackage, 'R0-W06');
  assert.equal(evidence.candidateH, '8feae838f09ad5202b21332d4280b989ab776bd7');
  assert.equal(evidence.tree, '9d63f98041e5e13174dbba4c0b9d27eef1471bf9');
  assert.equal(evidence.activationIntentSha256, sha256Hex(activationIntentBytes));
  assert.equal(activationIntent.kind, 'activation-intent');
  assert.equal(
    activationIntent.reviewPackagePath,
    '.harness/changes/fix-ext-g0-authority-recovery-20260725/review_inputs/review-7df6e4e1..e8be2ca9.diff',
  );
  assert.equal(activationIntent.reviewPackageSha256, sha256Hex(reviewPackageBytes));
  assert.equal(
    activationIntent.reviewPackageSha256,
    '0fdf3da62b977d6935b65c68e5509ee6b52eb98d7ee80a142341625bd4d3f885',
  );
  assert.deepEqual(parseExecutionAuthorityV2ReviewPackage(reviewPackageBytes), [
    '.harness/changes/fix-ext-g0-authority-recovery-20260725/activation_intent/r0-w06-activation-intent.json',
    '.harness/changes/fix-ext-g0-authority-recovery-20260725/ci_result/ci_summary.md',
    '.harness/changes/fix-ext-g0-authority-recovery-20260725/claude_code_review/review-request.md',
    '.harness/changes/fix-ext-g0-authority-recovery-20260725/owner_approval/exact-h-approval.md',
    '.harness/changes/fix-ext-g0-authority-recovery-20260725/owner_scope/recovery-boundary.md',
    '.harness/changes/fix-ext-g0-authority-recovery-20260725/request_analysis/tasks.md',
    '.harness/changes/fix-ext-g0-authority-recovery-20260725/summary.md',
    'docs/superpowers/plans/2026-07-25-ext-recovery-program.md',
    'scripts/execution-authority-v2.nodetest.mjs',
    'scripts/execution-authority.nodetest.mjs',
    'scripts/lib/execution-authority-v2.mjs',
  ]);
  assert.deepEqual(activationIntent.effectiveBase, evidence.effectiveBase);
  assert.deepEqual(activationIntent.approvalEvidence.approvedScope, ['R0-W06']);
  assert.equal(activationIntent.activeWorkPackage, 'R0-W06');
  assert.deepEqual(activationIntent.workPackageLedger.at(-1), {
    id: 'R0-W06',
    status: 'ACTIVE',
  });
});
