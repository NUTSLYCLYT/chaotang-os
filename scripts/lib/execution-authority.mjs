import { createHash } from 'node:crypto';
import { lstat, readFile, readdir } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';

export const EXECUTION_AUTHORITY_PATH = '.harness/manifest/execution-authority.v1.json';
export const EXECUTION_AUTHORITY_SCHEMA_PATH =
  '.harness/contracts/execution-authority.schema.json';
export const CANONICAL_EXECUTION_PLAN =
  'docs/plans/chaotang-os-world-class-agent-harness-execution-plan-2026-07-17.md';
export const EXPECTED_EXECUTION_SEQUENCE = Object.freeze([
  'M0',
  'M1',
  'M2',
  'M5',
  'M6',
  'M3',
  'M4',
  'M7',
  'M8',
  'M9',
  'M10',
]);
export const EXPECTED_EXECUTION_AUTHORITY_REGISTRATION = Object.freeze({
  status: 'AMENDMENT_REQUIRED',
  manifest: EXECUTION_AUTHORITY_PATH,
  schema: EXECUTION_AUTHORITY_SCHEMA_PATH,
  resolver: 'scripts/lib/execution-authority.mjs',
  command: 'scripts/execution-authority.mjs',
  test: 'scripts/execution-authority.nodetest.mjs',
  documentation: '.harness/wiki/execution-authority.md',
  verification: Object.freeze([
    'node --test scripts/execution-authority.nodetest.mjs',
    'node scripts/execution-authority.mjs --check',
    'node scripts/harness-doctor.mjs',
  ]),
});

