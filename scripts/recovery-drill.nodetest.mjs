import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { chmodSync, copyFileSync, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';

import { createTask } from './harness-task.mjs';
import { acquireLease, expireLeases, leaseStatus } from './harness-lease.mjs';
import { openControlPlaneDb, processIdentity, registeredProcessAlive, registeredProcessIdentity, withImmediateTransaction } from './lib/control-plane-db.mjs';
import { acquireResource, fenceResource, markResourceSuspect, reclaimResource, releaseResource } from './lib/resource-lock.mjs';
import { canonical, executeBreakGlass, loadBreakGlassTrust, preserveFailureSnapshot, runFailClosedMutation, verifyBreakGlassTicket } from './lib/recovery-control.mjs';
import { activateBuild, buildCandidate, inspectActiveBuild } from '../frontend/scripts/lib/immutable-build-manager.mjs';

process.env.NODE_ENV = 'test';
process.env.CHAOTANG_CONTROL_PLANE_TEST_ADAPTER = '1';

const roots = [];
const fresh = prefix => { const root = mkdtempSync(join(tmpdir(), prefix)); roots.push(root); return root; };
test.after(() => roots.forEach(root => { try { execFileSync('chmod', ['-R', 'u+w', root]); } catch {} rmSync(root, { recursive: true, force: true }); }));

function task(id, root, paths = ['frontend/src'], resources = []) {
  return { task_id: `task-${id}`, title: id, owner: id, risk: 'critical', write_paths: paths, read_paths: [], dependencies: [], worktree: root, resources, expires_at: new Date(Date.now() + 60_000).toISOString() };
}

function trustFixture() {
  const keys = ['security-a', 'release-b'].map(actor => ({ actor, ...generateKeyPairSync('ed25519') }));
  const trust = { schema_version: 1, independent: true, authority_mode: 'external-protected', threshold: 2, approvers: keys.map((key, index) => ({ key_id: `key-${index + 1}`, actor: key.actor, trust_domain: `domain-${index + 1}`, public_key_pem: key.publicKey.export({ type: 'spki', format: 'pem' }), public_key_sha256: createHash('sha256').update(key.publicKey.export({ type: 'spki', format: 'der' })).digest('hex') })) };
  return { keys, trust };
}

function signedTicket(fixture, overrides = {}) {
  const payload = { schema: 'chaotang.break-glass-ticket.v1', ticket_id: `bg-${Date.now()}-${Math.random().toString(16).slice(2)}`, commit_sha: 'a'.repeat(40), release_id: 'release-drill', operator: 'emergency-maintainer', reason: 'approved emergency recovery drill', evidence: 'INC-2026-0713', operation: { type: 'force-resource-unlock', resource_key: 'release:production', expected_lock:{owner:'emergency-maintainer',task_id:'task-emergency-maintainer',commit_sha:'a'.repeat(40),fencing_epoch:1} }, issued_at: new Date(Date.now() - 1000).toISOString(), expires_at: new Date(Date.now() + 10 * 60_000).toISOString(), original_gate: { command: '/usr/bin/corepack', args: ['pnpm', 'gate:prod-release'], cwd: 'frontend' }, ...overrides };
  const bytes = Buffer.from(canonical(payload));
  return { ...payload, approvals: fixture.keys.map((key, index) => ({ key_id: `key-${index + 1}`, actor: key.actor, signature: sign(null, bytes, key.privateKey).toString('base64') })) };
}

test('killed lease holder cannot be preempted before TTL and is safely reclaimed after TTL', async () => {
  const root = fresh('s9-lease-'), databasePath = join(root, 'control.sqlite3'), options = { cwd: process.cwd(), databasePath }, child = spawn('sleep', ['30']);
  try {
    const identity = registeredProcessIdentity({ pid: child.pid, cwd: process.cwd() });
    createTask(task('holder', process.cwd()), options); createTask(task('contender', process.cwd()), options);
    acquireLease({ task_id: 'task-holder', owner: 'holder', resource: 'frontend/src/recovery', ttl_ms: 150, holder_process: identity }, options);
    child.kill('SIGKILL'); await new Promise(resolve => child.once('close', resolve));
    assert.throws(() => acquireLease({ task_id: 'task-contender', owner: 'contender', resource: 'frontend/src/recovery' }, options), /conflict/);
    await new Promise(resolve => setTimeout(resolve, 180)); expireLeases(options);
    assert.equal(acquireLease({ task_id: 'task-contender', owner: 'contender', resource: 'frontend/src/recovery' }, options).state, 'active');
    assert.equal(leaseStatus(options).filter(item => item.resource === 'frontend/src/recovery' && item.state === 'active').length, 1);
  } finally { child.kill('SIGKILL'); }
});

test('PID reuse, cwd, boot-id and namespace drift never revive an owner', () => {
  const identity = processIdentity(process.cwd());
  assert.equal(registeredProcessAlive(identity), true);
  for (const mutation of [
    { start_ticks: identity.start_ticks + 1 }, { cwd: '/tmp' }, { pid: 99999999 },
    { boot_id: `${identity.boot_id}-reboot` }, { pid_namespace: `${identity.pid_namespace}-container` },
  ]) assert.equal(registeredProcessAlive({ ...identity, ...mutation }), false);
});

test('interrupted candidate build leaves active immutable build unchanged and removes candidate', async () => {
  const root = fresh('s9-build-'); execFileSync('git', ['init', '-q'], { cwd: root }); execFileSync('git', ['config', 'user.email', 's9@test'], { cwd: root }); execFileSync('git', ['config', 'user.name', 'S9'], { cwd: root });
  writeFileSync(join(root, '.git', 'info', 'exclude'), 'artifacts/\n.runtime/\n');
  mkdirSync(join(root, 'frontend', 'public'), { recursive: true }); writeFileSync(join(root, 'frontend', 'next.config.ts'), 'export default {}\n'); writeFileSync(join(root, 'frontend', 'public', 'x'), 'x'); execFileSync('git', ['add', '.'], { cwd: root }); execFileSync('git', ['commit', '-qm', 'base'], { cwd: root });
  const databasePath = join(root, '.runtime', 'control.sqlite3'), commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), resources = ['build:frontend-production'];
  createTask(task('builder', root, [], resources), { cwd: root, databasePath }); const identity = processIdentity(process.cwd()), buildRoot = join(root, 'artifacts'), activePointer = join(buildRoot, 'active');
  const lock = acquireResource({ dbPath: databasePath, key: resources[0], holder: { owner: 'builder', taskId: 'task-builder', pid: identity.pid, pgid: identity.pgid, cwd: identity.cwd, worktree: root, commit, command: 's9-build', nonce: identity.nonce, startTicks: identity.start_ticks, protectedPaths: [buildRoot, activePointer] }, ttlMs: 60_000 });
  const common = { cwd: root, frontendRoot: join(root, 'frontend'), buildRoot, activePointer, databasePath, lock: { key: lock.key, fencingEpoch: lock.fencingEpoch, nonce: lock.nonce } };
  const complete = async ({ nextDir }) => { mkdirSync(join(nextDir, 'static'), { recursive: true }); for (const [name, value] of [['BUILD_ID', 'old'], ['build-manifest.json', '{}'], ['routes-manifest.json', '{}']]) writeFileSync(join(nextDir, name), value); };
  const old = await buildCandidate({ ...common, releaseId: 'release-old', runner: complete }); activateBuild({ ...common, releaseId: 'release-old', manifest: old.manifest }); const before = readFileSync(activePointer, 'utf8');
  await assert.rejects(buildCandidate({ ...common, releaseId: 'release-new', runner: async ({ nextDir }) => { writeFileSync(join(nextDir, 'BUILD_ID'), 'half'); throw new Error('injected build kill'); } }), /injected build kill/);
  assert.equal(readFileSync(activePointer, 'utf8'), before); assert.equal(inspectActiveBuild(common).release_id, 'release-old'); assert.equal(existsSync(join(buildRoot, '.candidate-release-new')), false);
});

