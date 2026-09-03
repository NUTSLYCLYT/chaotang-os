import { createHash } from 'node:crypto';
import { lstat, readFile } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';

export const SCENE_PACK_AUTHORITY_PATH =
  '.harness/manifest/execution-authority.scene-pack-v1.json';
export const SCENE_PACK_AUTHORITY_SCHEMA_PATH =
  '.harness/contracts/execution-authority-scene-pack-v1.schema.json';
export const SCENE_PACK_WORK_PACKAGE = 'SCENE-PACK-V1';

export const EXPECTED_SCENE_PACK_AUTHORITY_REGISTRATION = Object.freeze({
  status: 'APPROVED_FOR_SCENE_PACK_V1',
  manifest: SCENE_PACK_AUTHORITY_PATH,
  schema: SCENE_PACK_AUTHORITY_SCHEMA_PATH,
  resolver: 'scripts/lib/execution-authority-scene-pack-v1.mjs',
  command: 'scripts/execution-authority-scene-pack-v1.mjs',
  test: 'scripts/execution-authority-scene-pack-v1.nodetest.mjs',
  documentation: '.harness/wiki/execution-authority-scene-pack-v1.md',
  verification: Object.freeze([
    'node --test scripts/execution-authority-scene-pack-v1.nodetest.mjs',
    'node scripts/execution-authority-scene-pack-v1.mjs --check',
    'node scripts/execution-authority-scene-pack-v1.mjs --authorize --work-package SCENE-PACK-V1',
    'node scripts/harness-doctor.mjs',
  ]),
});

const AUTHORITY_ID = 'scene-pack-v1-execution-authority-20260903';
const AMENDMENT_ID = 'SCENE-PACK-V1-FIRST-REAL-SCENES-20260903';
const AMENDMENT_PATH = '.harness/changes/feat-scene-pack-v1-amendment-20260903/amendment.md';
const OWNER_APPROVAL_PATH =
  '.harness/changes/feat-scene-pack-v1-amendment-20260903/owner_approval/exact-h-approval.md';
const APPROVED_AMENDMENT_DIGEST =
  '14f84c54c2f2429bc581dcc99b8534dd29a75a9dc13defbc9d842426e437dad0';
const APPROVED_OWNER_APPROVAL_DIGEST =
  'e066160486d07602bd364e3529964673c7b48ebd481b154220b3f24be084a9ae';
const EFFECTIVE_BASE_REF = 'origin/ext-dev';
const EFFECTIVE_BASE_SHA = '8282247208f3d79a8158aa7dc3138a49b1b919fb';
const HEX64_PATTERN = /^[0-9a-f]{64}$/;
const HEX40_PATTERN = /^[0-9a-f]{40}$/;

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

export async function readPinnedSceneAuthorityFile(root, path, errors) {
  if (!safeRepositoryPath(path)) {
    errors.push(`unsafe scene authority path: ${path}`);
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
      errors.push(`${path}: symbolic links are forbidden in scene authority inputs`);
      return null;
    }
    if (index < components.length - 1 && !stat.isDirectory()) {
      errors.push(`${path}: ancestor is not a directory`);
      return null;
    }
    if (index === components.length - 1 && !stat.isFile()) {
      errors.push(`${path}: scene authority input must be a regular file`);
      return null;
    }
  }
  try {
    return await readFile(current, 'utf8');
  } catch (cause) {
    errors.push(`${path}: unable to read scene authority input: ${cause.message}`);
    return null;
  }
}

export function validateScenePackAuthoritySchema(schema) {
  const errors = [];
  if (schema?.$schema !== 'https://json-schema.org/draft/2020-12/schema') {
    errors.push('scene authority schema must use JSON Schema 2020-12');
  }
  if (schema?.type !== 'object' || schema?.additionalProperties !== false) {
    errors.push('scene authority schema root must be a closed object');
  }
  if (schema?.properties?.schemaVersion?.const !== 'execution-authority.scene-pack-v1') {
    errors.push('scene authority schemaVersion must be fixed');
  }
  if (schema?.properties?.authorityId?.const !== AUTHORITY_ID) {
    errors.push('scene authorityId must be fixed');
  }
  if (schema?.properties?.amendment?.properties?.id?.const !== AMENDMENT_ID) {
    errors.push('scene authority amendment id must be fixed');
  }
  if (schema?.properties?.effectiveBase?.properties?.sha?.const !== EFFECTIVE_BASE_SHA) {
    errors.push('scene authority effective base sha must be pinned');
  }
  if (schema?.properties?.policy?.properties?.allowPush?.const !== false) {
    errors.push('scene authority must not authorize push');
  }
  return errors;
}

