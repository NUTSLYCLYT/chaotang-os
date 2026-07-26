import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import {
  effectiveIndependentReviewer,
  parseReviewerReassignmentEvidence,
  validateAmendmentGovernanceRegistration,
  validateReviewerReassignmentOverlay,
  verifyAmendmentApprovalEvidenceFiles,
} from './lib/amendment-governance.mjs';
import { validateR0AmendmentMarkdown } from './lib/r0-amendment-check.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const execFileAsync = promisify(execFile);
const cliPath = join(root, 'scripts/r0-amendment-check.mjs');
const amendmentPath = join(
  root,
  '.harness/changes/docs-r0-trusted-kernel-amendment-20260720/amendment.md',
);
const effectiveBase = Object.freeze({
  ref: 'origin/feature-chaotang-ext',
  sha: 'ccc2d74a2e439830e9c6ae7adcefb5ee8c05c150',
});
const ownerAssignments = Object.freeze({
  product: 'lyt',
  program: 'lyt',
  backendApiContract: 'lyt',
  canonicalRuntime: 'lyt',
  securityData: 'lyt',
  frontend: 'lyt',
  qaLegalEvaluation: 'lyt',
  release: 'lyt',
  security: 'lyt',
});

test('R0 amendment maps all requirements and exit gates to one owner', async () => {
  const source = await readFile(amendmentPath, 'utf8');
  assert.deepEqual(validateR0AmendmentMarkdown(source), []);
});

test('R0 amendment re-pin binds the merged G0 base and every named owner', async () => {
  const source = await readFile(amendmentPath, 'utf8');
  assert.deepEqual(
    validateR0AmendmentMarkdown(source, { effectiveBase, ownerAssignments }),
    [],
  );

  const missingBase = source.replace(effectiveBase.sha, 'PENDING');
  assert.ok(
    validateR0AmendmentMarkdown(missingBase, { effectiveBase, ownerAssignments }).some((error) =>
      error.includes('effective base'),
    ),
  );

  const invalidHexBase = source.replace(effectiveBase.sha, 'g'.repeat(40));
  assert.ok(
    validateR0AmendmentMarkdown(invalidHexBase, {
      effectiveBase,
      ownerAssignments,
    }).some((error) => error.includes('effective base')),
  );

  const unassignedSecurity = source.replace(
    '| Security & Data Owner | `lyt` |',
    '| Security & Data Owner | `UNASSIGNED` |',
  );
  assert.ok(
    validateR0AmendmentMarkdown(unassignedSecurity, {
      effectiveBase,
      ownerAssignments,
    }).some((error) => error.includes('Security & Data Owner')),
  );

  const pendingSecurity = source.replace(
    '| Security & Data Owner | `lyt` |',
    '| Security & Data Owner | `PENDING` |',
  );
  assert.ok(
    validateR0AmendmentMarkdown(pendingSecurity, { effectiveBase }).some((error) =>
      error.includes('Security & Data Owner'),
    ),
  );

  const mismatchedSecurity = source.replace(
    '| Security & Data Owner | `lyt` |',
    '| Security & Data Owner | `different-owner` |',
  );
  assert.ok(
    validateR0AmendmentMarkdown(mismatchedSecurity, {
      effectiveBase,
      ownerAssignments,
    }).some((error) => error.includes('must be lyt')),
  );

  const duplicatedSecurity = source.replace(
    '| Security & Data Owner | `lyt` |',
    '| Security & Data Owner | `lyt` |\n| Security & Data Owner | `lyt` |',
  );
  assert.ok(
    validateR0AmendmentMarkdown(duplicatedSecurity, {
      effectiveBase,
      ownerAssignments,
    }).some((error) => error.includes('exactly one named owner')),
  );
});

