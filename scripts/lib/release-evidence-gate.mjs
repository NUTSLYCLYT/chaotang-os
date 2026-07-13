import { createHash, randomUUID } from 'node:crypto';
import { chmodSync, closeSync, existsSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, realpathSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';

import { inspectProductionRuntime } from '../../frontend/scripts/prod-runtime-identity.mjs';
import { resolveControlPlanePaths, processIdentity } from './control-plane-db.mjs';
import { heartbeatResource, inspectResource } from './resource-lock.mjs';
import {
  appendReleaseEvidence, assertReleaseAlignment, canonical, checkpointLedger,
  readAndVerifyBuildManifest, readGitProvenance, verifyEvidenceLedger,
} from './release-evidence-ledger.mjs';

const REQUIRED = ['root-doctor', 'frontend-doctor', 'backend-doctor', 'production-build', 'browser', 'true-chain', 'jiqun', 'security'];
const sha = value => `sha256:${createHash('sha256').update(value).digest('hex')}`;

export function releaseEvidencePaths(cwd = process.cwd()) {
  const root = realpathSync(cwd), control = resolveControlPlanePaths(root);
  return {
    root, databasePath: control.databasePath,
    trustPath: join(root, '.harness', 'trust', 'release-evidence-trust.json'),
    anchorPath: join(control.runtimeDir, 'release-evidence-checkpoints.json'),
    gateReportDir: join(control.runtimeDir, 'gate-reports'),
    localPrivateKeyPath: join(control.runtimeDir, 'release-evidence-local-anchor-private.pem'),
  };
}

export function loadReleaseEvidenceTrust(cwd = process.cwd()) {
  const path = releaseEvidencePaths(cwd).trustPath;
  let trust; try { trust = JSON.parse(readFileSync(path, 'utf8')); } catch { throw new Error('release evidence fixed trust root is not configured'); }
  if (trust?.schema_version !== 1 || !trust.key_id || !trust.public_key_pem || typeof trust.independent !== 'boolean') throw new Error('release evidence fixed trust root is invalid');
  return trust;
}

function validateGateReport(report) {
  if (report?.schema_version !== 1 || report?.decision !== 'GREEN' || !/^release-[A-Za-z0-9._-]+$/.test(report.release_id ?? '') || !/^[0-9a-f]{40}$/.test(report.commit_sha ?? '') || !Array.isArray(report.checks) || !Number.isFinite(Date.parse(report.started_at)) || !Number.isFinite(Date.parse(report.completed_at))) throw new Error('release gate report is not GREEN or lacks persisted provenance');
  for (const id of REQUIRED) if (!report.checks.some(check => check.id === id && check.status === 'passed')) throw new Error(`release gate report missing passed ${id}`);
  if (report.checks.some(check => check.status !== 'passed')) throw new Error('release gate report contains failed or skipped checks');
  if (new Set(report.checks.map(check => check.id)).size !== report.checks.length || report.checks.some(check => !check.evidence)) throw new Error('release gate report checks are duplicated or lack evidence');
  return structuredClone(report);
}

function assertCommanderLock(input, dbPath, override) {
  const lock = override ?? inspectResource({ dbPath, key: 'release:production' });
  if (!lock || lock.state !== 'active' || Date.parse(lock.expiresAt) <= Date.now() || lock.owner !== input.commander || lock.taskId !== input.taskId || lock.fencingEpoch !== input.credential?.fencingEpoch || lock.nonce !== input.credential?.nonce) throw new Error('active Release Commander lock identity mismatch');
  if (override) return lock;
  return heartbeatResource({ dbPath, key: 'release:production', fencingEpoch: lock.fencingEpoch, nonce: lock.nonce, ttlMs: 60000 });
}

export function persistProductionGateReport(input, options = {}) {
  const adapter = process.env.NODE_ENV === 'test' && process.env.CHAOTANG_CONTROL_PLANE_TEST_ADAPTER === '1' && options.testAdapter === true;
  if ((options.databasePath || options.runtime || options.commanderLock || options.reportPath) && !adapter) throw new Error('gate report overrides require explicit test adapter');
  const cwd = realpathSync(options.cwd ?? process.cwd()), paths = releaseEvidencePaths(cwd), dbPath = options.databasePath ?? paths.databasePath;
  assertCommanderLock(input, dbPath, options.commanderLock);
  const runtime = options.runtime ?? inspectProductionRuntime(), provenance = readGitProvenance(cwd), checks = input.checks ?? [];
  validateGateReport({ schema_version: 1, release_id: input.releaseId, commit_sha: provenance.commit, decision: 'GREEN', started_at: input.startedAt, completed_at: new Date().toISOString(), checks });
  if (runtime.commit !== provenance.commit) throw new Error('STOP/runtime_identity_mismatch: gate runtime commit differs from Git HEAD');
  const reportPath = options.reportPath ?? join(paths.gateReportDir, `${input.releaseId}.json`);
  if (existsSync(reportPath)) {
    const stat = statSync(reportPath);
    if (lstatSync(reportPath).isSymbolicLink() || stat.uid !== process.getuid() || (stat.mode & 0o777) !== 0o600) throw new Error('persisted gate report path is not owner-only regular evidence');
    const existing = validateGateReport(JSON.parse(readFileSync(reportPath, 'utf8')));
    if (existing.release_id !== input.releaseId || existing.commit_sha !== provenance.commit || existing.build_id !== runtime.buildId || existing.runtime_artifact_digest !== runtime.artifactDigest) throw new Error('persisted gate report identity conflicts with current release');
    return reportPath;
  }
  const report = { schema_version: 1, release_id: input.releaseId, commit_sha: provenance.commit, tree_sha: provenance.tree, build_id: runtime.buildId, runtime_artifact_digest: runtime.artifactDigest, decision: 'GREEN', started_at: input.startedAt, completed_at: new Date().toISOString(), checks: structuredClone(checks) }, temp = `${reportPath}.${process.pid}.${randomUUID()}.tmp`;
  mkdirSync(dirname(reportPath), { recursive: true, mode: 0o700 }); writeFileSync(temp, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600, flag: 'wx' });
  const file = openSync(temp, 'r'); fsyncSync(file); closeSync(file); renameSync(temp, reportPath); chmodSync(reportPath, 0o600); const directory = openSync(dirname(reportPath), 'r'); fsyncSync(directory); closeSync(directory);
  return reportPath;
}