test('real SIGKILL build leaves a dead operation that is fenced and precisely recovered',async()=>{if(process.env.S9_ISOLATED_PID_NS!=='1'){execFileSync('unshare',['--user','--map-root-user','--pid','--fork','--mount-proc',process.execPath,'--test','--test-name-pattern=real SIGKILL',new URL(import.meta.url).pathname],{env:{...process.env,S9_ISOLATED_PID_NS:'1'},stdio:'pipe'});return;}const root=fresh('s9-build-kill-');execFileSync('git',['init','-q'],{cwd:root});execFileSync('git',['config','user.email','s9@test'],{cwd:root});execFileSync('git',['config','user.name','S9'],{cwd:root});mkdirSync(join(root,'frontend','public'),{recursive:true});writeFileSync(join(root,'frontend','next.config.ts'),'export default {}\n');writeFileSync(join(root,'.git','info','exclude'),'artifacts/\n.runtime/\nready\n');execFileSync('git',['add','.'],{cwd:root});execFileSync('git',['commit','-qm','base'],{cwd:root});const databasePath=join(root,'.runtime','control.sqlite3'),buildRoot=join(root,'artifacts'),activePointer=join(buildRoot,'active'),ready=join(root,'ready'),commit=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),options={cwd:root,databasePath};createTask({task_id:'task-kill-builder',title:'kill',owner:'kill-builder',risk:'critical',write_paths:[],read_paths:[],dependencies:[],worktree:root,resources:['build:frontend-production'],expires_at:new Date(Date.now()+60000).toISOString()},options);const helper=new URL('./fixtures/s9-build-kill-child.mjs',import.meta.url).pathname,child=spawn(process.execPath,[helper,root,databasePath,buildRoot,activePointer,ready,commit],{cwd:root,env:{...process.env,NODE_ENV:'test',CHAOTANG_CONTROL_PLANE_TEST_ADAPTER:'1'},detached:true,stdio:'ignore'});try{const end=Date.now()+3000;while(!existsSync(ready)&&Date.now()<end)await new Promise(r=>setTimeout(r,20));assert.equal(existsSync(ready),true);process.kill(-child.pid,'SIGKILL');await new Promise(r=>child.once('close',r));await new Promise(r=>setTimeout(r,100));const suspect=markResourceSuspect({dbPath:databasePath,key:'build:frontend-production',nowMs:Date.now()+120000}),fenced=fenceResource({dbPath:databasePath,key:'build:frontend-production',expectedEpoch:suspect.fencingEpoch,actor:'s9-drill',reason:'real build SIGKILL',evidence:'child exit+candidate sentinel'});reclaimResource({dbPath:databasePath,key:'build:frontend-production',expectedEpoch:fenced.fencingEpoch,evidence:'no process/fd remains'});const identity=processIdentity(process.cwd()),lock=acquireResource({dbPath:databasePath,key:'build:frontend-production',holder:{owner:'kill-builder',taskId:'task-kill-builder',pid:identity.pid,pgid:identity.pgid,cwd:identity.cwd,worktree:root,commit,command:'s9-recovery',nonce:identity.nonce,protectedPaths:[buildRoot,activePointer]},ttlMs:60000}),runner=async({nextDir})=>{mkdirSync(join(nextDir,'static'),{recursive:true});for(const[name,value]of[['BUILD_ID','recovered'],['build-manifest.json','{}'],['routes-manifest.json','{}']])writeFileSync(join(nextDir,name),value);};const built=await buildCandidate({cwd:root,frontendRoot:join(root,'frontend'),buildRoot,activePointer,databasePath,lock:{key:lock.key,fencingEpoch:lock.fencingEpoch,nonce:lock.nonce},releaseId:'release-recovered',runner});assert.equal(built.manifest.build_id,'recovered');assert.equal(existsSync(join(buildRoot,'.candidate-release-killed')),false);}finally{try{process.kill(-child.pid,'SIGKILL');}catch{}}});