const AUTHORITY_ID = 'r0-execution-authority-20260720-v1';
const DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/;
const PLAN_PATH_PATTERN = /^docs\/plans\/[A-Za-z0-9][A-Za-z0-9._-]*\.md$/;
const EXPECTED_PRODUCT_AUTHORITIES = new Map([
  ['docs/product/PROJECT_PRODUCT.md', 'PRODUCT_CONSTITUTION'],
  ['docs/product/releases/product-r0-trusted-kernel/PRD.md', 'R0_R1_RELEASE_PRD'],
]);
const EXPECTED_GOVERNED_DOCUMENTS = new Map([
  ['AGENTS.md', 'ROOT_AGENT_ENTRY'],
  ['.harness/agents/project-owner.md', 'PROJECT_OWNER_POLICY'],
  ['.harness/rules/project-workflow.md', 'PROJECT_WORKFLOW_POLICY'],
  ['.harness/templates/change-template/summary.md', 'CHANGE_RECORD_TEMPLATE'],
]);
const REQUIRED_DOCUMENT_CONTENT = new Map([
  [
    'AGENTS.md',
    [
      '.harness/agents/project-owner.md',
      'node scripts/execution-authority.mjs --check',
      'node scripts/execution-authority-v2.mjs --authorize --work-package <R0-Wxx>',
      'V1_CHECK_INTEGRITY_ONLY_NON_AUTHORIZING',
      'V2_SCOPED_AUTHORIZE_SOLE_PRODUCT_DECISION',
    ],
  ],
  [
    'docs/product/PROJECT_PRODUCT.md',
    ['CURRENT_PRODUCT_SSOT', 'R0 内部可信内核', 'R2 邀请制生产'],
  ],
  [
    'docs/product/releases/product-r0-trusted-kernel/PRD.md',
    [
      'FROZEN_PRODUCT_SCOPE / IMPLEMENTATION_REQUIRES_AMENDMENT',
      '本 PRD 冻结产品需求，不自行授权修改生产代码',
    ],
  ],
  [
    '.harness/agents/project-owner.md',
    [
      'node scripts/execution-authority.mjs --check',
      'node scripts/execution-authority-v2.mjs --authorize --work-package <R0-Wxx>',
      'V1_CHECK_INTEGRITY_ONLY_NON_AUTHORIZING',
      'V2_SCOPED_AUTHORIZE_SOLE_PRODUCT_DECISION',
      '不能单独授予产品施工权',
    ],
  ],
  [
    '.harness/rules/project-workflow.md',
    [
      'node scripts/execution-authority.mjs --check',
      'node scripts/execution-authority-v2.mjs --authorize --work-package <R0-Wxx>',
      'V1_CHECK_INTEGRITY_ONLY_NON_AUTHORIZING',
      'V2_SCOPED_AUTHORIZE_SOLE_PRODUCT_DECISION',
      '不单独授予产品实施权',
    ],
  ],
  [
    '.harness/templates/change-template/summary.md',
    ['NOT_GRANTED_BY_CHANGE_RECORD'],
  ],
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

export function sha256Document(text) {
  return `sha256:${createHash('sha256').update(text, 'utf8').digest('hex')}`;
}

export function validateGovernedDocumentContent(path, text) {
  const required = REQUIRED_DOCUMENT_CONTENT.get(path) ?? [];
  return required
    .filter((needle) => !text.includes(needle))
    .map((needle) => `${path}: missing required inactive-authority statement ${JSON.stringify(needle)}`);
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

function validatePinnedEntries(entries, expected, label, errors) {
  if (!Array.isArray(entries)) {
    errors.push(`${label} must be an array`);
    return;
  }
  const actual = new Map();
  for (const entry of entries) {
    if (!exactKeys(entry, ['path', 'role', 'sha256'])) {
      errors.push(`${label} entries must contain exactly path, role, sha256`);
      continue;
    }
    if (!safeRepositoryPath(entry.path)) errors.push(`${label}: unsafe path ${entry.path}`);
    if (actual.has(entry.path)) errors.push(`${label}: duplicate path ${entry.path}`);
    actual.set(entry.path, entry.role);
    if (!DIGEST_PATTERN.test(entry.sha256)) errors.push(`${label}: invalid digest for ${entry.path}`);
  }
  if (actual.size !== expected.size) errors.push(`${label}: inventory size mismatch`);
  for (const [path, role] of expected) {
    if (actual.get(path) !== role) errors.push(`${label}: missing or invalid ${path}`);
  }
  for (const path of actual.keys()) {
    if (!expected.has(path)) errors.push(`${label}: unexpected path ${path}`);
  }
}

export function validateExecutionAuthorityManifest(manifest) {
  const errors = [];
  if (
    !exactKeys(manifest, [
      'schemaVersion',
      'authorityId',
      'status',
      'productAuthorities',
      'governedDocuments',
      'canonicalPlan',
      'referencePlans',
      'activation',
    ])
  ) {
    return ['execution-authority.v1 has missing or unsupported top-level fields'];
  }
  if (manifest.schemaVersion !== 'execution-authority.v1') {
    errors.push('execution-authority.v1 schemaVersion is required');
  }
  if (manifest.authorityId !== AUTHORITY_ID) errors.push(`unsupported authorityId: ${manifest.authorityId}`);
  if (manifest.status !== 'AMENDMENT_REQUIRED') {
    errors.push('execution-authority.v1 must remain AMENDMENT_REQUIRED and inactive');
  }

  validatePinnedEntries(
    manifest.productAuthorities,
    EXPECTED_PRODUCT_AUTHORITIES,
    'productAuthorities',
    errors,
  );
  validatePinnedEntries(
    manifest.governedDocuments,
    EXPECTED_GOVERNED_DOCUMENTS,
    'governedDocuments',
    errors,
  );

  if (!exactKeys(manifest.canonicalPlan, ['path', 'sha256', 'state', 'sequence'])) {
    errors.push('canonicalPlan must contain exactly path, sha256, state, sequence');
  } else {
    if (manifest.canonicalPlan.path !== CANONICAL_EXECUTION_PLAN) {
      errors.push('canonicalPlan path is not the frozen M0-M10 plan');
    }
    if (!DIGEST_PATTERN.test(manifest.canonicalPlan.sha256)) {
      errors.push('canonicalPlan digest is invalid');
    }
    if (manifest.canonicalPlan.state !== 'INACTIVE') {
      errors.push('execution-authority.v1 canonical plan must remain inactive');
    }
    if (!sameArray(manifest.canonicalPlan.sequence, EXPECTED_EXECUTION_SEQUENCE)) {
      errors.push('canonicalPlan sequence differs from the frozen M0-M10 sequence');
    }
  }

  if (!Array.isArray(manifest.referencePlans)) {
    errors.push('referencePlans must be an array');
  } else {
    const paths = new Set();
    for (const plan of manifest.referencePlans) {
      if (!exactKeys(plan, ['path', 'sha256', 'authority', 'executionSemantics'])) {
        errors.push('referencePlans entries have missing or unsupported fields');
        continue;
      }
      if (!PLAN_PATH_PATTERN.test(plan.path) || !safeRepositoryPath(plan.path)) {
        errors.push(`reference plan has unsafe path: ${plan.path}`);
      }
      if (plan.path === CANONICAL_EXECUTION_PLAN) {
        errors.push('canonical plan cannot also be a reference plan');
      }
      if (paths.has(plan.path)) errors.push(`duplicate reference plan: ${plan.path}`);
      paths.add(plan.path);
      if (!DIGEST_PATTERN.test(plan.sha256)) errors.push(`invalid digest for ${plan.path}`);
      if (plan.authority !== 'NOT_EXECUTION_AUTHORITY') {
        errors.push(`${plan.path}: reference plan cannot grant execution authority`);
      }
      if (plan.executionSemantics !== 'NONE') {
        errors.push(`${plan.path}: reference plan execution semantics must be NONE`);
      }
    }
  }

  if (!exactKeys(manifest.activation, ['activeAmendment', 'approvalEvidence', 'effectiveHead'])) {
    errors.push('activation must contain exactly activeAmendment, approvalEvidence, effectiveHead');
  } else if (
    manifest.activation.activeAmendment !== null ||
    manifest.activation.approvalEvidence !== null ||
    manifest.activation.effectiveHead !== null
  ) {
    errors.push('execution-authority.v1 activation must remain empty until a new approved contract exists');
  }
  return errors;
}

export function validateExecutionAuthoritySchema(schema) {
  const errors = [];
  if (schema?.$schema !== 'https://json-schema.org/draft/2020-12/schema') {
    errors.push('execution authority schema must use JSON Schema 2020-12');
  }
  if (schema?.$id !== 'https://chaotang.local/contracts/execution-authority.v1.schema.json') {
    errors.push('execution authority schema has an unexpected $id');
  }
  if (schema?.type !== 'object' || schema?.additionalProperties !== false) {
    errors.push('execution authority schema root must be a closed object');
  }
  if (schema?.properties?.schemaVersion?.const !== 'execution-authority.v1') {
    errors.push('schemaVersion must be fixed to execution-authority.v1');
  }
  if (schema?.properties?.authorityId?.const !== AUTHORITY_ID) {
    errors.push('authorityId must be fixed to the G0 authority identity');
  }
  if (schema?.properties?.status?.const !== 'AMENDMENT_REQUIRED') {
    errors.push('v1 schema cannot describe an active status');
  }
  const canonical = schema?.properties?.canonicalPlan;
  if (canonical?.additionalProperties !== false) {
    errors.push('canonicalPlan schema must reject unknown fields');
  }
  if (canonical?.properties?.state?.const !== 'INACTIVE') {
    errors.push('v1 canonicalPlan schema must remain INACTIVE');
  }
  if (!sameArray(canonical?.properties?.sequence?.const, EXPECTED_EXECUTION_SEQUENCE)) {
    errors.push('v1 schema has an invalid M0-M10 sequence');
  }
  const activation = schema?.properties?.activation;
  if (activation?.additionalProperties !== false) {
    errors.push('activation schema must reject unknown fields');
  }
  for (const key of ['activeAmendment', 'approvalEvidence', 'effectiveHead']) {
    if (activation?.properties?.[key]?.type !== 'null') {
      errors.push(`v1 activation ${key} must only accept null`);
    }
  }
  const reference = schema?.properties?.referencePlans?.items;
  if (
    reference?.additionalProperties !== false ||
    reference?.properties?.authority?.const !== 'NOT_EXECUTION_AUTHORITY' ||
    reference?.properties?.executionSemantics?.const !== 'NONE'
  ) {
    errors.push('referencePlans schema must be closed and non-authoritative');
  }
  if (schema?.$defs?.pinnedDocument?.additionalProperties !== false) {
    errors.push('pinnedDocument schema must reject unknown fields');
  }
  return errors;
}

export function resolveExecutionAuthority(manifest) {
  const errors = validateExecutionAuthorityManifest(manifest);
  if (errors.length > 0) throw new Error(`execution-authority.v1 rejected: ${errors.join('; ')}`);
  return {
    schemaVersion: manifest.schemaVersion,
    authorityId: manifest.authorityId,
    decision: 'STOP',
    canExecuteCanonicalPlan: false,
    reason: 'AMENDMENT_APPROVAL_REQUIRED',
    canonicalPlan: manifest.canonicalPlan.path,
  };
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
      errors.push(`${path}: missing path component ${components.slice(0, index + 1).join('/')}: ${cause.code ?? cause.message}`);
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

export async function loadExecutionAuthority(root) {
  const errors = [];
  const manifestSource = await readPinnedAuthorityFile(root, EXECUTION_AUTHORITY_PATH, errors);
  const schemaSource = await readPinnedAuthorityFile(root, EXECUTION_AUTHORITY_SCHEMA_PATH, errors);
  let manifest = null;
  let schema = null;
  if (manifestSource !== null) {
    try {
      manifest = parseJsonObjectWithUniqueKeys(manifestSource, EXECUTION_AUTHORITY_PATH);
    } catch (cause) {
      errors.push(cause.message);
    }
  }
  if (schemaSource !== null) {
    try {
      schema = parseJsonObjectWithUniqueKeys(schemaSource, EXECUTION_AUTHORITY_SCHEMA_PATH);
      errors.push(...validateExecutionAuthoritySchema(schema));
    } catch (cause) {
      errors.push(cause.message);
    }
  }
  if (manifest === null) return { manifest, schema, documents: {}, actualPlans: [], errors };

  const manifestErrors = validateExecutionAuthorityManifest(manifest);
  errors.push(...manifestErrors);
  if (manifestErrors.length > 0) {
    return { manifest, schema, documents: {}, actualPlans: [], errors: [...new Set(errors)] };
  }
  const documents = {};
  const pinnedEntries = [
    ...manifest.productAuthorities,
    ...manifest.governedDocuments,
    manifest.canonicalPlan,
    ...manifest.referencePlans,
  ];
  for (const entry of pinnedEntries) {
    if (!entry || typeof entry.path !== 'string') continue;
    const source = await readPinnedAuthorityFile(root, entry.path, errors);
    if (source === null) continue;
    documents[entry.path] = source;
    if (entry.sha256 !== sha256Document(source)) errors.push(`${entry.path}: digest mismatch`);
    errors.push(...validateGovernedDocumentContent(entry.path, source));
  }

  const plansRoot = join(root, 'docs/plans');
  const actualPlans = [];
  try {
    const stat = await lstat(plansRoot);
    if (stat.isSymbolicLink() || !stat.isDirectory()) {
      errors.push('docs/plans must be a real directory, not a symlink');
    } else {
      const entries = await readdir(plansRoot, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isSymbolicLink() || entry.isDirectory() || !entry.isFile()) {
          errors.push(`docs/plans must remain flat regular files: ${entry.name}`);
        } else if (entry.name.endsWith('.md')) {
          const path = `docs/plans/${entry.name}`;
          if (!PLAN_PATH_PATTERN.test(path)) errors.push(`unsafe plan filename: ${entry.name}`);
          actualPlans.push(path);
        }
      }
    }
  } catch (cause) {
    errors.push(`unable to inventory docs/plans: ${cause.message}`);
  }

  const inventoriedPlans = [
    manifest.canonicalPlan.path,
    ...manifest.referencePlans.map((entry) => entry.path),
  ].sort();
  actualPlans.sort();
  if (!sameArray(inventoriedPlans, actualPlans)) {
    errors.push('execution authority plan inventory differs from the real flat docs/plans inventory');
  }
  return { manifest, schema, documents, actualPlans, errors: [...new Set(errors)] };
}

export function validateExecutionAuthority(loaded) {
  if (!loaded || loaded.manifest === null || loaded.manifest === undefined) {
    return [...new Set(loaded?.errors ?? ['execution authority manifest is unavailable'])];
  }
  return [
    ...new Set([
      ...(loaded.errors ?? []),
      ...validateExecutionAuthorityManifest(loaded.manifest),
    ]),
  ];
}

export function executionAuthorityCommandResult(loaded, mode = '--authorize', extraArguments = []) {
  if (!['--status', '--check', '--authorize'].includes(mode) || extraArguments.length > 0) {
    return {
      exitCode: 64,
      output: {
        schemaVersion: 'execution-authority.v1',
        decision: 'STOP',
        canExecuteCanonicalPlan: false,
        reason: 'UNSUPPORTED_COMMAND',
      },
    };
  }
  const errors = validateExecutionAuthority(loaded);
  if (errors.length > 0) {
    return {
      exitCode: 1,
      output: {
        schemaVersion: 'execution-authority.v1',
        decision: 'STOP',
        canExecuteCanonicalPlan: false,
        reason: 'INVALID_EXECUTION_AUTHORITY',
        errors,
      },
    };
  }
  const decision = resolveExecutionAuthority(loaded.manifest);
  if (mode === '--check') {
    return {
      exitCode: 0,
      output: { ...decision, decision: 'VALID_INACTIVE_GUARD' },
    };
  }
  return { exitCode: mode === '--authorize' ? 2 : 0, output: decision };
}
