import { createHash } from 'node:crypto';
import { lstat, readFile } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';

import {
  effectiveIndependentReviewer,
  validateAmendmentGovernanceRegistration,
  verifyAmendmentApprovalEvidenceFiles,
  verifyReviewerReassignmentActivationHistory,
} from './amendment-governance.mjs';

export const EXECUTION_AUTHORITY_V2_PATH = '.harness/manifest/execution-authority.v2.json';
export const EXECUTION_AUTHORITY_V2_SCHEMA_PATH =
  '.harness/contracts/execution-authority-v2.schema.json';

export const EXPECTED_R0_WORK_PACKAGE_SEQUENCE = Object.freeze([
  'R0-W00',
  'R0-W01',
  'R0-W02',
  'R0-W03',
  'R0-W04',
  'R0-W05',
  'R0-W06',
  'R0-W07',
  'R0-W08',
  'R0-W09',
]);

export const EXPECTED_EXECUTION_AUTHORITY_V2_REGISTRATION = Object.freeze({
  status: 'APPROVED_FOR_W01_GUARD_ACTIVE',
  manifest: EXECUTION_AUTHORITY_V2_PATH,
  schema: EXECUTION_AUTHORITY_V2_SCHEMA_PATH,
  resolver: 'scripts/lib/execution-authority-v2.mjs',
  command: 'scripts/execution-authority-v2.mjs',
  test: 'scripts/execution-authority-v2.nodetest.mjs',
  documentation: '.harness/wiki/execution-authority-v2.md',
  verification: Object.freeze([
    'node --test scripts/execution-authority-v2.nodetest.mjs',
    'node scripts/execution-authority-v2.mjs --check',
    'node scripts/harness-doctor.mjs',
  ]),
});

const AUTHORITY_ID = 'r0-execution-authority-20260721-v2';
const AMENDMENT_ID = 'R0-TRUSTED-KERNEL-AMENDMENT-01';
const AMENDMENT_PATH = '.harness/changes/docs-r0-trusted-kernel-amendment-20260720/amendment.md';
const HEX64_PATTERN = /^[0-9a-f]{64}$/;
const HEX40_PATTERN = /^[0-9a-f]{40}$/;
const WORK_PACKAGE_PATTERN = /^R0-W0[0-9]$/;
const LEDGER_STATUSES = new Set([
  'NOT_STARTED',
  'ACTIVE',
  'MERGED_AND_VERIFIED',
  'BLOCKED_DEPENDENCY',
  'ROLLED_BACK',
]);
const EXPECTED_REQUIRED_BEFORE = Object.freeze(['REAL_CUSTOMER_DATA', 'R0-W08', 'R0-W09']);
const EXPECTED_ROLES_REQUIRED = Object.freeze(['security', 'legal', 'release']);
const PROFESSIONAL_GATE_TRIGGER_PACKAGES = new Set(['R0-W08', 'R0-W09']);
const EVIDENCE_VERSION = 'execution-authority-v2-evidence.v1';
const ACTIVATION_INTENT_SCHEMA_VERSION = 'execution-authority.v2.activation-intent.v1';
const ACTIVATION_INTENT_KIND = 'activation-intent';
const REQUIRED_W06_EXCLUSIONS = Object.freeze([
  'NO_DEPLOYMENT',
  'NO_REAL_CUSTOMER_DATA',
  'NO_DB_MIGRATION',
  'NO_LISTENER_3050_TAKEOVER',
  'NO_R0_W07_TO_R0_W09',
  'NO_AUTOMATIC_MERGE',
  'NO_PRODUCTION_CLAIM',
]);
const RECOVERY_CHANGE_ROOT = '.harness/changes/fix-ext-g0-authority-recovery-20260725';
const REVIEW_PACKAGE_PATH =
  `${RECOVERY_CHANGE_ROOT}/review_inputs/review-7df6e4e1..e8be2ca9.diff`;
const ALLOWED_REVIEW_CHANGED_PATHS = new Set([
  '.harness/manifest/execution-authority.v2.json',
  `${RECOVERY_CHANGE_ROOT}/ci_result/ci_summary.md`,
  `${RECOVERY_CHANGE_ROOT}/claude_code_review/exact-h-final.md`,
  `${RECOVERY_CHANGE_ROOT}/claude_code_review/review-request.md`,
  `${RECOVERY_CHANGE_ROOT}/owner_approval/exact-h-approval.md`,
  `${RECOVERY_CHANGE_ROOT}/owner_scope/recovery-boundary.md`,
  `${RECOVERY_CHANGE_ROOT}/activation_intent/r0-w06-activation-intent.json`,
  `${RECOVERY_CHANGE_ROOT}/request_analysis/tasks.md`,
  `${RECOVERY_CHANGE_ROOT}/summary.md`,
  'docs/superpowers/plans/2026-07-25-ext-recovery-program.md',
  'scripts/execution-authority-v2.nodetest.mjs',
  'scripts/execution-authority.nodetest.mjs',
  'scripts/lib/execution-authority-v2.mjs',
]);
const REQUIRED_REVIEW_COMMANDS = Object.freeze([
  'node --test scripts/execution-authority.nodetest.mjs',
  'node --test scripts/execution-authority-v2.nodetest.mjs',
  'node scripts/execution-authority.mjs --authorize',
  'node scripts/execution-authority-v2.mjs --authorize --work-package R0-W06',
  'node scripts/harness-doctor.mjs',
  'git diff --check',
]);

