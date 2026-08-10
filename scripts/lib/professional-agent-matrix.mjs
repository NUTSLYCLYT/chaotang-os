import { createHash } from 'node:crypto';
import { lstat, readdir } from 'node:fs/promises';
import { resolve, sep } from 'node:path';

export const MATRIX_SCHEMA_VERSION = 'professional-agent-asset-matrix.v1';
export const MATRIX_ID = 'professional-agent-assets-ext-k0';
export const CANONICAL_OWNER = 'feature-chaotang-ext';
export const DONOR_BRANCH = 'codex/professional-agent-k0-20260803';
export const DONOR_TIP = '675aa950a073ae4e3e72b562aab13eea43d018df';
export const DONOR_CANDIDATE_COMMITS = Object.freeze([
  'a6c391cbda1217a392009c8bc51eed159cdd3464',
  '4c55ad785540463edb16860d5302f77480d2e381',
  '675aa950a073ae4e3e72b562aab13eea43d018df',
]);
export const SAFE_PATH_SCHEMA_PATTERN = '^(?!/)(?!.*//)(?!.*(?:^|/)\\.{1,2}(?:/|$))[A-Za-z0-9._/\\u4e00-\\u9fff-]+$';
export const SCHEMA_CANONICAL_SHA256 = 'a3d4cfe45863d511068271f974b21161ee78f53b23ef6f5176f54aeed5572552';
export const EXPECTED_PROFESSIONAL_AGENT_REGISTRATION = Object.freeze({
  status: 'REVIEW_GO_PENDING_PROMOTION',
  assetFamily: 'PROFESSIONAL_AGENT_K0',
  canonicalOwner: CANONICAL_OWNER,
  manifest: '.harness/manifest/professional-agent-asset-matrix.v1.json',
  contract: '.harness/contracts/professional-agent-asset-matrix.v1.schema.json',
  evaluator: 'scripts/professional-agent-matrix.mjs',
  schemaChecker: 'scripts/professional_agent_matrix_schema_check.py',
  test: 'scripts/professional-agent-matrix.nodetest.mjs',
  documentation: '.harness/wiki/professional-agent-asset-matrix.md',
  verification: [
    'node --test scripts/professional-agent-matrix.nodetest.mjs',
    'node scripts/professional-agent-matrix.mjs --check',
    'node scripts/harness-doctor.mjs',
  ],
});

export function validateProfessionalAgentRegistration(registration) {
  return JSON.stringify(registration) === JSON.stringify(EXPECTED_PROFESSIONAL_AGENT_REGISTRATION)
    ? []
    : ['project professionalAgentAssets registration differs from the reviewed K0 registration'];
}

const MATURITIES = new Set(['DESIGN_ONLY', 'PROMPT_ONLY', 'CONTRACT_READY', 'API_READY', 'LIVE']);
const KINDS = new Set(['CANONICAL_REGISTRY', 'RUNTIME_AGENT', 'ROLE_COLLECTION']);
const COVERAGE = new Set(['VERIFIED', 'PARTIAL']);
const DISPOSITIONS = new Set(['CURRENT_CANONICAL', 'CURRENT_WITH_GAPS']);
const TOP_LEVEL_KEYS = new Set([
  'schemaVersion',
  'matrixId',
  'canonicalOwner',
  'integrationTarget',
  'provenance',
  'inventoryAssertions',
  'assets',
]);
const PROVENANCE_KEYS = new Set([
  'assetFamily',
  'decision',
  'donorBranch',
  'donorTip',
  'candidateCommits',
  'adaptation',
]);
const ASSERTION_KEYS = new Set(['id', 'root', 'fileName', 'expectedCount']);
const PATH_FIELDS = [
  'runtimeEntries',
  'apiEntries',
  'contractEntries',
  'promptEntries',
  'designEntries',
  'toolEntries',
  'testEntries',
];
const ASSET_KEYS = new Set([
  'assetId',
  'title',
  'owner',
  'kind',
  'maturity',
  'capabilities',
  ...PATH_FIELDS,
  'coverageStatus',
  'gapReason',
  'verificationCommand',
  'sourceDisposition',
]);

function isNonBlank(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

export function isSafeRepositoryPath(value) {
  if (!isNonBlank(value) || value.startsWith('/') || value.includes('\\')) return false;
  const segments = value.split('/');
  return /^[A-Za-z0-9._/\u4e00-\u9fff-]+$/u.test(value)
    && !value.includes('//')
    && !segments.some((segment) => segment === '.' || segment === '..');
}

function rejectUnsupportedKeys(errors, label, value, allowed) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    errors.push(`${label} must be an object`);
    return;
  }
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) errors.push(`${label} has unsupported field ${key}`);
  }
}

