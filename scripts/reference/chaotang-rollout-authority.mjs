#!/usr/bin/node

/**
 * Reference single-host rollout authority.
 *
 * Deploy this exact file outside the repository at the path pinned by
 * .harness/policy/control-plane-rollout.json.  Its state is deliberately kept
 * outside both the repository and git-common-dir.  Production deployments
 * should run it under a dedicated authority identity or replace it with a
 * remote protected authority implementing the same stdin/stdout protocol.
 */

import {createHash, randomUUID} from 'node:crypto';
import {
  chmodSync,
  closeSync,
  constants,
  existsSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  rmdirSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import {basename, dirname, join} from 'node:path';
import {createConnection, createServer} from 'node:net';

const STATE_DIR = '/var/lib/chaotang-rollout-authority';
const STATE_PATH = join(STATE_DIR, 'authority-state.json');
const LOCK_PATH = join(STATE_DIR, '.authority.lock');
const RUNTIME_DIR = '/run/chaotang-rollout-authority';
const SOCKET_PATH = join(RUNTIME_DIR, 'authority.sock');
const ZERO_DIGEST = `sha256:${'0'.repeat(64)}`;
const DIGEST = /^sha256:[0-9a-f]{64}$/;
const SHA = /^[0-9a-f]{40}$/;
const ACCEPTANCE_ID = /^A(?:[1-9]|1[0-2])$/;
const STAGES = new Set(['observe', 'warn', 'enforce_paths', 'enforce_resources', 'mandatory']);
const MAX_INPUT_BYTES = 64 * 1024;
const sleepArray = new Int32Array(new SharedArrayBuffer(4));

function canonical(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
}

function sha(value) {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function fail(message) {
  process.stderr.write(`rollout authority: ${message}\n`);
  process.exit(1);
}

function assertExactKeys(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object`);
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (canonical(actual) !== canonical(expected)) throw new Error(`${label} fields invalid`);
}

function assertOwnerOnly(path, kind) {
  const value = lstatSync(path);
  if (value.isSymbolicLink()) throw new Error(`${kind} symlink forbidden`);
  if (value.uid !== process.getuid()) throw new Error(`${kind} must be owned by authority uid`);
  if ((value.mode & 0o077) !== 0) throw new Error(`${kind} must be owner-only`);
  return value;
}

function assertStateDirectory() {
  const value = assertOwnerOnly(STATE_DIR, 'state directory');
  if (!value.isDirectory()) throw new Error('state directory is not a directory');
}

function assertRuntimeDirectory() {
  const value = lstatSync(RUNTIME_DIR);
  if (value.isSymbolicLink() || !value.isDirectory()) throw new Error('authority runtime directory invalid');
  if (value.uid !== process.getuid() || (value.mode & 0o007) !== 0 || (value.mode & 0o020) !== 0) throw new Error('authority runtime directory ownership/permissions invalid');
}

function initialState(now) {
  return {
    schema_version: 1,
    authority_id: randomUUID(),
    created_at: now,
    state_revision: 0,
    trusted_time: now,
    head: {sequence: 0, digest: ZERO_DIGEST, policy_digest: null, stage: null, stage_started_at: null, stage_boot_id: null, stage_uptime_ms: null},
    controls: {
      integrationRequired: false,
      releaseTrust: false,
      recoveryPassed: false,
      rolloutAnchor: false,
    },
    release_approvals: {},
    acceptance_approvals: {},
    operation_approvals: {},
    pending_promotion: null,
    verified_acceptances: {},
    release_history: [],
    history: [],
  };
}

function stateDigest(state) {
  const copy = {...state};
  delete copy.state_digest;
  return sha(canonical(copy));
}

function validateHistory(state) {
  let previous = ZERO_DIGEST;
  let sequence = 0;
  for (const entry of state.history) {
    sequence += 1;
    if (entry.authority_sequence !== sequence || entry.previous_hash !== previous) throw new Error('authority history sequence/hash link invalid');
    const material = {...entry};
    delete material.entry_hash;
    const expected = sha(canonical(material));
    if (entry.entry_hash !== expected) throw new Error('authority history entry hash invalid');
    previous = entry.entry_hash;
  }
  if (state.state_revision !== sequence) throw new Error('authority state revision mismatch');
}

function validateState(state) {
  if (state?.schema_version !== 1 || typeof state.authority_id !== 'string') throw new Error('authority state schema invalid');
  assertExactKeys(state.head, ['sequence', 'digest', 'policy_digest', 'stage', 'stage_started_at', 'stage_boot_id', 'stage_uptime_ms'], 'authority head');
  assertExactKeys(state.controls, ['integrationRequired', 'releaseTrust', 'recoveryPassed', 'rolloutAnchor'], 'promotion controls');
  if (!Number.isSafeInteger(state.head.sequence) || state.head.sequence < 0 || !DIGEST.test(state.head.digest)) throw new Error('authority head invalid');
  if (state.head.policy_digest !== null && !DIGEST.test(state.head.policy_digest)) throw new Error('authority policy digest invalid');
  if (state.head.stage !== null && !STAGES.has(state.head.stage)) throw new Error('authority stage invalid');
  if ((state.head.stage === null) !== (state.head.stage_started_at === null) || (state.head.stage_started_at !== null && !Number.isFinite(Date.parse(state.head.stage_started_at)))) throw new Error('authority stage start invalid');
  if ((state.head.stage === null) !== (state.head.stage_boot_id === null) || (state.head.stage === null) !== (state.head.stage_uptime_ms === null) || (state.head.stage_uptime_ms !== null && (!Number.isSafeInteger(state.head.stage_uptime_ms) || state.head.stage_uptime_ms < 0))) throw new Error('authority monotonic stage identity invalid');
  if (Object.values(state.controls).some(value => typeof value !== 'boolean')) throw new Error('promotion controls must be boolean');
  if (!state.release_approvals || typeof state.release_approvals !== 'object' || Array.isArray(state.release_approvals)) throw new Error('release approvals invalid');
  if (!state.acceptance_approvals || typeof state.acceptance_approvals !== 'object' || Array.isArray(state.acceptance_approvals)) throw new Error('acceptance approvals invalid');
  if (!state.operation_approvals || typeof state.operation_approvals !== 'object' || Array.isArray(state.operation_approvals)) throw new Error('operation approvals invalid');
  if (state.pending_promotion !== null && (typeof state.pending_promotion !== 'object' || Array.isArray(state.pending_promotion))) throw new Error('pending promotion invalid');
  if (!state.verified_acceptances || typeof state.verified_acceptances !== 'object' || Array.isArray(state.verified_acceptances) || !Array.isArray(state.release_history)) throw new Error('verified rollout receipts invalid');
  if (!Array.isArray(state.history) || !Number.isSafeInteger(state.state_revision)) throw new Error('authority history invalid');
  if (!DIGEST.test(state.state_digest) || state.state_digest !== stateDigest(state)) throw new Error('authority state digest mismatch');
  validateHistory(state);
  const trusted = Date.parse(state.trusted_time);
  if (!Number.isFinite(trusted)) throw new Error('authority trusted time invalid');
}

function acquireLock() {
  const deadline = Date.now() + 10_000;
  for (;;) {
    try {
      mkdirSync(LOCK_PATH, {mode: 0o700});
      assertOwnerOnly(LOCK_PATH, 'authority lock');
      const stat=readFileSync(`/proc/${process.pid}/stat`,'utf8'),start_ticks=Number(stat.slice(stat.lastIndexOf(')')+2).split(/\s+/)[19]);
      writeFileSync(join(LOCK_PATH, 'owner'), `${canonical({pid:process.pid,start_ticks,boot_id:readFileSync('/proc/sys/kernel/random/boot_id','utf8').trim()})}\n`, {mode: 0o600, flag: 'wx'});
      return;
    } catch (error) {
      if (error.code !== 'EEXIST' || Date.now() >= deadline) throw new Error('authority lock unavailable');
      try{
        const ownerPath=join(LOCK_PATH,'owner'),owner=JSON.parse(readFileSync(ownerPath,'utf8')),bootId=readFileSync('/proc/sys/kernel/random/boot_id','utf8').trim();let alive=owner.boot_id===bootId;
        if(alive){try{process.kill(owner.pid,0);const stat=readFileSync(`/proc/${owner.pid}/stat`,'utf8'),start=Number(stat.slice(stat.lastIndexOf(')')+2).split(/\s+/)[19]);alive=start===owner.start_ticks;}catch{alive=false;}}
        if(!alive){const stale=`${LOCK_PATH}.stale.${process.pid}.${randomUUID()}`;renameSync(LOCK_PATH,stale);try{unlinkSync(join(stale,'owner'));}finally{rmdirSync(stale);}continue;}
      }catch(recoveryError){if(recoveryError.code==='ENOENT')continue;}
      Atomics.wait(sleepArray, 0, 0, 25);
    }
  }
}

function releaseLock() {
  try { unlinkSync(join(LOCK_PATH, 'owner')); } catch {}
  try { rmdirSync(LOCK_PATH); } catch {}
}

function readState() {
  assertStateDirectory();
  const stat = assertOwnerOnly(STATE_PATH, 'authority state');
  if (!stat.isFile() || stat.size > 16 * 1024 * 1024) throw new Error('authority state file invalid');
  const state = JSON.parse(readFileSync(STATE_PATH, 'utf8'));
  validateState(state);
  return state;
}

function atomicWriteState(state) {
  state.state_digest = stateDigest(state);
  const temporary = join(STATE_DIR, `.${basename(STATE_PATH)}.${process.pid}.${randomUUID()}.tmp`);
  let fd;
  try {
    fd = openSync(temporary, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY, 0o600);
    writeFileSync(fd, `${canonical(state)}\n`, 'utf8');
    fsyncSync(fd);
    closeSync(fd);
    fd = undefined;
    chmodSync(temporary, 0o600);
    renameSync(temporary, STATE_PATH);
    const directoryFd = openSync(STATE_DIR, constants.O_RDONLY);
    try { fsyncSync(directoryFd); } finally { closeSync(directoryFd); }
  } finally {
    if (fd !== undefined) try { closeSync(fd); } catch {}
    if (existsSync(temporary)) try { unlinkSync(temporary); } catch {}
  }
}

function trustedNow(state) {
  const current = Date.now();
  const previous = Date.parse(state.trusted_time);
  if (!Number.isFinite(current) || current < previous) throw new Error('trusted clock rollback detected');
  return new Date(current).toISOString();
}

function monotonicNow() {
  const bootId=readFileSync('/proc/sys/kernel/random/boot_id','utf8').trim(),seconds=Number(readFileSync('/proc/uptime','utf8').trim().split(/\s+/)[0]);
  if(!/^[0-9a-f-]{36}$/.test(bootId)||!Number.isFinite(seconds)||seconds<0)throw new Error('protected monotonic clock unavailable');
  return{boot_id:bootId,uptime_ms:Math.floor(seconds*1000)};
}

function appendHistory(state, action, evidence, now) {
  const entry = {
    authority_sequence: state.state_revision + 1,
    action,
    evidence,
    trusted_time: now,
    previous_hash: state.history.at(-1)?.entry_hash ?? ZERO_DIGEST,
  };
  entry.entry_hash = sha(canonical(entry));
  state.history.push(entry);
  state.state_revision = entry.authority_sequence;
}

function verifiedResponse(state, extra = {}) {
  return {
    verified: true,
    authority_id: state.authority_id,
    authority_sequence: state.state_revision,
    sequence: state.head.sequence,
    digest: state.head.digest,
    stage_started_at: state.head.stage_started_at,
    trusted_time: state.trusted_time,
    ...extra,
  };
}

function processRequest(state, request) {
  if (!request || typeof request !== 'object' || Array.isArray(request) || typeof request.action !== 'string') throw new Error('request invalid');
  const now = trustedNow(state);
  let response;

  if (request.action === 'head') {
    if (!DIGEST.test(request.policy_digest)) throw new Error('head policy digest invalid');
    if (state.head.policy_digest !== null && request.policy_digest !== state.head.policy_digest) throw new Error('pinned policy digest changed');
    state.trusted_time = now;
    response = verifiedResponse(state);
  } else if (request.action === 'append') {
    if (!Number.isSafeInteger(request.sequence) || request.sequence < 1 || !DIGEST.test(request.digest) || !DIGEST.test(request.policy_digest) || !STAGES.has(request.stage) || typeof request.event !== 'string' || !request.payload || typeof request.payload !== 'object') throw new Error('append checkpoint invalid');
    const idempotent = request.sequence === state.head.sequence && request.digest === state.head.digest && request.policy_digest === state.head.policy_digest && request.stage === state.head.stage;
    if (!idempotent) {
      if (request.sequence !== state.head.sequence + 1) throw new Error('append sequence is not monotonic');
      if (state.head.policy_digest !== null && request.policy_digest !== state.head.policy_digest) throw new Error('pinned policy digest changed');
      if(state.head.stage!==null&&request.stage!==state.head.stage){const pending=state.pending_promotion;if(request.event==='rollout.advanced'){if(!pending||pending.from!==state.head.stage||pending.to!==request.stage||pending.sequence!==state.head.sequence||pending.digest!==state.head.digest)throw new Error('privileged stage transition lacks one-use semantic authorization');state.pending_promotion=null;}else if(request.event==='rollout.auto_rollback'){const order=['observe','warn','enforce_paths','enforce_resources','mandatory'];if(order.indexOf(request.stage)>=order.indexOf(state.head.stage))throw new Error('automatic rollback must lower the stage');}else throw new Error('stage change event is not authorized');}
      if(request.event==='rollout.acceptance'){const receipt=state.verified_acceptances[request.payload.id];if(!receipt||receipt.commit!==request.payload.commit||receipt.artifact_digest!==request.payload.artifact_digest)throw new Error('acceptance event lacks independent authority receipt');}
      if(request.event==='rollout.release'){const ready=request.payload.outcome==='ready';if(ready&&!state.release_approvals[request.payload.release_id]?.verified_at)throw new Error('ready release event lacks independent authority receipt');state.release_history.push({release_id:request.payload.release_id,outcome:request.payload.outcome,verified:ready,incident:request.payload.incident===true});}
      const unchanged=request.stage===state.head.stage,monotonic=unchanged?{boot_id:state.head.stage_boot_id,uptime_ms:state.head.stage_uptime_ms}:monotonicNow(),stageStartedAt=unchanged?state.head.stage_started_at:now;
      state.head = {sequence: request.sequence, digest: request.digest, policy_digest: request.policy_digest, stage: request.stage, stage_started_at: stageStartedAt, stage_boot_id: monotonic.boot_id, stage_uptime_ms: monotonic.uptime_ms};
      appendHistory(state, 'append', {sequence: request.sequence, digest: request.digest, event: request.event, stage: request.stage, policy_digest: request.policy_digest}, now);
    }
    state.trusted_time = now;
    response = verifiedResponse(state, {idempotent});
  } else if (request.action === 'verify') {
    if (request.sequence !== state.head.sequence || request.digest !== state.head.digest || request.policy_digest !== state.head.policy_digest || request.stage !== state.head.stage) throw new Error('checkpoint is not the latest authority head');
    state.trusted_time = now;
    response = verifiedResponse(state);
  } else if (request.action === 'verify-promotion-controls') {
    if (request.sequence !== state.head.sequence || request.digest !== state.head.digest || request.stage !== state.head.stage || !STAGES.has(request.to) || !Number.isSafeInteger(request.minimum_ms) || request.minimum_ms < 0) throw new Error('promotion checkpoint invalid');
    const monotonic=monotonicNow();if(monotonic.boot_id!==state.head.stage_boot_id||monotonic.uptime_ms-state.head.stage_uptime_ms<request.minimum_ms)throw new Error('authority monotonic stage minimum duration not met');
    const required=request.to==='warn'?[]:request.to==='enforce_paths'?['integrationRequired']:['integrationRequired','releaseTrust','recoveryPassed','rolloutAnchor'];if(required.some(key=>state.controls[key]!==true))throw new Error('promotion controls are not approved for target stage');
    if(request.to==='mandatory'){if(Object.keys(state.verified_acceptances).length!==12)throw new Error('authority lacks A1-A12 receipts');const tail=state.release_history.slice(-20);if(tail.length!==20||tail.some(item=>!item.verified||item.outcome!=='ready'||item.incident))throw new Error('authority lacks 20 consecutive verified incident-free releases');}
    state.pending_promotion={from:request.stage,to:request.to,sequence:request.sequence,digest:request.digest,authorized_at:now};
    state.trusted_time = now;
    appendHistory(state, 'verify-promotion-controls', {from: request.stage, to: request.to, controls: state.controls}, now);
    response = verifiedResponse(state, {controls: {...state.controls}});
  } else if (request.action === 'manual-rollback' || request.action === 'reconcile-pointer') {
    const approval = state.operation_approvals[request.action];
    if (!approval || approval.used_at) throw new Error('one-use operation approval missing or consumed');
    const expected = approval.request;
    if (canonical(request) !== canonical(expected)) throw new Error('operation request differs from independently approved evidence');
    if (request.sequence !== state.head.sequence || request.digest !== state.head.digest) throw new Error('operation checkpoint is not the latest authority head');
    approval.used_at = now;
    state.trusted_time = now;
    appendHistory(state, request.action, {request_digest: sha(canonical(request)), ticket_id: approval.ticket_id}, now);
    response = verifiedResponse(state, {ticket_id: approval.ticket_id});
  } else if (request.action === 'verify-release-evidence') {
    if (typeof request.release_id !== 'string' || !Number.isSafeInteger(request.sequence) || !DIGEST.test(request.record_hash) || !SHA.test(request.commit_sha)) throw new Error('release evidence request invalid');
    const approval = state.release_approvals[request.release_id];
    if (!approval || approval.sequence !== request.sequence || approval.record_hash !== request.record_hash || approval.commit_sha !== request.commit_sha) throw new Error('release evidence is not independently approved');
    state.trusted_time = now;
    approval.verified_at=now;
    appendHistory(state, 'verify-release-evidence', {release_id: request.release_id, sequence: request.sequence, record_hash: request.record_hash, commit_sha: request.commit_sha}, now);
    response = verifiedResponse(state, {release_id: request.release_id});
  } else if (request.action === 'acceptance') {
    if (!ACCEPTANCE_ID.test(request.id) || !SHA.test(request.commit) || !DIGEST.test(request.artifact_digest) || request.passed !== true) throw new Error('acceptance request invalid');
    const approval = state.acceptance_approvals[request.id];
    if (!approval || approval.commit !== request.commit || approval.artifact_digest !== request.artifact_digest) throw new Error('acceptance is not independently approved');
    state.trusted_time = now;
    state.verified_acceptances[request.id]={commit:request.commit,artifact_digest:request.artifact_digest,verified_at:now};
    appendHistory(state, 'acceptance', {id: request.id, commit: request.commit, artifact_digest: request.artifact_digest}, now);
    response = verifiedResponse(state, {acceptance_id: request.id});
  } else {
    throw new Error('unsupported authority action');
  }

  atomicWriteState(state);
  return response;
}

function readAdminDocument(path, label) {
  const value = assertOwnerOnly(path, label);
  if (!value.isFile() || value.size > MAX_INPUT_BYTES) throw new Error(`${label} file invalid`);
  return JSON.parse(readFileSync(path, 'utf8'));
}

function runAdminCommand(argument, documentPath) {
  assertStateDirectory();
  acquireLock();
  try {
    if (argument === '--init') {
      if (existsSync(STATE_PATH)) throw new Error('authority state already exists');
      const now = new Date().toISOString();
      const state = initialState(now);
      atomicWriteState(state);
      return {initialized: true, authority_id: state.authority_id, trusted_time: now};
    }

    const state = readState();
    const now = trustedNow(state);
    if (argument === '--status') return verifiedResponse(state, {controls: state.controls, approvals: {releases: Object.keys(state.release_approvals).length, acceptances: Object.keys(state.acceptance_approvals).length, operations: Object.values(state.operation_approvals).filter(value => !value.used_at).length}});
    if (!documentPath) throw new Error('owner-only admin document path required');
    const document = readAdminDocument(documentPath, 'admin document');

    if (argument === '--set-promotion-controls') {
      assertExactKeys(document, ['integrationRequired', 'releaseTrust', 'recoveryPassed', 'rolloutAnchor'], 'promotion controls');
      if (Object.values(document).some(value => typeof value !== 'boolean')) throw new Error('promotion controls must be boolean');
      state.controls = {...document};
      appendHistory(state, 'admin.set-promotion-controls', {controls: state.controls}, now);
    } else if (argument === '--approve-release') {
      assertExactKeys(document, ['release_id', 'sequence', 'record_hash', 'commit_sha'], 'release approval');
      if (typeof document.release_id !== 'string' || !Number.isSafeInteger(document.sequence) || document.sequence < 1 || !DIGEST.test(document.record_hash) || !SHA.test(document.commit_sha)) throw new Error('release approval invalid');
      if (state.release_approvals[document.release_id]) throw new Error('release approval already exists');
      state.release_approvals[document.release_id] = {sequence: document.sequence, record_hash: document.record_hash, commit_sha: document.commit_sha, approved_at: now};
      appendHistory(state, 'admin.approve-release', document, now);
    } else if (argument === '--approve-acceptance') {
      assertExactKeys(document, ['id', 'commit', 'artifact_digest'], 'acceptance approval');
      if (!ACCEPTANCE_ID.test(document.id) || !SHA.test(document.commit) || !DIGEST.test(document.artifact_digest)) throw new Error('acceptance approval invalid');
      if (state.acceptance_approvals[document.id]) throw new Error('acceptance approval already exists');
      state.acceptance_approvals[document.id] = {commit: document.commit, artifact_digest: document.artifact_digest, approved_at: now};
      appendHistory(state, 'admin.approve-acceptance', document, now);
    } else if (argument === '--approve-operation') {
      assertExactKeys(document, ['ticket_id', 'request'], 'operation approval');
      if (typeof document.ticket_id !== 'string' || document.ticket_id.length < 8 || !['manual-rollback', 'reconcile-pointer'].includes(document.request?.action)) throw new Error('operation approval invalid');
      if (state.operation_approvals[document.request.action] && !state.operation_approvals[document.request.action].used_at) throw new Error('unconsumed operation approval already exists');
      state.operation_approvals[document.request.action] = {ticket_id: document.ticket_id, request: document.request, approved_at: now, used_at: null};
      appendHistory(state, 'admin.approve-operation', {ticket_id: document.ticket_id, request_digest: sha(canonical(document.request))}, now);
    } else {
      throw new Error('unsupported admin command');
    }

    state.trusted_time = now;
    atomicWriteState(state);
    return {updated: true, authority_id: state.authority_id, authority_sequence: state.state_revision, trusted_time: now};
  } finally {
    releaseLock();
  }
}

function readBoundedStream(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let bytes = 0;
    stream.on('data', chunk => {
      bytes += chunk.length;
      if (bytes > MAX_INPUT_BYTES) {
        reject(new Error('request size invalid'));
        stream.destroy();
        return;
      }
      chunks.push(chunk);
    });
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}

async function runClient() {
  const input = await readBoundedStream(process.stdin);
  if (input.length === 0) throw new Error('request size invalid');
  return await new Promise((resolve, reject) => {
    const socket = createConnection({path: SOCKET_PATH});
    const chunks = [];
    let bytes = 0;
    const timeout = setTimeout(() => socket.destroy(new Error('authority service timeout')), 10_000);
    socket.on('connect', () => socket.end(input));
    socket.on('data', chunk => {
      bytes += chunk.length;
      if (bytes > MAX_INPUT_BYTES) return socket.destroy(new Error('authority response size invalid'));
      chunks.push(chunk);
    });
    socket.on('end', () => {
      clearTimeout(timeout);
      try {
        const envelope = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        if (envelope?.ok !== true) throw new Error(envelope?.error ?? 'authority service rejected request');
        resolve(envelope.response);
      } catch (error) { reject(error); }
    });
    socket.on('error', error => { clearTimeout(timeout); reject(error); });
  });
}

async function runServer() {
  assertStateDirectory();
  assertRuntimeDirectory();
  readState();
  if (existsSync(SOCKET_PATH)) throw new Error('authority socket already exists; refuse unsafe unlink');
  const server = createServer({allowHalfOpen: true}, socket => {
    readBoundedStream(socket).then(input => {
      if (input.length === 0) throw new Error('request size invalid');
      acquireLock();
      try {
        const state = readState();
        const response = processRequest(state, JSON.parse(input.toString('utf8')));
        socket.end(`${canonical({ok: true, response})}\n`);
      } finally {
        releaseLock();
      }
    }).catch(error => socket.end(`${canonical({ok: false, error: error instanceof Error ? error.message : 'unknown failure'})}\n`));
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(SOCKET_PATH, () => {
      chmodSync(SOCKET_PATH, 0o660);
      resolve();
    });
  });
  const cleanup = () => {
    server.close(() => {
      try { unlinkSync(SOCKET_PATH); } catch {}
      process.exit(0);
    });
  };
  process.on('SIGTERM', cleanup);
  process.on('SIGINT', cleanup);
  await new Promise((_, reject) => server.once('error', reject));
}

try {
  const [argument, documentPath, ...extra] = process.argv.slice(2);
  if (extra.length || (argument && !['--serve', '--init', '--status', '--approve-release', '--approve-acceptance', '--approve-operation'].includes(argument))) throw new Error('invalid arguments');
  if (argument === '--serve') {
    if (documentPath) throw new Error('invalid arguments');
    await runServer();
  } else if (argument) {
    process.stdout.write(`${canonical(runAdminCommand(argument, documentPath))}\n`);
  } else {
    process.stdout.write(`${canonical(await runClient())}\n`);
  }
} catch (error) {
  fail(error instanceof Error ? error.message : 'unknown failure');
}
