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
  if (!amendment || amendment.approvalEvidence === null || amendment.approvalEvidence === undefined) {
    return [];
  }
  const evidence = amendment.approvalEvidence;
  const errors = [];
  for (const [pathField, digestField] of [
    ['ownerApprovalPath', 'ownerApprovalSha256'],
    ['reviewPath', 'reviewSha256'],
  ]) {
    const path = evidence[pathField];
    if (!safeRepositoryPath(path)) {
      errors.push(`approvalEvidence.${pathField}: unsafe path`);
      continue;
    }
    let current = root;
    const components = path.split('/');
    let failed = false;
    for (let index = 0; index < components.length; index += 1) {
      current = join(current, components[index]);
      let stat;
      try {
        stat = await lstat(current);
      } catch (cause) {
        errors.push(`approvalEvidence.${pathField}: missing path component: ${cause.code ?? cause.message}`);
        failed = true;
        break;
      }
      if (stat.isSymbolicLink()) {
        errors.push(`approvalEvidence.${pathField}: symbolic links are forbidden`);
        failed = true;
        break;
      }
    }
    if (failed) continue;
    const source = await readFile(current, 'utf8');
    const digest = createHash('sha256').update(source, 'utf8').digest('hex');
    if (digest !== evidence[digestField]) {
      errors.push(`approvalEvidence.${pathField}: digest mismatch`);
    }
  }
  return errors;
}
