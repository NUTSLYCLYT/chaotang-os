import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

import {
  EXPECTED_PROFESSIONAL_AGENT_REGISTRATION,
  validateProfessionalAgentMatrix,
  validateProfessionalAgentProvenance,
  validateProfessionalAgentRegistration,
  validateProfessionalAgentSchema,
  verifyProfessionalAgentMatrix,
} from './lib/professional-agent-matrix.mjs';

const root = new URL('../', import.meta.url);
const manifestUrl = new URL('.harness/manifest/professional-agent-asset-matrix.v1.json', root);
const execFileAsync = promisify(execFile);

async function currentMatrix() {
  return JSON.parse(await readFile(manifestUrl, 'utf8'));
}

test('current EXT matrix is structurally valid and all registered paths exist', async () => {
  const matrix = await currentMatrix();
  assert.deepEqual(validateProfessionalAgentMatrix(matrix), []);
  assert.deepEqual(await verifyProfessionalAgentMatrix(matrix, root.pathname), []);
  assert.equal(matrix.assets.length, 8);
  assert.equal(matrix.assets.filter((asset) => asset.coverageStatus === 'VERIFIED').length, 6);
  assert.equal(matrix.assets.filter((asset) => asset.coverageStatus === 'PARTIAL').length, 2);
});

test('root project manifest registers the exact K0 control-plane asset', async () => {
  const projectManifest = JSON.parse(await readFile(
    new URL('.harness/manifest/project-harness.json', root),
    'utf8',
  ));
  assert.deepEqual(
    projectManifest.professionalAgentAssets,
    EXPECTED_PROFESSIONAL_AGENT_REGISTRATION,
  );
  assert.deepEqual(
    validateProfessionalAgentRegistration(projectManifest.professionalAgentAssets),
    [],
  );
  delete projectManifest.professionalAgentAssets;
  assert.match(
    validateProfessionalAgentRegistration(projectManifest.professionalAgentAssets).join('\n'),
    /differs from the reviewed K0 registration/u,
  );
});

test('executable validator is pinned to the published schema fields', async () => {
  const schema = JSON.parse(await readFile(
    new URL('.harness/contracts/professional-agent-asset-matrix.v1.schema.json', root),
    'utf8',
  ));
  assert.deepEqual(validateProfessionalAgentSchema(schema), []);
  schema.$defs.asset.required.pop();
  assert.match(validateProfessionalAgentSchema(schema).join('\n'), /asset fields differ/u);
});

test('schema mirror rejects weakened integration, provenance, and path constraints', async () => {
  const schema = JSON.parse(await readFile(
    new URL('.harness/contracts/professional-agent-asset-matrix.v1.schema.json', root),
    'utf8',
  ));
  schema.properties.integrationTarget.const = 'backend/app';
  schema.properties.provenance.additionalProperties = true;
  schema.$defs.safePath.pattern = '.*';
  const errors = validateProfessionalAgentSchema(schema).join('\n');
  assert.match(errors, /integrationTarget differs/u);
  assert.match(errors, /provenance fields differ/u);
  assert.match(errors, /safePath pattern differs/u);
});

test('any published schema mutation breaks the reviewed schema digest', async () => {
  const schema = JSON.parse(await readFile(
    new URL('.harness/contracts/professional-agent-asset-matrix.v1.schema.json', root),
    'utf8',
  ));
  schema.required = [];
  schema.properties.provenance.required = [];
  schema.$defs.asset.properties.coverageStatus.enum.push('FORGED');
  schema.$defs.asset.properties.maturity.enum.push('FORGED');
  schema.$defs.pathList.uniqueItems = false;
  assert.match(validateProfessionalAgentSchema(schema).join('\n'), /schema document hash differs/u);
});

