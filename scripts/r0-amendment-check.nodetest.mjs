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
  reviewerReassignmentDiffArgs,
  validateAmendmentGovernanceRegistration,
  validateReviewerReassignmentOverlay,
  verifyAmendmentApprovalEvidenceFiles,
  verifyReviewerReassignmentActivationHistory,
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
      '019f9c6d-d611-7400-b03f-3b2e474543a8',
      '019f9c6d-d648-7961-a3eb-7071cc51eec9',
      '019f9c7c-09d3-7d70-890a-9f77201076e3',
      '019f9c7c-0a04-7a20-b62f-cdd8779ad09d',
      '019f9c8a-e2d2-7d13-8a5a-781992a38021',
      '019f9c8a-e301-7430-a67f-270e119262b2',
      '019f9cd7-fbb2-76c2-adc5-a2dd003543c6',
      '019f9cd7-fbed-7e73-9774-80c8c23569ac',
      '019f9ce3-9a79-79d1-ab66-caf35bb82778',
      '019f9ce3-9ab1-7df1-aef9-14c1b939b7c3',
      '019f9cf4-7b7d-7840-85b4-953d47fa995d',
      '019f9cf4-7bb2-79a3-ba7e-277a0eec60c8',
      '019f9d05-77f5-79a3-8d0c-4a0e036ce563',
      '019f9d05-782d-78e3-98ca-b76baf67ba94',
      '019f9d3e-2f09-7fb0-81ad-4a0bb0a6ef3d',
      '019f9d3e-5bf0-7f71-b824-2747a3cc0bda',
      '019f9d4b-e4ac-7c92-a38c-492e4619f442',
      '019f9d4c-1bff-71c3-8967-d8f6550f1b33',
      '019f9d56-e07e-7d10-b75c-7e07bbf5c2eb',
      '019f9d57-0d8d-7142-b5b4-d0e2c8cb4fce',
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