test('break-glass requires two independent approvals, exact binding, <=30m and original gate', () => {
  const fixture = trustFixture(), ticket = signedTicket(fixture);
  assert.equal(verifyBreakGlassTicket({ ticket, trust: fixture.trust, expectedCommit: ticket.commit_sha, expectedReleaseId: ticket.release_id, testAdapter:true }).approval_key_ids.length, 2);
  assert.throws(() => verifyBreakGlassTicket({ ticket: { ...ticket, approvals: ticket.approvals.slice(0, 1) }, trust: fixture.trust, expectedCommit: ticket.commit_sha, expectedReleaseId: ticket.release_id, testAdapter:true }), /two approvals/);
  assert.throws(() => verifyBreakGlassTicket({ ticket, trust: fixture.trust, expectedCommit: 'b'.repeat(40), expectedReleaseId: ticket.release_id, testAdapter:true }), /binding/);
  assert.throws(() => verifyBreakGlassTicket({ ticket: signedTicket(fixture, { expires_at: new Date(Date.now() + 31 * 60_000).toISOString() }), trust: fixture.trust, expectedCommit: ticket.commit_sha, expectedReleaseId: ticket.release_id, testAdapter:true }), /30 minutes/);
  const changed = signedTicket(fixture, { original_gate: { command: 'true', args: [], cwd: '.' } });
  assert.throws(() => verifyBreakGlassTicket({ ticket: changed, trust: fixture.trust, expectedCommit: changed.commit_sha, expectedReleaseId: changed.release_id, testAdapter:true }), /original production gate/);
  const changedOperation=signedTicket(fixture,{operation:{type:'arbitrary-shell',resource_key:'build:other'}});assert.throws(()=>verifyBreakGlassTicket({ticket:changedOperation,trust:fixture.trust,expectedCommit:changedOperation.commit_sha,expectedReleaseId:changedOperation.release_id,testAdapter:true}),/operation|payload/);
});

