import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);

async function json(rel) {
  return JSON.parse(await readFile(new URL(rel, root), 'utf8'));
}

function validate(schema, value, path = '$') {
  const errors = [];
  if (schema.type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return [`${path} must be object`];
    for (const key of schema.required ?? []) if (!(key in value)) errors.push(`${path}.${key} is required`);
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) if (!(key in (schema.properties ?? {}))) errors.push(`${path}.${key} is unknown`);
    }
    for (const [key, child] of Object.entries(schema.properties ?? {})) {
      if (key in value) errors.push(...validate(child, value[key], `${path}.${key}`));
    }
  } else if (schema.type === 'array') {
    if (!Array.isArray(value)) return [`${path} must be array`];
    if (schema.minItems != null && value.length < schema.minItems) errors.push(`${path} has too few items`);
    value.forEach((item, index) => errors.push(...validate(schema.items, item, `${path}[${index}]`)));
  } else if (schema.type === 'string') {
    if (typeof value !== 'string') return [`${path} must be string`];
    if (schema.minLength != null && value.length < schema.minLength) errors.push(`${path} is too short`);
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) errors.push(`${path} has invalid format`);
  } else if (schema.type === 'integer') {
    if (!Number.isInteger(value)) errors.push(`${path} must be integer`);
    if (schema.minimum != null && value < schema.minimum) errors.push(`${path} is below minimum`);
  } else if (schema.type === 'boolean' && typeof value !== 'boolean') errors.push(`${path} must be boolean`);
  if (schema.const !== undefined && value !== schema.const) errors.push(`${path} must equal ${schema.const}`);
  if (schema.enum && !schema.enum.includes(value)) errors.push(`${path} is not in enum`);
  return errors;
}

const samples = {
  task: {
    schema_version: 1, task_id: 'task-20260713-001', title: 'S0 contracts', status: 'ready',
    owner: 'agent/root', scope: ['.harness/contracts'], dependencies: [], created_at: '2026-07-13T12:00:00Z',
  },
  lease: {
    schema_version: 1, lease_id: 'lease-001', task_id: 'task-20260713-001', holder: 'agent/root',
    state: 'active', fencing_epoch: 1, acquired_at: '2026-07-13T12:00:00Z', expires_at: '2026-07-13T12:10:00Z',
    process: { host_id: 'host-a', boot_id: 'boot-a', pid_namespace: 'ns-a', pid: 123, start_ticks: 456, cwd: '/repo', nonce: 'n-123' },
  },
  release: {
    schema_version: 1, release_id: 'release-001', commit_sha: '0123456789abcdef0123456789abcdef01234567',
    status: 'verified', commander_lease_id: 'lease-001', build_digest: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    evidence_digest: 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    started_at: '2026-07-13T12:00:00Z', completed_at: '2026-07-13T12:05:00Z', checks: [{ id: 'root-doctor', status: 'passed', evidence: 'artifact://root-doctor' }],
  },
};

for (const name of ['task', 'lease', 'release-evidence']) {
  test(`${name} contract accepts positive and rejects negative examples`, async () => {
    const schema = await json(`.harness/contracts/${name}.schema.json`);
    assert.equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema');
    const sample = samples[name === 'release-evidence' ? 'release' : name];
    assert.deepEqual(validate(schema, sample), []);
    assert.notDeepEqual(validate(schema, { ...sample, schema_version: 999, unexpected: true }), []);
  });
}

test('root manifest registers control-plane contracts and verification command', async () => {
  const manifest = await json('.harness/manifest/project-harness.json');
  assert.equal(manifest.controlPlane.status, 'IMPLEMENTED');
  assert.deepEqual(manifest.controlPlane.contracts, [
    '.harness/contracts/task.schema.json',
    '.harness/contracts/lease.schema.json',
    '.harness/contracts/release-evidence.schema.json',
  ]);
  assert.ok(manifest.controlPlane.verification.includes('node --test scripts/multi-agent-contracts.nodetest.mjs'));
});
