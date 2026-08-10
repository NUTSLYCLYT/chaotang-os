import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { constants as fsConstants } from 'node:fs';
import { lstat, open, realpath } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const GIT = '/usr/bin/git';
const HEX40 = /^[0-9a-f]{40}$/u;
const HEX64 = /^[0-9a-f]{64}$/u;
const IDENTITY = /^\/root\/[a-z0-9][a-z0-9_\/-]*$/u;

export const REVIEWER_SUCCESSOR_W08_ROOT =
  '.harness/changes/docs-r0-w08-codex-reviewer-successor-20260810';
export const REVIEWER_SUCCESSOR_W08_PRODUCT_BASE =
  '4c543209333fa14f3a296ff1ff917642153ffc30';
export const REVIEWER_SUCCESSOR_W08_PRODUCT_H =
  '24071c2f9a5cd19952ece17a8dc172a297a1dc09';
export const REVIEWER_SUCCESSOR_W08_PRODUCT_TREE =
  '9d1bdc08dbbd4a6198907976508c956c86cfffff';
export const REVIEWER_SUCCESSOR_W08_PRODUCT_DIFF_SHA256 =
  '432082345d18230fcaff22e36602a5274b68b25562b3772736e6ad5685e05044';

const OVERLAY_KEYS = Object.freeze([
  'approvedBy',
  'candidateMutation',
  'executionOwner',
  'expiresAfter',
  'fromReviewer',
  'governanceBaseH',
  'governanceCandidateH',
  'governanceReviewPackagePath',
  'governanceReviewPackageSha256',
  'governanceTree',
  'ownerApprovalPath',
  'ownerApprovalSha256',
  'productBaseH',
  'productCandidateH',
  'productReviewPackagePath',
  'productReviewPackageSha256',
  'productTree',
  'reviewPassesRequired',
  'reviews',
  'schemaVersion',
  'scope',
  'sessionIsolation',
  'status',
  'toReviewer',
  'writeAccess',
]);
const REVIEW_KEYS = Object.freeze([
  'high',
  'identity',
  'medium',
  'path',
  'sha256',
  'verdict',
  'writeAccess',
]);
const REVIEW_EVIDENCE_KEYS = Object.freeze([
  'candidateMutation',
  'governanceBaseH',
  'governanceCandidateH',
  'governanceReviewPackagePath',
  'governanceReviewPackageSha256',
  'governanceTree',
  'high',
  'identity',
  'kind',
  'medium',
  'pass',
  'productBaseH',
  'productCandidateH',
  'productReviewPackagePath',
  'productReviewPackageSha256',
  'productTree',
  'reviewer',
  'schemaVersion',
  'scope',
  'verdict',
  'writeAccess',
]);
const OWNER_EVIDENCE_KEYS = Object.freeze([
  'approver',
  'decision',
  'governanceBaseH',
  'governanceCandidateH',
  'governanceReviewPackagePath',
  'governanceReviewPackageSha256',
  'governanceTree',
  'kind',
  'productBaseH',
  'productCandidateH',
  'productReviewPackagePath',
  'productReviewPackageSha256',
  'productTree',
  'reviews',
  'schemaVersion',
  'scope',
]);
const OWNER_REVIEW_KEYS = Object.freeze(['identity', 'path', 'sha256']);
const PROTECTED_PATHS = Object.freeze([
  'scripts/lib/reviewer-successor-w08.mjs',
  'scripts/lib/amendment-governance.mjs',
  'scripts/lib/execution-authority-v2.mjs',
  'scripts/reviewer-successor-w08.nodetest.mjs',
  'scripts/execution-authority-v2.nodetest.mjs',
]);

function exactKeys(value, keys) {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort())
  );
}