test('production trust is read from clean Git HEAD and pins the external replay command digest',()=>{const root=fresh('s9-trust-'),external=fresh('s9-authority-'),command=join(external,'claim'),fixture=trustFixture();writeFileSync(command,'#!/bin/sh\nexit 0\n',{mode:0o700});const trust={...fixture.trust,replay_claim_command:command,replay_claim_command_digest:`sha256:${createHash('sha256').update(readFileSync(command)).digest('hex')}`},bytes=`${JSON.stringify(trust,null,2)}\n`;execFileSync('git',['init','-q'],{cwd:root});execFileSync('git',['config','user.email','s9@test'],{cwd:root});execFileSync('git',['config','user.name','S9'],{cwd:root});mkdirSync(join(root,'.harness','trust'),{recursive:true});writeFileSync(join(root,'.harness','trust','break-glass-trust.json'),bytes);execFileSync('git',['add','.'],{cwd:root});execFileSync('git',['commit','-qm','trust'],{cwd:root});assert.equal(loadBreakGlassTrust(root).replay_claim_command,command);writeFileSync(join(root,'.harness','trust','break-glass-trust.json'),`${bytes}\n`);assert.throws(()=>loadBreakGlassTrust(root),/clean tracked HEAD/);writeFileSync(join(root,'.harness','trust','break-glass-trust.json'),bytes);writeFileSync(command,'#!/bin/sh\nexit 1\n',{mode:0o700});assert.throws(()=>loadBreakGlassTrust(root),/digest mismatch/);});