export function validateScenePackAuthorityManifest(manifest) {
  const errors = [];
  if (
    !exactKeys(manifest, [
      'schemaVersion',
      'authorityId',
      'amendment',
      'effectiveBase',
      'approvalEvidence',
      'activeWorkPackage',
      'policy',
    ])
  ) {
    return ['scene authority has missing or unsupported top-level fields'];
  }
  if (manifest.schemaVersion !== 'execution-authority.scene-pack-v1') {
    errors.push('scene authority schemaVersion mismatch');
  }
  if (manifest.authorityId !== AUTHORITY_ID) errors.push('scene authorityId mismatch');

  if (!exactKeys(manifest.amendment, ['id', 'path', 'approvedSourceDigest'])) {
    errors.push('scene authority amendment must contain exactly id, path, approvedSourceDigest');
  } else {
    if (manifest.amendment.id !== AMENDMENT_ID) errors.push('scene amendment id mismatch');
    if (manifest.amendment.path !== AMENDMENT_PATH) errors.push('scene amendment path mismatch');
    if (manifest.amendment.approvedSourceDigest !== APPROVED_AMENDMENT_DIGEST) {
      errors.push('scene amendment approvedSourceDigest mismatch');
    }
    if (!HEX64_PATTERN.test(manifest.amendment.approvedSourceDigest ?? '')) {
      errors.push('scene amendment digest must be 64 hex');
    }
  }

  if (!exactKeys(manifest.effectiveBase, ['ref', 'sha'])) {
    errors.push('scene effectiveBase must contain exactly ref, sha');
  } else {
    if (manifest.effectiveBase.ref !== EFFECTIVE_BASE_REF) errors.push('scene effectiveBase ref mismatch');
    if (manifest.effectiveBase.sha !== EFFECTIVE_BASE_SHA) errors.push('scene effectiveBase sha mismatch');
    if (!HEX40_PATTERN.test(manifest.effectiveBase.sha ?? '')) {
      errors.push('scene effectiveBase sha must be 40 hex');
    }
  }

  if (!exactKeys(manifest.approvalEvidence, ['ownerApprovalPath', 'ownerApprovalSha256', 'approver', 'approvedScope'])) {
    errors.push('scene approvalEvidence has missing or unsupported fields');
  } else {
    if (manifest.approvalEvidence.ownerApprovalPath !== OWNER_APPROVAL_PATH) {
      errors.push('scene ownerApprovalPath mismatch');
    }
    if (manifest.approvalEvidence.ownerApprovalSha256 !== APPROVED_OWNER_APPROVAL_DIGEST) {
      errors.push('scene ownerApprovalSha256 mismatch');
    }
    if (manifest.approvalEvidence.approver !== 'lyt') errors.push('scene approver must be lyt');
    if (!sameArray(manifest.approvalEvidence.approvedScope, [SCENE_PACK_WORK_PACKAGE])) {
      errors.push('scene approvedScope must contain only SCENE-PACK-V1');
    }
  }

  if (manifest.activeWorkPackage !== SCENE_PACK_WORK_PACKAGE) {
    errors.push('scene activeWorkPackage must be SCENE-PACK-V1');
  }

  if (
    !exactKeys(manifest.policy, [
      'allowProductRuntimeChanges',
      'allowPush',
      'allowMerge',
      'allowDeploy',
      'allowExternalActions',
      'allowedData',
    ])
  ) {
    errors.push('scene policy has missing or unsupported fields');
  } else {
    if (manifest.policy.allowProductRuntimeChanges !== true) {
      errors.push('scene policy must allow product runtime changes');
    }
    for (const key of ['allowPush', 'allowMerge', 'allowDeploy', 'allowExternalActions']) {
      if (manifest.policy[key] !== false) errors.push(`scene policy ${key} must be false`);
    }
    if (manifest.policy.allowedData !== 'demo_or_user_provided_non_external_execution_only') {
      errors.push('scene policy allowedData mismatch');
    }
  }

  return errors;
}

export function resolveScenePackAuthority(manifest, loadedDigests = {}, options = {}) {
  const { workPackage } = options;
  const errors = validateScenePackAuthorityManifest(manifest);
  if (errors.length > 0) {
    return {
      schemaVersion: 'execution-authority.scene-pack-v1',
      decision: 'STOP',
      reason: 'INVALID_SCENE_PACK_AUTHORITY',
      errors,
    };
  }
  if (loadedDigests.amendmentDigest !== manifest.amendment.approvedSourceDigest) {
    return {
      schemaVersion: 'execution-authority.scene-pack-v1',
      decision: 'STOP',
      reason: 'AMENDMENT_DIGEST_DRIFT',
    };
  }
  if (loadedDigests.ownerApprovalDigest !== manifest.approvalEvidence.ownerApprovalSha256) {
    return {
      schemaVersion: 'execution-authority.scene-pack-v1',
      decision: 'STOP',
      reason: 'OWNER_APPROVAL_DIGEST_DRIFT',
    };
  }
  if (typeof workPackage !== 'string' || workPackage.length === 0) {
    return {
      schemaVersion: 'execution-authority.scene-pack-v1',
      decision: 'STOP',
      reason: 'WORK_PACKAGE_ARGUMENT_REQUIRED',
    };
  }
  if (workPackage !== SCENE_PACK_WORK_PACKAGE) {
    return {
      schemaVersion: 'execution-authority.scene-pack-v1',
      decision: 'STOP',
      reason: 'WORK_PACKAGE_MISMATCH',
    };
  }
  if (manifest.activeWorkPackage !== SCENE_PACK_WORK_PACKAGE) {
    return {
      schemaVersion: 'execution-authority.scene-pack-v1',
      decision: 'STOP',
      reason: 'NO_ACTIVE_WORK_PACKAGE',
    };
  }
  return {
    schemaVersion: 'execution-authority.scene-pack-v1',
    decision: 'GO',
    activeWorkPackage: SCENE_PACK_WORK_PACKAGE,
    effectiveBase: `${EFFECTIVE_BASE_REF}@${EFFECTIVE_BASE_SHA}`,
    reason: 'APPROVED_SCENE_PACK_V1',
  };
}

