import assert from 'node:assert/strict';
import test from 'node:test';

import {
  REVIEWER_SUCCESSOR_W08_PRODUCT_BASE,
  REVIEWER_SUCCESSOR_W08_PRODUCT_DIFF_SHA256,
  REVIEWER_SUCCESSOR_W08_PRODUCT_H,
  REVIEWER_SUCCESSOR_W08_PRODUCT_TREE,
  REVIEWER_SUCCESSOR_W08_ROOT,
  effectiveReviewerSuccessorW08,
  parseReviewerSuccessorW08Evidence,
  validateReviewerSuccessorW08,
} from './lib/reviewer-successor-w08.mjs';

function validOverlay() {
  return {
    schemaVersion: 'reviewer-successor.w08.v1',
    status: 'APPROVED',
    scope: ['R0-W08'],
    fromReviewer: 'Claude Code',
    toReviewer: 'Codex Independent QA',
    executionOwner: 'Codex',
    reviewPassesRequired: 2,
    sessionIsolation: 'FRESH_NO_FORK_CONTEXT',
    writeAccess: 'DENIED',
    candidateMutation: 'FORBIDDEN',
    expiresAfter: 'R0-W08_MERGED_AND_VERIFIED',
    productBaseH: REVIEWER_SUCCESSOR_W08_PRODUCT_BASE,
    productCandidateH: REVIEWER_SUCCESSOR_W08_PRODUCT_H,
    productTree: REVIEWER_SUCCESSOR_W08_PRODUCT_TREE,
    productReviewPackagePath: `${REVIEWER_SUCCESSOR_W08_ROOT}/review_inputs/product-candidate.diff`,
    productReviewPackageSha256: REVIEWER_SUCCESSOR_W08_PRODUCT_DIFF_SHA256,
    governanceBaseH: REVIEWER_SUCCESSOR_W08_PRODUCT_H,
    governanceCandidateH: '1'.repeat(40),
    governanceTree: '2'.repeat(40),
    governanceReviewPackagePath: `${REVIEWER_SUCCESSOR_W08_ROOT}/review_inputs/reviewer-successor.diff`,
    governanceReviewPackageSha256: '3'.repeat(64),
    ownerApprovalPath: `${REVIEWER_SUCCESSOR_W08_ROOT}/owner_approval/exact-h-approval.md`,
    ownerApprovalSha256: '4'.repeat(64),
    reviews: [
      {
        identity: '/root/w08_successor_qa_pass1',
        path: `${REVIEWER_SUCCESSOR_W08_ROOT}/codex_review/pass-1.md`,
        sha256: '5'.repeat(64),
        verdict: 'GO',
        high: 0,
        medium: 0,
        writeAccess: 'DENIED',
      },
      {
        identity: '/root/w08_successor_qa_pass2',
        path: `${REVIEWER_SUCCESSOR_W08_ROOT}/codex_review/exact-h-final.md`,
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

test('valid W08 reviewer successor selects Codex Independent QA only for active W08', () => {
  const governance = { reviewerSuccessorW08: validOverlay() };
  assert.deepEqual(validateReviewerSuccessorW08(governance.reviewerSuccessorW08), []);
  assert.equal(
    effectiveReviewerSuccessorW08(governance, 'R0-W08', [
      { id: 'R0-W08', status: 'ACTIVE' },
    ]),
    'Codex Independent QA',
  );
  assert.equal(
    effectiveReviewerSuccessorW08(governance, 'R0-W08', [
      { id: 'R0-W08', status: 'MERGED_AND_VERIFIED' },
    ]),
    null,
  );
  assert.equal(
    effectiveReviewerSuccessorW08(governance, 'R0-W09', [
      { id: 'R0-W09', status: 'ACTIVE' },
    ]),
    null,
  );
});

for (const [name, mutate, message] of [
  ['scope expansion', (overlay) => { overlay.scope = ['R0-W08', 'R0-W09']; }, 'scope'],
  ['owner self-review', (overlay) => { overlay.toReviewer = 'Codex'; }, 'execution owner'],
  ['single pass', (overlay) => { overlay.reviews.pop(); }, 'exactly two'],
  ['shared identity', (overlay) => { overlay.reviews[1].identity = overlay.reviews[0].identity; }, 'identities'],
  ['write access', (overlay) => { overlay.reviews[0].writeAccess = 'ALLOWED'; }, 'deny writes'],
  ['candidate mutation', (overlay) => { overlay.candidateMutation = 'ALLOWED'; }, 'candidateMutation'],
  ['product H drift', (overlay) => { overlay.productCandidateH = '7'.repeat(40); }, 'productCandidateH'],
  ['product tree drift', (overlay) => { overlay.productTree = '8'.repeat(40); }, 'productTree'],
  ['product diff digest drift', (overlay) => { overlay.productReviewPackageSha256 = '9'.repeat(64); }, 'productReviewPackageSha256'],
  ['unsafe evidence path', (overlay) => { overlay.ownerApprovalPath = '../approval.md'; }, 'ownerApprovalPath'],
]) {
  test(`W08 reviewer successor fails closed for ${name}`, () => {
    const overlay = validOverlay();
    mutate(overlay);
    const errors = validateReviewerSuccessorW08(overlay);
    assert.ok(errors.some((error) => error.includes(message)), errors.join('\n'));
  });
}

test('review evidence requires one marked block', () => {
  assert.throws(
    () => parseReviewerSuccessorW08Evidence('{}'),
    /require exactly one marked JSON evidence block/u,
  );
});
