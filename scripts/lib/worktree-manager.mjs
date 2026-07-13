import {
  appendFileSync, closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync,
  readlinkSync, readdirSync, renameSync, rmSync, statSync, writeFileSync,
} from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve, sep } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import {
  auditEvent, openControlPlaneDb, registeredProcessAlive, resolveControlPlanePaths,
  withImmediateTransaction,
} from './control-plane-db.mjs';
import {
  acquireResource, inspectResource, portSocketOwners,
  reclaimResource, releaseResource,
} from './resource-lock.mjs';

const git = (cwd, args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
const SHA = /^[0-9a-f]{40}$/;

function runtime(cwd, registryPath) {
  const paths = resolveControlPlanePaths(cwd);
  if (registryPath && !(process.env.NODE_ENV === 'test' && process.env.CHAOTANG_CONTROL_PLANE_TEST_ADAPTER === '1')) throw new Error('registryPath override requires explicit test adapter');
  const registry = registryPath ? resolve(registryPath) : join(paths.runtimeDir, 'worktrees.json');
  if (registryPath) mkdirSync(dirname(registry), { recursive: true, mode: 0o700 });
  return { ...paths, registry, lock: `${registry}.lock` };
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

const registryDigest = (entries) => createHash('sha256').update(canonical(entries)).digest('hex');

function validateRecord(record) {
  const required = new Set([
    'task_id', 'owner', 'branch', 'worktree', 'commit', 'port', 'port_lock', 'dist_dir',
    'artifact_dir', 'holder', 'state', 'created_at', 'handoff_token',
  ]);
  const optional = new Set(['retired_at', 'recovered_at', 'blocked_at', 'incident', 'failure']);
  if (!record || typeof record !== 'object' || Array.isArray(record)) throw new Error('worktree registry record schema invalid');
  for (const key of required) if (!(key in record)) throw new Error('worktree registry record schema invalid');
  for (const key of Object.keys(record)) if (!required.has(key) && !optional.has(key)) throw new Error('worktree registry record has unknown field');
  if (!/^task-[A-Za-z0-9._-]+$/.test(record.task_id) || record.branch !== `agent/${record.task_id}` || !SHA.test(record.commit)) throw new Error('worktree registry identity invalid');
  if (!resolve(record.worktree).endsWith(`${sep}.worktrees${sep}${record.task_id}`)) throw new Error('worktree registry path invalid');
  if (!Number.isInteger(record.port) || record.port < 3100 || record.port > 3199) throw new Error('worktree registry port invalid');
  if (record.port_lock?.key !== `port:${record.port}` || !Number.isInteger(record.port_lock?.fencing_epoch) || typeof record.port_lock?.nonce !== 'string') throw new Error('worktree registry lock invalid');
  if (!/^\.next-agent-[A-Za-z0-9_-]+$/.test(record.dist_dir) || record.artifact_dir !== join('dev', 'artifacts', record.task_id)) throw new Error('worktree registry output path invalid');
  if (!Number.isInteger(record.holder?.pid) || !Number.isInteger(record.holder?.pgid) || !Number.isInteger(record.holder?.start_ticks) || typeof record.holder?.cwd !== 'string' || typeof record.holder?.nonce !== 'string') throw new Error('worktree registry holder invalid');
  if (!['active', 'retired', 'recovered', 'blocked'].includes(record.state) || typeof record.handoff_token !== 'string' || !record.handoff_token) throw new Error('worktree registry state invalid');
  if (!Number.isFinite(Date.parse(record.created_at))) throw new Error('worktree registry timestamp invalid');
}

function emptyRegistry() {
  const entries = {};
  return { schema_version: 1, entries, digest: registryDigest(entries) };
}

function readRegistry(path) {
  let raw;
  try {
    const mode = statSync(path).mode & 0o777;
    if ((mode & 0o077) !== 0) throw new Error('permissions must be owner-only');
    raw = readFileSync(path, 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') return emptyRegistry();
    throw new Error(`worktree registry unreadable: ${error.message}`);
  }
  let state;
  try { state = JSON.parse(raw); } catch { throw new Error('worktree registry JSON is corrupt'); }
  if (!state || Object.keys(state).sort().join(',') !== 'digest,entries,schema_version' || state.schema_version !== 1 || !state.entries || Array.isArray(state.entries) || state.digest !== registryDigest(state.entries)) throw new Error('worktree registry schema/digest invalid');
  for (const [id, record] of Object.entries(state.entries)) {
    validateRecord(record);
    if (id !== record.task_id) throw new Error('worktree registry key mismatch');
  }
  return state;
}

function mutateRegistry(paths, action) {
  let lockFd;
  try { lockFd = openSync(paths.lock, 'wx', 0o600); } catch { throw new Error('worktree registry is busy; fail closed'); }
  try {
    const state = readRegistry(paths.registry);
    const result = action(state);
    for (const record of Object.values(state.entries)) validateRecord(record);
    state.digest = registryDigest(state.entries);
    const temp = `${paths.registry}.${process.pid}.${randomUUID()}.tmp`;
    const out = openSync(temp, 'wx', 0o600);
    try { writeFileSync(out, `${JSON.stringify(state, null, 2)}\n`); fsyncSync(out); } finally { closeSync(out); }
    renameSync(temp, paths.registry);
    const directory = openSync(dirname(paths.registry), 'r');
    try { fsyncSync(directory); } finally { closeSync(directory); }
    return result;
  } finally {
    closeSync(lockFd);
    rmSync(paths.lock, { force: true });
  }
}

function audit(databasePath, cwd, event, actor, subject, reason, payload = {}) {
  const { db } = openControlPlaneDb({ cwd, databasePath });
  try { withImmediateTransaction(db, () => auditEvent(db, { event, actor, subject, reason, payload })); } finally { db.close(); }
}

function holderFor(identity, { owner, taskId, worktree, commit }) {
  return {
    owner, taskId, pid: identity.pid, pgid: identity.pgid, cwd: identity.cwd, worktree,
    commit, command: 'worktree-manager', nonce: identity.nonce, hostId: identity.host_id,
    bootId: identity.boot_id, pidNamespace: identity.pid_namespace, startTicks: identity.start_ticks,
  };
}

function assertTaskAndLease(db, taskId, owner) {
  const task = db.prepare('SELECT owner,status,spec_json FROM tasks WHERE task_id=?').get(taskId);
  if (!task || task.owner !== owner || !['leased', 'running'].includes(task.status)) throw new Error('Task is missing, wrong owner or not leased');
  const lease = db.prepare("SELECT 1 FROM leases WHERE task_id=? AND owner=? AND state='active' AND resource_type='path' AND mode='write' LIMIT 1").get(taskId, owner);
  if (!lease) throw new Error('Task requires an active write path lease');
  return JSON.parse(task.spec_json);
}

function ensureWorktreeExclude(paths) {
  const file = join(paths.gitCommonDir, 'info', 'exclude');
  mkdirSync(dirname(file), { recursive: true });
  let current = '';
  try { current = readFileSync(file, 'utf8'); } catch (error) { if (error?.code !== 'ENOENT') throw error; }
  if (!current.split(/\r?\n/).includes('.worktrees/')) appendFileSync(file, `${current && !current.endsWith('\n') ? '\n' : ''}.worktrees/\n`);
}

function worktreeRegistered(cwd, path) {
  const target = resolve(path);
  return git(cwd, ['worktree', 'list', '--porcelain']).split(/\r?\n/).some((line) => line === `worktree ${target}`);
}

function removeAndVerify(cwd, path) {
  git(cwd, ['worktree', 'remove', '--force', path]);
  if (existsSync(path) || worktreeRegistered(cwd, path)) throw new Error('worktree removal could not be verified');
}

function markBlocked(paths, record, failure) {
  mutateRegistry(paths, (state) => {
    state.entries[record.task_id] = { ...state.entries[record.task_id], state: 'blocked', blocked_at: new Date().toISOString(), failure };
  });
}

export function createWorktree({ taskId, owner, holder, cwd = process.cwd(), databasePath, registryPath, base } = {}) {
  if (!taskId || !owner || !holder) throw new Error('taskId, owner and resident holder are required');
  const paths = runtime(cwd, registryPath);
  ensureWorktreeExclude(paths);
  const { db } = openControlPlaneDb({ cwd, databasePath });
  let spec;
  try { spec = assertTaskAndLease(db, taskId, owner); } finally { db.close(); }
  const approvedSha = spec.metadata?.approved_base_sha;
  if (typeof approvedSha !== 'string' || !SHA.test(approvedSha)) throw new Error('Task metadata.approved_base_sha must be a full commit SHA');
  const resolvedApproved = git(cwd, ['rev-parse', `${approvedSha}^{commit}`]);
  if (resolvedApproved !== approvedSha || (base && git(cwd, ['rev-parse', `${base}^{commit}`]) !== approvedSha)) throw new Error('base commit is not the Task approved_base_sha');
  const approvedWorktree = join(paths.repositoryRoot, '.worktrees', taskId);
  if (resolve(paths.repositoryRoot, spec.worktree) !== approvedWorktree) throw new Error('Task frozen worktree does not match canonical target');
  const ports = spec.resources.filter((resource) => /^port:31\d\d$/.test(resource));
  if (!ports.length || ['port:3002', 'port:3050'].some((resource) => spec.resources.includes(resource))) throw new Error('Task declares no valid isolated 3100-3199 port');
  if (readRegistry(paths.registry).entries[taskId]) throw new Error('worktree already registered');
  const branch = `agent/${taskId}`;
  const short = taskId.replace(/^task-/, '').replace(/[^A-Za-z0-9_-]/g, '-').slice(0, 32);
  const distDir = `.next-agent-${short}`;
  const artifactDir = join('dev', 'artifacts', taskId);
  mkdirSync(dirname(approvedWorktree), { recursive: true });
  let lock;
  for (const key of ports) {
    const existing = inspectResource({ dbPath: databasePath, key });
    if (portSocketOwners(Number(key.slice(5))).length || (existing && !['released', 'reclaimed'].includes(existing.state))) continue;
    try {
      lock = acquireResource({ dbPath: databasePath, key, holder: holderFor(holder, { owner, taskId, worktree: approvedWorktree, commit: approvedSha }), ttlMs: 120000 });
      break;
    } catch {}
  }
  if (!lock) throw new Error('no declared isolated port can be locked');
  try {
    git(cwd, ['worktree', 'add', '-b', branch, approvedWorktree, approvedSha]);
    const childPaths = resolveControlPlanePaths(approvedWorktree);
    if (childPaths.repositoryIdentity !== paths.repositoryIdentity || childPaths.databasePath !== paths.databasePath) throw new Error('created worktree does not share the repository control plane');
    const commit = git(approvedWorktree, ['rev-parse', 'HEAD']);
    if (commit !== approvedSha) throw new Error('created worktree commit differs from approved base');
    mkdirSync(join(approvedWorktree, 'frontend', artifactDir), { recursive: true });
    const record = {
      task_id: taskId, owner, branch, worktree: approvedWorktree, commit, port: Number(lock.key.slice(5)),
      port_lock: { key: lock.key, fencing_epoch: lock.fencingEpoch, nonce: lock.nonce },
      dist_dir: distDir, artifact_dir: artifactDir,
      holder: { pid: holder.pid, pgid: holder.pgid, start_ticks: holder.start_ticks, cwd: holder.cwd, nonce: holder.nonce },
      state: 'active', handoff_token: randomUUID(), created_at: new Date().toISOString(),
    };
    mutateRegistry(paths, (state) => { if (state.entries[taskId]) throw new Error('concurrent duplicate worktree'); state.entries[taskId] = record; });
    audit(databasePath, cwd, 'worktree.created', owner, taskId, null, { commit, branch, port: record.port });
    return record;
  } catch (error) {
    try { git(cwd, ['worktree', 'remove', '--force', approvedWorktree]); } catch {}
    try { releaseResource({ dbPath: databasePath, key: lock.key, fencingEpoch: lock.fencingEpoch, nonce: lock.nonce }); } catch {}
    throw error;
  }
}

export function listWorktrees({ cwd = process.cwd(), registryPath } = {}) { return Object.values(readRegistry(runtime(cwd, registryPath).registry).entries); }

export function worktreeEnv({ taskId, cwd = process.cwd(), registryPath } = {}) {
  const record = readRegistry(runtime(cwd, registryPath).registry).entries[taskId];
  if (!record || record.state !== 'active') throw new Error('active worktree not found');
  return {
    WORKTREE: record.worktree, BRANCH: record.branch, PORT: String(record.port), NEXT_DIST_DIR: record.dist_dir,
    PLAYWRIGHT_OUTPUT_DIR: join(record.artifact_dir, 'playwright'), TEST_RESULTS_DIR: join(record.artifact_dir, 'test-results'), ARTIFACT_DIR: record.artifact_dir,
  };
}

export function retireWorktree({ taskId, cwd = process.cwd(), databasePath, registryPath, handoffToken, actor, reason, evidence } = {}) {
  if (!actor || !reason || !evidence) throw new Error('normal retire requires supervisor actor, reason and evidence');
  const paths = runtime(cwd, registryPath);
  const record = readRegistry(paths.registry).entries[taskId];
  if (!record || record.state !== 'active') throw new Error('active worktree not registered');
  if (handoffToken !== record.handoff_token) throw new Error('retire handoff token mismatch');
  const pid = processUsesPath(record.worktree);
  if (pid) throw new Error(`worktree is held by pid ${pid}`);
  try {
    removeAndVerify(cwd, record.worktree);
  } catch (error) {
    markBlocked(paths, record, `retire removal failed: ${error.message}`);
    audit(databasePath, cwd, 'worktree.retire_blocked', actor, taskId, reason, { evidence, failure: error.message });
    throw error;
  }
  try {
    releaseResource({ dbPath: databasePath, key: record.port_lock.key, fencingEpoch: record.port_lock.fencing_epoch, nonce: record.port_lock.nonce });
  } catch (error) {
    markBlocked(paths, record, `retire port release failed: ${error.message}`);
    audit(databasePath, cwd, 'worktree.retire_blocked', actor, taskId, reason, { evidence, failure: error.message });
    throw error;
  }
  mutateRegistry(paths, (state) => { state.entries[taskId] = { ...state.entries[taskId], state: 'retired', retired_at: new Date().toISOString() }; });
  audit(databasePath, cwd, 'worktree.retired', actor, taskId, reason, { evidence });
  return { task_id: taskId, state: 'retired' };
}

function processUsesPath(root) {
  for (const pid of readdirSync('/proc').filter((entry) => /^\d+$/.test(entry))) {
    try { const cwd = readlinkSync(`/proc/${pid}/cwd`); if (cwd === root || cwd.startsWith(`${root}${sep}`)) return Number(pid); } catch {}
  }
  return null;
}

export function recoverWorktrees({ cwd = process.cwd(), databasePath, registryPath, actor, reason, evidence, ticket } = {}) {
  if (!actor || !reason || !evidence || !ticket) throw new Error('recovery requires incident evidence');
  const paths = runtime(cwd, registryPath);
  const results = [];
  for (const record of listWorktrees({ cwd, registryPath }).filter((entry) => entry.state === 'active')) {
    if (registeredProcessAlive(record.holder)) { results.push({ task_id: record.task_id, state: 'blocked', reason: 'holder alive' }); continue; }
    const pid = processUsesPath(record.worktree);
    if (pid) { results.push({ task_id: record.task_id, state: 'blocked', reason: `cwd held by pid ${pid}` }); continue; }
    const preflightLock = inspectResource({ dbPath: databasePath, key: record.port_lock.key });
    if (preflightLock?.state === 'active' || preflightLock?.state === 'suspect') { results.push({ task_id: record.task_id, state: 'blocked', reason: 'signed break-glass authorization required' }); continue; }
    try {
      removeAndVerify(cwd, record.worktree);
    } catch (error) {
      markBlocked(paths, record, `recovery removal failed: ${error.message}`);
      audit(databasePath, cwd, 'worktree.recovery_blocked', actor, record.task_id, reason, { evidence, ticket, failure: error.message });
      results.push({ task_id: record.task_id, state: 'blocked', reason: 'worktree removal failed; port retained' });
      continue;
    }
    try {
      if (portSocketOwners(record.port).length) throw new Error('port listening');
      let lock = inspectResource({ dbPath: databasePath, key: record.port_lock.key });
      if (lock?.state === 'fenced') reclaimResource({ dbPath: databasePath, key: record.port_lock.key, expectedEpoch: lock.fencingEpoch, evidence });
      else if (lock && !['released', 'reclaimed'].includes(lock.state)) throw new Error(`port lock is ${lock.state}`);
    } catch (error) {
      markBlocked(paths, record, `recovery port reclaim failed: ${error.message}`);
      audit(databasePath, cwd, 'worktree.recovery_blocked', actor, record.task_id, reason, { evidence, ticket, failure: error.message });
      results.push({ task_id: record.task_id, state: 'blocked', reason: 'port reclaim failed' });
      continue;
    }
    mutateRegistry(paths, (state) => { state.entries[record.task_id] = { ...state.entries[record.task_id], state: 'recovered', recovered_at: new Date().toISOString(), incident: ticket }; });
    audit(databasePath, cwd, 'worktree.recovered', actor, record.task_id, reason, { evidence, ticket });
    results.push({ task_id: record.task_id, state: 'recovered' });
  }
  return results;
}