function validatePathList(errors, assetId, field, value) {
  if (!Array.isArray(value)) {
    errors.push(`${assetId}.${field} must be an array`);
    return;
  }
  const seen = new Set();
  for (const path of value) {
    if (!isSafeRepositoryPath(path)) errors.push(`${assetId}.${field} contains an unsafe path`);
    if (seen.has(path)) errors.push(`${assetId}.${field} contains duplicate path: ${path}`);
    seen.add(path);
  }
}

export function validateProfessionalAgentMatrix(matrix) {
  const errors = [];
  rejectUnsupportedKeys(errors, 'matrix', matrix, TOP_LEVEL_KEYS);
  if (matrix?.schemaVersion !== MATRIX_SCHEMA_VERSION) errors.push('schemaVersion is invalid');
  if (matrix?.matrixId !== MATRIX_ID) errors.push('matrixId is invalid');
  if (matrix?.canonicalOwner !== CANONICAL_OWNER) errors.push('canonicalOwner must be feature-chaotang-ext');
  if (matrix?.integrationTarget !== 'backend/src') errors.push('integrationTarget must remain backend/src');

  const provenance = matrix?.provenance;
  rejectUnsupportedKeys(errors, 'provenance', provenance, PROVENANCE_KEYS);
  if (provenance?.assetFamily !== 'PROFESSIONAL_AGENT_K0') errors.push('provenance.assetFamily is invalid');
  if (provenance?.decision !== 'ABSORB_ADAPT') errors.push('provenance.decision is invalid');
  if (provenance?.donorBranch !== DONOR_BRANCH) errors.push('provenance.donorBranch is invalid');
  if (provenance?.donorTip !== DONOR_TIP) errors.push('provenance.donorTip is invalid');
  if (JSON.stringify(provenance?.candidateCommits) !== JSON.stringify(DONOR_CANDIDATE_COMMITS)) {
    errors.push('provenance.candidateCommits is invalid');
  }
  if (provenance?.adaptation !== 'REBUILT_ON_CURRENT_EXT') errors.push('provenance.adaptation is invalid');

  if (!Array.isArray(matrix?.inventoryAssertions) || matrix.inventoryAssertions.length === 0) {
    errors.push('inventoryAssertions must be a non-empty array');
  } else {
    const assertionIds = new Set();
    for (const assertion of matrix.inventoryAssertions) {
      rejectUnsupportedKeys(errors, `inventory assertion ${assertion?.id ?? '<unknown>'}`, assertion, ASSERTION_KEYS);
      if (!isNonBlank(assertion?.id)) errors.push('inventory assertion id is required');
      if (assertionIds.has(assertion?.id)) errors.push(`duplicate inventory assertion: ${assertion?.id}`);
      assertionIds.add(assertion?.id);
      if (!isSafeRepositoryPath(assertion?.root)) errors.push(`inventory assertion ${assertion?.id} root is unsafe`);
      if (!isNonBlank(assertion?.fileName) || assertion.fileName.includes('/') || assertion.fileName.includes('\\')) {
        errors.push(`inventory assertion ${assertion?.id} fileName is invalid`);
      }
      if (!Number.isInteger(assertion?.expectedCount) || assertion.expectedCount < 1) {
        errors.push(`inventory assertion ${assertion?.id} expectedCount is invalid`);
      }
    }
  }

  if (!Array.isArray(matrix?.assets) || matrix.assets.length === 0) {
    errors.push('assets must be a non-empty array');
    return errors;
  }
  const assetIds = new Set();
  for (const [index, asset] of matrix.assets.entries()) {
    const assetId = isNonBlank(asset?.assetId) ? asset.assetId : `asset[${index}]`;
    if (!isNonBlank(asset?.assetId)) errors.push(`${assetId}.assetId is required`);
    for (const key of ASSET_KEYS) {
      if (!Object.hasOwn(asset ?? {}, key)) errors.push(`${assetId} missing ${key}`);
    }
    for (const key of Object.keys(asset ?? {})) {
      if (!ASSET_KEYS.has(key)) errors.push(`${assetId} has unsupported field ${key}`);
    }
    if (assetIds.has(asset?.assetId)) errors.push(`duplicate assetId: ${asset?.assetId}`);
    assetIds.add(asset?.assetId);
    if (!isNonBlank(asset?.title)) errors.push(`${assetId}.title is required`);
    if (!['root', 'backend'].includes(asset?.owner)) errors.push(`${assetId}.owner is invalid`);
    if (!KINDS.has(asset?.kind)) errors.push(`${assetId}.kind is invalid`);
    if (!MATURITIES.has(asset?.maturity)) errors.push(`${assetId}.maturity is invalid`);
    if (!Array.isArray(asset?.capabilities) || asset.capabilities.length === 0
      || asset.capabilities.some((capability) => !isNonBlank(capability))) {
      errors.push(`${assetId}.capabilities must be non-empty strings`);
    }
    for (const field of PATH_FIELDS) validatePathList(errors, assetId, field, asset?.[field]);
    const hasImplementation = ['runtimeEntries', 'promptEntries', 'designEntries']
      .some((field) => Array.isArray(asset?.[field]) && asset[field].length > 0);
    if (!hasImplementation) errors.push(`${assetId} has no runtime, prompt, or design entry`);
    if (!Array.isArray(asset?.contractEntries) || asset.contractEntries.length === 0) {
      errors.push(`${assetId}.contractEntries must not be empty`);
    }
    if (!COVERAGE.has(asset?.coverageStatus)) errors.push(`${assetId}.coverageStatus is invalid`);
    if (asset?.coverageStatus === 'VERIFIED') {
      if (!Array.isArray(asset?.testEntries) || asset.testEntries.length === 0) {
        errors.push(`${assetId} cannot be VERIFIED without tests`);
      }
      if (asset?.gapReason !== null) errors.push(`${assetId}.gapReason must be null when VERIFIED`);
      if (asset?.sourceDisposition !== 'CURRENT_CANONICAL') {
        errors.push(`${assetId} VERIFIED assets must be CURRENT_CANONICAL`);
      }
    }
    if (asset?.coverageStatus === 'PARTIAL') {
      if (!isNonBlank(asset?.gapReason)) errors.push(`${assetId}.gapReason is required when PARTIAL`);
      if (asset?.sourceDisposition !== 'CURRENT_WITH_GAPS') {
        errors.push(`${assetId} PARTIAL assets must be CURRENT_WITH_GAPS`);
      }
    }
    if (!isNonBlank(asset?.verificationCommand)) errors.push(`${assetId}.verificationCommand is required`);
    if (asset?.coverageStatus === 'VERIFIED') {
      const expectedCommand = `python3 -m pytest -q ${asset.testEntries.join(' ')}`;
      if (asset.verificationCommand !== expectedCommand) {
        errors.push(`${assetId}.verificationCommand must execute its exact registered tests`);
      }
    }
    if (!DISPOSITIONS.has(asset?.sourceDisposition)) errors.push(`${assetId}.sourceDisposition is invalid`);
  }
  return errors;
}

