import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const digestA = `sha256:${'a'.repeat(64)}`;
const digestB = `sha256:${'b'.repeat(64)}`;
const digestC = `sha256:${'c'.repeat(64)}`;
const requiredProductionChecks = ['root-doctor', 'frontend-doctor', 'backend-doctor', 'production-build', 'browser', 'true-chain', 'jiqun', 'security'];
const processIdentity = { host_id: 'host-a', boot_id: 'boot-a', pid_namespace: 'ns-a', pid: 123, pgid: 123, start_ticks: 456, cwd: '/repo', nonce: '0123456789abcdef' };

async function json(rel) { return JSON.parse(await readFile(new URL(rel, root), 'utf8')); }
function omit(object, key) { const copy = structuredClone(object); delete copy[key]; return copy; }
function semanticErrors(kind, value) {
  const errors = [];
  if (kind === 'task') {
    if (Date.parse(value.expires_at) <= Date.parse(value.created_at)) errors.push('task expiry');
    if (value.dependencies.includes(value.task_id)) errors.push('self dependency');
  }
  if (kind === 'lease' && (Date.parse(value.heartbeat_at) < Date.parse(value.acquired_at) || Date.parse(value.expires_at) <= Date.parse(value.heartbeat_at))) errors.push('lease time order');
  if (kind === 'release') {
    if (Date.parse(value.completed_at) < Date.parse(value.started_at)) errors.push('release time order');
    if (value.listener.pid !== value.runtime_process.pid) errors.push('listener identity mismatch');
    if (value.build_digest !== value.runtime_artifact_digest) errors.push('artifact identity mismatch');
    if (new Set(value.checks.map((check) => check.id)).size !== value.checks.length) errors.push('duplicate check id');
    const checkIds = new Set(value.checks.map((check) => check.id));
    for (const id of requiredProductionChecks) if (!checkIds.has(id)) errors.push(`missing ${id}`);
  }
  return errors;
}