function sameArray(left, right) {
  return (
    Array.isArray(left) &&
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function safePath(path) {
  return (
    typeof path === 'string' &&
    path.length > 0 &&
    !isAbsolute(path) &&
    !path.includes('\\') &&
    !path.includes('\0') &&
    !path.split('/').includes('..')
  );
}

function gitArgs(...args) {
  return [
    '--no-replace-objects',
    '-c',
    'core.attributesFile=/dev/null',
    '-c',
    'core.commitGraph=false',
    ...args,
  ];
}

function gitOptions(root, extra = {}) {
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
    },
    ...extra,
  };
}

async function readRegularFile(root, path) {
  if (!safePath(path)) throw new Error(`unsafe path: ${path}`);
  let current = root;
  for (const component of path.split('/')) {
    current = join(current, component);
    const stat = await lstat(current);
    if (stat.isSymbolicLink()) throw new Error(`symbolic links are forbidden: ${path}`);
  }
  const expected = join(await realpath(root), path);
  const handle = await open(current, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW);
  try {
    const [stat, opened] = await Promise.all([
      handle.stat(),
      realpath(`/proc/self/fd/${handle.fd}`),
    ]);
    if (!stat.isFile() || stat.nlink !== 1 || opened !== expected) {
      throw new Error(`evidence path is not a unique regular file: ${path}`);
    }
    return await handle.readFile();
  } finally {
    await handle.close();
  }
}

async function gitBlob(root, commit, path) {
  const { stdout } = await execFileAsync(
    GIT,
    gitArgs('show', `${commit}:${path}`),
    gitOptions(root, { encoding: 'buffer', maxBuffer: 10 * 1024 * 1024 }),
  );
  return Buffer.isBuffer(stdout) ? stdout : Buffer.from(stdout);
}

export function parseReviewerSuccessorW08Evidence(source, label = 'W08 reviewer evidence') {
  const matches = [
    ...String(source).matchAll(
      /<!-- reviewer-successor-w08-evidence:start -->\r?\n```json\r?\n([\s\S]*?)\r?\n```\r?\n<!-- reviewer-successor-w08-evidence:end -->/gu,
    ),
  ];
  if (matches.length !== 1) {
    throw new SyntaxError(`${label}: require exactly one marked JSON evidence block`);
  }
  return JSON.parse(matches[0][1]);
}

