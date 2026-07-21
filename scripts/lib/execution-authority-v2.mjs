import { createHash } from 'node:crypto';
import { lstat, readFile } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';

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