function lockedBreakGlassResource(options) {
  createTask(task('emergency-maintainer', process.cwd(), [], ['release:production']), options); const identity = processIdentity(process.cwd());
  const lock=acquireResource({ dbPath: options.databasePath, key: 'release:production', holder: { owner: 'emergency-maintainer', taskId: 'task-emergency-maintainer', pid: identity.pid, pgid: identity.pgid, cwd: identity.cwd, worktree: process.cwd(), commit: 'a'.repeat(40), command: 'drill', nonce: identity.nonce }, ttlMs: 60_000 }),opened=openControlPlaneDb(options),at=new Date().toISOString();try{opened.db.prepare("INSERT INTO release_runs(release_id,task_id,commander,status,commit_sha,attestation_digest,release_fencing_epoch,nonce_commitment,checks_json,log_json,created_at,updated_at) VALUES('release-drill','task-emergency-maintainer','emergency-maintainer','locked',?,?,?,?, '[]','[]',?,?)").run('a'.repeat(40),`sha256:${'b'.repeat(64)}`,lock.fencingEpoch,'commitment',at,at);}finally{opened.db.close();}return lock;
}

test('break-glass is single-use, runs original gate, and writes immutable audit identity', async () => {
  const root = fresh('s9-glass-'), options = { cwd: process.cwd(), databasePath: join(root, 'control.sqlite3') }, fixture = trustFixture(), calls = [],replay=[],lock=lockedBreakGlassResource(options),ticket = signedTicket(fixture,{operation:{type:'force-resource-unlock',resource_key:'release:production',expected_lock:{owner:'emergency-maintainer',task_id:'task-emergency-maintainer',commit_sha:'a'.repeat(40),fencing_epoch:lock.fencingEpoch}}});
  const input = { ticket, trust: fixture.trust, expectedCommit: ticket.commit_sha, expectedReleaseId: ticket.release_id, actor: ticket.operator, reason: ticket.reason, evidence: ticket.evidence, gateRunner: async command => { calls.push(command); return { code: 0, output: 'GREEN: release gate passed' }; }, replayClaim: async claim => {replay.push(claim.action);return { claimed: claim.ticket_id };} };
  const adapter={...options,testAdapter:true};const result = await executeBreakGlass(input, adapter); assert.equal(result.status, 'consumed'); assert.deepEqual(calls, [{ command: '/usr/bin/corepack', args: ['pnpm','gate:prod-release'], cwd: 'frontend' }]);
  assert.deepEqual(replay,['claim','complete']);
  await assert.rejects(executeBreakGlass(input, adapter), /single-use/);
  await assert.rejects(executeBreakGlass(input,options),/production break-glass trust, gate and replay authority are fixed/);
  const { db } = openControlPlaneDb(options); try { assert.throws(() => db.prepare('DELETE FROM break_glass_uses').run(), /append-only/); assert.throws(() => db.prepare("UPDATE audit_events SET actor='x'").run(), /append-only/); assert.equal(db.prepare("SELECT count(*) n FROM audit_events WHERE event='break_glass.consumed'").get().n, 1); } finally { db.close(); }
});

test('failed or skipped production gate consumes no emergency operation and remains fail closed', async () => {
  const root = fresh('s9-gate-'), options = { cwd: process.cwd(), databasePath: join(root, 'control.sqlite3') }, fixture = trustFixture(), lock=lockedBreakGlassResource(options),ticket = signedTicket(fixture,{operation:{type:'force-resource-unlock',resource_key:'release:production',expected_lock:{owner:'emergency-maintainer',task_id:'task-emergency-maintainer',commit_sha:'a'.repeat(40),fencing_epoch:lock.fencingEpoch}}}); let operated = false;
  await assert.rejects(executeBreakGlass({ ticket, trust: fixture.trust, expectedCommit: ticket.commit_sha, expectedReleaseId: ticket.release_id, actor: ticket.operator, reason: ticket.reason, evidence: ticket.evidence, gateRunner: async () => ({ code: 0, output: 'GREEN: release gate passed\nSKIP browser' }), replayClaim: async () => { operated = true; } }, {...options,testAdapter:true}), /did not pass/);
  assert.equal(operated, false); const { db } = openControlPlaneDb(options); try { assert.equal(db.prepare('SELECT status FROM break_glass_uses WHERE ticket_id=?').get(ticket.ticket_id).status, 'failed'); } finally { db.close(); }
});

