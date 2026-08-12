import {
  effectiveReviewerSuccessorW08,
  validateReviewerSuccessorW08,
  verifyReviewerSuccessorW08,
} from './reviewer-successor-w08.mjs';

const execFileAsync = promisify(execFile);
const GIT = '/usr/bin/git';

function gitOptions(root, encoding = 'utf8') {
  return {
    cwd: root,
    encoding,
    maxBuffer: 10 * 1024 * 1024,
    env: {
      ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_'))),
      GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', GIT_ATTR_NOSYSTEM: '1',
      GIT_OPTIONAL_LOCKS: '0', LC_ALL: 'C',
    },
  };
}

async function git(root, ...args) {
  return (await execFileAsync(GIT, [
    '--no-replace-objects',
    '-c', 'core.attributesFile=/dev/null',
    '-c', 'core.commitGraph=false',
    ...args,
  ], gitOptions(root))).stdout.trim();
}

async function exactDiffPaths(root, base, candidate) {
  const source = await git(root, 'diff', '--name-only', '--no-renames', `${base}..${candidate}`);
  return source.split('\n').filter(Boolean).sort();
}

function samePaths(actual, expected) {
  return JSON.stringify(actual) === JSON.stringify([...expected].sort());
}

export const REVIEWER_SUCCESSOR_W08_D4A_ROOT =
  '.harness/changes/docs-r0-w08-d4a-exact-h-activation-20260812';
export const REVIEWER_SUCCESSOR_W08_D4A_PRODUCT_BASE =
  'df6c82cfa3f3b449da7c5a4500c643c3f45501fd';
export const REVIEWER_SUCCESSOR_W08_D4A_PRODUCT_H =
  'e25706c0c5d689354d2424f483446a1e243b58ec';
export const REVIEWER_SUCCESSOR_W08_D4A_PRODUCT_TREE =
  '1bc77790d7327b364a6e972620de456aa913f699';
export const REVIEWER_SUCCESSOR_W08_D4A_PRODUCT_DIFF_SHA256 =
  '9e5ff0c70dbafc96700ea2479fec886b21e9926263f6406e435adc92b9a9002d';

const EXTRA_OVERLAY_KEYS = Object.freeze(['continuationId', 'priorPromotionH', 'priorPromotionTree']);
const BASE_OVERLAY_KEYS = Object.freeze([
  'approvedBy', 'candidateMutation', 'executionOwner', 'expiresAfter', 'fromReviewer',
  'governanceBaseH', 'governanceCandidateH', 'governanceReviewPackagePath',
  'governanceReviewPackageSha256', 'governanceTree', 'ownerApprovalPath',
  'ownerApprovalSha256', 'productBaseH', 'productCandidateH', 'productReviewPackagePath',
  'productReviewPackageSha256', 'productTree', 'reviewPassesRequired', 'reviews',
  'schemaVersion', 'scope', 'sessionIsolation', 'status', 'toReviewer', 'writeAccess',
]);
const REVIEW_EVIDENCE_KEYS = Object.freeze([
  'candidateMutation', 'continuationId', 'governanceBaseH', 'governanceCandidateH',
  'governanceReviewPackagePath', 'governanceReviewPackageSha256', 'governanceTree',
  'high', 'identity', 'kind', 'medium', 'pass', 'priorPromotionH', 'priorPromotionTree',
  'productBaseH', 'productCandidateH', 'productReviewPackagePath',
  'productReviewPackageSha256', 'productTree', 'reviewer', 'schemaVersion', 'scope',
  'verdict', 'writeAccess',
]);
const OWNER_EVIDENCE_KEYS = Object.freeze([
  'approver', 'continuationId', 'decision', 'governanceBaseH', 'governanceCandidateH',
  'governanceReviewPackagePath', 'governanceReviewPackageSha256', 'governanceTree', 'kind',
  'priorPromotionH', 'priorPromotionTree', 'productBaseH', 'productCandidateH',
  'productReviewPackagePath', 'productReviewPackageSha256', 'productTree', 'reviews',
  'schemaVersion', 'scope',
]);
const PRODUCT_PATHS = Object.freeze([
  '.harness/changes/feat-ext-d4a-docx-provenance-20260812/ci_result/ci_summary.md',
  '.harness/changes/feat-ext-d4a-docx-provenance-20260812/request_analysis/spec.md',
  '.harness/changes/feat-ext-d4a-docx-provenance-20260812/request_analysis/tasks.md',
  '.harness/changes/feat-ext-d4a-docx-provenance-20260812/summary.md',
  'backend/src/secure_ingest/document_text.py',
  'backend/tests/test_secure_ingest_document_text.py',
  'backend/web/routers/secure_ingest.py',
]);
const GOVERNANCE_PATHS = Object.freeze([
  `${REVIEWER_SUCCESSOR_W08_D4A_ROOT}/ci_result/governance-candidate.md`,
  `${REVIEWER_SUCCESSOR_W08_D4A_ROOT}/request_analysis/spec.md`,
  `${REVIEWER_SUCCESSOR_W08_D4A_ROOT}/request_analysis/tasks.md`,
  `${REVIEWER_SUCCESSOR_W08_D4A_ROOT}/summary.md`,
  'scripts/execution-authority-v2.nodetest.mjs', 'scripts/lib/amendment-governance.mjs',
  'scripts/lib/execution-authority-v2.mjs', 'scripts/lib/reviewer-successor-w08-d4a.mjs',
  'scripts/lib/reviewer-successor-w08.mjs', 'scripts/reviewer-successor-w08-d4a.nodetest.mjs',
  'scripts/reviewer-successor-w08.nodetest.mjs',
]);
const ACTIVATION_PATHS = Object.freeze([
  '.harness/manifest/execution-authority.v2.json', '.harness/manifest/project-harness.json',
  `${REVIEWER_SUCCESSOR_W08_D4A_ROOT}/activation_intent/r0-w08-d4a-activation-intent.json`,
  `${REVIEWER_SUCCESSOR_W08_D4A_ROOT}/codex_review/exact-h-final.md`,
  `${REVIEWER_SUCCESSOR_W08_D4A_ROOT}/codex_review/pass-1.md`,
  `${REVIEWER_SUCCESSOR_W08_D4A_ROOT}/owner_approval/reviewer-successor-approval.md`,
  `${REVIEWER_SUCCESSOR_W08_D4A_ROOT}/owner_approval/exact-h-approval.md`,
  `${REVIEWER_SUCCESSOR_W08_D4A_ROOT}/review_inputs/product-candidate.diff`,
  `${REVIEWER_SUCCESSOR_W08_D4A_ROOT}/review_inputs/reviewer-successor.diff`,
]);

