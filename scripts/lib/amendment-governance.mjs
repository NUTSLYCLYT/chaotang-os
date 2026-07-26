import { createHash } from 'node:crypto';
import { lstat, readFile } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';

export const EXPECTED_R0_EFFECTIVE_BASE = Object.freeze({
  ref: 'origin/feature-chaotang-ext',
  sha: 'ccc2d74a2e439830e9c6ae7adcefb5ee8c05c150',
});

export const EXPECTED_R0_OWNER_ASSIGNMENTS = Object.freeze({
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

export const EXPECTED_R0_PROFESSIONAL_REASSIGNMENT_GATE_STATUS_PROPOSED =
  'DECLARATIVE_PRECONDITION_NOT_RUNTIME_ENFORCED';
export const EXPECTED_R0_PROFESSIONAL_REASSIGNMENT_GATE_STATUS_APPROVED =
  'RUNTIME_ENFORCED_BY_EXECUTION_AUTHORITY_V2';

const REQUIRED_REASSIGNMENT_BOUNDARIES = Object.freeze([
  'REAL_CUSTOMER_DATA',
  'R0-W08',
  'R0-W09',
]);
const REQUIRED_PROFESSIONAL_ROLES = Object.freeze(['security', 'legal', 'release']);
const REQUIRED_VERIFICATION_PROPOSED = Object.freeze([
  'node --test scripts/r0-amendment-check.nodetest.mjs',
  'node scripts/r0-amendment-check.mjs',
  'node scripts/harness-doctor.mjs',
]);
const REQUIRED_VERIFICATION_APPROVED = Object.freeze([
  ...REQUIRED_VERIFICATION_PROPOSED,
  'node --test scripts/execution-authority-v2.nodetest.mjs',
  'node scripts/execution-authority-v2.mjs --check',
]);
const APPROVED_SCOPE = Object.freeze(['R0-W01']);
const HEX64_PATTERN = /^[0-9a-f]{64}$/;
const HEX40_PATTERN = /^[0-9a-f]{40}$/;
const WORK_PACKAGE_PATTERN = /^R0-W0[0-9]$/;
const REVIEWER_REASSIGNMENT_KEYS = Object.freeze([
  'approvedBy',
  'candidateH',
  'candidateMutation',
  'executionOwner',
  'expiresAfter',
  'fromReviewer',
  'ownerApprovalPath',
  'ownerApprovalSha256',
  'reviewPackagePath',
  'reviewPackageSha256',
  'reviewPassesRequired',
  'reviews',
  'schemaVersion',
  'scope',
  'sessionIsolation',
  'status',
  'toReviewer',
  'tree',
  'writeAccess',
]);
const REVIEW_PASS_KEYS = Object.freeze([
  'high',
  'medium',
  'path',
  'sessionId',
  'sha256',
  'verdict',
  'writeAccess',
]);

function hasExactEntries(actual, expected) {
  if (actual === null || typeof actual !== 'object' || Array.isArray(actual)) return false;
  const actualKeys = Object.keys(actual).sort();
  const expectedKeys = Object.keys(expected).sort();
  return (
    actualKeys.length === expectedKeys.length &&
    expectedKeys.every((key, index) => actualKeys[index] === key && actual[key] === expected[key])
  );
}

function hasExactItems(actual, expected) {
  return (
    Array.isArray(actual) &&
    actual.length === expected.length &&
    expected.every((item, index) => actual[index] === item)
  );
}

function hasExactKeys(actual, expected) {
  return (
    actual !== null &&
    typeof actual === 'object' &&
    !Array.isArray(actual) &&
    sameArray(Object.keys(actual).sort(), [...expected].sort())
  );
}

function sameArray(left, right) {
  return (
    Array.isArray(left) &&
    Array.isArray(right) &&
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function safeRepositoryPath(path) {
  return (
    typeof path === 'string' &&
    path.length > 0 &&
    !isAbsolute(path) &&
    !path.includes('\\') &&
    !path.includes('\0') &&
    !path.split('/').includes('..')
  );
}

export function validateReviewerReassignmentOverlay(overlay) {
  const errors = [];
  if (!hasExactKeys(overlay, REVIEWER_REASSIGNMENT_KEYS)) {
    return ['reviewer reassignment has missing or unsupported fields'];
  }
  if (overlay.schemaVersion !== 'reviewer-reassignment.v1') {
    errors.push('reviewer reassignment schemaVersion is unsupported');
  }
  if (overlay.status !== 'APPROVED') {
    errors.push('reviewer reassignment status must be APPROVED');
  }
  if (!sameArray(overlay.scope, ['R0-W07'])) {
    errors.push('reviewer reassignment scope must be exactly R0-W07');
  }
  if (overlay.fromReviewer !== 'Claude Code') {
    errors.push('reviewer reassignment fromReviewer must be Claude Code');
  }
  if (overlay.toReviewer !== 'Codex Independent QA') {
    errors.push('reviewer reassignment toReviewer must be Codex Independent QA');
  }
  if (overlay.executionOwner !== 'Codex') {
    errors.push('reviewer reassignment executionOwner must remain Codex');
  }
  if (overlay.toReviewer === overlay.executionOwner) {
    errors.push('reviewer reassignment reviewer must differ from execution owner identity');
  }
  if (overlay.reviewPassesRequired !== 2) {
    errors.push('reviewer reassignment must require exactly two review passes');
  }
  if (overlay.sessionIsolation !== 'FRESH_NO_FORK_CONTEXT') {
    errors.push('reviewer reassignment sessionIsolation must be FRESH_NO_FORK_CONTEXT');
  }
  if (overlay.writeAccess !== 'DENIED') {
    errors.push('reviewer reassignment writeAccess must be DENIED');
  }
  if (overlay.candidateMutation !== 'FORBIDDEN') {
    errors.push('reviewer reassignment candidateMutation must be FORBIDDEN');
  }
  if (overlay.expiresAfter !== 'R0-W07_MERGED_AND_VERIFIED') {
    errors.push('reviewer reassignment must expire after R0-W07_MERGED_AND_VERIFIED');
  }
  if (!HEX40_PATTERN.test(overlay.candidateH ?? '')) {
    errors.push('reviewer reassignment candidateH must be a 40-hex git sha');
  }
  if (!HEX40_PATTERN.test(overlay.tree ?? '')) {
    errors.push('reviewer reassignment tree must be a 40-hex git tree');
  }
  for (const [pathField, digestField] of [
    ['reviewPackagePath', 'reviewPackageSha256'],
    ['ownerApprovalPath', 'ownerApprovalSha256'],
  ]) {
    if (!safeRepositoryPath(overlay[pathField])) {
      errors.push(`reviewer reassignment ${pathField} must be a safe repository path`);
    }
    if (!HEX64_PATTERN.test(overlay[digestField] ?? '')) {
      errors.push(`reviewer reassignment ${digestField} must be a sha256 hex digest`);
    }
  }
  if (
    !Array.isArray(overlay.reviews) ||
    overlay.reviews.length !== overlay.reviewPassesRequired
  ) {
    errors.push('reviewer reassignment requires exactly two review passes');
  } else {
    const sessions = new Set();
    for (const review of overlay.reviews) {
      if (!hasExactKeys(review, REVIEW_PASS_KEYS)) {
        errors.push('review pass has missing or unsupported fields');
        continue;
      }
      if (typeof review.sessionId !== 'string' || review.sessionId.length === 0) {
        errors.push('review sessionId must be non-empty');
      } else if (sessions.has(review.sessionId)) {
        errors.push('review passes must use a unique sessionId');
      } else {
        sessions.add(review.sessionId);
      }
      if (!safeRepositoryPath(review.path)) {
        errors.push('review path must be a safe repository path');
      }
      if (!HEX64_PATTERN.test(review.sha256 ?? '')) {
        errors.push('review sha256 must be a sha256 hex digest');
      }
      if (review.verdict !== 'GO') errors.push('review verdict must be GO');
      if (review.high !== 0 || review.medium !== 0) {
        errors.push('review must have zero unresolved HIGH and MEDIUM findings');
      }
      if (review.writeAccess !== 'DENIED') {
        errors.push('review writeAccess must be DENIED');
      }
    }
  }
  if (overlay.approvedBy !== 'lyt') {
    errors.push('reviewer reassignment approvedBy must be lyt');
  }
  return [...new Set(errors)];
}

export function effectiveIndependentReviewer(amendmentGovernance, workPackage) {
  const overlay = amendmentGovernance?.reviewerReassignment;
  if (overlay === undefined || overlay === null) {
    return amendmentGovernance?.independentReviewer ?? null;
  }
  if (validateReviewerReassignmentOverlay(overlay).length > 0) return null;
  return overlay.scope.includes(workPackage)
    ? overlay.toReviewer
    : amendmentGovernance?.independentReviewer ?? null;
}

function validateCommonFields(amendment, { requiredVerification, gateStatus }) {
  const errors = [];
  if (amendment.canAuthorizeRuntime !== false) {
    errors.push('amendment governance checker must never authorize runtime');
  }
  if (
    amendment.document !== '.harness/changes/docs-r0-trusted-kernel-amendment-20260720/amendment.md'
  ) {
    errors.push('amendment governance document must remain the canonical R0 amendment path');
  }
  if (!HEX64_PATTERN.test(amendment.candidateSourceDigest ?? '')) {
    errors.push('amendment governance candidateSourceDigest must be a sha256 hex digest');
  }
  if (!hasExactEntries(amendment.effectiveBase, EXPECTED_R0_EFFECTIVE_BASE)) {
    errors.push('amendment governance effective base differs from the re-pinned EXT base');
  }
  if (!hasExactEntries(amendment.ownerAssignments, EXPECTED_R0_OWNER_ASSIGNMENTS)) {
    errors.push('amendment governance named R0 owners differ from the approved interim assignments');
  }
  if (amendment.executionOwner !== 'Codex') {
    errors.push('amendment governance executionOwner must be Codex');
  }
  if (amendment.independentReviewer !== 'Claude Code') {
    errors.push('amendment governance independentReviewer must be Claude Code');
  }
  if (
    amendment.reviewerReassignment !== undefined &&
    amendment.reviewerReassignment !== null
  ) {
    errors.push(...validateReviewerReassignmentOverlay(amendment.reviewerReassignment));
  }
  if (!hasExactItems(amendment.professionalReassignmentRequiredBefore, REQUIRED_REASSIGNMENT_BOUNDARIES)) {
    errors.push('amendment governance must reassign professionals before customer data, W08, and W09');
  }
  if (!hasExactItems(amendment.professionalRolesRequired, REQUIRED_PROFESSIONAL_ROLES)) {
    errors.push('amendment governance must require professional security, legal, and release owners');
  }
  if (amendment.professionalReassignmentGateStatus !== gateStatus) {
    errors.push(`professional reassignment gate must be ${gateStatus}`);
  }
  for (const command of requiredVerification) {
    if (!(amendment.verification ?? []).includes(command)) {
      errors.push(`amendment governance missing verification command: ${command}`);
    }
  }
  return errors;
}

function validateProposedNotAuthority(amendment) {
  const errors = validateCommonFields(amendment, {
    requiredVerification: REQUIRED_VERIFICATION_PROPOSED,
    gateStatus: EXPECTED_R0_PROFESSIONAL_REASSIGNMENT_GATE_STATUS_PROPOSED,
  });
  if (amendment.approvalEvidence !== null) {
    errors.push('proposed amendment must not carry approvalEvidence');
  }
  if (amendment.approvedSourceDigest !== null) {
    errors.push('proposed amendment must not carry an approvedSourceDigest');
  }
  return errors;
}

function validateApprovalEvidenceShape(evidence) {
  const errors = [];
  if (
    !evidence ||
    typeof evidence !== 'object' ||
    Array.isArray(evidence) ||
    !sameArray(
      Object.keys(evidence).sort(),
      [
        'approvedScope',
        'approver',
        'candidateH',
        'ownerApprovalPath',
        'ownerApprovalSha256',
        'reviewPath',
        'reviewSha256',
        'reviewVerdict',
        'tree',
      ].sort(),
    )
  ) {
    return ['approvalEvidence has missing or unsupported fields'];
  }
  if (
    !safeRepositoryPath(evidence.ownerApprovalPath) ||
    !/owner_approval\/exact-h-approval\.md$/.test(evidence.ownerApprovalPath)
  ) {
    errors.push('approvalEvidence.ownerApprovalPath is not a valid owner approval path');
  }
  if (!HEX64_PATTERN.test(evidence.ownerApprovalSha256 ?? '')) {
    errors.push('approvalEvidence.ownerApprovalSha256 must be a sha256 hex digest');
  }
  if (
    !safeRepositoryPath(evidence.reviewPath) ||
    !/claude_code_review\/exact-h-final\.md$/.test(evidence.reviewPath)
  ) {
    errors.push('approvalEvidence.reviewPath is not a valid review evidence path');
  }
  if (!HEX64_PATTERN.test(evidence.reviewSha256 ?? '')) {
    errors.push('approvalEvidence.reviewSha256 must be a sha256 hex digest');
  }
  if (evidence.reviewVerdict !== 'GO') errors.push('approvalEvidence.reviewVerdict must be GO');
  if (typeof evidence.approver !== 'string' || evidence.approver.length === 0) {
    errors.push('approvalEvidence.approver must be a non-empty string');
  }
  if (!HEX40_PATTERN.test(evidence.candidateH ?? '')) {
    errors.push('approvalEvidence.candidateH must be a 40-hex git sha');
  }
  if (!HEX40_PATTERN.test(evidence.tree ?? '')) {
    errors.push('approvalEvidence.tree must be a 40-hex git tree id');
  }
  if (
    !Array.isArray(evidence.approvedScope) ||
    !evidence.approvedScope.every((id) => WORK_PACKAGE_PATTERN.test(id)) ||
    !sameArray(evidence.approvedScope, APPROVED_SCOPE)
  ) {
    errors.push('approvalEvidence.approvedScope must be exactly ["R0-W01"]');
  }
  return errors;
}

function validateApprovedForW01(amendment) {
  const errors = validateCommonFields(amendment, {
    requiredVerification: REQUIRED_VERIFICATION_APPROVED,
    gateStatus: EXPECTED_R0_PROFESSIONAL_REASSIGNMENT_GATE_STATUS_APPROVED,
  });
  if (!HEX64_PATTERN.test(amendment.approvedSourceDigest ?? '')) {
    errors.push('approved amendment must carry a sha256 approvedSourceDigest');
  } else if (amendment.approvedSourceDigest !== amendment.candidateSourceDigest) {
    errors.push('approvedSourceDigest must equal candidateSourceDigest once approved');
  }
  errors.push(...validateApprovalEvidenceShape(amendment.approvalEvidence));
  return errors;
}

export function validateAmendmentGovernanceRegistration(amendment) {
  if (amendment === null || typeof amendment !== 'object' || Array.isArray(amendment)) {
    return ['amendment governance registration must be an object'];
  }
  if (amendment.status === 'PROPOSED_NOT_AUTHORITY') {
    return validateProposedNotAuthority(amendment);
  }
  if (amendment.status === 'APPROVED_FOR_W01') {
    return validateApprovedForW01(amendment);
  }
  return [`amendment governance has invalid status: ${amendment.status}`];
}

export async function verifyAmendmentApprovalEvidenceFiles(root, amendment) {
  const errors = [];
  if (!amendment) return errors;

  async function verifyEvidenceFile(path, expectedDigest, fieldLabel) {
    if (!safeRepositoryPath(path)) {
      errors.push(`${fieldLabel}: unsafe path`);
      return;
    }
    let current = root;
    const components = path.split('/');
    for (const component of components) {
      current = join(current, component);
      let stat;
      try {
        stat = await lstat(current);
      } catch (cause) {
        errors.push(`${fieldLabel}: missing path component: ${cause.code ?? cause.message}`);
        return;
      }
      if (stat.isSymbolicLink()) {
        errors.push(`${fieldLabel}: symbolic links are forbidden`);
        return;
      }
    }
    const source = await readFile(current);
    const digest = createHash('sha256').update(source).digest('hex');
    if (digest !== expectedDigest) {
      errors.push(`${fieldLabel}: digest mismatch`);
    }
  }

  const evidence = amendment.approvalEvidence;
  if (evidence !== null && evidence !== undefined) {
    for (const [pathField, digestField] of [
      ['ownerApprovalPath', 'ownerApprovalSha256'],
      ['reviewPath', 'reviewSha256'],
    ]) {
      await verifyEvidenceFile(
        evidence[pathField],
        evidence[digestField],
        `approvalEvidence.${pathField}`,
      );
    }
  }

  const overlay = amendment.reviewerReassignment;
  if (overlay !== null && overlay !== undefined) {
    await verifyEvidenceFile(
      overlay.reviewPackagePath,
      overlay.reviewPackageSha256,
      'reviewerReassignment.reviewPackagePath',
    );
    await verifyEvidenceFile(
      overlay.ownerApprovalPath,
      overlay.ownerApprovalSha256,
      'reviewerReassignment.ownerApprovalPath',
    );
    if (Array.isArray(overlay.reviews)) {
      for (let index = 0; index < overlay.reviews.length; index += 1) {
        await verifyEvidenceFile(
          overlay.reviews[index].path,
          overlay.reviews[index].sha256,
          `reviewerReassignment.reviews[${index}].path`,
        );
      }
    }
  }
  return errors;
}