test('review package Git command disables external diff and text conversion', () => {
  assert.deepEqual(reviewerReassignmentDiffArgs('base', 'candidate'), [
    '--no-replace-objects',
    'diff',
    '--no-ext-diff',
    '--no-textconv',
    '--binary',
    'base..candidate',
  ]);
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
      'R0-W07',
      [{ id: 'R0-W07', status: 'ROLLED_BACK' }],
    ),
    'Claude Code',
  );
  const malformedOverlay = structuredClone(overlay);
  malformedOverlay.scope = ['R0-W08'];
  assert.equal(
    effectiveIndependentReviewer(
      { independentReviewer: 'Claude Code', reviewerReassignment: malformedOverlay },
      'R0-W06',
      [{ id: 'R0-W06', status: 'ACTIVE' }],
    ),
    'Claude Code',
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
        rejectedSessionIds: overlay.rejectedSessionIds,
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
        writingSessionId: overlay.writingSessionId,
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
      rejectedSessionIds: overlay.rejectedSessionIds,
      writingSessionId: overlay.writingSessionId,
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

    await execFileAsync(
      'git',
      ['tag', '-a', 'candidate-tag', '-m', 'candidate tag', overlay.candidateH],
      { cwd: tempRoot },
    );
    const tagObject = (
      await execFileAsync('git', ['rev-parse', 'candidate-tag'], { cwd: tempRoot })
    ).stdout.trim();
    const originalBaseH = overlay.baseH;
    overlay.baseH = tagObject;
    assert.ok(
      (await verifyAmendmentApprovalEvidenceFiles(tempRoot, governance)).some(
        (error) => error === 'reviewerReassignment.baseH: git object mismatch',
      ),
    );
    overlay.baseH = originalBaseH;

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

test('W07 activation requires a prior quiescent overlay registration commit', async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), 'reviewer-activation-history-'));
  try {
    await execFileAsync('git', ['init', '-q'], { cwd: tempRoot });
    await execFileAsync('git', ['config', 'user.name', 'R0 Test'], { cwd: tempRoot });
    await execFileAsync('git', ['config', 'user.email', 'r0@example.invalid'], {
      cwd: tempRoot,
    });
    const protectedPaths = [
      '.harness/contracts/execution-authority-v2.schema.json',
      'scripts/execution-authority-v2.mjs',
      'scripts/lib/amendment-governance.mjs',
      'scripts/lib/execution-authority-v2.mjs',
    ];
    for (const path of protectedPaths) {
      await mkdir(dirname(join(tempRoot, path)), { recursive: true });
      await writeFile(join(tempRoot, path), `${path}\n`);
    }
    await mkdir(join(tempRoot, '.harness/manifest'), { recursive: true });
    await writeFile(
      join(tempRoot, '.harness/manifest/project-harness.json'),
      `${JSON.stringify({ amendmentGovernance: {} }, null, 2)}\n`,
    );
    await writeFile(
      join(tempRoot, '.harness/manifest/execution-authority.v2.json'),
      `${JSON.stringify({ activeWorkPackage: null, workPackageLedger: [] }, null, 2)}\n`,
    );
    await execFileAsync('git', ['add', '.'], { cwd: tempRoot });
    await execFileAsync('git', ['commit', '-qm', 'reviewed candidate'], {
      cwd: tempRoot,
    });

    const overlay = approvedReviewerReassignmentFixture();
    overlay.candidateH = (
      await execFileAsync('git', ['rev-parse', 'HEAD'], { cwd: tempRoot })
    ).stdout.trim();
    overlay.baseH = overlay.candidateH;
    overlay.tree = (
      await execFileAsync('git', ['rev-parse', 'HEAD^{tree}'], { cwd: tempRoot })
    ).stdout.trim();
    const evidencePaths = [
      [overlay.reviewPackagePath, 'package\n', 'reviewPackageSha256'],
      [overlay.ownerApprovalPath, 'owner\n', 'ownerApprovalSha256'],
    ];
    for (const [path, source, digestField] of evidencePaths) {
      await mkdir(dirname(join(tempRoot, path)), { recursive: true });
      await writeFile(join(tempRoot, path), source);
      overlay[digestField] = createHash('sha256').update(source).digest('hex');
    }
    for (let index = 0; index < overlay.reviews.length; index += 1) {
      const review = overlay.reviews[index];
      const source = `review ${index + 1}\n`;
      await mkdir(dirname(join(tempRoot, review.path)), { recursive: true });
      await writeFile(join(tempRoot, review.path), source);
      review.sha256 = createHash('sha256').update(source).digest('hex');
    }
    const projectPath = join(tempRoot, '.harness/manifest/project-harness.json');
    const authorityPath = join(
      tempRoot,
      '.harness/manifest/execution-authority.v2.json',
    );
    await mkdir(dirname(projectPath), { recursive: true });
    await writeFile(
      projectPath,
      `${JSON.stringify({ amendmentGovernance: { reviewerReassignment: overlay } }, null, 2)}\n`,
    );
    await writeFile(
      authorityPath,
      `${JSON.stringify({ activeWorkPackage: null, workPackageLedger: [] }, null, 2)}\n`,
    );
    await execFileAsync('git', ['add', '.'], { cwd: tempRoot });
    await execFileAsync('git', ['commit', '-qm', 'register overlay'], { cwd: tempRoot });

    await writeFile(
      authorityPath,
      `${JSON.stringify({
        activeWorkPackage: 'R0-W07',
        workPackageLedger: [{ id: 'R0-W07', status: 'ACTIVE' }],
      }, null, 2)}\n`,
    );
    await execFileAsync('git', ['add', '.'], { cwd: tempRoot });
    await execFileAsync('git', ['commit', '-qm', 'activate W07'], { cwd: tempRoot });
    assert.deepEqual(
      await verifyReviewerReassignmentActivationHistory(
        tempRoot,
        { reviewerReassignment: overlay },
        { activeWorkPackage: 'R0-W07' },
      ),
      [],
    );

    await writeFile(join(tempRoot, protectedPaths[0]), 'uncommitted drift\n');
    assert.ok(
      (await verifyReviewerReassignmentActivationHistory(
        tempRoot,
        { reviewerReassignment: overlay },
        { activeWorkPackage: 'R0-W07' },
      )).some((error) => error.includes('working tree drift')),
    );
    await writeFile(join(tempRoot, protectedPaths[0]), `${protectedPaths[0]}\n`);

    await writeFile(join(tempRoot, 'unrelated.txt'), 'post-activation work\n');
    await execFileAsync('git', ['add', 'unrelated.txt'], { cwd: tempRoot });
    await execFileAsync('git', ['commit', '-qm', 'post activation work'], {
      cwd: tempRoot,
    });
    assert.deepEqual(
      await verifyReviewerReassignmentActivationHistory(
        tempRoot,
        { reviewerReassignment: overlay },
        { activeWorkPackage: 'R0-W07' },
      ),
      [],
    );

    const activeAuthoritySource = await readFile(authorityPath, 'utf8');
    const activeProjectSource = await readFile(projectPath, 'utf8');
    await writeFile(
      authorityPath,
      `${JSON.stringify({
        activeWorkPackage: null,
        workPackageLedger: [{ id: 'R0-W07', status: 'MERGED_AND_VERIFIED' }],
      }, null, 2)}\n`,
    );
    await writeFile(
      projectPath,
      `${JSON.stringify({ amendmentGovernance: {} }, null, 2)}\n`,
    );
    await execFileAsync('git', ['add', '.'], { cwd: tempRoot });
    await execFileAsync('git', ['commit', '-qm', 'expire W07 overlay'], {
      cwd: tempRoot,
    });
    await writeFile(authorityPath, activeAuthoritySource);
    await writeFile(projectPath, activeProjectSource);
    await execFileAsync('git', ['add', '.'], { cwd: tempRoot });
    await execFileAsync('git', ['commit', '-qm', 'replay expired overlay'], {
      cwd: tempRoot,
    });
    assert.ok(
      (await verifyReviewerReassignmentActivationHistory(
        tempRoot,
        { reviewerReassignment: overlay },
        { activeWorkPackage: 'R0-W07' },
      )).some((error) => error.includes('continuous activation history')),
    );

    await execFileAsync('git', ['checkout', '-qb', 'uncommitted', overlay.candidateH], {
      cwd: tempRoot,
    });
    await mkdir(dirname(projectPath), { recursive: true });
    await writeFile(
      projectPath,
      `${JSON.stringify({ amendmentGovernance: { reviewerReassignment: overlay } }, null, 2)}\n`,
    );
    await writeFile(
      authorityPath,
      `${JSON.stringify({ activeWorkPackage: null, workPackageLedger: [] }, null, 2)}\n`,
    );
    for (const [path, source] of evidencePaths) {
      await mkdir(dirname(join(tempRoot, path)), { recursive: true });
      await writeFile(join(tempRoot, path), source);
    }
    for (let index = 0; index < overlay.reviews.length; index += 1) {
      const review = overlay.reviews[index];
      await mkdir(dirname(join(tempRoot, review.path)), { recursive: true });
      await writeFile(join(tempRoot, review.path), `review ${index + 1}\n`);
    }
    await execFileAsync('git', ['add', '.'], { cwd: tempRoot });
    await execFileAsync('git', ['commit', '-qm', 'register overlay for uncommitted case'], {
      cwd: tempRoot,
    });
    await writeFile(join(tempRoot, 'unrelated.txt'), 'registration descendant\n');
    await execFileAsync('git', ['add', 'unrelated.txt'], { cwd: tempRoot });
    await execFileAsync('git', ['commit', '-qm', 'registration descendant'], {
      cwd: tempRoot,
    });
    await writeFile(
      authorityPath,
      `${JSON.stringify({
        activeWorkPackage: 'R0-W07',
        workPackageLedger: [{ id: 'R0-W07', status: 'ACTIVE' }],
      }, null, 2)}\n`,
    );
    assert.ok(
      (await verifyReviewerReassignmentActivationHistory(
        tempRoot,
        { reviewerReassignment: overlay },
        { activeWorkPackage: 'R0-W07' },
      )).some((error) => error.includes('committed activation event')),
    );
    await execFileAsync('git', ['restore', '.harness/manifest/execution-authority.v2.json'], {
      cwd: tempRoot,
    });

    await execFileAsync('git', ['checkout', '-qb', 'terminal-reactivation', overlay.candidateH], {
      cwd: tempRoot,
    });
    await mkdir(dirname(projectPath), { recursive: true });
    await writeFile(
      projectPath,
      `${JSON.stringify({ amendmentGovernance: {} }, null, 2)}\n`,
    );
    await writeFile(
      authorityPath,
      `${JSON.stringify({
        activeWorkPackage: null,
        workPackageLedger: [{ id: 'R0-W07', status: 'MERGED_AND_VERIFIED' }],
      }, null, 2)}\n`,
    );
    await execFileAsync('git', ['add', '.'], { cwd: tempRoot });
    await execFileAsync('git', ['commit', '-qm', 'terminal W07 before overlay'], {
      cwd: tempRoot,
    });
    await writeFile(
      authorityPath,
      `${JSON.stringify({ activeWorkPackage: null, workPackageLedger: [] }, null, 2)}\n`,
    );
    await execFileAsync('git', ['add', '.'], { cwd: tempRoot });
    await execFileAsync('git', ['commit', '-qm', 'delete terminal W07 ledger entry'], {
      cwd: tempRoot,
    });
    await writeFile(
      projectPath,
      `${JSON.stringify({ amendmentGovernance: { reviewerReassignment: overlay } }, null, 2)}\n`,
    );
    for (const [path, source] of evidencePaths) {
      await mkdir(dirname(join(tempRoot, path)), { recursive: true });
      await writeFile(join(tempRoot, path), source);
    }
    for (let index = 0; index < overlay.reviews.length; index += 1) {
      const review = overlay.reviews[index];
      await mkdir(dirname(join(tempRoot, review.path)), { recursive: true });
      await writeFile(join(tempRoot, review.path), `review ${index + 1}\n`);
    }
    await execFileAsync('git', ['add', '.'], { cwd: tempRoot });
    await execFileAsync('git', ['commit', '-qm', 'register overlay after terminal W07'], {
      cwd: tempRoot,
    });
    await writeFile(
      authorityPath,
      `${JSON.stringify({
        activeWorkPackage: 'R0-W07',
        workPackageLedger: [{ id: 'R0-W07', status: 'ACTIVE' }],
      }, null, 2)}\n`,
    );
    await execFileAsync('git', ['add', '.'], { cwd: tempRoot });
    await execFileAsync('git', ['commit', '-qm', 'attempt terminal W07 reactivation'], {
      cwd: tempRoot,
    });
    assert.ok(
      (await verifyReviewerReassignmentActivationHistory(
        tempRoot,
        { reviewerReassignment: overlay },
        { activeWorkPackage: 'R0-W07' },
      )).some((error) => error.includes('reachable history already contains R0-W07')),
    );
    await execFileAsync(
      'git',
      ['checkout', '-qb', 'hidden-second-parent-w07', overlay.candidateH],
      { cwd: tempRoot },
    );
    await writeFile(
      authorityPath,
      `${JSON.stringify({
        activeWorkPackage: 'R0-W07',
        workPackageLedger: [{ id: 'R0-W07', status: 'ACTIVE' }],
        unexpectedHistoricalField: true,
      }, null, 2)}\n`,
    );
    await execFileAsync('git', ['add', '.'], { cwd: tempRoot });
    await execFileAsync('git', ['commit', '-qm', 'hidden second-parent W07'], {
      cwd: tempRoot,
    });

    await execFileAsync(
      'git',
      ['checkout', '-qb', 'merge-parent-replay', overlay.candidateH],
      { cwd: tempRoot },
    );
    await execFileAsync(
      'git',
      [
        'merge',
        '-q',
        '--no-ff',
        '-s',
        'ours',
        'hidden-second-parent-w07',
        '-m',
        'merge hidden authority history',
      ],
      { cwd: tempRoot },
    );
    await writeFile(
      projectPath,
      `${JSON.stringify({ amendmentGovernance: { reviewerReassignment: overlay } }, null, 2)}\n`,
    );
    await writeFile(
      authorityPath,
      `${JSON.stringify({ activeWorkPackage: null, workPackageLedger: [] }, null, 2)}\n`,
    );
    for (const [path, source] of evidencePaths) {
      await mkdir(dirname(join(tempRoot, path)), { recursive: true });
      await writeFile(join(tempRoot, path), source);
    }
    for (let index = 0; index < overlay.reviews.length; index += 1) {
      const review = overlay.reviews[index];
      await mkdir(dirname(join(tempRoot, review.path)), { recursive: true });
      await writeFile(join(tempRoot, review.path), `review ${index + 1}\n`);
    }
    await execFileAsync('git', ['add', '.'], { cwd: tempRoot });
    await execFileAsync('git', ['commit', '-qm', 'register after hidden W07 merge'], {
      cwd: tempRoot,
    });
    await writeFile(
      authorityPath,
      `${JSON.stringify({
        activeWorkPackage: 'R0-W07',
        workPackageLedger: [{ id: 'R0-W07', status: 'ACTIVE' }],
      }, null, 2)}\n`,
    );
    await execFileAsync('git', ['add', '.'], { cwd: tempRoot });
    await execFileAsync('git', ['commit', '-qm', 'activate after hidden W07 merge'], {
      cwd: tempRoot,
    });
    assert.ok(
      (await verifyReviewerReassignmentActivationHistory(
        tempRoot,
        { reviewerReassignment: overlay },
        { activeWorkPackage: 'R0-W07' },
      )).some((error) => error.includes('reachable history already contains R0-W07')),
    );
    assert.ok(
      (await verifyReviewerReassignmentActivationHistory(
        tempRoot,
        { reviewerReassignment: overlay },
        { activeWorkPackage: 'R0-W07' },
        (authority) =>
          authority.unexpectedHistoricalField === true
            ? ['unexpected historical manifest field']
            : [],
      )).some((error) => error.includes('unexpected historical manifest field')),
    );

    await execFileAsync(
      'git',
      ['checkout', '-qb', 'merge-activation', overlay.candidateH],
      { cwd: tempRoot },
    );
    await writeFile(
      projectPath,
      `${JSON.stringify({ amendmentGovernance: { reviewerReassignment: overlay } }, null, 2)}\n`,
    );
    await writeFile(
      authorityPath,
      `${JSON.stringify({ activeWorkPackage: null, workPackageLedger: [] }, null, 2)}\n`,
    );
    for (const [path, source] of evidencePaths) {
      await mkdir(dirname(join(tempRoot, path)), { recursive: true });
      await writeFile(join(tempRoot, path), source);
    }
    for (let index = 0; index < overlay.reviews.length; index += 1) {
      const review = overlay.reviews[index];
      await mkdir(dirname(join(tempRoot, review.path)), { recursive: true });
      await writeFile(join(tempRoot, review.path), `review ${index + 1}\n`);
    }
    await execFileAsync('git', ['add', '.'], { cwd: tempRoot });
    await execFileAsync('git', ['commit', '-qm', 'register before merge activation'], {
      cwd: tempRoot,
    });
    await execFileAsync(
      'git',
      ['merge', '-q', '--no-ff', '--no-commit', '-s', 'ours', 'hidden-second-parent-w07'],
      { cwd: tempRoot },
    );
    await writeFile(
      authorityPath,
      `${JSON.stringify({
        activeWorkPackage: 'R0-W07',
        workPackageLedger: [{ id: 'R0-W07', status: 'ACTIVE' }],
      }, null, 2)}\n`,
    );
    await execFileAsync('git', ['add', '.'], { cwd: tempRoot });
    await execFileAsync('git', ['commit', '-qm', 'merge activation'], {
      cwd: tempRoot,
    });
    assert.ok(
      (await verifyReviewerReassignmentActivationHistory(
        tempRoot,
        { reviewerReassignment: overlay },
        { activeWorkPackage: 'R0-W07' },
      )).some((error) => error.includes('activation commit must have exactly one parent')),
    );

    await execFileAsync('git', ['checkout', '-qb', 'combined', overlay.candidateH], {
      cwd: tempRoot,
    });
    await mkdir(dirname(projectPath), { recursive: true });
    await writeFile(
      projectPath,
      `${JSON.stringify({ amendmentGovernance: { reviewerReassignment: overlay } }, null, 2)}\n`,
    );
    await writeFile(
      authorityPath,
      `${JSON.stringify({
        activeWorkPackage: 'R0-W07',
        workPackageLedger: [{ id: 'R0-W07', status: 'ACTIVE' }],
      }, null, 2)}\n`,
    );
    for (const [path, source] of evidencePaths) {
      await mkdir(dirname(join(tempRoot, path)), { recursive: true });
      await writeFile(join(tempRoot, path), source);
    }
    for (let index = 0; index < overlay.reviews.length; index += 1) {
      const review = overlay.reviews[index];
      await mkdir(dirname(join(tempRoot, review.path)), { recursive: true });
      await writeFile(join(tempRoot, review.path), `review ${index + 1}\n`);
    }
    await execFileAsync('git', ['add', '.'], { cwd: tempRoot });
    await execFileAsync('git', ['commit', '-qm', 'combined registration activation'], {
      cwd: tempRoot,
    });
    assert.notDeepEqual(
      await verifyReviewerReassignmentActivationHistory(
        tempRoot,
        { reviewerReassignment: overlay },
        { activeWorkPackage: 'R0-W07' },
      ),
      [],
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
    'rejected session replay',
    (overlay) => { overlay.reviews[0].sessionId = overlay.rejectedSessionIds[0]; },
    'must not reuse a rejected session',
  ],
  [
    'rejected session substitution',
    (overlay) => { overlay.rejectedSessionIds[0] = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'; },
    'must bind all prior rejected sessions',
  ],
  [
    'writer receipt substitution',
    (overlay) => { overlay.writingSessionId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'; },
    'must match the frozen writer receipt',
  ],
  [
    'base substitution',
    (overlay) => { overlay.baseH = 'a'.repeat(40); },
    'must match the frozen EXT baseline',
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