test('operation-applied crash resumes only external completion and local finalize without unlocking twice',async()=>{const root=fresh('s9-reconcile-'),options={cwd:process.cwd(),databasePath:join(root,'control.sqlite3')},fixture=trustFixture(),lock=lockedBreakGlassResource(options),ticket=signedTicket(fixture,{operation:{type:'force-resource-unlock',resource_key:'release:production',expected_lock:{owner:'emergency-maintainer',task_id:'task-emergency-maintainer',commit_sha:'a'.repeat(40),fencing_epoch:lock.fencingEpoch}}}),actions=[];let failComplete=true;const input={ticket,trust:fixture.trust,expectedCommit:ticket.commit_sha,expectedReleaseId:ticket.release_id,actor:ticket.operator,reason:ticket.reason,evidence:ticket.evidence,gateRunner:async()=>({code:0,output:'GREEN: release gate passed'}),replayClaim:async event=>{actions.push(event.action);if(event.action==='complete'&&failComplete){failComplete=false;throw new Error('external complete unavailable');}}},adapter={...options,testAdapter:true};await assert.rejects(executeBreakGlass(input,adapter),/external complete unavailable/);let opened=openControlPlaneDb(options);const applied=opened.db.prepare('SELECT status FROM break_glass_uses WHERE ticket_id=?').get(ticket.ticket_id);opened.db.close();assert.equal(applied.status,'operation_applied');const fencedEpoch=lock.fencingEpoch;const resumed=await executeBreakGlass(input,adapter);assert.equal(resumed.reconciled,true);opened=openControlPlaneDb(options);try{assert.equal(opened.db.prepare('SELECT status FROM break_glass_uses WHERE ticket_id=?').get(ticket.ticket_id).status,'consumed');assert.equal(opened.db.prepare("SELECT count(*) n FROM audit_events WHERE event='resource.break_glass'").get().n,1);assert.ok(opened.db.prepare("SELECT pending_fencing_epoch e FROM resource_locks WHERE resource_key='release:production'").get().e>fencedEpoch);}finally{opened.db.close();}assert.deepEqual(actions,['claim','complete','complete']);});

test('operation outcome digest is byte-stable across external-complete crash recovery', async () => {
  const root = fresh('s9-outcome-'), options = { cwd: process.cwd(), databasePath: join(root, 'control.sqlite3') };
  const fixture = trustFixture(), lock = lockedBreakGlassResource(options);
  const ticket = signedTicket(fixture, { operation: { type: 'force-resource-unlock', resource_key: 'release:production', expected_lock: { owner: 'emergency-maintainer', task_id: 'task-emergency-maintainer', commit_sha: 'a'.repeat(40), fencing_epoch: lock.fencingEpoch } } });
  const events = []; let failComplete = true;
  const input = { ticket, trust: fixture.trust, expectedCommit: ticket.commit_sha, expectedReleaseId: ticket.release_id, actor: ticket.operator, reason: ticket.reason, evidence: ticket.evidence, gateRunner: async () => ({ code: 0, output: 'GREEN: release gate passed' }), replayClaim: async event => { events.push(structuredClone(event)); if (event.action === 'complete' && failComplete) { failComplete = false; throw new Error('complete crash'); } } };
  await assert.rejects(executeBreakGlass(input, { ...options, testAdapter: true }), /complete crash/);
  await executeBreakGlass(input, { ...options, testAdapter: true });
  const completes = events.filter(event => event.action === 'complete');
  assert.equal(completes.length, 2); assert.equal(completes[0].outcome, completes[1].outcome); assert.match(completes[0].outcome, /^sha256:[0-9a-f]{64}$/);
  const opened = openControlPlaneDb(options); try { assert.equal(opened.db.prepare("SELECT count(*) n FROM audit_events WHERE event='resource.break_glass'").get().n, 1); assert.equal(opened.db.prepare('SELECT operation_evidence FROM break_glass_uses WHERE ticket_id=?').get(ticket.ticket_id).operation_evidence, completes[0].outcome); } finally { opened.db.close(); }
});