export function validateProfessionalAgentSchema(schema) {
  const errors = [];
  const actualDigest = createHash('sha256').update(JSON.stringify(schema)).digest('hex');
  if (actualDigest !== SCHEMA_CANONICAL_SHA256) errors.push('schema document hash differs from the reviewed Draft 2020-12 contract');
  if (schema?.additionalProperties !== false) errors.push('schema top-level additionalProperties must be false');
  if (schema?.properties?.schemaVersion?.const !== MATRIX_SCHEMA_VERSION) errors.push('schema schemaVersion differs from validator');
  if (schema?.properties?.matrixId?.const !== MATRIX_ID) errors.push('schema matrixId differs from validator');
  if (schema?.properties?.canonicalOwner?.const !== CANONICAL_OWNER) errors.push('schema canonicalOwner differs from validator');
  if (schema?.properties?.integrationTarget?.const !== 'backend/src') errors.push('schema integrationTarget differs from validator');
  const schemaTopLevel = new Set(Object.keys(schema?.properties ?? {}));
  if (schemaTopLevel.size !== TOP_LEVEL_KEYS.size || [...TOP_LEVEL_KEYS].some((key) => !schemaTopLevel.has(key))) {
    errors.push('schema top-level fields differ from validator');
  }
  const schemaAssetKeys = new Set(schema?.$defs?.asset?.required ?? []);
  if (schemaAssetKeys.size !== ASSET_KEYS.size || [...ASSET_KEYS].some((key) => !schemaAssetKeys.has(key))) {
    errors.push('schema asset fields differ from validator');
  }
  const schemaAssetProperties = new Set(Object.keys(schema?.$defs?.asset?.properties ?? {}));
  if (schema?.$defs?.asset?.additionalProperties !== false
    || schemaAssetProperties.size !== ASSET_KEYS.size
    || [...ASSET_KEYS].some((key) => !schemaAssetProperties.has(key))) {
    errors.push('schema asset properties differ from validator');
  }
  const schemaProvenanceProperties = new Set(Object.keys(schema?.properties?.provenance?.properties ?? {}));
  if (schema?.properties?.provenance?.additionalProperties !== false
    || schemaProvenanceProperties.size !== PROVENANCE_KEYS.size
    || [...PROVENANCE_KEYS].some((key) => !schemaProvenanceProperties.has(key))) {
    errors.push('schema provenance fields differ from validator');
  }
  if (schema?.properties?.provenance?.properties?.donorBranch?.const !== DONOR_BRANCH) {
    errors.push('schema donorBranch differs from validator');
  }
  if (schema?.properties?.provenance?.properties?.donorTip?.const !== DONOR_TIP) {
    errors.push('schema donorTip differs from validator');
  }
  if (schema?.properties?.provenance?.properties?.candidateCommits?.uniqueItems !== true) {
    errors.push('schema candidateCommits must be unique');
  }
  if (JSON.stringify(schema?.properties?.provenance?.properties?.candidateCommits?.const)
    !== JSON.stringify(DONOR_CANDIDATE_COMMITS)) {
    errors.push('schema candidateCommits differ from validator');
  }
  if (schema?.$defs?.safePath?.pattern !== SAFE_PATH_SCHEMA_PATTERN) {
    errors.push('schema safePath pattern differs from validator');
  }
  return errors;
}