export function recordVerifiedRelease(input, options = {}) {
  const adapter = process.env.NODE_ENV === 'test' && process.env.CHAOTANG_CONTROL_PLANE_TEST_ADAPTER === '1' && options.testAdapter === true;
  if ((options.databasePath || options.anchorPath || options.privateKeyPath || options.trust || options.runtime || options.gateReport || options.commanderLock) && !adapter) throw new Error('release evidence overrides require explicit test adapter');
  const cwd = realpathSync(options.cwd ?? process.cwd()), paths = releaseEvidencePaths(cwd);
  const trust = options.trust ?? loadReleaseEvidenceTrust(cwd);
  const privateKeyPath = options.privateKeyPath ?? (() => {
    const configured = process.env.CHAOTANG_RELEASE_EVIDENCE_SIGNING_KEY;
    if (!configured) return paths.localPrivateKeyPath;
    if (!isAbsolute(configured)) throw new Error('release evidence signing key path must be absolute'); return resolve(configured);
  })();
  const runtime = options.runtime ?? inspectProductionRuntime();
  const build = readAndVerifyBuildManifest(runtime.releaseRoot, { cwd, requireHead: true });
  const provenance = readGitProvenance(cwd), gateBytes = options.gateReport ? `${JSON.stringify(options.gateReport, null, 2)}\n` : readFileSync(input.gateReportPath), gateReport = validateGateReport(JSON.parse(gateBytes));
  if (input.releaseId !== runtime.releaseId || !/^release-[A-Za-z0-9._-]+$/.test(input.releaseId ?? '')) throw new Error('release evidence ID does not match runtime build');
  if (gateReport.release_id !== input.releaseId || gateReport.build_id !== runtime.buildId || gateReport.runtime_artifact_digest !== runtime.artifactDigest) throw new Error('STOP/runtime_identity_mismatch: persisted gate report differs from runtime');
  const lock = assertCommanderLock(input, options.databasePath ?? paths.databasePath, options.commanderLock), reportDigest = sha(gateBytes), artifactDigest = `sha256:${build.artifact.digest}`, host = processIdentity(cwd);
  const checks = gateReport.checks.map(check => ({ id: check.id, status: check.status, evidence: check.evidence }));
  checks.push({ id: 'external-trust-anchor', status: 'failed', evidence: 'local signer verifies integrity but is not an independent protected authority' });
  const core = {
    schema_version: 1, profile: 'production', release_id: input.releaseId,
    repository_id: resolveControlPlanePaths(cwd).repositoryIdentity, worktree: cwd, commit_sha: provenance.commit, rollback_commit_sha: input.rollbackCommitSha,
    status: 'rejected', commander_lease_id: `lease-${input.releaseId}-epoch-${lock.fencingEpoch}`,
    build_id: build.buildId, build_digest: artifactDigest, runtime_artifact_digest: runtime.artifactDigest,
    runtime_process: { host_id: host.host_id, boot_id: host.boot_id, pid_namespace: host.pid_namespace, pid: runtime.process.pid, pgid: runtime.process.pgid, start_ticks: runtime.process.start_ticks, cwd: runtime.process.cwd, nonce: sha(`${runtime.listener.socketInode}:${runtime.process.start_ticks}`).slice(7, 39) },
    listener: { host: '127.0.0.1', port: runtime.listener.port, socket_inode: runtime.listener.socketInode, pid: runtime.listener.pid },
    base_url: input.baseUrl ?? 'http://127.0.0.1:3050/chaotang', gate_report: { path: input.gateReportPath, digest: reportDigest },
    started_at: gateReport.started_at, completed_at: gateReport.completed_at, checks,
  };
  assertReleaseAlignment({ gitProvenance: provenance, build, runtime, evidence: core, gateReport });
  const row = appendReleaseEvidence({ dbPath: options.databasePath ?? paths.databasePath, evidence: core });
  const checkpoint = checkpointLedger({ dbPath: options.databasePath ?? paths.databasePath, anchorPath: options.anchorPath ?? paths.anchorPath, privateKeyPath, trust });
  const verified = verifyEvidenceLedger({ dbPath: options.databasePath ?? paths.databasePath, anchorPath: options.anchorPath ?? paths.anchorPath, trust });
  const ledgerCheckpoint = { sequence: row.sequence, previous_hash: row.previous_hash, record_hash: row.record_hash }, externalTrustAnchor = { provider: trust.provider, checkpoint: checkpoint.signature, verified: true }, envelope = {
    ...core,
    ledger_checkpoint: ledgerCheckpoint,
    external_trust_anchor: externalTrustAnchor,
    evidence_digest: sha(canonical({ release_payload: core, ledger_checkpoint: ledgerCheckpoint, external_trust_anchor: externalTrustAnchor })),
  };
  return { envelope, ledger: verified, readyEligible: verified.readyEligible };
}

export function verifyReleaseEvidenceEnvelope(envelope) {
  const core = structuredClone(envelope); delete core.ledger_checkpoint; delete core.external_trust_anchor; delete core.evidence_digest;
  const expected = sha(canonical({ release_payload: core, ledger_checkpoint: envelope.ledger_checkpoint, external_trust_anchor: envelope.external_trust_anchor }));
  if (expected !== envelope.evidence_digest || envelope.ledger_checkpoint?.record_hash === undefined) throw new Error('release evidence envelope digest mismatch');
  return { valid: true, evidenceDigest: expected, ledgerRecordHash: envelope.ledger_checkpoint.record_hash };
}

export { REQUIRED as REQUIRED_RELEASE_CHECKS };