test('external replay authority rejects a second claim after local database rollback', async () => {
  const root = fresh('s9-external-replay-'), options = { cwd: process.cwd(), databasePath: join(root, 'control.sqlite3') }, authority = join(root, 'external-authority'); mkdirSync(authority, { mode: 0o700 });
  const fixture = trustFixture(), lock = lockedBreakGlassResource(options), ticket = signedTicket(fixture, { operation: { type: 'force-resource-unlock', resource_key: 'release:production', expected_lock: { owner: 'emergency-maintainer', task_id: 'task-emergency-maintainer', commit_sha: 'a'.repeat(40), fencing_epoch: lock.fencingEpoch } } });
  let opened = openControlPlaneDb(options); try { opened.db.exec('PRAGMA wal_checkpoint(TRUNCATE)'); } finally { opened.db.close(); }
  const rollback = join(root, 'claim-before.sqlite3'); copyFileSync(options.databasePath, rollback);
  const replayClaim = async event => {
    const path = join(authority, `${event.ticket_id}.${event.action}`), bytes = `${canonical(event)}\n`;
    if (event.action === 'claim') { try { writeFileSync(path, bytes, { flag: 'wx', mode: 0o600 }); } catch (error) { if (error?.code === 'EEXIST') throw new Error('external replay rejected second claim'); throw error; } return; }
    if (existsSync(path)) { if (readFileSync(path, 'utf8') !== bytes) throw new Error('external replay rejected different outcome'); return; }
    writeFileSync(path, bytes, { flag: 'wx', mode: 0o600 });
  };
  const input = { ticket, trust: fixture.trust, expectedCommit: ticket.commit_sha, expectedReleaseId: ticket.release_id, actor: ticket.operator, reason: ticket.reason, evidence: ticket.evidence, gateRunner: async () => ({ code: 0, output: 'GREEN: release gate passed' }), replayClaim };
  await executeBreakGlass(input, { ...options, testAdapter: true });
  const completed = JSON.parse(readFileSync(join(authority, `${ticket.ticket_id}.complete`), 'utf8'));
  await assert.rejects(replayClaim({ ...completed, outcome: `sha256:${'0'.repeat(64)}` }), /different outcome/);
  rmSync(`${options.databasePath}-wal`, { force: true }); rmSync(`${options.databasePath}-shm`, { force: true }); copyFileSync(rollback, options.databasePath);
  await assert.rejects(executeBreakGlass(input, { ...options, testAdapter: true }), /external replay rejected second claim/);
  opened = openControlPlaneDb(options); try { assert.equal(opened.db.prepare("SELECT state FROM resource_locks WHERE resource_key='release:production'").get().state, 'active'); assert.equal(opened.db.prepare("SELECT count(*) n FROM audit_events WHERE event='resource.break_glass'").get().n, 0); } finally { opened.db.close(); }
});