const PROFILE = Object.freeze({
  schemaVersion: 'reviewer-successor.w08-d4a.v1',
  evidenceSchemaVersion: 'reviewer-successor.w08-d4a.evidence.v1',
  marker: 'reviewer-successor-w08-d4a-evidence', root: REVIEWER_SUCCESSOR_W08_D4A_ROOT,
  productBaseH: REVIEWER_SUCCESSOR_W08_D4A_PRODUCT_BASE,
  productCandidateH: REVIEWER_SUCCESSOR_W08_D4A_PRODUCT_H,
  productTree: REVIEWER_SUCCESSOR_W08_D4A_PRODUCT_TREE,
  productDiffSha256: REVIEWER_SUCCESSOR_W08_D4A_PRODUCT_DIFF_SHA256,
  expiresAfter: 'R0-W08_D4A_MERGED_AND_VERIFIED', governanceReviewFile: 'reviewer-successor.diff',
  ownerApprovalFile: 'reviewer-successor-approval.md', activationCarrierPaths: ACTIVATION_PATHS,
  productPaths: PRODUCT_PATHS, governancePaths: GOVERNANCE_PATHS,
  protectedPaths: [...GOVERNANCE_PATHS, 'scripts/execution-authority-v2.mjs'],
  overlayKeys: [...BASE_OVERLAY_KEYS, ...EXTRA_OVERLAY_KEYS],
  reviewEvidenceKeys: REVIEW_EVIDENCE_KEYS, ownerEvidenceKeys: OWNER_EVIDENCE_KEYS,
  extraExactValues: [
    ['continuationId', 'R0-W08-D4A-DOCX-PROVENANCE-01'],
    ['priorPromotionH', REVIEWER_SUCCESSOR_W08_D4A_PRODUCT_BASE],
    ['priorPromotionTree', '559c0091bd60020b9c7faf936b687602970feab4'],
  ],
  extraReviewEvidence: (o) => ({ continuationId: o.continuationId, priorPromotionH: o.priorPromotionH, priorPromotionTree: o.priorPromotionTree }),
  extraOwnerEvidence: (o) => ({ continuationId: o.continuationId, priorPromotionH: o.priorPromotionH, priorPromotionTree: o.priorPromotionTree }),
});

export function validateReviewerSuccessorW08D4A(overlay) {
  return validateReviewerSuccessorW08(overlay, PROFILE).map((error) => error.replaceAll('reviewerSuccessorW08', 'reviewerSuccessorW08D4A'));
}

export function effectiveReviewerSuccessorW08D4A(amendmentGovernance, workPackage, ledger = []) {
  return effectiveReviewerSuccessorW08({ reviewerSuccessorW08: amendmentGovernance?.reviewerSuccessorW08D4A }, workPackage, ledger, PROFILE);
}