export function validateReviewerSuccessorW08(overlay) {
  const errors = [];
  if (!exactKeys(overlay, OVERLAY_KEYS)) {
    return ['reviewerSuccessorW08 has missing or unsupported fields'];
  }
  const exactValues = [
    ['schemaVersion', 'reviewer-successor.w08.v1'],
    ['status', 'APPROVED'],
    ['fromReviewer', 'Claude Code'],
    ['toReviewer', 'Codex Independent QA'],
    ['executionOwner', 'Codex'],
    ['reviewPassesRequired', 2],
    ['sessionIsolation', 'FRESH_NO_FORK_CONTEXT'],
    ['writeAccess', 'DENIED'],
    ['candidateMutation', 'FORBIDDEN'],
    ['expiresAfter', 'R0-W08_MERGED_AND_VERIFIED'],
    ['productBaseH', REVIEWER_SUCCESSOR_W08_PRODUCT_BASE],
    ['productCandidateH', REVIEWER_SUCCESSOR_W08_PRODUCT_H],
    ['productTree', REVIEWER_SUCCESSOR_W08_PRODUCT_TREE],
    ['productReviewPackageSha256', REVIEWER_SUCCESSOR_W08_PRODUCT_DIFF_SHA256],
    ['governanceBaseH', REVIEWER_SUCCESSOR_W08_PRODUCT_H],
    ['approvedBy', 'lyt'],
  ];
  for (const [field, expected] of exactValues) {
    if (overlay[field] !== expected) errors.push(`reviewerSuccessorW08 ${field} mismatch`);
  }
  if (!sameArray(overlay.scope, ['R0-W08'])) {
    errors.push('reviewerSuccessorW08 scope must be exactly R0-W08');
  }
  if (overlay.toReviewer === overlay.executionOwner) {
    errors.push('reviewerSuccessorW08 reviewer must differ from execution owner');
  }
  for (const field of ['governanceCandidateH', 'governanceTree']) {
    if (!HEX40.test(overlay[field] ?? '')) errors.push(`reviewerSuccessorW08 ${field} must be 40-hex`);
  }
  const canonicalPaths = {
    productReviewPackagePath: `${REVIEWER_SUCCESSOR_W08_ROOT}/review_inputs/product-candidate.diff`,
    governanceReviewPackagePath: `${REVIEWER_SUCCESSOR_W08_ROOT}/review_inputs/reviewer-successor.diff`,
    ownerApprovalPath: `${REVIEWER_SUCCESSOR_W08_ROOT}/owner_approval/exact-h-approval.md`,
  };
  for (const [field, expected] of Object.entries(canonicalPaths)) {
    if (overlay[field] !== expected) errors.push(`reviewerSuccessorW08 ${field} must be canonical`);
  }
  for (const field of [
    'productReviewPackageSha256',
    'governanceReviewPackageSha256',
    'ownerApprovalSha256',
  ]) {
    if (!HEX64.test(overlay[field] ?? '')) errors.push(`reviewerSuccessorW08 ${field} must be sha256`);
  }
  if (!Array.isArray(overlay.reviews) || overlay.reviews.length !== 2) {
    errors.push('reviewerSuccessorW08 requires exactly two reviews');
  } else {
    const identities = new Set();
    for (let index = 0; index < overlay.reviews.length; index += 1) {
      const review = overlay.reviews[index];
      if (!exactKeys(review, REVIEW_KEYS)) {
        errors.push(`reviewerSuccessorW08 review ${index + 1} has missing or unsupported fields`);
        continue;
      }
      const expectedPath = `${REVIEWER_SUCCESSOR_W08_ROOT}/codex_review/${index === 0 ? 'pass-1.md' : 'exact-h-final.md'}`;
      if (review.path !== expectedPath) errors.push(`reviewerSuccessorW08 review ${index + 1} path must be canonical`);
      if (!IDENTITY.test(review.identity ?? '')) errors.push(`reviewerSuccessorW08 review ${index + 1} identity is invalid`);
      if (identities.has(review.identity)) errors.push('reviewerSuccessorW08 review identities must be unique');
      identities.add(review.identity);
      if (!HEX64.test(review.sha256 ?? '')) errors.push(`reviewerSuccessorW08 review ${index + 1} sha256 is invalid`);
      if (review.verdict !== 'GO' || review.high !== 0 || review.medium !== 0) {
        errors.push(`reviewerSuccessorW08 review ${index + 1} must be GO with zero HIGH/MEDIUM`);
      }
      if (review.writeAccess !== 'DENIED') errors.push(`reviewerSuccessorW08 review ${index + 1} must deny writes`);
    }
  }
  return [...new Set(errors)];
}

export function effectiveReviewerSuccessorW08(amendmentGovernance, workPackage, ledger = []) {
  const overlay = amendmentGovernance?.reviewerSuccessorW08;
  if (validateReviewerSuccessorW08(overlay).length > 0) return null;
  const active = ledger.some((entry) => entry.id === workPackage && entry.status === 'ACTIVE');
  return active && workPackage === 'R0-W08' ? overlay.toReviewer : null;
}