test('real SQLite FULL and READONLY mutations fail closed with owner-only pre-failure snapshots', async () => {
  const root = fresh('s9-storage-'), databasePath = join(root, 'control.sqlite3'), snapshots = join(root, 'snapshots'), options = { cwd: process.cwd(), databasePath };
  let opened = openControlPlaneDb(options); opened.db.exec('PRAGMA journal_mode=DELETE'); const pages=opened.db.prepare('PRAGMA page_count').get().page_count;opened.db.exec(`PRAGMA max_page_count=${pages}`);process.env.CHAOTANG_RECOVERY_SNAPSHOT_DIR=snapshots;
  let fullSnapshot;try{assert.throws(()=>withImmediateTransaction(opened.db,()=>opened.db.prepare('INSERT INTO audit_events(event,actor,subject,payload_json,created_at) VALUES(?,?,?,?,?)').run('x','x','x','x'.repeat(2_000_000),new Date().toISOString())),error=>{fullSnapshot=error.snapshot;return error.code==='CONTROL_PLANE_FAIL_CLOSED'&&existsSync(error.snapshot);});}finally{delete process.env.CHAOTANG_RECOVERY_SNAPSHOT_DIR;opened.db.close();}const recovered=new DatabaseSync(fullSnapshot,{readOnly:true});try{assert.equal(recovered.prepare('PRAGMA integrity_check').get().integrity_check,'ok');}finally{recovered.close();}
  opened = openControlPlaneDb(options); opened.db.close(); chmodSync(databasePath, 0o444); chmodSync(root, 0o555);
  try { await assert.rejects(runFailClosedMutation({ databasePath, cwd: process.cwd(), snapshotDirectory: snapshots, operation: async () => { const raw = new DatabaseSync(databasePath); try { raw.exec('PRAGMA journal_mode=DELETE; BEGIN IMMEDIATE; CREATE TABLE readonly_probe(x); COMMIT;'); } finally { raw.close(); } } }), /STOP\/control_plane_storage_failure/); }
  finally { chmodSync(root, 0o700); chmodSync(databasePath, 0o600); }
});

test('corrupt control database is retained byte-for-byte and never auto-deleted', () => {
  const root = fresh('s9-corrupt-'), databasePath = join(root, 'control.sqlite3'), snapshots = join(root, 'snapshots'), bytes = Buffer.from('not-a-sqlite-control-plane'); writeFileSync(databasePath, bytes);
  assert.throws(() => openControlPlaneDb({ cwd: process.cwd(), databasePath }));
  const preserved = preserveFailureSnapshot({ databasePath, cwd: process.cwd(), failure: Object.assign(new Error('SQLITE_CORRUPT'), { code: 'SQLITE_CORRUPT' }), snapshotDirectory: snapshots });
  assert.deepEqual(readFileSync(preserved.snapshot), bytes); assert.deepEqual(readFileSync(databasePath), bytes); assert.equal((statSync(preserved.report).mode & 0o777), 0o600);
});

test('v7 snapshot upgrades forward to v8 and remains available as an explicit downgrade rollback image',()=>{const root=fresh('s9-migration-'),databasePath=join(root,'control.sqlite3'),v7=join(root,'control-v7.sqlite3'),options={cwd:process.cwd(),databasePath};createTask(task('migration-state',process.cwd()),options);let opened=openControlPlaneDb(options);opened.db.exec("DROP TRIGGER trg_break_glass_no_delete;DROP TRIGGER trg_break_glass_immutable_identity;DROP TRIGGER trg_break_glass_state_machine;DROP TABLE break_glass_uses;PRAGMA user_version=7;PRAGMA wal_checkpoint(TRUNCATE)");opened.db.close();copyFileSync(databasePath,v7);opened=openControlPlaneDb(options);try{assert.equal(opened.db.prepare('PRAGMA user_version').get().user_version,8);assert.equal(opened.db.prepare("SELECT count(*) n FROM tasks WHERE task_id='task-migration-state'").get().n,1);}finally{opened.db.close();}rmSync(`${databasePath}-wal`,{force:true});rmSync(`${databasePath}-shm`,{force:true});copyFileSync(v7,databasePath);const raw=new DatabaseSync(databasePath,{readOnly:true});try{assert.equal(raw.prepare('PRAGMA user_version').get().user_version,7);assert.equal(raw.prepare("SELECT count(*) n FROM tasks WHERE task_id='task-migration-state'").get().n,1);}finally{raw.close();}});