export async function loadExecutionAuthorityScenePackV1(root) {
  const errors = [];
  const manifestSource = await readPinnedSceneAuthorityFile(root, SCENE_PACK_AUTHORITY_PATH, errors);
  const schemaSource = await readPinnedSceneAuthorityFile(root, SCENE_PACK_AUTHORITY_SCHEMA_PATH, errors);

  let manifest = null;
  let schema = null;
  let amendmentDigest = null;
  let ownerApprovalDigest = null;

  if (manifestSource !== null) {
    try {
      manifest = parseJsonObjectWithUniqueKeys(manifestSource, SCENE_PACK_AUTHORITY_PATH);
    } catch (cause) {
      errors.push(cause.message);
    }
  }
  if (schemaSource !== null) {
    try {
      schema = parseJsonObjectWithUniqueKeys(schemaSource, SCENE_PACK_AUTHORITY_SCHEMA_PATH);
      errors.push(...validateScenePackAuthoritySchema(schema));
    } catch (cause) {
      errors.push(cause.message);
    }
  }

  if (manifest !== null) {
    const manifestErrors = validateScenePackAuthorityManifest(manifest);
    errors.push(...manifestErrors);
    if (manifestErrors.length === 0) {
      const amendmentSource = await readPinnedSceneAuthorityFile(root, manifest.amendment.path, errors);
      if (amendmentSource !== null) amendmentDigest = sha256Hex(amendmentSource);
      const ownerApprovalSource = await readPinnedSceneAuthorityFile(
        root,
        manifest.approvalEvidence.ownerApprovalPath,
        errors,
      );
      if (ownerApprovalSource !== null) ownerApprovalDigest = sha256Hex(ownerApprovalSource);
      if (amendmentDigest !== null && amendmentDigest !== manifest.amendment.approvedSourceDigest) {
        errors.push('scene amendment digest mismatch');
      }
      if (ownerApprovalDigest !== null && ownerApprovalDigest !== manifest.approvalEvidence.ownerApprovalSha256) {
        errors.push('scene owner approval digest mismatch');
      }
    }
  }

  return {
    manifest,
    schema,
    loadedDigests: { amendmentDigest, ownerApprovalDigest },
    errors: [...new Set(errors)],
  };
}

export function validateExecutionAuthorityScenePackV1(loaded) {
  if (!loaded || loaded.manifest === null || loaded.manifest === undefined) {
    return [...new Set(loaded?.errors ?? ['scene authority manifest is unavailable'])];
  }
  return [...new Set([...(loaded.errors ?? []), ...validateScenePackAuthorityManifest(loaded.manifest)])];
}

export function executionAuthorityScenePackV1CommandResult(
  loaded,
  mode = '--authorize',
  { workPackage } = {},
) {
  if (!['--status', '--check', '--authorize'].includes(mode)) {
    return {
      exitCode: 64,
      output: {
        schemaVersion: 'execution-authority.scene-pack-v1',
        decision: 'STOP',
        reason: 'UNSUPPORTED_COMMAND',
      },
    };
  }
  const errors = validateExecutionAuthorityScenePackV1(loaded);
  if (errors.length > 0) {
    return {
      exitCode: 1,
      output: {
        schemaVersion: 'execution-authority.scene-pack-v1',
        decision: 'STOP',
        reason: 'INVALID_SCENE_PACK_AUTHORITY',
        errors,
      },
    };
  }
  if (mode === '--check') {
    return {
      exitCode: 0,
      output: {
        schemaVersion: 'execution-authority.scene-pack-v1',
        decision: 'VALID_STRUCTURE',
        reason: 'STRUCTURALLY_VALID_NOT_AN_AUTHORIZATION',
      },
    };
  }
  if (mode === '--status') {
    return {
      exitCode: 0,
      output: {
        schemaVersion: 'execution-authority.scene-pack-v1',
        activeWorkPackage: loaded.manifest.activeWorkPackage,
        reason: 'STATUS_ONLY_NOT_AN_AUTHORIZATION',
      },
    };
  }
  const decision = resolveScenePackAuthority(loaded.manifest, loaded.loadedDigests, { workPackage });
  return { exitCode: decision.decision === 'GO' ? 0 : 2, output: decision };
}