function validateWithDraft202012(schema, instances) {
  const program = `
import json, sys
from datetime import datetime
from urllib.parse import urlparse
from jsonschema import Draft202012Validator, FormatChecker
p=json.load(sys.stdin); s=p['schema']; Draft202012Validator.check_schema(s)
checker=FormatChecker()
@checker.checks('date-time')
def valid_datetime(value):
  try: datetime.fromisoformat(value.replace('Z', '+00:00')); return 'T' in value
  except (ValueError, AttributeError): return False
@checker.checks('uri')
def valid_uri(value):
  try: return bool(urlparse(value).scheme)
  except (ValueError, AttributeError): return False
v=Draft202012Validator(s, format_checker=checker)
print(json.dumps([not bool(list(v.iter_errors(x))) for x in p['instances']]))
`;
  const result = spawnSync('python3', ['-c', program], { input: JSON.stringify({ schema, instances }), encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

const taskSample = {
  schema_version: 1, task_id: 'task-20260713-001', title: 'S0 contracts', status: 'ready', owner: 'agent/root',
  read_paths: ['docs/README.md'], write_paths: ['.harness/contracts'], resources: ['integration:feature-chaotang-ext'],
  dependencies: [], worktree: '/repo', risk: 'medium', created_at: '2026-07-13T00:00:00Z', expires_at: '2026-07-14T00:00:00Z',
};
const leaseSample = {
  schema_version: 1, lease_id: 'lease-001', task_id: taskSample.task_id, holder: 'agent/root', resource_type: 'path',
  resource: 'frontend/e2e', mode: 'write', state: 'active', fencing_epoch: 1,
  acquired_at: '2026-07-13T00:00:00Z', heartbeat_at: '2026-07-13T00:01:00Z', expires_at: '2026-07-13T00:10:00Z', process: processIdentity,
};
const releaseSample = {
  schema_version: 1, profile: 'production', release_id: 'release-001', repository_id: 'chaotang-os:device:inode', worktree: '/repo',
  commit_sha: '0123456789abcdef0123456789abcdef01234567', rollback_commit_sha: 'fedcba9876543210fedcba9876543210fedcba98',
  status: 'verified', commander_lease_id: 'lease-001', build_id: 'build-001', build_digest: digestA, runtime_artifact_digest: digestA,
  runtime_process: processIdentity, listener: { host: '127.0.0.1', port: 3050, socket_inode: '999', pid: 123 }, base_url: 'http://127.0.0.1:3050',
  gate_report: { path: 'artifacts/gate.json', digest: digestB }, ledger_checkpoint: { sequence: 1, previous_hash: digestC, record_hash: digestB },
  external_trust_anchor: { provider: 'ci-attestation', checkpoint: 'artifact://release-001', verified: true }, evidence_digest: digestB,
  started_at: '2026-07-13T00:00:00Z', completed_at: '2026-07-13T00:05:00Z', checks: requiredProductionChecks.map((id) => ({ id, status: 'passed', evidence: `artifact://${id}` })),
};

test('task schema is Draft 2020-12 and independently rejects each unsafe shape', async () => {
  const schema = await json('.harness/contracts/task.schema.json');
  const invalid = [omit(taskSample, 'write_paths'), { ...taskSample, schema_version: 2 }, { ...taskSample, unexpected: true },
    { ...taskSample, write_paths: ['/absolute'] }, { ...taskSample, write_paths: ['frontend/../backend'] },
    { ...taskSample, write_paths: ['frontend/**'] }, { ...taskSample, dependencies: ['task-x', 'task-x'] }, { ...taskSample, resources: ['port:3099'] }, { ...taskSample, resources: ['port:3200'] },
    { ...taskSample, created_at: '2026-99-99T99:99:99Z' }];
  assert.deepEqual(validateWithDraft202012(schema, [taskSample, ...invalid]), [true, ...invalid.map(() => false)]);
});

test('lease schema covers path, port, build, release and integration resources', async () => {
  const schema = await json('.harness/contracts/lease.schema.json');
  const variants = [leaseSample, ...['port:3050', 'port:3100', 'port:3199', 'build:frontend-production', 'release:production', 'integration:feature-chaotang-ext'].map((resource) => ({
    ...omit(leaseSample, 'mode'), resource_type: resource.split(':')[0], resource,
  }))];
  const invalid = [omit(leaseSample, 'resource'), omit(leaseSample, 'heartbeat_at'), { ...leaseSample, mode: 'execute' },
    { ...leaseSample, resource: '../frontend' }, { ...leaseSample, process: { ...processIdentity, unexpected: true } },
    { ...omit(leaseSample, 'mode'), resource_type: 'port', resource: 'port:3099' }, { ...omit(leaseSample, 'mode'), resource_type: 'port', resource: 'port:3200' },
    { ...omit(leaseSample, 'mode'), resource_type: 'build', resource: 'release:production' }, { ...omit(leaseSample, 'mode'), resource_type: 'release', resource: 'integration:x' },
    { ...omit(leaseSample, 'mode'), resource_type: 'integration', resource: 'build:x' }, { ...leaseSample, acquired_at: 'not-a-date' }];
  assert.deepEqual(validateWithDraft202012(schema, [...variants, ...invalid]), [...variants.map(() => true), ...invalid.map(() => false)]);
});

test('release evidence binds runtime, listener, gate, rollback and external trust anchor', async () => {
  const schema = await json('.harness/contracts/release-evidence.schema.json');
  const invalid = [omit(releaseSample, 'runtime_process'), omit(releaseSample, 'listener'), omit(releaseSample, 'external_trust_anchor'),
    omit(releaseSample, 'rollback_commit_sha'), { ...releaseSample, external_trust_anchor: { ...releaseSample.external_trust_anchor, verified: false } },
    { ...releaseSample, checks: [{ id: 'production-gate', status: 'failed', evidence: 'artifact://gate' }] },
    { ...releaseSample, completed_at: 'invalid' }, { ...releaseSample, base_url: 'javascript:alert(1)' }];
  assert.deepEqual(validateWithDraft202012(schema, [releaseSample, ...invalid]), [true, ...invalid.map(() => false)]);
});

test('runtime semantic checks reject reversed timestamps and identity mismatch', () => {
  assert.deepEqual(semanticErrors('task', taskSample), []);
  assert.notDeepEqual(semanticErrors('task', { ...taskSample, expires_at: taskSample.created_at }), []);
  assert.notDeepEqual(semanticErrors('task', { ...taskSample, dependencies: [taskSample.task_id] }), []);
  assert.deepEqual(semanticErrors('lease', leaseSample), []);
  assert.notDeepEqual(semanticErrors('lease', { ...leaseSample, expires_at: leaseSample.heartbeat_at }), []);
  assert.deepEqual(semanticErrors('release', releaseSample), []);
  assert.notDeepEqual(semanticErrors('release', { ...releaseSample, completed_at: '2026-07-12T00:00:00Z' }), []);
  assert.notDeepEqual(semanticErrors('release', { ...releaseSample, listener: { ...releaseSample.listener, pid: 999 } }), []);
  assert.notDeepEqual(semanticErrors('release', { ...releaseSample, runtime_artifact_digest: digestC }), []);
  assert.notDeepEqual(semanticErrors('release', { ...releaseSample, checks: [...releaseSample.checks, { ...releaseSample.checks[0] }] }), []);
  assert.notDeepEqual(semanticErrors('release', { ...releaseSample, checks: releaseSample.checks.slice(1) }), []);
});

test('root manifest reports component status without overstating the whole control plane', async () => {
  const manifest = await json('.harness/manifest/project-harness.json');
  assert.equal(manifest.controlPlane.status, 'IMPLEMENTING');
  assert.equal(manifest.controlPlane.components.contracts, 'IMPLEMENTED');
  assert.equal(manifest.controlPlane.components.leaseManager, 'IMPLEMENTED');
  assert.equal(manifest.controlPlane.components.leaseAttestation, 'IMPLEMENTED_LOCAL');
  assert.equal(manifest.controlPlane.components.integrationGate, 'IMPLEMENTED_LOCAL');
  assert.equal(manifest.controlPlane.components.mandatoryRollout, 'IMPLEMENTED_LOCAL_OBSERVE_PENDING');
  assert.notEqual(manifest.controlPlane.status, 'ENFORCED');
  assert.ok(manifest.controlPlane.verification.includes('node --test scripts/multi-agent-contracts.nodetest.mjs'));
});