function proposedGovernanceFixture() {
  return {
    status: 'PROPOSED_NOT_AUTHORITY',
    document: '.harness/changes/docs-r0-trusted-kernel-amendment-20260720/amendment.md',
    checker: 'scripts/r0-amendment-check.mjs',
    test: 'scripts/r0-amendment-check.nodetest.mjs',
    effectiveBase: { ref: 'origin/feature-chaotang-ext', sha: 'ccc2d74a2e439830e9c6ae7adcefb5ee8c05c150' },
    ownerAssignments: {
      product: 'lyt',
      program: 'lyt',
      backendApiContract: 'lyt',
      canonicalRuntime: 'lyt',
      securityData: 'lyt',
      frontend: 'lyt',
      qaLegalEvaluation: 'lyt',
      release: 'lyt',
      security: 'lyt',
    },
    executionOwner: 'Codex',
    independentReviewer: 'Claude Code',
    professionalReassignmentRequiredBefore: ['REAL_CUSTOMER_DATA', 'R0-W08', 'R0-W09'],
    professionalRolesRequired: ['security', 'legal', 'release'],
    professionalReassignmentGateStatus: 'DECLARATIVE_PRECONDITION_NOT_RUNTIME_ENFORCED',
    approvalEvidence: null,
    candidateSourceDigest: '2ba59cbe4d4032d8f372d1dd757e03edb78038b38de6d657380f357100a83e38',
    approvedSourceDigest: null,
    canAuthorizeRuntime: false,
    verification: [
      'node --test scripts/r0-amendment-check.nodetest.mjs',
      'node scripts/r0-amendment-check.mjs',
      'node scripts/harness-doctor.mjs',
    ],
  };
}