test('Draft 2020-12 checker rejects a schema-invalid matrix', async () => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), 'professional-agent-matrix-'));
  try {
    const matrix = await currentMatrix();
    matrix.assets[0].owner = 'forged-owner';
    const matrixPath = join(temporaryRoot, 'matrix.json');
    await writeFile(matrixPath, JSON.stringify(matrix), 'utf8');
    await assert.rejects(
      execFileAsync('python3', [
        new URL('scripts/professional_agent_matrix_schema_check.py', root).pathname,
        new URL('.harness/contracts/professional-agent-asset-matrix.v1.schema.json', root).pathname,
        matrixPath,
      ]),
      (error) => error.code === 1 && /SCHEMA_VALIDATION_FAILED/u.test(error.stdout),
    );
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

test('provenance is bound to the frozen canonical K0 donor', async () => {
  const [matrix, convergence] = await Promise.all([
    currentMatrix(),
    readFile(new URL('.harness/manifest/ext-branch-convergence.v1.json', root), 'utf8').then(JSON.parse),
  ]);
  assert.deepEqual(validateProfessionalAgentProvenance(matrix, convergence), []);
  const forgedMatrix = structuredClone(matrix);
  forgedMatrix.provenance.donorTip = '0'.repeat(40);
  assert.match(validateProfessionalAgentMatrix(forgedMatrix).join('\n'), /donorTip is invalid/u);
  const forgedLedger = structuredClone(convergence);
  forgedLedger.branches.find((item) => item.branch === matrix.provenance.donorBranch).tip = '0'.repeat(40);
  assert.match(validateProfessionalAgentProvenance(matrix, forgedLedger).join('\n'), /frozen K0 donor/u);
});

test('inventory assertions freeze 35 designs and 71 runtime prompts', async () => {
  const matrix = await currentMatrix();
  assert.deepEqual(
    Object.fromEntries(matrix.inventoryAssertions.map((item) => [item.id, item.expectedCount])),
    { 'agent-design-contracts': 35, 'runtime-prompt-contracts': 71 },
  );
});

test('VERIFIED cannot be claimed without tests', async () => {
  const matrix = structuredClone(await currentMatrix());
  matrix.assets[0].testEntries = [];
  assert.match(validateProfessionalAgentMatrix(matrix).join('\n'), /cannot be VERIFIED without tests/u);
});

test('PARTIAL assets must expose their gap', async () => {
  const matrix = structuredClone(await currentMatrix());
  const asset = matrix.assets.find((item) => item.coverageStatus === 'PARTIAL');
  asset.gapReason = null;
  assert.match(validateProfessionalAgentMatrix(matrix).join('\n'), /gapReason is required/u);
});

test('rejects duplicate identities and escaping paths', async () => {
  const matrix = structuredClone(await currentMatrix());
  matrix.assets.push(structuredClone(matrix.assets[0]));
  matrix.assets[0].runtimeEntries = ['../outside.py'];
  const errors = validateProfessionalAgentMatrix(matrix).join('\n');
  assert.match(errors, /duplicate assetId/u);
  assert.match(errors, /unsafe path/u);
});

test('rejects blank IDs, duplicate donor commits, extra fields, and schema-unsafe characters', async () => {
  const matrix = structuredClone(await currentMatrix());
  matrix.unapproved = true;
  matrix.provenance.candidateCommits.push(matrix.provenance.candidateCommits[0]);
  matrix.assets[0].assetId = ' ';
  matrix.assets[0].runtimeEntries = ['backend/src/file name.py'];
  const errors = validateProfessionalAgentMatrix(matrix).join('\n');
  assert.match(errors, /unsupported field unapproved/u);
  assert.match(errors, /candidateCommits is invalid/u);
  assert.match(errors, /assetId is required/u);
  assert.match(errors, /unsafe path/u);
});

test('VERIFIED command must execute the exact registered test files', async () => {
  const matrix = structuredClone(await currentMatrix());
  matrix.assets[0].testEntries = ['backend/tests'];
  matrix.assets[0].verificationCommand = 'python3 -m pytest -q backend/tests';
  const pathErrors = (await verifyProfessionalAgentMatrix(matrix, root.pathname)).join('\n');
  assert.match(pathErrors, /registered test must be a file/u);
  assert.match(pathErrors, /registered Python test path is invalid/u);

  const placeholder = structuredClone(await currentMatrix());
  placeholder.assets[0].verificationCommand = 'true';
  assert.match(
    validateProfessionalAgentMatrix(placeholder).join('\n'),
    /exact registered tests/u,
  );
});