export function validateProfessionalAgentProvenance(matrix, convergence) {
  const errors = [];
  const family = convergence?.assetFamilies?.find((item) => item.id === 'PROFESSIONAL_AGENT_K0');
  const donor = convergence?.branches?.find((item) => item.branch === DONOR_BRANCH);
  if (family?.canonicalDonor !== DONOR_BRANCH || family?.decision !== 'ABSORB_ADAPT') {
    errors.push('EXT convergence family does not bind the expected K0 donor');
  }
  if (donor?.assetFamily !== 'PROFESSIONAL_AGENT_K0' || donor?.canonicalDonor !== true
    || donor?.tip !== DONOR_TIP || donor?.disposition !== 'ABSORB_ADAPT') {
    errors.push('EXT convergence branch does not match the frozen K0 donor');
  }
  const shortCandidates = DONOR_CANDIDATE_COMMITS.map((commit) => commit.slice(0, 8));
  if (JSON.stringify(donor?.candidateCommits) !== JSON.stringify(shortCandidates)) {
    errors.push('EXT convergence candidate commits do not match the K0 matrix provenance');
  }
  if (matrix?.provenance?.donorTip !== donor?.tip) errors.push('matrix donor tip differs from EXT convergence');
  return errors;
}

async function countNamedFiles(rootPath, fileName) {
  let count = 0;
  for (const entry of await readdir(rootPath, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) throw new Error(`symbolic link is not allowed in inventory: ${entry.name}`);
    const path = resolve(rootPath, entry.name);
    if (entry.isDirectory()) count += await countNamedFiles(path, fileName);
    else if (entry.isFile() && entry.name === fileName) count += 1;
  }
  return count;
}

function insideRoot(rootPath, relativePath) {
  const absolute = resolve(rootPath, relativePath);
  return absolute === rootPath || absolute.startsWith(`${rootPath}${sep}`);
}

export async function verifyProfessionalAgentMatrix(matrix, repositoryRoot) {
  const errors = validateProfessionalAgentMatrix(matrix);
  const rootPath = resolve(repositoryRoot);
  if (errors.length > 0) return errors;

  const paths = new Map();
  for (const asset of matrix.assets) {
    for (const field of PATH_FIELDS) {
      for (const path of asset[field]) {
        if (!paths.has(path)) paths.set(path, new Set());
        paths.get(path).add(field);
      }
    }
  }
  for (const [path, fields] of paths) {
    if (!insideRoot(rootPath, path)) {
      errors.push(`path escapes repository root: ${path}`);
      continue;
    }
    try {
      const stat = await lstat(resolve(rootPath, path));
      if (stat.isSymbolicLink()) errors.push(`path must not be a symbolic link: ${path}`);
      if (fields.has('testEntries')) {
        if (!stat.isFile()) errors.push(`registered test must be a file: ${path}`);
        if (!/(?:^|\/)test_[A-Za-z0-9_]+\.py$/u.test(path)) {
          errors.push(`registered Python test path is invalid: ${path}`);
        }
      }
    } catch {
      errors.push(`missing asset path: ${path}`);
    }
  }

  for (const assertion of matrix.inventoryAssertions) {
    try {
      const actual = await countNamedFiles(resolve(rootPath, assertion.root), assertion.fileName);
      if (actual !== assertion.expectedCount) {
        errors.push(`${assertion.id} count mismatch: expected ${assertion.expectedCount}, got ${actual}`);
      }
    } catch (error) {
      errors.push(`${assertion.id} inventory failed: ${error.message}`);
    }
  }
  return errors;
}
