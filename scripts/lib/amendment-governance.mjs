import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { constants as fsConstants } from 'node:fs';
import { lstat, open, realpath } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import { promisify } from 'node:util';

const rawExecFileAsync = promisify(execFile);
const AUTHORITY_GIT_EXECUTABLE = '/usr/bin/git';
const execFileAsync = (executable, args, options) =>
  rawExecFileAsync(
    executable === 'git' ? AUTHORITY_GIT_EXECUTABLE : executable,
    args,
    options,
  );

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
const SESSION_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const REVIEWER_REASSIGNMENT_BASE_H =
  '55caf0d176cd6a1bbb833ffd1872ea3f1d8a46ca';
const REVIEWER_REASSIGNMENT_WRITING_SESSION =
  '70da5ef5-c29f-4570-83ec-f7ee19e9bef1';
const REJECTED_REVIEW_SESSION_IDS = Object.freeze([
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
  '019f9d5d-2fac-76b0-8043-e18374e699b7',
  '019f9d5d-63d2-7690-9c52-4f422cc6e738',
  '019f9d6c-55a8-73e3-99ba-027549989c1f',
  '019f9d6c-55e8-7f00-89f5-b63114a791ea',
  '019f9d77-931c-7103-888a-30d4bdac1bed',
  '019f9d77-934c-7e33-b86a-78eddb22a420',
  '019f9e54-18be-7961-acbb-d4b24a99f422',
  '019f9e54-42d5-7373-9fb3-c49a81a37275',
  '019f9e63-ae15-7342-b54d-eb1335b88ca1',
  '019f9e63-d995-7353-a9c7-b9ddf850de8a',
  '019f9e7f-7755-7043-9cc8-01febc98d973',
  '019f9e7f-ae1f-7aa2-81ac-a4b0265273b6',
]);
const LEGACY_REJECTED_REVIEW_SESSION_ALIASES = Object.freeze([
  '/root/r0_w07_qa_pass1',
  '/root/r0_w07_qa_pass2',
  '/root/r0_w07_qa19_pass1',
  '/root/r0_w07_qa19_pass2_retry',
]);
const REVIEWER_REASSIGNMENT_KEYS = Object.freeze([
  'approvedBy',
  'baseH',
  'candidateH',
  'candidateMutation',
  'executionOwner',
  'expiresAfter',
  'fromReviewer',
  'ownerApprovalPath',
  'ownerApprovalSha256',
  'rejectedSessionIds',
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
  'writingSessionId',
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
const REVIEW_EVIDENCE_KEYS = Object.freeze([
  'baseH',
  'candidateH',
  'candidateMutated',
  'high',
  'kind',
  'medium',
  'pass',
  'reviewPackagePath',
  'reviewPackageSha256',
  'reviewer',
  'rejectedSessionIds',
  'schemaVersion',
  'scope',
  'sessionId',
  'tree',
  'verdict',
  'writeAccess',
  'writingSessionId',
]);
const OWNER_REASSIGNMENT_EVIDENCE_KEYS = Object.freeze([
  'approver',
  'baseH',
  'candidateH',
  'decision',
  'kind',
  'reviewPackagePath',
  'reviewPackageSha256',
  'rejectedSessionIds',
  'reviews',
  'schemaVersion',
  'scope',
  'tree',
  'writingSessionId',
]);
const OWNER_REVIEW_REFERENCE_KEYS = Object.freeze(['path', 'sessionId', 'sha256']);
const REVIEWER_AUTHORITY_PROTECTED_PATHS = Object.freeze([
  '.harness/contracts/execution-authority-v2.schema.json',
  'scripts/execution-authority-v2.mjs',
  'scripts/lib/amendment-governance.mjs',
  'scripts/lib/execution-authority-v2.mjs',
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

function parseUniqueJsonObject(source, label) {
  const duplicateKeys = findDuplicateJsonKeys(source);
  if (duplicateKeys.length > 0) {
    throw new Error(`${label}: duplicate JSON keys: ${duplicateKeys.join(', ')}`);
  }
  const value = JSON.parse(source);
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label}: evidence JSON must be an object`);
  }
  return value;
}

export function parseReviewerReassignmentEvidence(source, path) {
  const matches = [
    ...source.matchAll(
      /<!-- reviewer-reassignment-evidence:start -->\s*```json\s*([\s\S]*?)\s*```\s*<!-- reviewer-reassignment-evidence:end -->/gu,
    ),
  ];
  if (matches.length !== 1) {
    throw new Error(`${path}: require exactly one reviewer reassignment evidence block`);
  }
  return parseUniqueJsonObject(matches[0][1], path);
}

function validateReviewerEvidence(evidence, overlay, review, index) {
  const errors = [];
  const label = `reviewerReassignment.reviews[${index}]`;
  if (!hasExactKeys(evidence, REVIEW_EVIDENCE_KEYS)) {
    return [`${label}: evidence has missing or unsupported fields`];
  }
  const expected = {
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
  };
  for (const [key, value] of Object.entries(expected)) {
    if (JSON.stringify(evidence[key]) !== JSON.stringify(value)) {
      errors.push(`${label}: evidence ${key} must match overlay`);
    }
  }
  return errors;
}

function validateOwnerReassignmentEvidence(evidence, overlay) {
  const errors = [];
  const label = 'reviewerReassignment.ownerApproval';
  if (!hasExactKeys(evidence, OWNER_REASSIGNMENT_EVIDENCE_KEYS)) {
    return [`${label}: evidence has missing or unsupported fields`];
  }
  const expected = {
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
  };
  for (const [key, value] of Object.entries(expected)) {
    if (JSON.stringify(evidence[key]) !== JSON.stringify(value)) {
      errors.push(`${label}: evidence ${key} must match overlay`);
    }
  }
  if (!Array.isArray(evidence.reviews) || evidence.reviews.length !== 2) {
    errors.push(`${label}: evidence must bind exactly two reviews`);
  } else {
    for (let index = 0; index < evidence.reviews.length; index += 1) {
      const reference = evidence.reviews[index];
      if (!hasExactKeys(reference, OWNER_REVIEW_REFERENCE_KEYS)) {
        errors.push(`${label}: review reference has missing or unsupported fields`);
        continue;
      }
      const expectedReview = overlay.reviews[index];
      for (const key of OWNER_REVIEW_REFERENCE_KEYS) {
        if (reference[key] !== expectedReview[key]) {
          errors.push(`${label}: review ${index + 1} ${key} must match overlay`);
        }
      }
    }
  }
  return errors;
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
  if (!HEX40_PATTERN.test(overlay.baseH ?? '')) {
    errors.push('reviewer reassignment baseH must be a 40-hex git sha');
  } else if (overlay.baseH !== REVIEWER_REASSIGNMENT_BASE_H) {
    errors.push('reviewer reassignment baseH must match the frozen EXT baseline');
  }
  if (!HEX40_PATTERN.test(overlay.candidateH ?? '')) {
    errors.push('reviewer reassignment candidateH must be a 40-hex git sha');
  }
  if (!HEX40_PATTERN.test(overlay.tree ?? '')) {
    errors.push('reviewer reassignment tree must be a 40-hex git tree');
  }
  if (
    typeof overlay.writingSessionId !== 'string' ||
    !SESSION_ID_PATTERN.test(overlay.writingSessionId)
  ) {
    errors.push('reviewer reassignment writingSessionId must be a canonical session id');
  } else if (overlay.writingSessionId !== REVIEWER_REASSIGNMENT_WRITING_SESSION) {
    errors.push('reviewer reassignment writingSessionId must match the frozen writer receipt');
  }
  if (
    !Array.isArray(overlay.rejectedSessionIds) ||
    !sameArray(overlay.rejectedSessionIds, REJECTED_REVIEW_SESSION_IDS)
  ) {
    errors.push('reviewer reassignment rejectedSessionIds must bind all prior rejected sessions');
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
    overlay.reviewPackagePath !==
    '.harness/changes/docs-r0-reviewer-reassignment-20260726/review_inputs/candidate.diff'
  ) {
    errors.push('reviewer reassignment reviewPackagePath must be canonical');
  }
  if (
    overlay.ownerApprovalPath !==
    '.harness/changes/docs-r0-reviewer-reassignment-20260726/owner_approval/exact-h-approval.md'
  ) {
    errors.push('reviewer reassignment ownerApprovalPath must be canonical');
  }
  if (
    !Array.isArray(overlay.reviews) ||
    overlay.reviews.length !== overlay.reviewPassesRequired
  ) {
    errors.push('reviewer reassignment requires exactly two review passes');
  } else {
    const sessions = new Set();
    const reviewPaths = new Set();
    const reviewDigests = new Set();
    for (let index = 0; index < overlay.reviews.length; index += 1) {
      const review = overlay.reviews[index];
      if (!hasExactKeys(review, REVIEW_PASS_KEYS)) {
        errors.push('review pass has missing or unsupported fields');
        continue;
      }
      if (LEGACY_REJECTED_REVIEW_SESSION_ALIASES.includes(review.sessionId)) {
        errors.push('review sessionId must not reuse a legacy rejected session alias');
      } else if (
        typeof review.sessionId !== 'string' ||
        !SESSION_ID_PATTERN.test(review.sessionId)
      ) {
        errors.push('review sessionId must be a canonical session id');
      } else if (review.sessionId === overlay.writingSessionId) {
        errors.push('review sessionId must differ from writingSessionId');
      } else if (overlay.rejectedSessionIds?.includes(review.sessionId)) {
        errors.push('review sessionId must not reuse a rejected session');
      } else if (sessions.has(review.sessionId)) {
        errors.push('review passes must use a unique sessionId');
      } else {
        sessions.add(review.sessionId);
      }
      if (!safeRepositoryPath(review.path)) {
        errors.push('review path must be a safe repository path');
      } else if (reviewPaths.has(review.path)) {
        errors.push('review evidence paths must be unique');
      } else if (
        review.path !==
        `.harness/changes/docs-r0-reviewer-reassignment-20260726/codex_review/pass-${index + 1}.md`
      ) {
        errors.push(`review pass ${index + 1} path must be canonical`);
      } else {
        reviewPaths.add(review.path);
      }
      if (!HEX64_PATTERN.test(review.sha256 ?? '')) {
        errors.push('review sha256 must be a sha256 hex digest');
      } else if (reviewDigests.has(review.sha256)) {
        errors.push('review digests must be unique');
      } else {
        reviewDigests.add(review.sha256);
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
  const allEvidencePaths = [
    overlay.reviewPackagePath,
    overlay.ownerApprovalPath,
    ...(Array.isArray(overlay.reviews) ? overlay.reviews.map((review) => review.path) : []),
  ];
  if (new Set(allEvidencePaths).size !== allEvidencePaths.length) {
    errors.push('reviewer reassignment evidence paths must be unique');
  }
  const allEvidenceDigests = [
    overlay.reviewPackageSha256,
    overlay.ownerApprovalSha256,
    ...(Array.isArray(overlay.reviews) ? overlay.reviews.map((review) => review.sha256) : []),
  ];
  if (new Set(allEvidenceDigests).size !== allEvidenceDigests.length) {
    errors.push('reviewer reassignment evidence digests must be unique');
  }
  return [...new Set(errors)];
}

function reviewerReassignmentGitArgs(...args) {
  return [
    '--no-replace-objects',
    '-c',
    'core.attributesFile=/dev/null',
    ...args,
  ];
}

function reviewerReassignmentGitOptions(root, extra = {}) {
  const { attributeSource, ...execExtra } = extra;
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')),
  );
  return {
    cwd: root,
    env: {
      ...env,
      GIT_CONFIG_NOSYSTEM: '1',
      GIT_CONFIG_GLOBAL: '/dev/null',
      GIT_ATTR_NOSYSTEM: '1',
      GIT_OPTIONAL_LOCKS: '0',
      LC_ALL: 'C',
      ...(attributeSource === undefined
        ? {}
        : { GIT_ATTR_SOURCE: attributeSource }),
    },
    ...execExtra,
  };
}

const ALLOWED_LOCAL_CORE_CONFIG = new Set([
  'core.repositoryformatversion',
  'core.filemode',
  'core.bare',
  'core.logallrefupdates',
  'core.worktree',
]);

function localGitConfigAffectsDiff(key) {
  const normalized = key.toLowerCase();
  return (
    normalized.startsWith('diff.') ||
    normalized.startsWith('include.') ||
    normalized.startsWith('includeif.') ||
    normalized === 'extensions.worktreeconfig' ||
    normalized === 'color.ui' ||
    normalized === 'color.diff' ||
    /^submodule\..+\.ignore$/u.test(normalized) ||
    (normalized.startsWith('core.') &&
      !ALLOWED_LOCAL_CORE_CONFIG.has(normalized))
  );
}

export async function verifyRepositoryLocalGitDiffEnvironment(
  root,
  label = 'authority',
) {
  const errors = [];
  try {
    const [
      { stdout: configSource },
      { stdout: gitDirSource },
      { stdout: commonDirSource },
    ] = await Promise.all([
      execFileAsync(
        'git',
        reviewerReassignmentGitArgs(
          'config',
          '--local',
          '--name-only',
          '--null',
          '--list',
        ),
        reviewerReassignmentGitOptions(root),
      ),
      execFileAsync(
        'git',
        reviewerReassignmentGitArgs('rev-parse', '--git-dir'),
        reviewerReassignmentGitOptions(root),
      ),
      execFileAsync(
        'git',
        reviewerReassignmentGitArgs('rev-parse', '--git-common-dir'),
        reviewerReassignmentGitOptions(root),
      ),
    ]);
    const unsafeConfig = configSource
      .split('\0')
      .filter(Boolean)
      .filter(localGitConfigAffectsDiff);
    if (unsafeConfig.length > 0) {
      errors.push(
        `${label}: repository-local Git config affects authority diff: ${unsafeConfig.join(', ')}`,
      );
    }

    const metadataRoots = new Set(
      [gitDirSource, commonDirSource].map((source) => source.trim()),
    );
    for (const metadataRoot of metadataRoots) {
      const resolvedRoot = isAbsolute(metadataRoot)
        ? metadataRoot
        : join(root, metadataRoot);
      try {
        await lstat(join(resolvedRoot, 'info', 'attributes'));
        errors.push(`${label}: Git info attributes affect authority diff`);
      } catch (cause) {
        if (cause.code !== 'ENOENT') throw cause;
      }
    }
  } catch (cause) {
    errors.push(
      `${label}: Git diff environment is unverifiable: ${cause.code ?? cause.message}`,
    );
  }
  return [...new Set(errors)];
}

export function reviewerReassignmentDiffArgs(baseH, candidateH) {
  return [
    '--no-replace-objects',
    '-c',
    'core.attributesFile=/dev/null',
    'diff',
    '--no-ext-diff',
    '--no-textconv',
    '--binary',
    `${baseH}..${candidateH}`,
  ];
}

export function effectiveIndependentReviewer(
  amendmentGovernance,
  workPackage,
  workPackageLedger = [],
) {
  const overlay = amendmentGovernance?.reviewerReassignment;
  if (overlay === undefined || overlay === null) {
    return amendmentGovernance?.independentReviewer ?? null;
  }
  if (validateReviewerReassignmentOverlay(overlay).length > 0) {
    return amendmentGovernance?.independentReviewer ?? null;
  }
  const scopedPackage = workPackageLedger.find((entry) => entry.id === workPackage);
  if (scopedPackage?.status !== 'ACTIVE') {
    return amendmentGovernance?.independentReviewer ?? null;
  }
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

async function readGitBlob(root, commit, path) {
  const { stdout } = await execFileAsync(
    'git',
    reviewerReassignmentGitArgs('show', `${commit}:${path}`),
    reviewerReassignmentGitOptions(root, {
      encoding: 'buffer',
      maxBuffer: 10 * 1024 * 1024,
    }),
  );
  return Buffer.isBuffer(stdout) ? stdout : Buffer.from(stdout);
}

async function readRepositoryBlob(root, path) {
  if (!safeRepositoryPath(path)) {
    throw new Error(`unsafe repository path: ${path}`);
  }
  let current = root;
  const components = path.split('/');
  for (let index = 0; index < components.length; index += 1) {
    current = join(current, components[index]);
    const stat = await lstat(current);
    if (stat.isSymbolicLink()) {
      throw new Error(`symbolic links are forbidden: ${path}`);
    }
    if (index < components.length - 1 && !stat.isDirectory()) {
      throw new Error(`path ancestor is not a directory: ${path}`);
    }
    if (index === components.length - 1 && !stat.isFile()) {
      throw new Error(`path is not a regular file: ${path}`);
    }
  }
  const expectedPath = join(await realpath(root), path);
  let handle;
  try {
    handle = await open(current, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW);
    const [stat, openedPath] = await Promise.all([
      handle.stat(),
      realpath(`/proc/self/fd/${handle.fd}`),
    ]);
    if (!stat.isFile()) {
      throw new Error(`path is not a regular file: ${path}`);
    }
    if (stat.nlink !== 1) {
      throw new Error(`hard links are forbidden: ${path}`);
    }
    if (openedPath !== expectedPath) {
      throw new Error(`opened path escapes repository target: ${path}`);
    }
    return await handle.readFile();
  } finally {
    await handle?.close();
  }
}

async function resolveReviewerReassignmentHead(root) {
  const { stdout: shallowSource } = await execFileAsync(
    'git',
    reviewerReassignmentGitArgs('rev-parse', '--is-shallow-repository'),
    reviewerReassignmentGitOptions(root),
  );
  if (shallowSource.trim() !== 'false') {
    throw new Error('reviewerReassignment requires complete non-shallow history');
  }
  const { stdout: headSource } = await execFileAsync(
    'git',
    reviewerReassignmentGitArgs('rev-parse', 'HEAD^{commit}'),
    reviewerReassignmentGitOptions(root),
  );
  return headSource.trim();
}

async function reviewerReassignmentFirstParentChain(root, headH) {
  const { stdout } = await execFileAsync(
    'git',
    reviewerReassignmentGitArgs('rev-list', '--first-parent', headH),
    reviewerReassignmentGitOptions(root),
  );
  return stdout.trim().split('\n').filter(Boolean);
}

function validateHistoricalExecutionManifest(
  authority,
  label,
  validateExecutionManifest,
) {
  if (typeof validateExecutionManifest !== 'function') return;
  const validationErrors = validateExecutionManifest(authority);
  if (validationErrors.length > 0) {
    throw new Error(`${label}: ${validationErrors.join('; ')}`);
  }
}

async function findReviewerReassignmentActivation(
  root,
  overlay,
  headH,
  validateExecutionManifest,
) {
  const firstParentChain = await reviewerReassignmentFirstParentChain(root, headH);
  const candidateIndex = firstParentChain.indexOf(overlay.candidateH);
  if (candidateIndex === -1) {
    throw new Error(
      'reviewerReassignment candidateH is not a first-parent ancestor of HEAD',
    );
  }
  const candidates = [];
  for (const commit of firstParentChain.slice(0, candidateIndex + 1)) {
    const authority = parseUniqueJsonObject(
      (
        await readGitBlob(
          root,
          commit,
          '.harness/manifest/execution-authority.v2.json',
        )
      ).toString('utf8'),
      `activation execution authority at ${commit}`,
    );
    validateHistoricalExecutionManifest(
      authority,
      `activation execution authority at ${commit}`,
      validateExecutionManifest,
    );
    if (authority.activeWorkPackage !== 'R0-W07') continue;
    const projectHarness = parseUniqueJsonObject(
      (
        await readGitBlob(root, commit, '.harness/manifest/project-harness.json')
      ).toString('utf8'),
      'activation project harness',
    );
    if (
      JSON.stringify(projectHarness.amendmentGovernance?.reviewerReassignment) !==
      JSON.stringify(overlay)
    ) {
      continue;
    }
    const { stdout: parentSource } = await execFileAsync(
      'git',
      reviewerReassignmentGitArgs('rev-list', '--parents', '-n', '1', commit),
      reviewerReassignmentGitOptions(root),
    );
    const commitAndParents = parentSource.trim().split(/\s+/u);
    if (commitAndParents.length !== 2) {
      throw new Error(
        'reviewerReassignment activation commit must have exactly one parent',
      );
    }
    const parentH = commitAndParents[1];
    const parentProjectHarness = parseUniqueJsonObject(
      (
        await readGitBlob(
          root,
          parentH,
          '.harness/manifest/project-harness.json',
        )
      ).toString('utf8'),
      'activation parent project harness',
    );
    const parentAuthority = parseUniqueJsonObject(
      (
        await readGitBlob(
          root,
          parentH,
          '.harness/manifest/execution-authority.v2.json',
        )
      ).toString('utf8'),
      'activation parent execution authority',
    );
    validateHistoricalExecutionManifest(
      parentAuthority,
      'activation parent execution authority',
      validateExecutionManifest,
    );
    if (
      JSON.stringify(parentProjectHarness.amendmentGovernance?.reviewerReassignment) ===
        JSON.stringify(overlay) &&
      parentAuthority.activeWorkPackage === null &&
      !parentAuthority.workPackageLedger?.some((entry) => entry.status === 'ACTIVE') &&
      !parentAuthority.workPackageLedger?.some((entry) => entry.id === 'R0-W07')
    ) {
      const parentChain = await reviewerReassignmentFirstParentChain(root, parentH);
      if (!parentChain.includes(overlay.candidateH)) {
        throw new Error(
          'reviewerReassignment candidateH is not a first-parent ancestor of activation parent',
        );
      }
      candidates.push({ activationH: commit, parentH });
    }
  }
  return candidates;
}

export async function verifyReviewerReassignmentActivationHistory(
  root,
  amendmentGovernance,
  executionManifest,
  validateExecutionManifest,
) {
  const overlay = amendmentGovernance?.reviewerReassignment;
  if (overlay === null || overlay === undefined) return [];
  if (executionManifest?.activeWorkPackage !== 'R0-W07') return [];

  const errors = [];
  try {
    const headH = await resolveReviewerReassignmentHead(root);
    const activationCandidates = await findReviewerReassignmentActivation(
      root,
      overlay,
      headH,
      validateExecutionManifest,
    );
    if (activationCandidates.length !== 1) {
      errors.push(
        `reviewerReassignment requires exactly one committed activation event; found ${activationCandidates.length}`,
      );
      return errors;
    }
    const [{ activationH, parentH }] = activationCandidates;
    const { stdout: descendantSource } = await execFileAsync(
      'git',
      reviewerReassignmentGitArgs(
        'rev-list',
        `${activationH}..${headH}`,
      ),
      reviewerReassignmentGitOptions(root),
    );
    for (const commit of [
      activationH,
      ...descendantSource.trim().split('\n').filter(Boolean),
    ]) {
      const [projectHarness, authority] = await Promise.all([
        readGitBlob(root, commit, '.harness/manifest/project-harness.json').then(
          (source) =>
            parseUniqueJsonObject(
              source.toString('utf8'),
              'continuous activation project harness',
            ),
        ),
        readGitBlob(
          root,
          commit,
          '.harness/manifest/execution-authority.v2.json',
        ).then((source) => {
          const authority = parseUniqueJsonObject(
            source.toString('utf8'),
            'continuous activation execution authority',
          );
          validateHistoricalExecutionManifest(
            authority,
            'continuous activation execution authority',
            validateExecutionManifest,
          );
          return authority;
        }),
      ]);
      if (
        JSON.stringify(projectHarness.amendmentGovernance?.reviewerReassignment) !==
          JSON.stringify(overlay) ||
        authority.activeWorkPackage !== 'R0-W07' ||
        !authority.workPackageLedger?.some(
          (entry) => entry.id === 'R0-W07' && entry.status === 'ACTIVE',
        )
      ) {
        errors.push(
          `reviewerReassignment continuous activation history is broken at ${commit}`,
        );
      }
    }

    for (const path of [
      overlay.reviewPackagePath,
      overlay.ownerApprovalPath,
      ...overlay.reviews.map((review) => review.path),
    ]) {
      const source = await readGitBlob(root, parentH, path);
      const expectedDigest =
        path === overlay.reviewPackagePath
          ? overlay.reviewPackageSha256
          : path === overlay.ownerApprovalPath
            ? overlay.ownerApprovalSha256
            : overlay.reviews.find((review) => review.path === path).sha256;
      if (createHash('sha256').update(source).digest('hex') !== expectedDigest) {
        errors.push(`reviewerReassignment activation parent evidence drift: ${path}`);
      }
    }

    const { stdout: reachablePriorCommits } = await execFileAsync(
      'git',
      reviewerReassignmentGitArgs(
        'rev-list',
        `${overlay.baseH}..${parentH}`,
      ),
      reviewerReassignmentGitOptions(root),
    );
    for (const commit of reachablePriorCommits.trim().split('\n').filter(Boolean)) {
      const authority = parseUniqueJsonObject(
        (
          await readGitBlob(
            root,
            commit,
            '.harness/manifest/execution-authority.v2.json',
          )
        ).toString('utf8'),
        'pre-activation execution authority',
      );
      validateHistoricalExecutionManifest(
        authority,
        `pre-activation execution authority at ${commit}`,
        validateExecutionManifest,
      );
      if (authority.workPackageLedger?.some((entry) => entry.id === 'R0-W07')) {
        errors.push(
          `reviewerReassignment reachable history already contains R0-W07 at ${commit}`,
        );
      }
    }

    const activationBoundPaths = [
      '.harness/manifest/execution-authority.v2.json',
      '.harness/manifest/project-harness.json',
      overlay.reviewPackagePath,
      overlay.ownerApprovalPath,
      ...overlay.reviews.map((review) => review.path),
      ...REVIEWER_AUTHORITY_PROTECTED_PATHS,
    ];
    for (const path of activationBoundPaths) {
      const [activationBlob, headBlob, workingBlob] = await Promise.all([
        readGitBlob(root, activationH, path),
        readGitBlob(root, headH, path),
        readRepositoryBlob(root, path),
      ]);
      if (!activationBlob.equals(headBlob)) {
        errors.push(`reviewerReassignment activation-bound history drift: ${path}`);
      }
      if (!activationBlob.equals(workingBlob)) {
        errors.push(`reviewerReassignment activation-bound working tree drift: ${path}`);
      }
    }

    for (const path of REVIEWER_AUTHORITY_PROTECTED_PATHS) {
      const [reviewedBlob, activationBlob] = await Promise.all([
        readGitBlob(root, overlay.candidateH, path),
        readGitBlob(root, activationH, path),
      ]);
      if (!reviewedBlob.equals(activationBlob)) {
        errors.push(
          `reviewerReassignment protected authority drift after review: ${path}`,
        );
      }
    }
    const finalHeadH = await resolveReviewerReassignmentHead(root);
    if (finalHeadH !== headH) {
      errors.push('reviewerReassignment HEAD moved during verification');
    }
  } catch (cause) {
    errors.push(
      `reviewerReassignment activation history is unverifiable: ${cause.code ?? cause.message}`,
    );
  }
  return [...new Set(errors)];
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

export async function verifyAmendmentApprovalEvidenceFiles(
  root,
  amendment,
  {
    includeReviewerReassignment = true,
    readEvidenceFile = null,
  } = {},
) {
  const errors = [];
  if (!amendment) return errors;

  async function verifyEvidenceFile(path, expectedDigest, fieldLabel) {
    if (!safeRepositoryPath(path)) {
      errors.push(`${fieldLabel}: unsafe path`);
      return null;
    }
    let source;
    try {
      source =
        typeof readEvidenceFile === 'function'
          ? await readEvidenceFile(path)
          : await readRepositoryBlob(root, path);
      if (!Buffer.isBuffer(source)) {
        throw new Error('pinned evidence source is unavailable');
      }
    } catch (cause) {
      errors.push(
        cause.code === 'ENOENT'
          ? `${fieldLabel}: missing path component: ${cause.code}`
          : `${fieldLabel}: unreadable evidence: ${cause.code ?? cause.message}`,
      );
      return null;
    }
    const digest = createHash('sha256').update(source).digest('hex');
    if (digest !== expectedDigest) {
      errors.push(`${fieldLabel}: digest mismatch`);
    }
    return source;
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
  if (
    includeReviewerReassignment &&
    overlay !== null &&
    overlay !== undefined
  ) {
    errors.push(
      ...(await verifyRepositoryLocalGitDiffEnvironment(
        root,
        'reviewerReassignment',
      )),
    );
    if (!hasExactKeys(overlay, REVIEWER_REASSIGNMENT_KEYS)) return errors;
    const reviewPackageSource = await verifyEvidenceFile(
      overlay.reviewPackagePath,
      overlay.reviewPackageSha256,
      'reviewerReassignment.reviewPackagePath',
    );
    const ownerSource = await verifyEvidenceFile(
      overlay.ownerApprovalPath,
      overlay.ownerApprovalSha256,
      'reviewerReassignment.ownerApprovalPath',
    );
    const reviewSources = [];
    if (Array.isArray(overlay.reviews)) {
      for (let index = 0; index < overlay.reviews.length; index += 1) {
        reviewSources.push(await verifyEvidenceFile(
          overlay.reviews[index].path,
          overlay.reviews[index].sha256,
          `reviewerReassignment.reviews[${index}].path`,
        ));
      }
    }
    for (let index = 0; index < reviewSources.length; index += 1) {
      if (reviewSources[index] === null) continue;
      try {
        const evidence = parseReviewerReassignmentEvidence(
          reviewSources[index].toString('utf8'),
          overlay.reviews[index].path,
        );
        errors.push(
          ...validateReviewerEvidence(evidence, overlay, overlay.reviews[index], index),
        );
      } catch (cause) {
        errors.push(cause.message);
      }
    }
    if (ownerSource !== null) {
      try {
        const evidence = parseReviewerReassignmentEvidence(
          ownerSource.toString('utf8'),
          overlay.ownerApprovalPath,
        );
        errors.push(...validateOwnerReassignmentEvidence(evidence, overlay));
      } catch (cause) {
        errors.push(cause.message);
      }
    }
    try {
      const [{ stdout: baseH }, { stdout: candidateH }, { stdout: tree }] =
        await Promise.all([
        execFileAsync(
          'git',
          reviewerReassignmentGitArgs('rev-parse', `${overlay.baseH}^{commit}`),
          reviewerReassignmentGitOptions(root),
        ),
        execFileAsync(
          'git',
          reviewerReassignmentGitArgs('rev-parse', `${overlay.candidateH}^{commit}`),
          reviewerReassignmentGitOptions(root),
        ),
        execFileAsync(
          'git',
          reviewerReassignmentGitArgs('rev-parse', `${overlay.candidateH}^{tree}`),
          reviewerReassignmentGitOptions(root),
        ),
      ]);
      if (baseH.trim() !== overlay.baseH) {
        errors.push('reviewerReassignment.baseH: git object mismatch');
      }
      if (candidateH.trim() !== overlay.candidateH) {
        errors.push('reviewerReassignment.candidateH: git object mismatch');
      }
      if (tree.trim() !== overlay.tree) {
        errors.push('reviewerReassignment.tree: git tree mismatch');
      }
      await execFileAsync(
        'git',
        reviewerReassignmentGitArgs(
          'merge-base',
          '--is-ancestor',
          overlay.baseH,
          overlay.candidateH,
        ),
        reviewerReassignmentGitOptions(root),
      );
      const { stdout: diffSource } = await execFileAsync(
        'git',
        reviewerReassignmentDiffArgs(overlay.baseH, overlay.candidateH),
        reviewerReassignmentGitOptions(root, {
          attributeSource: overlay.candidateH,
          encoding: 'buffer',
          maxBuffer: 10 * 1024 * 1024,
        }),
      );
      if (
        reviewPackageSource !== null &&
        !reviewPackageSource.equals(diffSource)
      ) {
        errors.push(
          'reviewerReassignment.reviewPackagePath: bytes must equal exact git diff',
        );
      }
      errors.push(
        ...(await verifyRepositoryLocalGitDiffEnvironment(
          root,
          'reviewerReassignment',
        )),
      );
    } catch (cause) {
      errors.push(
        `reviewerReassignment.gitIdentity: ${cause.code ?? cause.message}`,
      );
    }
  }
  return errors;
}