export async function verifyReviewerSuccessorW08D4A(root, overlay, priorOverlay) {
  const errors = validateReviewerSuccessorW08D4A(overlay);
  const priorErrors = validateReviewerSuccessorW08(priorOverlay);
  if (priorErrors.length > 0) {
    return priorErrors.map((error) => `reviewerSuccessorW08D4A prior chain: ${error}`);
  }
  if (errors.length > 0) return errors;
  errors.push(...(await verifyReviewerSuccessorW08D4ATopology(root, overlay)));
  if (errors.length > 0) return errors;
  const [priorVerified, verified] = await Promise.all([
    verifyReviewerSuccessorW08(root, priorOverlay, undefined, {
      headOverride: overlay.priorPromotionH,
      bindWorkingTree: false,
    }),
    verifyReviewerSuccessorW08(root, overlay, PROFILE),
  ]);
  return [
    ...priorVerified.map((error) => `reviewerSuccessorW08D4A prior chain: ${error}`),
    ...verified.map((error) => error.replaceAll('reviewerSuccessorW08', 'reviewerSuccessorW08D4A')),
  ];
}

export async function verifyReviewerSuccessorW08D4ATopology(root, overlay) {
  const errors = validateReviewerSuccessorW08D4A(overlay);
  if (errors.length > 0) return errors;
  try {
    const head = await git(root, 'rev-parse', 'HEAD^{commit}');
    const headLine = (await git(root, 'rev-list', '--parents', '-n', '1', head)).split(/\s+/u);
    if (headLine.length !== 3 || headLine[1] !== overlay.priorPromotionH) {
      return ['reviewerSuccessorW08D4A promotion must have exact parents [B,A]'];
    }
    const activationH = headLine[2];
    const activationLine = (await git(root, 'rev-list', '--parents', '-n', '1', activationH)).split(/\s+/u);
    const governanceLine = (await git(root, 'rev-list', '--parents', '-n', '1', overlay.governanceCandidateH)).split(/\s+/u);
    if (activationLine.length !== 2 || activationLine[1] !== overlay.governanceCandidateH) {
      errors.push('reviewerSuccessorW08D4A A must be the direct child of G');
    }
    if (governanceLine.length !== 2 || governanceLine[1] !== overlay.productCandidateH) {
      errors.push('reviewerSuccessorW08D4A G must be the direct child of P');
    }
    const [priorTree, productTree, governanceTree, activationTree, headTree] = await Promise.all([
      git(root, 'rev-parse', `${overlay.priorPromotionH}^{tree}`),
      git(root, 'rev-parse', `${overlay.productCandidateH}^{tree}`),
      git(root, 'rev-parse', `${overlay.governanceCandidateH}^{tree}`),
      git(root, 'rev-parse', `${activationH}^{tree}`),
      git(root, 'rev-parse', `${head}^{tree}`),
    ]);
    if (priorTree !== overlay.priorPromotionTree) errors.push('reviewerSuccessorW08D4A prior promotion tree mismatch');
    if (productTree !== overlay.productTree) errors.push('reviewerSuccessorW08D4A product tree mismatch');
    if (governanceTree !== overlay.governanceTree) errors.push('reviewerSuccessorW08D4A governance tree mismatch');
    if (headTree !== activationTree) errors.push('reviewerSuccessorW08D4A promotion tree must equal A tree');
    const [productPaths, governancePaths, activationPaths] = await Promise.all([
      exactDiffPaths(root, overlay.productBaseH, overlay.productCandidateH),
      exactDiffPaths(root, overlay.governanceBaseH, overlay.governanceCandidateH),
      exactDiffPaths(root, overlay.governanceCandidateH, activationH),
    ]);
    if (!samePaths(productPaths, PRODUCT_PATHS)) errors.push('reviewerSuccessorW08D4A product paths must be exact 7');
    if (!samePaths(governancePaths, GOVERNANCE_PATHS)) errors.push('reviewerSuccessorW08D4A governance paths must be exact 11');
    if (!samePaths(activationPaths, ACTIVATION_PATHS)) errors.push('reviewerSuccessorW08D4A activation paths must be exact 9');
  } catch (cause) {
    errors.push(`reviewerSuccessorW08D4A topology unverifiable: ${cause.code ?? cause.message}`);
  }
  return [...new Set(errors)];
}

export const REVIEWER_SUCCESSOR_W08_D4A_PRODUCT_PATHS = PRODUCT_PATHS;
export const REVIEWER_SUCCESSOR_W08_D4A_GOVERNANCE_PATHS = GOVERNANCE_PATHS;
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