function validateReviewEvidence(evidence, overlay, review, index) {
  const errors = [];
  if (!exactKeys(evidence, REVIEW_EVIDENCE_KEYS)) return [`reviewerSuccessorW08 review ${index + 1} evidence shape mismatch`];
  const expected = {
    schemaVersion: 'reviewer-successor.w08.evidence.v1',
    kind: 'independent-review',
    reviewer: overlay.toReviewer,
    identity: review.identity,
    pass: index + 1,
    productBaseH: overlay.productBaseH,
    productCandidateH: overlay.productCandidateH,
    productTree: overlay.productTree,
    productReviewPackagePath: overlay.productReviewPackagePath,
    productReviewPackageSha256: overlay.productReviewPackageSha256,
    governanceBaseH: overlay.governanceBaseH,
    governanceCandidateH: overlay.governanceCandidateH,
    governanceTree: overlay.governanceTree,
    governanceReviewPackagePath: overlay.governanceReviewPackagePath,
    governanceReviewPackageSha256: overlay.governanceReviewPackageSha256,
    verdict: 'GO',
    high: 0,
    medium: 0,
    writeAccess: 'DENIED',
    candidateMutation: 'FORBIDDEN',
  };
  for (const [field, value] of Object.entries(expected)) {
    if (evidence[field] !== value) errors.push(`reviewerSuccessorW08 review ${index + 1} evidence ${field} mismatch`);
  }
  if (!sameArray(evidence.scope, ['R0-W08'])) errors.push(`reviewerSuccessorW08 review ${index + 1} evidence scope mismatch`);
  return errors;
}

function validateOwnerEvidence(evidence, overlay) {
  const errors = [];
  if (!exactKeys(evidence, OWNER_EVIDENCE_KEYS)) return ['reviewerSuccessorW08 owner evidence shape mismatch'];
  const expected = {
    schemaVersion: 'reviewer-successor.w08.evidence.v1',
    kind: 'owner-approval',
    decision: 'APPROVED',
    approver: overlay.approvedBy,
    productBaseH: overlay.productBaseH,
    productCandidateH: overlay.productCandidateH,
    productTree: overlay.productTree,
    productReviewPackagePath: overlay.productReviewPackagePath,
    productReviewPackageSha256: overlay.productReviewPackageSha256,
    governanceBaseH: overlay.governanceBaseH,
    governanceCandidateH: overlay.governanceCandidateH,
    governanceTree: overlay.governanceTree,
    governanceReviewPackagePath: overlay.governanceReviewPackagePath,
    governanceReviewPackageSha256: overlay.governanceReviewPackageSha256,
  };
  for (const [field, value] of Object.entries(expected)) {
    if (evidence[field] !== value) errors.push(`reviewerSuccessorW08 owner evidence ${field} mismatch`);
  }
  if (!sameArray(evidence.scope, ['R0-W08'])) errors.push('reviewerSuccessorW08 owner evidence scope mismatch');
  if (!Array.isArray(evidence.reviews) || evidence.reviews.length !== 2) {
    errors.push('reviewerSuccessorW08 owner evidence must bind two reviews');
  } else {
    for (let index = 0; index < 2; index += 1) {
      if (!exactKeys(evidence.reviews[index], OWNER_REVIEW_KEYS)) {
        errors.push(`reviewerSuccessorW08 owner review ${index + 1} shape mismatch`);
      } else {
        for (const field of OWNER_REVIEW_KEYS) {
          if (evidence.reviews[index][field] !== overlay.reviews[index][field]) {
            errors.push(`reviewerSuccessorW08 owner review ${index + 1} ${field} mismatch`);
          }
        }
      }
    }
  }
  return errors;
}

