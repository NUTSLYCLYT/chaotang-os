import { execFileSync, spawn } from 'node:child_process';
import { createHash, createPublicKey, randomUUID, verify } from 'node:crypto';
import { chmodSync, closeSync, copyFileSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { backup, DatabaseSync } from 'node:sqlite';

import { auditEvent, openControlPlaneDb, resolveControlPlanePaths, withImmediateTransaction } from './control-plane-db.mjs';
import { breakGlassResource } from './resource-lock.mjs';

const SHA = /^[0-9a-f]{40}$/;
const RELEASE = /^release-[A-Za-z0-9._-]+$/;
const canonical = value => JSON.stringify(value, (_, nested) => nested && typeof nested === 'object' && !Array.isArray(nested)
  ? Object.fromEntries(Object.entries(nested).sort(([a], [b]) => a.localeCompare(b))) : nested);
const sha = value => createHash('sha256').update(value).digest('hex');

function ticketPayload(ticket) {
  const payload = structuredClone(ticket);
  delete payload.approvals;
  return payload;
}

function validateTrust(trust, { testAdapter = false } = {}) {
  if (trust?.schema_version !== 1 || trust.independent !== true || trust.authority_mode !== 'external-protected' || trust.threshold !== 2 || !Array.isArray(trust.approvers) || trust.approvers.length < 2 || (!testAdapter && (!isAbsolute(trust.replay_claim_command ?? '') || !/^sha256:[0-9a-f]{64}$/.test(trust.replay_claim_command_digest ?? '')))) throw new Error('break-glass requires an independent two-person trust root and external replay authority');
  const ids = new Set(), domains = new Set();
  for (const approver of trust.approvers) {
    if (!approver?.key_id || !approver?.actor || !approver?.trust_domain || typeof approver.public_key_pem !== 'string' || ids.has(approver.key_id) || domains.has(approver.trust_domain)) throw new Error('break-glass trust approvers or trust domains are invalid or duplicated');
    const fingerprint = sha(createPublicKey(approver.public_key_pem).export({ type: 'spki', format: 'der' }));
    if (approver.public_key_sha256 !== fingerprint) throw new Error('break-glass approver fingerprint mismatch');
    ids.add(approver.key_id); domains.add(approver.trust_domain);
  }
  return trust;
}

export function verifyBreakGlassTicket({ ticket, trust: inputTrust, expectedCommit, expectedReleaseId, nowMs = Date.now(), testAdapter = false }) {
  const trust = validateTrust(inputTrust, { testAdapter }), issued = Date.parse(ticket?.issued_at), expires = Date.parse(ticket?.expires_at);
  const lock=ticket?.operation?.expected_lock;
  if (ticket?.schema !== 'chaotang.break-glass-ticket.v1' || !/^bg-[A-Za-z0-9._-]+$/.test(ticket.ticket_id ?? '') || !SHA.test(ticket.commit_sha ?? '') || !RELEASE.test(ticket.release_id ?? '') || typeof ticket.operator !== 'string' || typeof ticket.reason !== 'string' || ticket.reason.length < 8 || typeof ticket.evidence !== 'string' || ticket.evidence.length < 4 || ticket.operation?.type !== 'force-resource-unlock' || !/^(port|build|release|integration):[A-Za-z0-9._-]+$/.test(ticket.operation?.resource_key ?? '') || !lock || typeof lock.owner!=='string'||typeof lock.task_id!=='string'||!SHA.test(lock.commit_sha??'')||!Number.isInteger(lock.fencing_epoch)||lock.fencing_epoch<1||lock.commit_sha!==ticket.commit_sha) throw new Error('break-glass ticket payload, operation, or expected lock identity is invalid');
  if (!Number.isFinite(issued) || !Number.isFinite(expires) || issued > nowMs + 30_000 || expires <= nowMs || expires - issued > 30 * 60_000 || expires <= issued) throw new Error('break-glass ticket is expired, future-dated, or exceeds 30 minutes');
  if (ticket.commit_sha !== expectedCommit || ticket.release_id !== expectedReleaseId) throw new Error('break-glass ticket commit/release binding mismatch');
  if (ticket.original_gate?.command !== '/usr/bin/corepack' || canonical(ticket.original_gate.args) !== canonical(['pnpm', 'gate:prod-release']) || ticket.original_gate.cwd !== 'frontend') throw new Error('break-glass ticket cannot change or skip the original production gate');
  if (!Array.isArray(ticket.approvals) || ticket.approvals.length < trust.threshold) throw new Error('break-glass ticket lacks two approvals');
  const payload = Buffer.from(canonical(ticketPayload(ticket))), used = new Set(), actors = new Set();
  for (const approval of ticket.approvals) {
    const approver = trust.approvers.find(item => item.key_id === approval?.key_id);
    if (!approver || used.has(approver.key_id) || actors.has(approver.actor) || approval.actor !== approver.actor || !verify(null, payload, createPublicKey(approver.public_key_pem), Buffer.from(approval.signature ?? '', 'base64'))) continue;
    used.add(approver.key_id); actors.add(approver.actor);
  }
  if (used.size < trust.threshold) throw new Error('break-glass ticket approvals are invalid or not independent');
  return { payload: ticketPayload(ticket), approval_key_ids: [...used].sort(), approval_actors: [...actors].sort(), ticket_digest: `sha256:${sha(payload)}` };
}

function validateEvidence(value, label) {
  if (typeof value !== 'string' || value.trim().length < 4 || value.length > 4096) throw new Error(`break-glass ${label} is required and bounded`);
  return value.trim();
}

function runOriginalGate(cwd) { return new Promise((resolve, reject) => { const child = spawn('/usr/bin/corepack', ['pnpm', 'gate:prod-release'], { cwd: join(cwd, 'frontend'), env: process.env, stdio: ['ignore', 'pipe', 'pipe'] }); let output = ''; child.stdout.on('data', chunk => output += chunk); child.stderr.on('data', chunk => output += chunk); child.once('error', reject); child.once('close', code => resolve({ code, output })); }); }
function runReplay(command, action, ticket, digest, outcome = '') { return new Promise((resolve, reject) => { const child = spawn(command, [action, ticket.ticket_id, ticket.release_id, ticket.commit_sha, digest, outcome], { stdio: ['ignore', 'pipe', 'pipe'], env: {} }); let output = ''; child.stdout.on('data', chunk => output += chunk); child.stderr.on('data', chunk => output += chunk); child.once('error', reject); child.once('close', code => code === 0 ? resolve({ code, output }) : reject(new Error(`external replay authority rejected ${action} (${code})`))); }); }

export async function executeBreakGlass({ ticket, trust: injectedTrust, expectedCommit, expectedReleaseId, actor, reason, evidence, gateRunner, replayClaim }, options = {}) {
  validateEvidence(actor, 'actor'); validateEvidence(reason, 'reason'); validateEvidence(evidence, 'evidence');
  const testAdapter = options.testAdapter === true && process.env.NODE_ENV === 'test' && process.env.CHAOTANG_CONTROL_PLANE_TEST_ADAPTER === '1', cwd = resolve(options.cwd ?? process.cwd());
  if (testAdapter && (typeof gateRunner !== 'function' || typeof replayClaim !== 'function')) throw new Error('test adapter requires explicit gate and external replay authority');
  if (!testAdapter && (injectedTrust || gateRunner || replayClaim || expectedCommit)) throw new Error('production break-glass trust, gate and replay authority are fixed');
  if (actor !== ticket.operator || reason !== ticket.reason || evidence !== ticket.evidence) throw new Error('break-glass operator/reason/evidence binding mismatch');
  const trust = testAdapter ? injectedTrust : loadBreakGlassTrust(cwd), commit = testAdapter ? expectedCommit : assertCleanCommittedHead(cwd), releaseId = expectedReleaseId ?? ticket.release_id;
  const verified = verifyBreakGlassTicket({ ticket, trust, expectedCommit: commit, expectedReleaseId: releaseId, nowMs: options.nowMs ?? Date.now(), testAdapter });
  const invokeReplay = (action,outcome='') => testAdapter ? replayClaim({ action, ticket_id: ticket.ticket_id, ticket_digest: verified.ticket_digest, outcome }) : runReplay(trust.replay_claim_command, action, ticket, verified.ticket_digest, outcome);
  const priorDb=openControlPlaneDb(options);let prior;try{prior=priorDb.db.prepare('SELECT status,operation_evidence FROM break_glass_uses WHERE ticket_id=?').get(ticket.ticket_id);}finally{priorDb.db.close();}
  if(prior?.status==='operation_applied'){await invokeReplay('complete',prior.operation_evidence);const reconciled=openControlPlaneDb(options);try{withImmediateTransaction(reconciled.db,()=>{reconciled.db.prepare("UPDATE break_glass_uses SET status='consumed',completed_at=? WHERE ticket_id=? AND status='operation_applied'").run(new Date().toISOString(),ticket.ticket_id);auditEvent(reconciled.db,{event:'break_glass.reconciled',actor,subject:ticket.ticket_id,reason,payload:{release_id:ticket.release_id,external_complete:true,operation_outcome_digest:prior.operation_evidence}});auditEvent(reconciled.db,{event:'rollout.release_incident',actor,subject:ticket.release_id,reason,payload:{ticket:ticket.ticket_id,severity:'P0',source:'break_glass.reconciled'}});});}finally{reconciled.db.close();}return{ticket_id:ticket.ticket_id,status:'consumed',reconciled:true};}
  const opened = openControlPlaneDb(options); let attempt;
  try {
    attempt = withImmediateTransaction(opened.db, () => {
      const previous = opened.db.prepare('SELECT status FROM break_glass_uses WHERE ticket_id=?').get(ticket.ticket_id);
      if (previous) throw new Error(`break-glass ticket is single-use (${previous.status})`);
      const at = new Date(options.nowMs ?? Date.now()).toISOString();
      opened.db.prepare("INSERT INTO break_glass_uses(ticket_id,release_id,commit_sha,actor,reason,evidence,ticket_digest,approval_key_ids_json,resource_key,expected_lock_json,status,created_at,completed_at,gate_evidence,operation_evidence) VALUES(?,?,?,?,?,?,?,?,?,?, 'in_progress', ?,NULL,NULL,NULL)")
        .run(ticket.ticket_id, ticket.release_id, ticket.commit_sha, actor, reason, evidence, verified.ticket_digest, JSON.stringify(verified.approval_key_ids), ticket.operation.resource_key, JSON.stringify(ticket.operation.expected_lock), at);
      auditEvent(opened.db, { event: 'break_glass.started', actor, subject: ticket.ticket_id, reason, payload: { release_id: ticket.release_id, commit_sha: ticket.commit_sha, evidence, approvals: verified.approval_key_ids } });
      auditEvent(opened.db, { event: 'rollout.release_incident', actor, subject: ticket.release_id, reason, payload: { ticket: ticket.ticket_id, severity: 'P0', source: 'break_glass.started' } });
      return at;
    });
  } finally { opened.db.close(); }
  try {
    const gate = await (testAdapter ? gateRunner : () => runOriginalGate(cwd))({ command: '/usr/bin/corepack', args: ['pnpm', 'gate:prod-release'], cwd: 'frontend' });
    if (!gate || gate.code !== 0 || !/GREEN: release gate passed/.test(String(gate.output ?? '')) || /\bSKIP\b/.test(String(gate.output ?? ''))) throw new Error('original production gate did not pass without SKIP');
    const gateEvidence = `sha256:${sha(String(gate.output))}`, authorized = openControlPlaneDb(options);
    try { withImmediateTransaction(authorized.db, () => authorized.db.prepare("UPDATE break_glass_uses SET status='authorized',gate_evidence=? WHERE ticket_id=? AND status='in_progress'").run(gateEvidence, ticket.ticket_id)); } finally { authorized.db.close(); }
    await invokeReplay('claim');
    const result = breakGlassResource({ dbPath: options.databasePath, key: ticket.operation.resource_key, actor, reason, evidence, ticketId: ticket.ticket_id });
    const applied = openControlPlaneDb(options); let operationEvidence;
    try { operationEvidence = applied.db.prepare("SELECT operation_evidence FROM break_glass_uses WHERE ticket_id=? AND status='operation_applied'").get(ticket.ticket_id)?.operation_evidence; } finally { applied.db.close(); }
    if (!/^sha256:[0-9a-f]{64}$/.test(operationEvidence ?? '')) throw new Error('break-glass operation outcome digest was not committed');
    await invokeReplay('complete', operationEvidence);
    const done = openControlPlaneDb(options);
    try { withImmediateTransaction(done.db, () => {
      const completed = new Date().toISOString();
      done.db.prepare("UPDATE break_glass_uses SET status='consumed',completed_at=? WHERE ticket_id=? AND status='operation_applied'").run(completed, ticket.ticket_id);
      auditEvent(done.db, { event: 'break_glass.consumed', actor, subject: ticket.ticket_id, reason, payload: { release_id: ticket.release_id, gate_evidence: gateEvidence, operation_evidence: operationEvidence } });
    }); } finally { done.db.close(); }
    return { ticket_id: ticket.ticket_id, status: 'consumed', started_at: attempt, result };
  } catch (error) {
    const failed = openControlPlaneDb(options);
    try { withImmediateTransaction(failed.db, () => {
      const failure = `sha256:${sha(error.message)}`;
      failed.db.prepare("UPDATE break_glass_uses SET status='failed',completed_at=?,operation_evidence=? WHERE ticket_id=? AND status IN ('in_progress','authorized')").run(new Date().toISOString(), failure, ticket.ticket_id);
      auditEvent(failed.db, { event: 'break_glass.failed', actor, subject: ticket.ticket_id, reason, payload: { failure } });
    }); } finally { failed.db.close(); }
    throw error;
  }
}

function secureSnapshotDirectory(cwd, override) {
  if (override) {
    if (!(process.env.NODE_ENV === 'test' && process.env.CHAOTANG_CONTROL_PLANE_TEST_ADAPTER === '1') || !isAbsolute(override)) throw new Error('recovery snapshot override is test-only and must be absolute');
    mkdirSync(override, { recursive: true, mode: 0o700 }); if((statSync(override).mode&0o077)!==0)throw new Error('recovery snapshot directory must be owner-only');return realpathOrResolve(override);
  }
  const path = join(resolveControlPlanePaths(cwd).runtimeDir, 'recovery-snapshots'); mkdirSync(path, { recursive: true, mode: 0o700 });if((statSync(path).mode&0o077)!==0)throw new Error('recovery snapshot directory must be owner-only'); return path;
}
const realpathOrResolve = path => { try { return resolve(path); } catch { return path; } };

export function preserveFailureSnapshot({ databasePath, cwd = process.cwd(), failure, snapshotDirectory }) {
  const directory = secureSnapshotDirectory(cwd, snapshotDirectory), stamp = `${Date.now()}-${randomUUID()}`, base = join(directory, `control-plane-failure-${stamp}`), snapshot = `${base}.sqlite3`, report = `${base}.json`;
  if (existsSync(databasePath)) copyFileSync(databasePath, snapshot); else writeFileSync(snapshot, '', { mode: 0o600, flag: 'wx' });
  chmodSync(snapshot, 0o600);
  for(const suffix of ['-wal','-shm'])if(existsSync(`${databasePath}${suffix}`)){copyFileSync(`${databasePath}${suffix}`,`${snapshot}${suffix}`);chmodSync(`${snapshot}${suffix}`,0o600);}
  const snapshotFiles=[snapshot,...['-wal','-shm'].map(s=>`${snapshot}${s}`).filter(existsSync)].map(path=>({path,size:statSync(path).size,digest:`sha256:${sha(readFileSync(path))}`}));
  const payload = { schema: 'chaotang.control-plane-failure.v1', database_path: resolve(databasePath), snapshot_path: snapshot, snapshot_files:snapshotFiles,consistency:'best-effort-crash-set', failure_class: failure?.code ?? failure?.name ?? 'Error', failure_digest: `sha256:${sha(String(failure?.message ?? failure))}`, captured_at: new Date().toISOString() };
  const temp = `${report}.tmp`; writeFileSync(temp, `${JSON.stringify(payload, null, 2)}\n`, { mode: 0o600, flag: 'wx' }); const fd = openSync(temp, 'r'); fsyncSync(fd); closeSync(fd); renameSync(temp, report);
  return { snapshot, report, payload };
}

export async function runFailClosedMutation({ databasePath, cwd = process.cwd(), operation, snapshotDirectory }) {
  if (typeof operation !== 'function') throw new Error('recovery mutation operation required');
  const directory = secureSnapshotDirectory(cwd, snapshotDirectory), before = join(directory, `control-plane-before-${Date.now()}-${randomUUID()}.sqlite3`);
  let source; try { source = new DatabaseSync(databasePath, { readOnly: true }); await backup(source, before); }
  catch { copyFileSync(databasePath, before); for (const suffix of ['-wal','-shm']) if (existsSync(`${databasePath}${suffix}`)) copyFileSync(`${databasePath}${suffix}`, `${before}${suffix}`); }
  finally { try { source?.close(); } catch {} } chmodSync(before, 0o600);
  try { const result = await operation(); rmSync(before, { force: true }); return result; }
  catch (error) {
    const report = `${before}.json`, payload = { schema: 'chaotang.control-plane-failure.v1', database_path: resolve(databasePath), snapshot_path: before, failure_class: error?.code ?? error?.name ?? 'Error', failure_digest: `sha256:${sha(String(error?.message ?? error))}`, captured_at: new Date().toISOString() };
    writeFileSync(report, `${JSON.stringify(payload, null, 2)}\n`, { mode: 0o600, flag: 'wx' });
    const wrapped = new Error(`STOP/control_plane_storage_failure: ${error.message}; snapshot=${before}`, { cause: error }); wrapped.code = 'CONTROL_PLANE_FAIL_CLOSED'; wrapped.snapshot = before; throw wrapped;
  }
}

function assertCleanCommittedHead(cwd) {
  const status = execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd, encoding: 'utf8' }).trim();
  if (status) throw new Error('production break-glass requires a clean tracked HEAD');
  return execFileSync('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf8' }).trim();
}

export function loadBreakGlassTrust(cwd = process.cwd()) {
  const root = resolve(cwd); assertCleanCommittedHead(root);
  let trust; try { trust = JSON.parse(execFileSync('git', ['show', 'HEAD:.harness/trust/break-glass-trust.json'], { cwd: root, encoding: 'utf8' })); } catch { throw new Error('break-glass fixed trust root is not committed at HEAD'); }
  const validated = validateTrust(trust);
  const commandDigest = `sha256:${sha(readFileSync(validated.replay_claim_command))}`;
  if (commandDigest !== validated.replay_claim_command_digest) throw new Error('external replay authority command digest mismatch');
  return validated;
}

export { canonical };
