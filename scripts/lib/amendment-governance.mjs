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

const REQUIRED_REASSIGNMENT_BOUNDARIES = Object.freeze([
  'REAL_CUSTOMER_DATA',
  'R0-W08',
  'R0-W09',
]);
const REQUIRED_PROFESSIONAL_ROLES = Object.freeze(['security', 'legal', 'release']);
const REQUIRED_VERIFICATION = Object.freeze([
  'node --test scripts/r0-amendment-check.nodetest.mjs',
  'node scripts/r0-amendment-check.mjs',
  'node scripts/harness-doctor.mjs',
]);

function hasExactEntries(actual, expected) {
  if (actual === null || typeof actual !== 'object' || Array.isArray(actual)) return false;
  const actualKeys = Object.keys(actual).sort();
  const expectedKeys = Object.keys(expected).sort();
  return (
    actualKeys.length === expectedKeys.length &&
    expectedKeys.every(
      (key, index) => actualKeys[index] === key && actual[key] === expected[key],
    )
  );
}

function hasExactItems(actual, expected) {
  return (
    Array.isArray(actual) &&
    actual.length === expected.length &&
    expected.every((item, index) => actual[index] === item)
  );
}

export function validateAmendmentGovernanceRegistration(amendment) {
  if (amendment === null || typeof amendment !== 'object' || Array.isArray(amendment)) {
    return ['amendment governance registration must be an object'];
  }

  const errors = [];
  if (amendment.status !== 'PROPOSED_NOT_AUTHORITY') {
    errors.push(`amendment governance has invalid status: ${amendment.status}`);
  }
  if (amendment.canAuthorizeRuntime !== false) {
    errors.push('amendment governance checker must never authorize runtime');
  }
  if (
    amendment.document !==
    '.harness/changes/docs-r0-trusted-kernel-amendment-20260720/amendment.md'
  ) {
    errors.push('amendment governance document must remain the canonical R0 amendment path');
  }
  if (!/^[0-9a-f]{64}$/.test(amendment.candidateSourceDigest ?? '')) {
    errors.push('amendment governance candidateSourceDigest must be a sha256 hex digest');
  }
  if (!hasExactEntries(amendment.effectiveBase, EXPECTED_R0_EFFECTIVE_BASE)) {
    errors.push('amendment governance effective base differs from the re-pinned EXT base');
  }
  if (!hasExactEntries(amendment.ownerAssignments, EXPECTED_R0_OWNER_ASSIGNMENTS)) {
    errors.push(
      'amendment governance named R0 owners differ from the approved interim assignments',
    );
  }
  if (amendment.executionOwner !== 'Codex') {
    errors.push('amendment governance executionOwner must be Codex');
  }
  if (amendment.independentReviewer !== 'Claude Code') {
    errors.push('amendment governance independentReviewer must be Claude Code');
  }
  if (
    !hasExactItems(
      amendment.professionalReassignmentRequiredBefore,
      REQUIRED_REASSIGNMENT_BOUNDARIES,
    )
  ) {
    errors.push(
      'amendment governance must reassign professionals before customer data, W08, and W09',
    );
  }
  if (!hasExactItems(amendment.professionalRolesRequired, REQUIRED_PROFESSIONAL_ROLES)) {
    errors.push(
      'amendment governance must require professional security, legal, and release owners',
    );
  }
  if (
    amendment.professionalReassignmentGateStatus !==
    'DECLARATIVE_PRECONDITION_NOT_RUNTIME_ENFORCED'
  ) {
    errors.push(
      'professional reassignment gate must remain declarative until execution-authority v2 enforces it',
    );
  }
  if (amendment.approvalEvidence !== null) {
    errors.push('proposed amendment must not carry approvalEvidence');
  }
  if (amendment.approvedSourceDigest !== null) {
    errors.push('proposed amendment must not carry an approvedSourceDigest');
  }
  for (const command of REQUIRED_VERIFICATION) {
    if (!(amendment.verification ?? []).includes(command)) {
      errors.push(`amendment governance missing verification command: ${command}`);
    }
  }
  return errors;
}