function sameArray(left, right) {
  return (
    Array.isArray(left) &&
    Array.isArray(right) &&
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function exactKeys(value, expected) {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    sameArray(Object.keys(value).sort(), [...expected].sort())
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

function findDuplicateJsonKeys(source) {
  let cursor = 0;
  const duplicates = [];
  const skipWhitespace = () => {
    while (/\s/u.test(source[cursor] ?? '')) cursor += 1;
  };
  const scanString = () => {
    const start = cursor;
    cursor += 1;
    while (cursor < source.length) {
      if (source[cursor] === '\\') cursor += 2;
      else if (source[cursor] === '"') {
        cursor += 1;
        return JSON.parse(source.slice(start, cursor));
      } else cursor += 1;
    }
    throw new SyntaxError('unterminated JSON string');
  };
  const scanValue = (path, depth = 0) => {
    if (depth > 64) throw new SyntaxError('JSON nesting depth exceeds 64');
    skipWhitespace();
    if (source[cursor] === '{') return scanObject(path, depth);
    if (source[cursor] === '[') return scanArray(path, depth);
    if (source[cursor] === '"') return scanString();
    while (cursor < source.length && !/[,\]}]/u.test(source[cursor])) cursor += 1;
    return undefined;
  };
  const scanObject = (path, depth) => {
    const keys = new Set();
    cursor += 1;
    skipWhitespace();
    if (source[cursor] === '}') {
      cursor += 1;
      return;
    }
    while (cursor < source.length) {
      skipWhitespace();
      const key = scanString();
      const keyPath = `${path}[${JSON.stringify(key)}]`;
      if (keys.has(key)) duplicates.push(keyPath);
      keys.add(key);
      skipWhitespace();
      if (source[cursor] !== ':') throw new SyntaxError(`missing colon at ${keyPath}`);
      cursor += 1;
      scanValue(keyPath, depth + 1);
      skipWhitespace();
      if (source[cursor] === '}') {
        cursor += 1;
        return;
      }
      if (source[cursor] !== ',') throw new SyntaxError(`missing comma at ${keyPath}`);
      cursor += 1;
    }
    throw new SyntaxError(`unterminated object at ${path}`);
  };
  const scanArray = (path, depth) => {
    cursor += 1;
    skipWhitespace();
    if (source[cursor] === ']') {
      cursor += 1;
      return;
    }
    let index = 0;
    while (cursor < source.length) {
      scanValue(`${path}[${index}]`, depth + 1);
      index += 1;
      skipWhitespace();
      if (source[cursor] === ']') {
        cursor += 1;
        return;
      }
      if (source[cursor] !== ',') throw new SyntaxError(`missing comma at ${path}`);
      cursor += 1;
    }
    throw new SyntaxError(`unterminated array at ${path}`);
  };

  scanValue('$');
  return [...new Set(duplicates)];
}

export function parseJsonObjectWithUniqueKeys(source, label = 'JSON document') {
  if (typeof source !== 'string') throw new TypeError(`${label}: source must be text`);
  const duplicates = findDuplicateJsonKeys(source);
  if (duplicates.length > 0) {
    throw new SyntaxError(`${label}: duplicate object key(s): ${duplicates.join(', ')}`);
  }
  const value = JSON.parse(source);
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label}: root must be an object`);
  }
  return value;
}

export function sha256Hex(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

export function parseExecutionAuthorityV2Evidence(source, label = 'authority evidence') {
  if (typeof source !== 'string') throw new TypeError(`${label}: source must be text`);
  const matches = [
    ...source.matchAll(
      /<!-- execution-authority-v2-evidence:start -->\r?\n```json\r?\n([\s\S]*?)\r?\n```\r?\n<!-- execution-authority-v2-evidence:end -->/gu,
    ),
  ];
  if (matches.length !== 1) {
    throw new SyntaxError(`${label}: require exactly one marked JSON evidence block`);
  }
  return parseJsonObjectWithUniqueKeys(matches[0][1], `${label} JSON evidence`);
}

export function parseExecutionAuthorityV2ReviewPackage(source, label = 'review package') {
  if (typeof source !== 'string') throw new TypeError(`${label}: source must be text`);
  const paths = [];
  const seen = new Set();
  for (const line of source.split(/\r?\n/u)) {
    if (!line.startsWith('diff --git ')) continue;
    const header = /^diff --git a\/([^\t ]+) b\/([^\t ]+)$/u.exec(line);
    if (header === null) throw new SyntaxError(`${label}: invalid diff --git header`);
    const [, leftPath, rightPath] = header;
    if (leftPath !== rightPath) {
      throw new SyntaxError(`${label}: diff header paths must match`);
    }
    if (!safeRepositoryPath(leftPath)) {
      throw new SyntaxError(`${label}: unsafe diff path: ${leftPath}`);
    }
    if (seen.has(leftPath)) {
      throw new SyntaxError(`${label}: duplicate diff path: ${leftPath}`);
    }
    seen.add(leftPath);
    paths.push(leftPath);
  }
  if (paths.length === 0) throw new SyntaxError(`${label}: must contain at least one diff --git header`);
  return paths.sort();
}

function evidenceHasExactKeys(evidence, expected, label, errors) {
  if (!exactKeys(evidence, expected)) {
    errors.push(`${label} has missing or unsupported fields`);
    return false;
  }
  return true;
}

function evidenceMatchesManifestIdentity(evidence, manifest, label, errors) {
  const approval = manifest.approvalEvidence;
  if (evidence.workPackage !== manifest.activeWorkPackage) {
    errors.push(`${label} workPackage must match activeWorkPackage`);
  }
  if (!sameArray(evidence.approvedScope, approval.approvedScope)) {
    errors.push(`${label} approvedScope must match manifest approvalEvidence.approvedScope`);
  }
  if (evidence.candidateH !== approval.candidateH) {
    errors.push(`${label} candidateH must match manifest approvalEvidence.candidateH`);
  }
  if (evidence.tree !== approval.tree) {
    errors.push(`${label} tree must match manifest approvalEvidence.tree`);
  }
  if (
    !exactKeys(evidence.effectiveBase, ['ref', 'sha']) ||
    evidence.effectiveBase.ref !== manifest.effectiveBase.ref ||
    evidence.effectiveBase.sha !== manifest.effectiveBase.sha
  ) {
    errors.push(`${label} effectiveBase must match manifest effectiveBase`);
  }
}

export function validateExecutionAuthorityV2ActivationIntent(manifest, activationIntent) {
  const errors = [];
  const manifestErrors = validateExecutionAuthorityV2Manifest(manifest);
  if (manifestErrors.length > 0) return manifestErrors;
  if (manifest.activeWorkPackage === null) return errors;
  if (
    !exactKeys(activationIntent, [
      'schemaVersion',
      'kind',
      'trackedManifestPath',
      'reviewPackagePath',
      'reviewPackageSha256',
      'effectiveBase',
      'approvalEvidence',
      'activeWorkPackage',
      'workPackageLedger',
    ])
  ) {
    return ['activation intent has missing or unsupported fields'];
  }
  if (activationIntent.schemaVersion !== ACTIVATION_INTENT_SCHEMA_VERSION) {
    errors.push('activation intent schemaVersion is unsupported');
  }
  if (activationIntent.kind !== ACTIVATION_INTENT_KIND) {
    errors.push('activation intent kind must be activation-intent');
  }
  if (activationIntent.trackedManifestPath !== EXECUTION_AUTHORITY_V2_PATH) {
    errors.push('activation intent trackedManifestPath must target execution-authority.v2');
  }
  if (activationIntent.reviewPackagePath !== REVIEW_PACKAGE_PATH) {
    errors.push('activation intent reviewPackagePath must target the pinned W06 review package');
  }
  if (!HEX64_PATTERN.test(activationIntent.reviewPackageSha256 ?? '')) {
    errors.push('activation intent reviewPackageSha256 must be a sha256 hex digest');
  }
  if (
    !exactKeys(activationIntent.effectiveBase, ['ref', 'sha']) ||
    activationIntent.effectiveBase.ref !== manifest.effectiveBase.ref ||
    activationIntent.effectiveBase.sha !== manifest.effectiveBase.sha
  ) {
    errors.push('activation intent effectiveBase must match manifest effectiveBase');
  }
  if (
    !exactKeys(activationIntent.approvalEvidence, [
      'ownerApprovalPath',
      'reviewPath',
      'reviewVerdict',
      'approver',
      'candidateH',
      'tree',
      'approvedScope',
    ])
  ) {
    errors.push('activation intent approvalEvidence has missing or unsupported fields');
  } else {
    for (const key of [
      'ownerApprovalPath',
      'reviewPath',
      'reviewVerdict',
      'approver',
      'candidateH',
      'tree',
    ]) {
      if (activationIntent.approvalEvidence[key] !== manifest.approvalEvidence[key]) {
        errors.push(`activation intent ${key} must match manifest approvalEvidence.${key}`);
      }
    }
    if (!sameArray(activationIntent.approvalEvidence.approvedScope, manifest.approvalEvidence.approvedScope)) {
      errors.push('activation intent approvedScope must match manifest approvalEvidence.approvedScope');
    }
  }
  if (activationIntent.activeWorkPackage !== manifest.activeWorkPackage) {
    errors.push('activation intent activeWorkPackage must match manifest activeWorkPackage');
  }
  if (JSON.stringify(activationIntent.workPackageLedger) !== JSON.stringify(manifest.workPackageLedger)) {
    errors.push('activation intent workPackageLedger must match the complete manifest ledger transition');
  }
  return [...new Set(errors)];
}

export function validateExecutionAuthorityV2Evidence(
  manifest,
  amendmentGovernance,
  ownerEvidence,
  reviewEvidence,
) {
  const errors = [];
  const manifestErrors = validateExecutionAuthorityV2Manifest(manifest);
  if (manifestErrors.length > 0) return manifestErrors;
  if (manifest.activeWorkPackage === null) return errors;

  const ownerValid = evidenceHasExactKeys(
    ownerEvidence,
    [
      'evidenceVersion',
      'kind',
      'decision',
      'approver',
      'workPackage',
      'effectiveBase',
      'candidateH',
      'tree',
      'approvedScope',
      'exclusions',
      'activationIntentPath',
      'activationIntentSha256',
    ],
    'owner evidence',
    errors,
  );
  const reviewValid = evidenceHasExactKeys(
    reviewEvidence,
    [
      'evidenceVersion',
      'kind',
      'verdict',
      'reviewer',
      'workPackage',
      'effectiveBase',
      'candidateH',
      'tree',
      'approvedScope',
      'ownerApprovalPath',
      'ownerApprovalSha256',
      'activationIntentPath',
      'activationIntentSha256',
      'reviewPackagePath',
      'diffSha256',
      'changedPaths',
      'commands',
      'productionReady',
    ],
    'review evidence',
    errors,
  );
  if (!ownerValid || !reviewValid) return errors;

  if (ownerEvidence.evidenceVersion !== EVIDENCE_VERSION) {
    errors.push('owner evidenceVersion is unsupported');
  }
  if (ownerEvidence.kind !== 'owner-approval') errors.push('owner kind must be owner-approval');
  if (ownerEvidence.decision !== 'APPROVED') errors.push('owner decision must be APPROVED');
  if (ownerEvidence.approver !== manifest.approvalEvidence.approver) {
    errors.push('owner approver must match manifest approvalEvidence.approver');
  }
  evidenceMatchesManifestIdentity(ownerEvidence, manifest, 'owner', errors);
  if (!sameArray(ownerEvidence.exclusions, REQUIRED_W06_EXCLUSIONS)) {
    errors.push('owner exclusions must match the frozen W06 exclusion list');
  }
  if (!safeRepositoryPath(ownerEvidence.activationIntentPath)) {
    errors.push('owner activationIntentPath must be a safe repository path');
  }
  if (!HEX64_PATTERN.test(ownerEvidence.activationIntentSha256 ?? '')) {
    errors.push('owner activationIntentSha256 must be a sha256 hex digest');
  }

  if (reviewEvidence.evidenceVersion !== EVIDENCE_VERSION) {
    errors.push('review evidenceVersion is unsupported');
  }
  if (reviewEvidence.kind !== 'independent-review') {
    errors.push('review kind must be independent-review');
  }
  if (reviewEvidence.verdict !== manifest.approvalEvidence.reviewVerdict) {
    errors.push('review verdict must match manifest approvalEvidence.reviewVerdict');
  }
  if (reviewEvidence.verdict !== 'GO') errors.push('review verdict must be GO');
  const expectedReviewer = effectiveIndependentReviewer(
    amendmentGovernance,
    manifest.activeWorkPackage,
    manifest.workPackageLedger,
  );
  if (typeof expectedReviewer !== 'string' || expectedReviewer.length === 0) {
    errors.push('amendmentGovernance.independentReviewer must be a non-empty string');
  } else if (reviewEvidence.reviewer !== expectedReviewer) {
    errors.push('reviewer must match amendmentGovernance.independentReviewer');
  }
  if (reviewEvidence.reviewer === manifest.approvalEvidence.approver) {
    errors.push('reviewer must differ from manifest approvalEvidence.approver');
  }
  evidenceMatchesManifestIdentity(reviewEvidence, manifest, 'review', errors);
  if (reviewEvidence.ownerApprovalPath !== manifest.approvalEvidence.ownerApprovalPath) {
    errors.push('review ownerApprovalPath must match manifest approvalEvidence.ownerApprovalPath');
  }
  if (reviewEvidence.ownerApprovalSha256 !== manifest.approvalEvidence.ownerApprovalSha256) {
    errors.push('review ownerApprovalSha256 must match manifest approvalEvidence.ownerApprovalSha256');
  }
  if (reviewEvidence.activationIntentPath !== ownerEvidence.activationIntentPath) {
    errors.push('review activationIntentPath must match owner activationIntentPath');
  }
  if (reviewEvidence.activationIntentSha256 !== ownerEvidence.activationIntentSha256) {
    errors.push('review activationIntentSha256 must match owner activationIntentSha256');
  }
  if (reviewEvidence.reviewPackagePath !== REVIEW_PACKAGE_PATH) {
    errors.push('review reviewPackagePath must target the pinned W06 review package');
  }
  if (!safeRepositoryPath(reviewEvidence.reviewPackagePath)) {
    errors.push('review reviewPackagePath must be a safe repository path');
  }
  if (!HEX64_PATTERN.test(reviewEvidence.diffSha256 ?? '')) {
    errors.push('review diffSha256 must be a sha256 hex digest');
  }
  if (
    !Array.isArray(reviewEvidence.changedPaths) ||
    reviewEvidence.changedPaths.length === 0 ||
    reviewEvidence.changedPaths.some(
      (path) => typeof path !== 'string' || !safeRepositoryPath(path.replace(/\/$/u, '')),
    )
  ) {
    errors.push('review changedPaths must be a non-empty list of safe repository paths');
  } else if (reviewEvidence.changedPaths.some((path) => !ALLOWED_REVIEW_CHANGED_PATHS.has(path))) {
    errors.push('review changedPaths must stay within the authority review allowlist');
  }
  if (
    !Array.isArray(reviewEvidence.commands) ||
    reviewEvidence.commands.length === 0 ||
    reviewEvidence.commands.some((command) => typeof command !== 'string' || command.length === 0)
  ) {
    errors.push('review commands must be a non-empty list of command strings');
  } else if (!sameArray(reviewEvidence.commands, REQUIRED_REVIEW_COMMANDS)) {
    errors.push('review commands must exactly match the required authority verification commands');
  }
  if (reviewEvidence.productionReady !== false) {
    errors.push('review productionReady must be false');
  }

  return [...new Set(errors)];
}

export async function readPinnedAuthorityFile(root, path, errors) {
  if (!safeRepositoryPath(path)) {
    errors.push(`unsafe governed path: ${path}`);
    return null;
  }
  let current = root;
  const components = path.split('/');
  for (let index = 0; index < components.length; index += 1) {
    current = join(current, components[index]);
    let stat;
    try {
      stat = await lstat(current);
    } catch (cause) {
      errors.push(
        `${path}: missing path component ${components.slice(0, index + 1).join('/')}: ${cause.code ?? cause.message}`,
      );
      return null;
    }
    if (stat.isSymbolicLink()) {
      errors.push(`${path}: symbolic links are forbidden in authority inputs`);
      return null;
    }
    if (index < components.length - 1 && !stat.isDirectory()) {
      errors.push(`${path}: ancestor is not a directory`);
      return null;
    }
    if (index === components.length - 1 && !stat.isFile()) {
      errors.push(`${path}: authority input must be a regular file`);
      return null;
    }
  }
  try {
    return await readFile(current, 'utf8');
  } catch (cause) {
    errors.push(`${path}: unable to read authority input: ${cause.message}`);
    return null;
  }
}

export function validateExecutionAuthorityV2Schema(schema) {
  const errors = [];
  if (schema?.$schema !== 'https://json-schema.org/draft/2020-12/schema') {
    errors.push('execution authority v2 schema must use JSON Schema 2020-12');
  }
  if (schema?.$id !== 'https://chaotang.local/contracts/execution-authority.v2.schema.json') {
    errors.push('execution authority v2 schema has an unexpected $id');
  }
  if (schema?.type !== 'object' || schema?.additionalProperties !== false) {
    errors.push('execution authority v2 schema root must be a closed object');
  }
  if (schema?.properties?.schemaVersion?.const !== 'execution-authority.v2') {
    errors.push('v2 schemaVersion must be fixed to execution-authority.v2');
  }
  if (schema?.properties?.authorityId?.const !== AUTHORITY_ID) {
    errors.push('v2 authorityId must be fixed to the fixed R0 execution authority identity');
  }
  const amendment = schema?.properties?.amendment;
  if (
    amendment?.additionalProperties !== false ||
    amendment?.properties?.id?.const !== AMENDMENT_ID ||
    amendment?.properties?.path?.const !== AMENDMENT_PATH
  ) {
    errors.push('v2 amendment schema must be closed and pinned to the R0 amendment');
  }
  const professionalReassignment = schema?.properties?.professionalReassignment;
  if (
    !sameArray(
      professionalReassignment?.properties?.requiredBefore?.const,
      EXPECTED_REQUIRED_BEFORE,
    ) ||
    !sameArray(professionalReassignment?.properties?.rolesRequired?.const, EXPECTED_ROLES_REQUIRED)
  ) {
    errors.push('v2 schema professional reassignment boundaries must match the frozen list');
  }
  if (schema?.$defs?.hex64?.pattern !== '^[0-9a-f]{64}$') {
    errors.push('v2 schema hex64 $def must stay a 64-hex pattern');
  }
  return errors;
}

export function validateExecutionAuthorityV2Manifest(manifest) {
  const errors = [];
  if (
    !exactKeys(manifest, [
      'schemaVersion',
      'authorityId',
      'amendment',
      'effectiveBase',
      'approvalEvidence',
      'activeWorkPackage',
      'workPackageLedger',
      'professionalReassignment',
    ])
  ) {
    return ['execution-authority.v2 has missing or unsupported top-level fields'];
  }
  if (manifest.schemaVersion !== 'execution-authority.v2') {
    errors.push('execution-authority.v2 schemaVersion is required');
  }
  if (manifest.authorityId !== AUTHORITY_ID) {
    errors.push(`unsupported v2 authorityId: ${manifest.authorityId}`);
  }

  if (!exactKeys(manifest.amendment, ['id', 'path', 'approvedSourceDigest'])) {
    errors.push('v2 amendment must contain exactly id, path, approvedSourceDigest');
  } else {
    if (manifest.amendment.id !== AMENDMENT_ID) errors.push('v2 amendment id mismatch');
    if (manifest.amendment.path !== AMENDMENT_PATH) errors.push('v2 amendment path mismatch');
    if (!HEX64_PATTERN.test(manifest.amendment.approvedSourceDigest ?? '')) {
      errors.push('v2 amendment approvedSourceDigest must be a sha256 hex digest');
    }
  }

  if (!exactKeys(manifest.effectiveBase, ['ref', 'sha'])) {
    errors.push('v2 effectiveBase must contain exactly ref, sha');
  } else if (!HEX40_PATTERN.test(manifest.effectiveBase.sha ?? '')) {
    errors.push('v2 effectiveBase sha must be a 40-hex git sha');
  }

  if (
    !exactKeys(manifest.approvalEvidence, [
      'ownerApprovalPath',
      'ownerApprovalSha256',
      'reviewPath',
      'reviewSha256',
      'reviewVerdict',
      'approver',
      'candidateH',
      'tree',
      'approvedScope',
    ])
  ) {
    errors.push('v2 approvalEvidence has missing or unsupported fields');
  } else {
    const evidence = manifest.approvalEvidence;
    if (!safeRepositoryPath(evidence.ownerApprovalPath) || !/owner_approval\/exact-h-approval\.md$/.test(evidence.ownerApprovalPath)) {
      errors.push('v2 approvalEvidence.ownerApprovalPath is not a valid owner approval path');
    }
    if (!HEX64_PATTERN.test(evidence.ownerApprovalSha256 ?? '')) {
      errors.push('v2 approvalEvidence.ownerApprovalSha256 must be a sha256 hex digest');
    }
    if (!safeRepositoryPath(evidence.reviewPath) || !/claude_code_review\/exact-h-final\.md$/.test(evidence.reviewPath)) {
      errors.push('v2 approvalEvidence.reviewPath is not a valid review evidence path');
    }
    if (!HEX64_PATTERN.test(evidence.reviewSha256 ?? '')) {
      errors.push('v2 approvalEvidence.reviewSha256 must be a sha256 hex digest');
    }
    if (evidence.reviewVerdict !== 'GO') errors.push('v2 approvalEvidence.reviewVerdict must be GO');
    if (typeof evidence.approver !== 'string' || evidence.approver.length === 0) {
      errors.push('v2 approvalEvidence.approver must be a non-empty string');
    }
    if (!HEX40_PATTERN.test(evidence.candidateH ?? '')) {
      errors.push('v2 approvalEvidence.candidateH must be a 40-hex git sha');
    }
    if (!HEX40_PATTERN.test(evidence.tree ?? '')) {
      errors.push('v2 approvalEvidence.tree must be a 40-hex git tree id');
    }
    if (
      !Array.isArray(evidence.approvedScope) ||
      evidence.approvedScope.length !== 1 ||
      !WORK_PACKAGE_PATTERN.test(evidence.approvedScope[0] ?? '') ||
      (manifest.activeWorkPackage !== null &&
        evidence.approvedScope[0] !== manifest.activeWorkPackage)
    ) {
      errors.push(
        'v2 approvalEvidence.approvedScope must contain exactly one work package id, matching activeWorkPackage when set',
      );
    }
  }

  if (
    manifest.activeWorkPackage !== null &&
    !WORK_PACKAGE_PATTERN.test(manifest.activeWorkPackage ?? '')
  ) {
    errors.push('v2 activeWorkPackage must be null or match R0-W0[0-9]');
  }

  if (!Array.isArray(manifest.workPackageLedger) || manifest.workPackageLedger.length === 0) {
    errors.push('v2 workPackageLedger must be a non-empty array');
  } else {
    const seen = new Set();
    let activeCount = 0;
    let activeId = null;
    for (const entry of manifest.workPackageLedger) {
      if (!exactKeys(entry, ['id', 'status'])) {
        errors.push('v2 workPackageLedger entries must contain exactly id, status');
        continue;
      }
      if (!WORK_PACKAGE_PATTERN.test(entry.id)) errors.push(`v2 ledger has invalid id: ${entry.id}`);
      if (seen.has(entry.id)) errors.push(`v2 ledger has duplicate id: ${entry.id}`);
      seen.add(entry.id);
      if (!LEDGER_STATUSES.has(entry.status)) {
        errors.push(`v2 ledger has invalid status for ${entry.id}: ${entry.status}`);
      }
      if (entry.status === 'ACTIVE') {
        activeCount += 1;
        activeId = entry.id;
      }
    }
    if (activeCount > 1) errors.push('v2 workPackageLedger must never have two ACTIVE entries');
    if (manifest.activeWorkPackage === null && activeCount !== 0) {
      errors.push('v2 activeWorkPackage is null but the ledger still has an ACTIVE entry');
    }
    if (manifest.activeWorkPackage !== null && activeCount === 0) {
      errors.push('v2 activeWorkPackage is set but no ledger entry is ACTIVE');
    }
    if (
      manifest.activeWorkPackage !== null &&
      activeCount === 1 &&
      manifest.activeWorkPackage !== activeId
    ) {
      errors.push('v2 activeWorkPackage does not match the ledger ACTIVE entry');
    }
  }

  if (
    !exactKeys(manifest.professionalReassignment, [
      'requiredBefore',
      'rolesRequired',
      'assignments',
      'defaultOwner',
    ])
  ) {
    errors.push('v2 professionalReassignment has missing or unsupported fields');
  } else {
    const reassignment = manifest.professionalReassignment;
    if (!sameArray(reassignment.requiredBefore, EXPECTED_REQUIRED_BEFORE)) {
      errors.push('v2 professionalReassignment.requiredBefore must match the frozen boundary list');
    }
    if (!sameArray(reassignment.rolesRequired, EXPECTED_ROLES_REQUIRED)) {
      errors.push('v2 professionalReassignment.rolesRequired must match the frozen role list');
    }
    if (!exactKeys(reassignment.assignments, EXPECTED_ROLES_REQUIRED)) {
      errors.push('v2 professionalReassignment.assignments must contain exactly the required roles');
    }
    if (reassignment.defaultOwner !== 'lyt') {
      errors.push('v2 professionalReassignment.defaultOwner must be lyt');
    }
  }

  return errors;
}

export function resolveExecutionAuthorityV2(manifest, amendmentGovernance, options = {}) {
  const { workPackage, realCustomerData = false } = options;
  const manifestErrors = validateExecutionAuthorityV2Manifest(manifest);
  if (manifestErrors.length > 0) {
    return {
      schemaVersion: 'execution-authority.v2',
      decision: 'STOP',
      reason: 'INVALID_EXECUTION_AUTHORITY',
      errors: manifestErrors,
    };
  }

  const governance = amendmentGovernance ?? {};
  if (
    governance.status !== 'APPROVED_FOR_W01' ||
    manifest.amendment.approvedSourceDigest !== governance.approvedSourceDigest ||
    manifest.amendment.approvedSourceDigest !== governance.candidateSourceDigest
  ) {
    return {
      schemaVersion: 'execution-authority.v2',
      decision: 'STOP',
      reason: 'AMENDMENT_DIGEST_DRIFT',
    };
  }

  // effectiveBase is the branch-from point for whichever work package is currently ACTIVE,
  // and legitimately advances every time a new packet starts (each packet branches from the
  // latest protected ext SHA, not from the amendment's original G0 approval point). It must
  // therefore be checked for self-consistency against THIS manifest's own approved candidate,
  // never against amendmentGovernance.effectiveBase, which is a permanently frozen historical
  // anchor for when the amendment itself was approved and never changes after that.
  if (manifest.effectiveBase.sha !== manifest.approvalEvidence.candidateH) {
    return {
      schemaVersion: 'execution-authority.v2',
      decision: 'STOP',
      reason: 'EFFECTIVE_BASE_MISMATCH',
    };
  }

  if (manifest.approvalEvidence.reviewVerdict !== 'GO') {
    return { schemaVersion: 'execution-authority.v2', decision: 'STOP', reason: 'REVIEW_NOT_GO' };
  }

  if (typeof workPackage !== 'string' || workPackage.length === 0) {
    return {
      schemaVersion: 'execution-authority.v2',
      decision: 'STOP',
      reason: 'WORK_PACKAGE_ARGUMENT_REQUIRED',
    };
  }
  if (!WORK_PACKAGE_PATTERN.test(workPackage)) {
    return {
      schemaVersion: 'execution-authority.v2',
      decision: 'STOP',
      reason: 'UNKNOWN_WORK_PACKAGE_FORMAT',
    };
  }

  const activeEntries = manifest.workPackageLedger.filter((entry) => entry.status === 'ACTIVE');
  if (activeEntries.length > 1) {
    return {
      schemaVersion: 'execution-authority.v2',
      decision: 'STOP',
      reason: 'MULTIPLE_ACTIVE_WORK_PACKAGES',
    };
  }

  if (manifest.activeWorkPackage === null || activeEntries.length === 0) {
    return {
      schemaVersion: 'execution-authority.v2',
      decision: 'STOP',
      reason: 'NO_ACTIVE_WORK_PACKAGE',
    };
  }

  const requestedIndex = EXPECTED_R0_WORK_PACKAGE_SEQUENCE.indexOf(workPackage);
  if (requestedIndex > 0) {
    const predecessor = EXPECTED_R0_WORK_PACKAGE_SEQUENCE[requestedIndex - 1];
    const predecessorEntry = manifest.workPackageLedger.find((entry) => entry.id === predecessor);
    if (!predecessorEntry || predecessorEntry.status !== 'MERGED_AND_VERIFIED') {
      return {
        schemaVersion: 'execution-authority.v2',
        decision: 'STOP',
        reason: 'BLOCKED_DEPENDENCY',
      };
    }
  }

  if (workPackage !== manifest.activeWorkPackage) {
    return {
      schemaVersion: 'execution-authority.v2',
      decision: 'STOP',
      reason: 'WORK_PACKAGE_MISMATCH',
    };
  }

  if (PROFESSIONAL_GATE_TRIGGER_PACKAGES.has(workPackage) || realCustomerData === true) {
    const assignments = manifest.professionalReassignment.assignments;
    const defaultOwner = manifest.professionalReassignment.defaultOwner;
    const stillDefault = manifest.professionalReassignment.rolesRequired.some(
      (role) => assignments[role] === defaultOwner,
    );
    if (stillDefault) {
      return {
        schemaVersion: 'execution-authority.v2',
        decision: 'STOP',
        reason: 'PROFESSIONAL_REASSIGNMENT_REQUIRED',
      };
    }
  }

  return {
    schemaVersion: 'execution-authority.v2',
    decision: 'GO',
    activeWorkPackage: workPackage,
    reason: 'APPROVED_WORK_PACKAGE',
  };
}

export async function loadExecutionAuthorityV2(root) {
  const errors = [];
  const manifestSource = await readPinnedAuthorityFile(root, EXECUTION_AUTHORITY_V2_PATH, errors);
  const schemaSource = await readPinnedAuthorityFile(
    root,
    EXECUTION_AUTHORITY_V2_SCHEMA_PATH,
    errors,
  );
  const projectHarnessSource = await readPinnedAuthorityFile(
    root,
    '.harness/manifest/project-harness.json',
    errors,
  );

  let manifest = null;
  let schema = null;
  let amendmentGovernance = null;

  if (manifestSource !== null) {
    try {
      manifest = parseJsonObjectWithUniqueKeys(manifestSource, EXECUTION_AUTHORITY_V2_PATH);
    } catch (cause) {
      errors.push(cause.message);
    }
  }
  if (schemaSource !== null) {
    try {
      schema = parseJsonObjectWithUniqueKeys(schemaSource, EXECUTION_AUTHORITY_V2_SCHEMA_PATH);
      errors.push(...validateExecutionAuthorityV2Schema(schema));
    } catch (cause) {
      errors.push(cause.message);
    }
  }
  if (projectHarnessSource !== null) {
    try {
      const projectHarness = parseJsonObjectWithUniqueKeys(
        projectHarnessSource,
        '.harness/manifest/project-harness.json',
      );
      amendmentGovernance = projectHarness.amendmentGovernance ?? null;
      const governanceErrors =
        validateAmendmentGovernanceRegistration(amendmentGovernance);
      errors.push(...governanceErrors);
      if (governanceErrors.length === 0) {
        errors.push(
          ...(await verifyAmendmentApprovalEvidenceFiles(root, amendmentGovernance)),
        );
      }
    } catch (cause) {
      errors.push(cause.message);
    }
  }

  if (manifest === null) {
    return { manifest, schema, amendmentGovernance, errors };
  }

  const manifestErrors = validateExecutionAuthorityV2Manifest(manifest);
  errors.push(...manifestErrors);
  if (manifestErrors.length > 0) {
    return { manifest, schema, amendmentGovernance, errors: [...new Set(errors)] };
  }
  if (amendmentGovernance !== null) {
    errors.push(
      ...(await verifyReviewerReassignmentActivationHistory(
        root,
        amendmentGovernance,
        manifest,
      )),
    );
  }

  const ownerApprovalSource = await readPinnedAuthorityFile(
    root,
    manifest.approvalEvidence.ownerApprovalPath,
    errors,
  );
  if (ownerApprovalSource !== null) {
    if (sha256Hex(ownerApprovalSource) !== manifest.approvalEvidence.ownerApprovalSha256) {
      errors.push('approvalEvidence.ownerApprovalPath: digest mismatch');
    }
  }
  const reviewSource = await readPinnedAuthorityFile(
    root,
    manifest.approvalEvidence.reviewPath,
    errors,
  );
  if (reviewSource !== null) {
    if (sha256Hex(reviewSource) !== manifest.approvalEvidence.reviewSha256) {
      errors.push('approvalEvidence.reviewPath: digest mismatch');
    }
  }

  if (manifest.activeWorkPackage !== null) {
    let ownerEvidence = null;
    let reviewEvidence = null;
    let activationIntent = null;
    let reviewPackagePaths = null;
    if (ownerApprovalSource !== null) {
      try {
        ownerEvidence = parseExecutionAuthorityV2Evidence(
          ownerApprovalSource,
          manifest.approvalEvidence.ownerApprovalPath,
        );
      } catch (cause) {
        errors.push(cause.message);
      }
    }
    if (reviewSource !== null) {
      try {
        reviewEvidence = parseExecutionAuthorityV2Evidence(
          reviewSource,
          manifest.approvalEvidence.reviewPath,
        );
      } catch (cause) {
        errors.push(cause.message);
      }
    }
    if (ownerEvidence === null) {
      errors.push('active execution authority requires parseable owner JSON evidence');
    }
    if (reviewEvidence === null) {
      errors.push('active execution authority requires parseable independent review JSON evidence');
    }
    if (ownerEvidence !== null && reviewEvidence !== null) {
      errors.push(
        ...validateExecutionAuthorityV2Evidence(
          manifest,
          amendmentGovernance,
          ownerEvidence,
          reviewEvidence,
        ),
      );
    }
    if (reviewEvidence !== null) {
      const reviewPackageSource = await readPinnedAuthorityFile(
        root,
        reviewEvidence.reviewPackagePath,
        errors,
      );
      if (reviewPackageSource === null) {
        errors.push('active execution authority requires a readable review package');
      } else {
        if (sha256Hex(reviewPackageSource) !== reviewEvidence.diffSha256) {
          errors.push('reviewPackagePath: digest mismatch');
        }
        try {
          reviewPackagePaths = parseExecutionAuthorityV2ReviewPackage(reviewPackageSource);
        } catch (cause) {
          errors.push(cause.message);
        }
      }
      if (reviewPackagePaths === null) {
        errors.push('active execution authority requires a parseable review package');
      } else if (
        !Array.isArray(reviewEvidence.changedPaths) ||
        !sameArray([...reviewEvidence.changedPaths].sort(), reviewPackagePaths)
      ) {
        errors.push('review changedPaths must exactly match the review package path set');
      }
    }
    if (ownerEvidence !== null) {
      const activationIntentSource = await readPinnedAuthorityFile(
        root,
        ownerEvidence.activationIntentPath,
        errors,
      );
      if (activationIntentSource === null) {
        errors.push('active execution authority requires a readable activation intent');
      } else {
        if (sha256Hex(activationIntentSource) !== ownerEvidence.activationIntentSha256) {
          errors.push('activationIntentPath: digest mismatch');
        }
        try {
          activationIntent = parseJsonObjectWithUniqueKeys(
            activationIntentSource,
            ownerEvidence.activationIntentPath,
          );
        } catch (cause) {
          errors.push(cause.message);
        }
      }
    }
    if (activationIntent === null) {
      errors.push('active execution authority requires parseable activation intent JSON');
    } else {
      errors.push(...validateExecutionAuthorityV2ActivationIntent(manifest, activationIntent));
      if (reviewEvidence !== null) {
        if (activationIntent.reviewPackagePath !== reviewEvidence.reviewPackagePath) {
          errors.push('activation intent reviewPackagePath must match review reviewPackagePath');
        }
        if (activationIntent.reviewPackageSha256 !== reviewEvidence.diffSha256) {
          errors.push('activation intent reviewPackageSha256 must match review diffSha256');
        }
      }
    }
  }

  return { manifest, schema, amendmentGovernance, errors: [...new Set(errors)] };
}

export function validateExecutionAuthorityV2(loaded) {
  if (!loaded || loaded.manifest === null || loaded.manifest === undefined) {
    return [...new Set(loaded?.errors ?? ['execution authority v2 manifest is unavailable'])];
  }
  return [
    ...new Set([...(loaded.errors ?? []), ...validateExecutionAuthorityV2Manifest(loaded.manifest)]),
  ];
}

export function executionAuthorityV2CommandResult(
  loaded,
  mode = '--authorize',
  extraArguments = [],
  { workPackage, realCustomerData = false } = {},
) {
  if (!['--status', '--check', '--authorize'].includes(mode)) {
    return {
      exitCode: 64,
      output: {
        schemaVersion: 'execution-authority.v2',
        decision: 'STOP',
        reason: 'UNSUPPORTED_COMMAND',
      },
    };
  }
  const errors = validateExecutionAuthorityV2(loaded);
  if (errors.length > 0) {
    return {
      exitCode: 1,
      output: {
        schemaVersion: 'execution-authority.v2',
        decision: 'STOP',
        reason: 'INVALID_EXECUTION_AUTHORITY',
        errors,
      },
    };
  }
  if (mode === '--check') {
    return {
      exitCode: 0,
      output: {
        schemaVersion: 'execution-authority.v2',
        decision: 'VALID_STRUCTURE',
        reason: 'STRUCTURALLY_VALID_NOT_AN_AUTHORIZATION',
      },
    };
  }
  if (mode === '--status') {
    return {
      exitCode: 0,
      output: {
        schemaVersion: 'execution-authority.v2',
        activeWorkPackage: loaded.manifest.activeWorkPackage,
        reason: 'STATUS_ONLY_NOT_AN_AUTHORIZATION',
      },
    };
  }
  const decision = resolveExecutionAuthorityV2(loaded.manifest, loaded.amendmentGovernance, {
    workPackage,
    realCustomerData,
  });
  return { exitCode: decision.decision === 'GO' ? 0 : 2, output: decision };
}