function approvedReviewerReassignmentFixture() {
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
    baseH: '0'.repeat(40),
    candidateH: '1'.repeat(40),
    tree: '2'.repeat(40),
    writingSessionId: '11111111-1111-1111-1111-111111111111',
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

function reviewerReassignmentEvidenceDocument(value) {
  return [
    '# Reviewer Reassignment Evidence',
    '',
    '<!-- reviewer-reassignment-evidence:start -->',
    '```json',
    JSON.stringify(value, null, 2),
    '```',
    '<!-- reviewer-reassignment-evidence:end -->',
    '',
  ].join('\n');
}

test('reviewer reassignment evidence rejects duplicate JSON keys', () => {
  const source = [
    '<!-- reviewer-reassignment-evidence:start -->',
    '```json',
    '{"kind":"owner-approval","kind":"codex-independent-review"}',
    '```',
    '<!-- reviewer-reassignment-evidence:end -->',
  ].join('\n');
  assert.throws(
    () => parseReviewerReassignmentEvidence(source, 'duplicate.md'),
    /duplicate JSON keys/,
  );
});

test('approved reviewer reassignment requires two isolated read-only Codex QA passes', () => {
  const overlay = approvedReviewerReassignmentFixture();
  assert.deepEqual(validateReviewerReassignmentOverlay(overlay), []);
  assert.equal(
    effectiveIndependentReviewer(
      { independentReviewer: 'Claude Code', reviewerReassignment: overlay },
      'R0-W07',
      [{ id: 'R0-W07', status: 'ACTIVE' }],
    ),
    'Codex Independent QA',
  );
  assert.equal(
    effectiveIndependentReviewer(
      { independentReviewer: 'Claude Code', reviewerReassignment: overlay },
      'R0-W06',
      [{ id: 'R0-W06', status: 'MERGED_AND_VERIFIED' }],
    ),
    'Claude Code',
  );
  assert.equal(
    effectiveIndependentReviewer(
      { independentReviewer: 'Claude Code', reviewerReassignment: overlay },
      'R0-W07',
      [{ id: 'R0-W07', status: 'MERGED_AND_VERIFIED' }],
    ),
    'Claude Code',
  );
});

test('reviewer reassignment evidence is verified byte-for-byte and fails closed on drift', async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), 'reviewer-reassignment-'));
  try {
    const overlay = approvedReviewerReassignmentFixture();
    await execFileAsync('git', ['init', '-q'], { cwd: tempRoot });
    await execFileAsync('git', ['config', 'user.name', 'R0 Test'], { cwd: tempRoot });
    await execFileAsync('git', ['config', 'user.email', 'r0@example.invalid'], {
      cwd: tempRoot,
    });
    await writeFile(join(tempRoot, 'candidate.txt'), 'base\n');
    await execFileAsync('git', ['add', 'candidate.txt'], { cwd: tempRoot });
    await execFileAsync('git', ['commit', '-qm', 'base'], { cwd: tempRoot });
    overlay.baseH = (await execFileAsync('git', ['rev-parse', 'HEAD'], {
      cwd: tempRoot,
    })).stdout.trim();
    await writeFile(join(tempRoot, 'candidate.txt'), 'candidate\n');
    await execFileAsync('git', ['add', 'candidate.txt'], { cwd: tempRoot });
    await execFileAsync('git', ['commit', '-qm', 'candidate'], { cwd: tempRoot });
    overlay.candidateH = (await execFileAsync('git', ['rev-parse', 'HEAD'], {
      cwd: tempRoot,
    })).stdout.trim();
    overlay.tree = (await execFileAsync('git', ['rev-parse', 'HEAD^{tree}'], {
      cwd: tempRoot,
    })).stdout.trim();
    const packageSource = (
      await execFileAsync('git', ['diff', '--binary', `${overlay.baseH}..${overlay.candidateH}`], {
        cwd: tempRoot,
        maxBuffer: 10 * 1024 * 1024,
      })
    ).stdout;
    overlay.reviewPackageSha256 = createHash('sha256').update(packageSource).digest('hex');
    await mkdir(dirname(join(tempRoot, overlay.reviewPackagePath)), { recursive: true });
    await writeFile(join(tempRoot, overlay.reviewPackagePath), packageSource);

    const reviewSources = overlay.reviews.map((review, index) =>
      reviewerReassignmentEvidenceDocument({
        schemaVersion: 'reviewer-reassignment-evidence.v1',
        kind: 'codex-independent-review',
        pass: index + 1,
        sessionId: review.sessionId,
        reviewer: overlay.toReviewer,
        scope: overlay.scope,
        baseH: overlay.baseH,
        candidateH: overlay.candidateH,
        tree: overlay.tree,
        reviewPackagePath: overlay.reviewPackagePath,
        reviewPackageSha256: overlay.reviewPackageSha256,
        verdict: review.verdict,
        high: review.high,
        medium: review.medium,
        writeAccess: review.writeAccess,
        candidateMutated: false,
      }),
    );
    for (let index = 0; index < overlay.reviews.length; index += 1) {
      const review = overlay.reviews[index];
      review.sha256 = createHash('sha256').update(reviewSources[index]).digest('hex');
      await mkdir(dirname(join(tempRoot, review.path)), { recursive: true });
      await writeFile(join(tempRoot, review.path), reviewSources[index]);
    }

    const ownerSource = reviewerReassignmentEvidenceDocument({
      schemaVersion: 'reviewer-reassignment-evidence.v1',
      kind: 'owner-approval',
      decision: 'APPROVED',
      approver: overlay.approvedBy,
      scope: overlay.scope,
      baseH: overlay.baseH,
      candidateH: overlay.candidateH,
      tree: overlay.tree,
      reviewPackagePath: overlay.reviewPackagePath,
      reviewPackageSha256: overlay.reviewPackageSha256,
      reviews: overlay.reviews.map(({ path, sessionId, sha256 }) => ({
        path,
        sessionId,
        sha256,
      })),
    });
    overlay.ownerApprovalSha256 = createHash('sha256').update(ownerSource).digest('hex');
    await mkdir(dirname(join(tempRoot, overlay.ownerApprovalPath)), { recursive: true });
    await writeFile(join(tempRoot, overlay.ownerApprovalPath), ownerSource);

    const governance = {
      approvalEvidence: null,
      reviewerReassignment: overlay,
    };
    assert.deepEqual(
      await verifyAmendmentApprovalEvidenceFiles(tempRoot, governance),
      [],
    );

    await writeFile(join(tempRoot, overlay.reviews[0].path), 'drifted review\n');
    assert.ok(
      (await verifyAmendmentApprovalEvidenceFiles(tempRoot, governance)).some(
        (error) =>
          error === 'reviewerReassignment.reviews[0].path: digest mismatch',
      ),
    );

    const forgedReview = reviewSources[0].replace(
      overlay.reviews[0].sessionId,
      'forged-session',
    );
    overlay.reviews[0].sha256 = createHash('sha256').update(forgedReview).digest('hex');
    await writeFile(join(tempRoot, overlay.reviews[0].path), forgedReview);
    assert.ok(
      (await verifyAmendmentApprovalEvidenceFiles(tempRoot, governance)).some(
        (error) =>
          error ===
          'reviewerReassignment.reviews[0]: evidence sessionId must match overlay',
      ),
    );
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

for (const [name, mutate, expected] of [
  [
    'scope expansion',
    (overlay) => overlay.scope.push('R0-W08'),
    'scope must be exactly R0-W07',
  ],
  [
    'one review',
    (overlay) => overlay.reviews.pop(),
    'exactly two review passes',
  ],
  [
    'reused session',
    (overlay) => { overlay.reviews[1].sessionId = overlay.reviews[0].sessionId; },
    'unique sessionId',
  ],
  [
    'writer self-review',
    (overlay) => { overlay.reviews[0].sessionId = overlay.writingSessionId; },
    'must differ from writingSessionId',
  ],
  [
    'reused evidence path',
    (overlay) => { overlay.reviews[1].path = overlay.reviews[0].path; },
    'evidence paths must be unique',
  ],
  [
    'reused evidence digest',
    (overlay) => { overlay.reviews[1].sha256 = overlay.reviews[0].sha256; },
    'review digests must be unique',
  ],
  [
    'wrong review role path',
    (overlay) => { overlay.reviews[0].path = 'AGENTS.md'; },
    'review pass 1 path must be canonical',
  ],
  [
    'writable review',
    (overlay) => { overlay.reviews[0].writeAccess = 'ALLOWED'; },
    'review writeAccess must be DENIED',
  ],
  [
    'non-GO review',
    (overlay) => { overlay.reviews[1].verdict = 'NO_GO'; },
    'review verdict must be GO',
  ],
  [
    'unresolved high',
    (overlay) => { overlay.reviews[0].high = 1; },
    'zero unresolved HIGH and MEDIUM',
  ],
]) {
  test(`reviewer reassignment fails closed for ${name}`, () => {
    const overlay = approvedReviewerReassignmentFixture();
    mutate(overlay);
    assert.ok(
      validateReviewerReassignmentOverlay(overlay).some((error) => error.includes(expected)),
    );
  });
}

test('PROPOSED_NOT_AUTHORITY governance branch stays a regression-safe standalone fixture', () => {
  const governance = proposedGovernanceFixture();
  assert.deepEqual(validateAmendmentGovernanceRegistration(governance), []);
  assert.ok(
    validateAmendmentGovernanceRegistration(null).some((error) => error.includes('must be an object')),
  );

  const mutations = [
    ['never authorize runtime', { ...governance, canAuthorizeRuntime: true }],
    ['canonical R0 amendment path', { ...governance, document: 'other.md' }],
    ['sha256 hex digest', { ...governance, candidateSourceDigest: 'invalid' }],
    [
      'effective base',
      { ...governance, effectiveBase: { ...governance.effectiveBase, sha: '0'.repeat(40) } },
    ],
    [
      'named R0 owners',
      { ...governance, ownerAssignments: { ...governance.ownerAssignments, security: 'other' } },
    ],
    ['executionOwner', { ...governance, executionOwner: 'other' }],
    ['independentReviewer', { ...governance, independentReviewer: 'other' }],
    [
      'customer data, W08, and W09',
      { ...governance, professionalReassignmentRequiredBefore: ['R0-W08'] },
    ],
    [
      'professional security, legal, and release owners',
      { ...governance, professionalRolesRequired: ['security'] },
    ],
    [
      'professional reassignment gate must be',
      { ...governance, professionalReassignmentGateStatus: 'ENFORCED' },
    ],
    ['approvalEvidence', { ...governance, approvalEvidence: { approved: true } }],
    ['approvedSourceDigest', { ...governance, approvedSourceDigest: '0'.repeat(64) }],
    ['missing verification command', { ...governance, verification: [] }],
  ];
  for (const [expectedError, mutation] of mutations) {
    assert.ok(
      validateAmendmentGovernanceRegistration(mutation).some((error) => error.includes(expectedError)),
      `expected governance error containing: ${expectedError}`,
    );
  }
});

test('APPROVED_FOR_W01 governance branch validates the live manifest and rejects every trust-boundary mutation', async () => {
  const projectManifest = JSON.parse(
    await readFile(join(root, '.harness/manifest/project-harness.json'), 'utf8'),
  );
  const governance = projectManifest.amendmentGovernance;
  assert.equal(governance.status, 'APPROVED_FOR_W01');
  assert.deepEqual(validateAmendmentGovernanceRegistration(governance), []);

  const mutations = [
    ['invalid status', { ...governance, status: 'APPROVED_FOR_W02' }],
    ['never authorize runtime', { ...governance, canAuthorizeRuntime: true }],
    ['canonical R0 amendment path', { ...governance, document: 'other.md' }],
    [
      'approved amendment must carry a sha256 approvedSourceDigest',
      { ...governance, approvedSourceDigest: null },
    ],
    [
      'approvedSourceDigest must equal candidateSourceDigest',
      { ...governance, approvedSourceDigest: '0'.repeat(64) },
    ],
    [
      'professional reassignment gate must be',
      { ...governance, professionalReassignmentGateStatus: 'DECLARATIVE_PRECONDITION_NOT_RUNTIME_ENFORCED' },
    ],
    [
      'approvalEvidence has missing or unsupported fields',
      { ...governance, approvalEvidence: null },
    ],
    [
      'approvedScope must be exactly',
      {
        ...governance,
        approvalEvidence: { ...governance.approvalEvidence, approvedScope: ['R0-W01', 'R0-W02'] },
      },
    ],
    [
      'reviewVerdict must be GO',
      { ...governance, approvalEvidence: { ...governance.approvalEvidence, reviewVerdict: 'STOP' } },
    ],
    ['missing verification command', { ...governance, verification: [] }],
  ];
  for (const [expectedError, mutation] of mutations) {
    assert.ok(
      validateAmendmentGovernanceRegistration(mutation).some((error) => error.includes(expectedError)),
      `expected governance error containing: ${expectedError}`,
    );
  }
});

test('R0 amendment validator rejects missing or duplicate requirement ownership', async () => {
  const source = await readFile(amendmentPath, 'utf8');
  const missing = source.replace(/^\| 022 \|.*\n/m, '');
  assert.ok(validateR0AmendmentMarkdown(missing).some((error) => error.includes('REQ 022')));

  const duplicate = source.replace(
    /^\| 022 \|.*$/m,
    (row) => `${row}\n| 022 | W05 | Duplicate Owner | duplicate | duplicate |`,
  );
  assert.ok(validateR0AmendmentMarkdown(duplicate).some((error) => error.includes('duplicate REQ 022')));
});

test('R0 amendment validator rejects a missing release exit gate', async () => {
  const source = await readFile(amendmentPath, 'utf8');
  const missing = source.replace(/^\| G04 \|.*\n/m, '');
  assert.ok(validateR0AmendmentMarkdown(missing).some((error) => error.includes('exit gate G04')));
});

test('R0 amendment validator requires fail-closed approval controls', async () => {
  const source = await readFile(amendmentPath, 'utf8');
  for (const requiredControl of [
    'git diff --binary <B>..<H> | sha256sum',
    'decision != GO',
    'OQ-02',
    'OQ-01',
    'OQ-03',
    'OQ-09',
    'OQ-10',
    'OQ-06',
    '1 → 2 → 4 → 5 → 3',
    '明确未批准 W02–W09 runtime',
  ]) {
    const mutated = source.replaceAll(requiredControl, 'REMOVED_CONTROL');
    assert.ok(
      validateR0AmendmentMarkdown(mutated).some((error) => error.includes(requiredControl)),
      `expected missing control error for ${requiredControl}`,
    );
  }

  const invertedDecision = source.replace(
    '`decision != GO`、字段缺失或包不一致立即 STOP',
    '`decision != GO`、字段缺失或包不一致可继续',
  );
  assert.ok(
    validateR0AmendmentMarkdown(invertedDecision).some((error) =>
      error.includes('decision != GO'),
    ),
  );

  const weakenedOq = source.replace('W03 RED 前 | W03 保持', 'W03 GREEN 后 | W03 保持');
  assert.ok(validateR0AmendmentMarkdown(weakenedOq).some((error) => error.includes('OQ-02')));
});

test('R0 amendment validator cross-checks packet ownership and legacy milestone disposition', async () => {
  const source = await readFile(amendmentPath, 'utf8');
  const conflictingOwner = source.replace(
    '| 2 | R0-W02 | 合同、Mission、裁决、状态的共享 v1 契约 | 003–007、012、017 |',
    '| 2 | R0-W02 | 合同、Mission、裁决、状态的共享 v1 契约 | 003–007、012、017、019 |',
  );
  assert.ok(
    validateR0AmendmentMarkdown(conflictingOwner).some((error) =>
      error.includes('packet ownership'),
    ),
  );

  const missingM10 = source.replace(/^\| M10 \|.*\n/m, '');
  assert.ok(
    validateR0AmendmentMarkdown(missingM10).some((error) => error.includes('milestone M10')),
  );

  const accidentalW08Owner = source.replace('| 消费 001–022 |', '| 001–022 消费 |');
  assert.ok(
    validateR0AmendmentMarkdown(accidentalW08Owner).some((error) =>
      error.includes('non-owner packet W08'),
    ),
  );
});

test('R0 amendment CLI binds output to canonical bytes and never authorizes runtime', async () => {
  const { stdout } = await execFileAsync(process.execPath, [cliPath], { cwd: root });
  const output = JSON.parse(stdout);
  const sourceBytes = await readFile(amendmentPath);
  assert.equal(output.sourceDigest, createHash('sha256').update(sourceBytes).digest('hex'));
  assert.equal(output.expectedSourceDigest, output.sourceDigest);
  assert.equal(output.canAuthorizeRuntime, false);
  assert.equal(output.decision, 'VALID_REPINNED_AMENDMENT');
  assert.deepEqual(output.effectiveBase, effectiveBase);
  assert.deepEqual(output.ownerAssignments, ownerAssignments);

  await assert.rejects(
    execFileAsync(process.execPath, [cliPath, amendmentPath], { cwd: root }),
    (error) => error.code === 64 && error.stderr.includes('canonical amendment path'),
  );
});

test('R0 amendment CLI returns distinct fail-closed results for invalid and unreadable input', async () => {
  const fixtureRoot = await mkdtemp(join(tmpdir(), 'r0-amendment-check-'));
  try {
    const fixtureScripts = join(fixtureRoot, 'scripts');
    const fixtureChange = join(
      fixtureRoot,
      '.harness/changes/docs-r0-trusted-kernel-amendment-20260720',
    );
    await mkdir(join(fixtureScripts, 'lib'), { recursive: true });
    await mkdir(fixtureChange, { recursive: true });
    await mkdir(join(fixtureRoot, '.harness/manifest'), { recursive: true });
    await copyFile(cliPath, join(fixtureScripts, 'r0-amendment-check.mjs'));
    await copyFile(
      join(root, 'scripts/lib/r0-amendment-check.mjs'),
      join(fixtureScripts, 'lib/r0-amendment-check.mjs'),
    );
    await copyFile(
      join(root, '.harness/manifest/project-harness.json'),
      join(fixtureRoot, '.harness/manifest/project-harness.json'),
    );

    const fixtureAmendment = join(fixtureChange, 'amendment.md');
    await copyFile(amendmentPath, fixtureAmendment);
    const fixtureManifestPath = join(fixtureRoot, '.harness/manifest/project-harness.json');
    const fixtureManifest = JSON.parse(await readFile(fixtureManifestPath, 'utf8'));
    fixtureManifest.amendmentGovernance.document = 'other-amendment.md';
    await writeFile(fixtureManifestPath, `${JSON.stringify(fixtureManifest, null, 2)}\n`);
    await assert.rejects(
      execFileAsync(process.execPath, [join(fixtureScripts, 'r0-amendment-check.mjs')], {
        cwd: fixtureRoot,
      }),
      (error) => {
        const output = JSON.parse(error.stdout);
        return (
          error.code === 1 &&
          output.errors.includes(
            'manifest amendment document differs from canonical amendment path',
          )
        );
      },
    );

    fixtureManifest.amendmentGovernance.document =
      '.harness/changes/docs-r0-trusted-kernel-amendment-20260720/amendment.md';
    fixtureManifest.amendmentGovernance.candidateSourceDigest = '0'.repeat(64);
    await writeFile(fixtureManifestPath, `${JSON.stringify(fixtureManifest, null, 2)}\n`);
    await assert.rejects(
      execFileAsync(process.execPath, [join(fixtureScripts, 'r0-amendment-check.mjs')], {
        cwd: fixtureRoot,
      }),
      (error) => {
        const output = JSON.parse(error.stdout);
        return (
          error.code === 1 &&
          output.errors.includes(
            'amendment sourceDigest differs from manifest candidateSourceDigest',
          )
        );
      },
    );

    fixtureManifest.amendmentGovernance.candidateSourceDigest = createHash('sha256')
      .update(await readFile(fixtureAmendment))
      .digest('hex');
    const savedEffectiveBase = fixtureManifest.amendmentGovernance.effectiveBase;
    delete fixtureManifest.amendmentGovernance.effectiveBase;
    await writeFile(fixtureManifestPath, `${JSON.stringify(fixtureManifest, null, 2)}\n`);
    await assert.rejects(
      execFileAsync(process.execPath, [join(fixtureScripts, 'r0-amendment-check.mjs')], {
        cwd: fixtureRoot,
      }),
      (error) => {
        const output = JSON.parse(error.stdout);
        return (
          error.code === 1 &&
          output.errors.includes('manifest amendment effectiveBase is missing or invalid')
        );
      },
    );
    fixtureManifest.amendmentGovernance.effectiveBase = savedEffectiveBase;

    const savedOwnerAssignments = fixtureManifest.amendmentGovernance.ownerAssignments;
    delete fixtureManifest.amendmentGovernance.ownerAssignments;
    await writeFile(fixtureManifestPath, `${JSON.stringify(fixtureManifest, null, 2)}\n`);
    await assert.rejects(
      execFileAsync(process.execPath, [join(fixtureScripts, 'r0-amendment-check.mjs')], {
        cwd: fixtureRoot,
      }),
      (error) => {
        const output = JSON.parse(error.stdout);
        return (
          error.code === 1 &&
          output.errors.includes('manifest amendment ownerAssignments are missing or invalid')
        );
      },
    );
    fixtureManifest.amendmentGovernance.ownerAssignments = savedOwnerAssignments;

    await writeFile(fixtureManifestPath, '{ invalid json\n');
    await assert.rejects(
      execFileAsync(process.execPath, [join(fixtureScripts, 'r0-amendment-check.mjs')], {
        cwd: fixtureRoot,
      }),
      (error) => {
        const output = JSON.parse(error.stdout);
        return (
          error.code === 65 &&
          output.errors.includes('PROJECT_HARNESS_MANIFEST_INVALID') &&
          output.canAuthorizeRuntime === false
        );
      },
    );
    await writeFile(fixtureManifestPath, `${JSON.stringify(fixtureManifest, null, 2)}\n`);

    await writeFile(fixtureAmendment, 'invalid amendment\n');
    await assert.rejects(
      execFileAsync(process.execPath, [join(fixtureScripts, 'r0-amendment-check.mjs')], {
        cwd: fixtureRoot,
      }),
      (error) => {
        const output = JSON.parse(error.stdout);
        return error.code === 1 && output.decision === 'STOP' && output.canAuthorizeRuntime === false;
      },
    );

    await rm(fixtureAmendment);
    await assert.rejects(
      execFileAsync(process.execPath, [join(fixtureScripts, 'r0-amendment-check.mjs')], {
        cwd: fixtureRoot,
      }),
      (error) => {
        const output = JSON.parse(error.stdout);
        return (
          error.code === 66 &&
          output.decision === 'STOP' &&
          output.errors.includes('AMENDMENT_OR_MANIFEST_READ_FAILED') &&
          output.canAuthorizeRuntime === false
        );
      },
    );
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});
