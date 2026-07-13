import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import { chmodSync, cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtempSync } from 'node:fs';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';

import {
  appendReleaseEvidence,
  assertReleaseAlignment,
  canonical,
  checkpointLedger,
  readGitProvenance,
  verifyEvidenceLedger,
  ZERO_HASH,
} from './lib/release-evidence-ledger.mjs';
import { inspectProductionRuntime } from '../frontend/scripts/prod-runtime-identity.mjs';
import { persistProductionGateReport, recordVerifiedRelease, REQUIRED_RELEASE_CHECKS, verifyReleaseEvidenceEnvelope } from './lib/release-evidence-gate.mjs';
import { createTask } from './harness-task.mjs';
import { processIdentity } from './lib/control-plane-db.mjs';
import { acquireResource, releaseResource } from './lib/resource-lock.mjs';

process.env.NODE_ENV = 'test';
process.env.CHAOTANG_CONTROL_PLANE_TEST_ADAPTER = '1';

function git(cwd, args) { return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim(); }
function repository() {
  const root = mkdtempSync(join(tmpdir(), 'chaotang-s8-'));
  git(root, ['init', '-q']);
  git(root, ['config', 'user.email', 's8@example.test']);
  git(root, ['config', 'user.name', 'S8 Test']);
  writeFileSync(join(root, 'tracked.txt'), 'v1\n');
  git(root, ['add', '.']); git(root, ['commit', '-qm', 'base']);
  return root;
}
function keys(root) {
  mkdirSync(root, { recursive: true, mode: 0o700 }); chmodSync(root, 0o700);
  const pair = generateKeyPairSync('ed25519');
  const privatePath = join(root, 'anchor-private.pem');
  writeFileSync(privatePath, pair.privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
  chmodSync(privatePath, 0o600);
  return {
    privatePath,
    trust: {
      schema_version: 1,
      key_id: 'test-release-anchor-1',
      provider: 'test-protected-ed25519',
      public_key_pem: pair.publicKey.export({ type: 'spki', format: 'pem' }),
      authority_mode: 'local-private-key',
      independent: false,
    },
  };
}
function evidence(commit, overrides = {}) {
  return {
    schema_version: 1, profile: 'production', release_id: `release-${crypto.randomUUID()}`,
    repository_id: 'test-repository', worktree: '/test/repository', commit_sha: commit, rollback_commit_sha: commit,
    status: 'rejected', commander_lease_id: 'lease-test', build_id: 'build-a', build_digest: `sha256:${'a'.repeat(64)}`,
    runtime_artifact_digest: `sha256:${'a'.repeat(64)}`,
    runtime_process: { host_id: 'host', boot_id: 'boot', pid_namespace: 'ns', pid: 123, pgid: 123, start_ticks: 1, cwd: '/build', nonce: '0123456789abcdef' },
    listener: { host: '127.0.0.1', port: 3050, socket_inode: '1', pid: 123 }, base_url: 'http://127.0.0.1:3050/chaotang',
    gate_report: { path: '/secure/gate.json', digest: `sha256:${'b'.repeat(64)}` },
    started_at: '2026-07-13T00:00:00.000Z', completed_at: '2026-07-13T00:01:00.000Z', checks: [{ id: 'external-trust-anchor', status: 'failed', evidence: 'local only' }],
    ...overrides,
  };
}

test('reads commit and tree from the Git object database and reports tracked dirt only', () => {
  const root = repository();
  const clean = readGitProvenance(root);
  assert.equal(clean.commit, git(root, ['rev-parse', 'HEAD']));
  assert.equal(clean.tree, git(root, ['rev-parse', 'HEAD^{tree}']));
  assert.equal(clean.dirtyTracked, false);
  writeFileSync(join(root, 'untracked.txt'), 'not tracked\n');
  assert.equal(readGitProvenance(root).dirtyTracked, false);
  writeFileSync(join(root, 'tracked.txt'), 'changed\n');
  assert.equal(readGitProvenance(root).dirtyTracked, true);
});

test('appends evidence transactionally and verifies a signed hash-chain checkpoint', () => {
  const root = repository(), dbPath = join(root, 'ledger.sqlite3'), anchorPath = join(root, 'anchor.json');
  const key = keys(root), commit = git(root, ['rev-parse', 'HEAD']);
  const first = appendReleaseEvidence({ dbPath, evidence: evidence(commit) });
  const second = appendReleaseEvidence({ dbPath, evidence: evidence(commit) });
  assert.equal(first.sequence, 1); assert.equal(second.previous_hash, first.record_hash);
  checkpointLedger({ dbPath, anchorPath, privateKeyPath: key.privatePath, trust: key.trust });
  const verified = verifyEvidenceLedger({ dbPath, anchorPath, trust: key.trust });
  assert.equal(verified.valid, true); assert.equal(verified.latest.sequence, 2);
  assert.equal(verified.readyEligible, false);
});

test('rejects tail deletion and an old database rollback against the newer anchor', () => {
  const root = repository(), dbPath = join(root, 'ledger.sqlite3'), oldPath = join(root, 'old.sqlite3'), anchorPath = join(root, 'anchor.json');
  const key = keys(root), commit = git(root, ['rev-parse', 'HEAD']);
  appendReleaseEvidence({ dbPath, evidence: evidence(commit) });
  checkpointLedger({ dbPath, anchorPath, privateKeyPath: key.privatePath, trust: key.trust });
  cpSync(dbPath, oldPath);
  appendReleaseEvidence({ dbPath, evidence: evidence(commit) });
  checkpointLedger({ dbPath, anchorPath, privateKeyPath: key.privatePath, trust: key.trust });
  assert.throws(() => verifyEvidenceLedger({ dbPath: oldPath, anchorPath, trust: key.trust }), /checkpoint|rollback|sequence/i);
  const db = new DatabaseSync(dbPath); db.exec('DROP TRIGGER release_evidence_no_delete; DELETE FROM release_evidence WHERE sequence=2'); db.close();
  assert.throws(() => verifyEvidenceLedger({ dbPath, anchorPath, trust: key.trust }), /checkpoint|rollback|sequence/i);
});

test('rejects field rewriting, whole-chain rewriting, and an invalid checkpoint signature', () => {
  const root = repository(), dbPath = join(root, 'ledger.sqlite3'), anchorPath = join(root, 'anchor.json');
  const key = keys(root), other = keys(join(root, 'other')), commit = git(root, ['rev-parse', 'HEAD']);
  appendReleaseEvidence({ dbPath, evidence: evidence(commit) });
  checkpointLedger({ dbPath, anchorPath, privateKeyPath: key.privatePath, trust: key.trust });
  assert.throws(() => verifyEvidenceLedger({ dbPath, anchorPath, trust: other.trust }), /key|signature|fingerprint/i);
  const db = new DatabaseSync(dbPath); db.exec('DROP TRIGGER release_evidence_no_update');
  const forged = evidence(commit, { release_id: db.prepare('SELECT release_id FROM release_evidence WHERE sequence=1').get().release_id, build_id: 'forged' });
  const forgedJson = canonical(forged), forgedHash = `sha256:${createHash('sha256').update(canonical({ sequence: 1, previous_hash: ZERO_HASH, record: forged })).digest('hex')}`;
  db.prepare("UPDATE release_evidence SET record_json=?,record_hash=? WHERE sequence=1").run(forgedJson, forgedHash);
  db.close();
  assert.throws(() => verifyEvidenceLedger({ dbPath, anchorPath, trust: key.trust }), /checkpoint|rollback|sequence/i);
});

test('local non-independent signing can detect damage but is never READY eligible', () => {
  const root = repository(), dbPath = join(root, 'ledger.sqlite3'), anchorPath = join(root, 'anchor.json');
  const key = keys(root); key.trust.independent = false;
  appendReleaseEvidence({ dbPath, evidence: evidence(git(root, ['rev-parse', 'HEAD'])) });
  checkpointLedger({ dbPath, anchorPath, privateKeyPath: key.privatePath, trust: key.trust });
  const result = verifyEvidenceLedger({ dbPath, anchorPath, trust: key.trust });
  assert.equal(result.valid, true); assert.equal(result.readyEligible, false);
  assert.equal(result.status, 'IMPLEMENTED_LOCAL');
});

test('external authority claims are hard rejected until a protected online provider is configured', () => {
  const root = repository(), dbPath = join(root, 'ledger.sqlite3'), anchorPath = join(root, 'anchor.json'), key = keys(root), commit = git(root, ['rev-parse', 'HEAD']);
  key.trust.authority_mode = 'external-attestation'; key.trust.independent = true;
  appendReleaseEvidence({ dbPath, evidence: evidence(commit) });
  assert.throws(() => checkpointLedger({ dbPath, anchorPath, privateKeyPath: key.privatePath, trust: key.trust }), /trust configuration|not configured/);
});

test('runtime identity follows socket inode to the real PID and derives provenance from its build directory', async (t) => {
  const root = repository(), releaseRoot = join(root, 'frontend', 'builds', 'r1'), next = join(releaseRoot, 'next');
  mkdirSync(join(next, 'static'), { recursive: true }); mkdirSync(join(releaseRoot, 'public'), { recursive: true });
  writeFileSync(join(next, 'BUILD_ID'), 'build-real\n'); writeFileSync(join(next, 'build-manifest.json'), '{}'); writeFileSync(join(next, 'routes-manifest.json'), '{}');
  writeFileSync(join(next, 'static', 'chunk.js'), 'chunk'); writeFileSync(join(releaseRoot, 'public', 'a.txt'), 'public'); writeFileSync(join(releaseRoot, 'next.config.ts'), 'export default {}');
  const commit = git(root, ['rev-parse', 'HEAD']), tree = git(root, ['rev-parse', 'HEAD^{tree}']);
  const { computeReleaseArtifact } = await import('./lib/release-evidence-ledger.mjs');
  const artifact = computeReleaseArtifact(releaseRoot);
  writeFileSync(join(releaseRoot, 'manifest.json'), JSON.stringify({ schema_version: 1, release_id: 'r1', commit, tree, dirty: false, command: ['pnpm', 'build'], env: { NODE_ENV: 'production' }, build_id: 'build-real', artifact }));
  const child = spawn(process.execPath, ['-e', "const s=require('http').createServer((q,r)=>r.end('ok'));s.listen(0,'127.0.0.1',()=>console.log(s.address().port))", '/fixture/node_modules/next/dist/bin/next', 'start'], { cwd: releaseRoot, stdio: ['ignore', 'pipe', 'inherit'] });
  t.after(() => { try { child.kill('SIGKILL'); } catch {} });
  const port = Number(await new Promise(resolve => child.stdout.once('data', chunk => resolve(String(chunk).trim()))));
  const stat = readFileSync(`/proc/${child.pid}/stat`, 'utf8'), tail = stat.slice(stat.lastIndexOf(')') + 2).split(' ');
  const runtimeRecord = join(root, 'runtime.json');
  writeFileSync(runtimeRecord, JSON.stringify({ pid: child.pid, pgid: Number(tail[2]), start_ticks: Number(tail[19]), cwd: releaseRoot, release_root: releaseRoot, runtime_dir: next, commit: '0'.repeat(40), build_id: 'forged-env-id', artifact_digest: 'forged', port }));
  const identity = inspectProductionRuntime({ cwd: root, port, runtimeRecord, buildRoot: join(root, 'frontend', 'builds'), testAdapter: true });
  assert.equal(identity.commit, commit); assert.equal(identity.buildId, 'build-real'); assert.equal(identity.listener.pid, child.pid);
  assert.notEqual(identity.commit, '0'.repeat(40));
  writeFileSync(join(next, 'static', 'chunk.js'), 'mutated while serving');
  assert.throws(() => inspectProductionRuntime({ cwd: root, port, runtimeRecord, buildRoot: join(root, 'frontend', 'builds'), testAdapter: true }), /artifact digest mismatch/);
});

test('runtime identity rejects a non-listener PID and modified runtime artifact', async () => {
  assert.throws(() => inspectProductionRuntime({ cwd: process.cwd(), port: 65534, runtimeRecord: '/does/not/exist', buildRoot: '/tmp', testAdapter: true }), /listener|runtime/i);
});

test('alignment rejects an empty/old SHA, a gate from another commit, and artifact drift', () => {
  const commit = '1'.repeat(40), digest = 'a'.repeat(64);
  const input = {
    gitProvenance: { commit, dirtyTracked: false },
    build: { manifest: { commit }, artifact: { digest }, buildId: 'build-a' },
    runtime: { commit, artifactDigest: `sha256:${digest}`, buildId: 'build-a' },
    evidence: evidence(commit), gateReport: { commit_sha: commit },
  };
  assert.deepEqual(assertReleaseAlignment(input), { commit, buildId: 'build-a', artifactDigest: `sha256:${digest}` });
  assert.throws(() => assertReleaseAlignment({ ...input, gateReport: { commit_sha: '2'.repeat(40) } }), /runtime_identity_mismatch/);
  assert.throws(() => assertReleaseAlignment({ ...input, runtime: { ...input.runtime, artifactDigest: `sha256:${'c'.repeat(64)}` } }), /runtime_identity_mismatch/);
  assert.throws(() => assertReleaseAlignment({ ...input, evidence: { ...input.evidence, commit_sha: '' } }), /runtime_identity_mismatch/);
});

test('high-level gate emits a contract-valid rejected envelope when only the local signer exists', async () => {
  const root = repository(), releaseRoot = join(root, 'frontend', 'builds', 'release-local'), next = join(releaseRoot, 'next');
  mkdirSync(join(next, 'static'), { recursive: true }); mkdirSync(join(releaseRoot, 'public'), { recursive: true });
  for (const [path, value] of [[join(next, 'BUILD_ID'), 'build-local\n'], [join(next, 'build-manifest.json'), '{}'], [join(next, 'routes-manifest.json'), '{}'], [join(next, 'static', 'chunk.js'), 'chunk'], [join(releaseRoot, 'public', 'asset.txt'), 'asset'], [join(releaseRoot, 'next.config.ts'), 'export default {}']]) writeFileSync(path, value);
  const commit = git(root, ['rev-parse', 'HEAD']), tree = git(root, ['rev-parse', 'HEAD^{tree}']);
  const { computeReleaseArtifact } = await import('./lib/release-evidence-ledger.mjs'), artifact = computeReleaseArtifact(releaseRoot);
  writeFileSync(join(releaseRoot, 'manifest.json'), JSON.stringify({ schema_version: 1, release_id: 'release-local', commit, tree, dirty: false, command: ['pnpm', 'build'], env: { NODE_ENV: 'production' }, build_id: 'build-local', artifact }));
  const key = keys(root), databasePath = join(root, 'ledger.sqlite3'); key.trust.independent = false;
  const checks = REQUIRED_RELEASE_CHECKS.map(id => ({ id, status: 'passed', evidence: `sha256:${'d'.repeat(64)}` }));
  const startedAt = new Date(Date.now() - 1000).toISOString();
  createTask({ task_id: 'task-a', title: 'release', owner: 'commander-a', risk: 'critical', write_paths: [], read_paths: ['frontend'], dependencies: [], worktree: root, resources: ['release:production'], expires_at: new Date(Date.now() + 60000).toISOString(), metadata: { approved_base_sha: commit } }, { cwd: root, databasePath });
  const holder = processIdentity(process.cwd()), commanderLock = acquireResource({ dbPath: databasePath, key: 'release:production', holder: { owner: 'commander-a', taskId: 'task-a', pid: holder.pid, pgid: holder.pgid, startTicks: holder.start_ticks, cwd: holder.cwd, nonce: holder.nonce, worktree: root, commit, command: 's8-test' }, ttlMs: 60000 }), credential = { fencingEpoch: commanderLock.fencingEpoch, nonce: commanderLock.nonce };
  const runtime = { releaseId: 'release-local', releaseRoot, commit, buildId: 'build-local', artifactDigest: `sha256:${artifact.digest}`, listener: { port: 3050, socketInode: '123', pid: process.pid }, process: { pid: process.pid, pgid: process.pid, start_ticks: 1, cwd: releaseRoot } }, common = { cwd: root, databasePath, runtime, testAdapter: true };
  const gateReportPath = persistProductionGateReport({ releaseId: 'release-local', commander: 'commander-a', taskId: 'task-a', credential, checks, startedAt }, { ...common, reportPath: join(root, '.runtime', 'gate-report.json') });
  const firstReportBytes = readFileSync(gateReportPath);
  assert.equal(persistProductionGateReport({ releaseId: 'release-local', commander: 'commander-a', taskId: 'task-a', credential, checks, startedAt: new Date().toISOString() }, { ...common, reportPath: gateReportPath }), gateReportPath);
  assert.deepEqual(readFileSync(gateReportPath), firstReportBytes);
  const result = recordVerifiedRelease({ releaseId: 'release-local', rollbackCommitSha: commit, commander: 'commander-a', taskId: 'task-a', credential, gateReportPath }, {
    cwd: root, databasePath, anchorPath: join(root, 'anchor.json'), privateKeyPath: key.privatePath, trust: key.trust,
    runtime, testAdapter: true,
  });
  assert.equal(result.readyEligible, false); assert.equal(result.envelope.status, 'rejected');
  assert.equal(result.envelope.external_trust_anchor.verified, true);
  assert.ok(result.envelope.checks.some(check => check.id === 'external-trust-anchor' && check.status === 'failed'));
  assert.equal(verifyReleaseEvidenceEnvelope(result.envelope).valid, true);
  assert.throws(() => verifyReleaseEvidenceEnvelope({ ...result.envelope, external_trust_anchor: { ...result.envelope.external_trust_anchor, checkpoint: 'tampered' } }), /digest mismatch/);
  assert.throws(() => verifyReleaseEvidenceEnvelope({ ...result.envelope, ledger_checkpoint: { ...result.envelope.ledger_checkpoint, sequence: 999 } }), /digest mismatch/);
  const schema = readFileSync(join(process.cwd(), '.harness', 'contracts', 'release-evidence.schema.json'), 'utf8');
  const program = "import json,sys;from jsonschema import Draft202012Validator,FormatChecker;p=json.load(sys.stdin);e=list(Draft202012Validator(p['schema'],format_checker=FormatChecker()).iter_errors(p['value']));print('\\n'.join(x.message for x in e),file=sys.stderr);raise SystemExit(bool(e))";
  execFileSync('python3', ['-c', program], { input: JSON.stringify({ schema: JSON.parse(schema), value: result.envelope }), encoding: 'utf8' });
  const repeated = recordVerifiedRelease({ releaseId: 'release-local', rollbackCommitSha: commit, commander: 'commander-a', taskId: 'task-a', credential, gateReportPath }, { cwd: root, databasePath, anchorPath: join(root, 'anchor.json'), privateKeyPath: key.privatePath, trust: key.trust, runtime, testAdapter: true });
  assert.equal(repeated.envelope.evidence_digest, result.envelope.evidence_digest);
  releaseResource({ dbPath: databasePath, key: 'release:production', fencingEpoch: credential.fencingEpoch, nonce: credential.nonce });
});