export async function verifyReviewerSuccessorW08(root, overlay) {
  const errors = validateReviewerSuccessorW08(overlay);
  if (errors.length > 0) return errors;
  const evidencePaths = [
    [overlay.productReviewPackagePath, overlay.productReviewPackageSha256],
    [overlay.governanceReviewPackagePath, overlay.governanceReviewPackageSha256],
    [overlay.ownerApprovalPath, overlay.ownerApprovalSha256],
    ...overlay.reviews.map((review) => [review.path, review.sha256]),
  ];
  const sources = new Map();
  for (const [path, digest] of evidencePaths) {
    try {
      const source = await readRegularFile(root, path);
      sources.set(path, source);
      if (createHash('sha256').update(source).digest('hex') !== digest) {
        errors.push(`reviewerSuccessorW08 evidence digest mismatch: ${path}`);
      }
    } catch (cause) {
      errors.push(`reviewerSuccessorW08 evidence unreadable: ${path}: ${cause.code ?? cause.message}`);
    }
  }
  for (let index = 0; index < overlay.reviews.length; index += 1) {
    const source = sources.get(overlay.reviews[index].path);
    if (!source) continue;
    try {
      errors.push(...validateReviewEvidence(
        parseReviewerSuccessorW08Evidence(source.toString('utf8'), overlay.reviews[index].path),
        overlay,
        overlay.reviews[index],
        index,
      ));
    } catch (cause) {
      errors.push(cause.message);
    }
  }
  const ownerSource = sources.get(overlay.ownerApprovalPath);
  if (ownerSource) {
    try {
      errors.push(...validateOwnerEvidence(
        parseReviewerSuccessorW08Evidence(ownerSource.toString('utf8'), overlay.ownerApprovalPath),
        overlay,
      ));
    } catch (cause) {
      errors.push(cause.message);
    }
  }
  try {
    const identities = await Promise.all([
      overlay.productBaseH,
      overlay.productCandidateH,
      overlay.governanceBaseH,
      overlay.governanceCandidateH,
    ].map(async (commit) => (await execFileAsync(GIT, gitArgs('rev-parse', `${commit}^{commit}`), gitOptions(root))).stdout.trim()));
    if (identities.some((identity, index) => identity !== [
      overlay.productBaseH,
      overlay.productCandidateH,
      overlay.governanceBaseH,
      overlay.governanceCandidateH,
    ][index])) errors.push('reviewerSuccessorW08 git commit identity mismatch');
    for (const [candidate, tree] of [
      [overlay.productCandidateH, overlay.productTree],
      [overlay.governanceCandidateH, overlay.governanceTree],
    ]) {
      const actual = (await execFileAsync(GIT, gitArgs('rev-parse', `${candidate}^{tree}`), gitOptions(root))).stdout.trim();
      if (actual !== tree) errors.push(`reviewerSuccessorW08 tree mismatch: ${candidate}`);
    }
    const ranges = [
      [overlay.productBaseH, overlay.productCandidateH, overlay.productReviewPackagePath],
      [overlay.governanceBaseH, overlay.governanceCandidateH, overlay.governanceReviewPackagePath],
    ];
    for (const [base, candidate, path] of ranges) {
      await execFileAsync(GIT, gitArgs('merge-base', '--is-ancestor', base, candidate), gitOptions(root));
      const { stdout } = await execFileAsync(
        GIT,
        gitArgs('diff', '--no-ext-diff', '--no-textconv', '--binary', `${base}..${candidate}`),
        gitOptions(root, { encoding: 'buffer', maxBuffer: 10 * 1024 * 1024 }),
      );
      if (sources.has(path) && !sources.get(path).equals(stdout)) {
        errors.push(`reviewerSuccessorW08 review package differs from exact git diff: ${path}`);
      }
    }
    const head = (await execFileAsync(GIT, gitArgs('rev-parse', 'HEAD^{commit}'), gitOptions(root))).stdout.trim();
    await execFileAsync(GIT, gitArgs('merge-base', '--is-ancestor', overlay.governanceCandidateH, head), gitOptions(root));
    for (const path of PROTECTED_PATHS) {
      const [reviewed, current] = await Promise.all([
        gitBlob(root, overlay.governanceCandidateH, path),
        readRegularFile(root, path),
      ]);
      if (!reviewed.equals(current)) errors.push(`reviewerSuccessorW08 protected path drift: ${path}`);
    }
  } catch (cause) {
    errors.push(`reviewerSuccessorW08 git identity unverifiable: ${cause.code ?? cause.message}`);
  }
  return [...new Set(errors)];
}
