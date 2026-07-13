import { readFileSync, readlinkSync, readdirSync, realpathSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { auditEvent, nextFencingEpoch, nowIso, openControlPlaneDb, registeredProcessAlive, registeredProcessIdentity, resolveControlPlanePaths, withImmediateTransaction } from './control-plane-db.mjs';
import {guardRolloutIfStarted} from './rollout-controller.mjs';

function withDb(databasePath, action) {
  const { db } = openControlPlaneDb({ databasePath });
  try { return action(db); } finally { db.close(); }
}

function rowToLock(row) {
  if (!row) return null;
  return {
    key: row.resource_key, owner: row.owner, taskId: row.task_id, state: row.state,
    fencingEpoch: row.pending_fencing_epoch ?? row.fencing_epoch, activeFencingEpoch: row.fencing_epoch,
    pid: row.pid, pgid: row.pgid, nonce: row.nonce, expiresAt: row.expires_at, evidence: row.evidence,
  };
}

function canonicalAbsolute(input){let target=resolve(input),suffix=[];while(true){try{return join(realpathSync(target),...suffix);}catch{const parent=dirname(target);if(parent===target)throw new Error(`cannot canonicalize protected path: ${input}`);suffix.unshift(target.slice(parent.length+1));target=parent;}}}
function within(path,root){const rel=relative(root,path);return rel===''||(!rel.startsWith(`..${sep}`)&&rel!=='..'&&!isAbsolute(rel));}
function freezeProtectedPaths(key,holder){if(!key.startsWith('build:'))return[];if(!Array.isArray(holder.protectedPaths)||holder.protectedPaths.length===0)throw new Error('build lock requires explicit protectedPaths');const worktree=realpathSync(holder.worktree),runtime=resolveControlPlanePaths(holder.cwd).runtimeDir;return holder.protectedPaths.map(input=>{if(typeof input!=='string'||!isAbsolute(input))throw new Error('protected path must be absolute');const canonical=canonicalAbsolute(input);if(!within(canonical,worktree)&&!within(canonical,runtime))throw new Error('protected path escapes worktree/runtime roots');return{input:resolve(input),canonical};});}

export function acquireResource({ dbPath, key, holder, ttlMs, nowMs = Date.now() }) {
  if (!key || !holder?.nonce || !Number.isFinite(ttlMs) || !(ttlMs > 0)) throw new Error('resource key, holder nonce and finite positive ttl are required');
  if (!/^(port:(3002|3050|31\d{2})|build:[A-Za-z0-9._-]+|release:[A-Za-z0-9._-]+|integration:[A-Za-z0-9._-]+)$/.test(key)) throw new Error(`unsupported resource key: ${key}`);
  const guardCwd=holder.cwd;
  if(!(process.env.NODE_ENV==='test'&&process.env.CHAOTANG_CONTROL_PLANE_TEST_ADAPTER==='1')){const authoritative=resolveControlPlanePaths(guardCwd);let actual,expected;try{actual=realpathSync(dbPath);expected=realpathSync(authoritative.databasePath);}catch{throw new Error('resource database/repository identity cannot be verified');}if(actual!==expected)throw new Error('resource database does not belong to holder repository');}
  guardRolloutIfStarted({kind:key.startsWith('integration:')?'path':key.startsWith('release:')?'release':'resource',compliant:true,actor:holder.owner,subject:key},{cwd:guardCwd});
  try{return withDb(dbPath, (db) => withImmediateTransaction(db, () => {
    const task=db.prepare('SELECT owner,status,expires_at,spec_json FROM tasks WHERE task_id=?').get(holder.taskId);
    if(!task||task.owner!==holder.owner||!['ready','leased','running'].includes(task.status)||Date.parse(task.expires_at)<=nowMs)throw new Error('task missing, owner mismatch, expired or not lockable');
    if(!JSON.parse(task.spec_json).resources.includes(key))throw new Error('resource is not authorized by task');
    const identity=registeredProcessIdentity({pid:holder.pid,pgid:holder.pgid,start_ticks:holder.startTicks,cwd:holder.cwd,nonce:holder.nonce});
    const protectedPaths=freezeProtectedPaths(key,holder);
    const current = db.prepare('SELECT * FROM resource_locks WHERE resource_key=?').get(key);
    if (current && !['released', 'reclaimed'].includes(current.state)) throw new Error(`resource already has ${current.state} owner: ${key}`);
    const epoch = nextFencingEpoch(db); const at = new Date(nowMs).toISOString(); const expires = new Date(nowMs + ttlMs).toISOString();
    db.prepare(`INSERT INTO resource_locks(resource_key,owner,task_id,state,fencing_epoch,pid,pgid,cwd,worktree,commit_sha,command,nonce,host_id,boot_id,pid_namespace,start_ticks,acquired_at,heartbeat_at,expires_at,pending_fencing_epoch,released_at,evidence,protected_paths_json)
      VALUES(?,?,?,'active',?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,NULL,NULL,NULL,?)
      ON CONFLICT(resource_key) DO UPDATE SET owner=excluded.owner,task_id=excluded.task_id,state='active',fencing_epoch=excluded.fencing_epoch,pid=excluded.pid,pgid=excluded.pgid,cwd=excluded.cwd,worktree=excluded.worktree,commit_sha=excluded.commit_sha,command=excluded.command,nonce=excluded.nonce,host_id=excluded.host_id,boot_id=excluded.boot_id,pid_namespace=excluded.pid_namespace,start_ticks=excluded.start_ticks,acquired_at=excluded.acquired_at,heartbeat_at=excluded.heartbeat_at,expires_at=excluded.expires_at,pending_fencing_epoch=NULL,released_at=NULL,evidence=NULL,protected_paths_json=excluded.protected_paths_json`)
      .run(key, holder.owner, holder.taskId, epoch, identity.pid, identity.pgid, identity.cwd, holder.worktree, holder.commit, holder.command, identity.nonce, identity.host_id, identity.boot_id, identity.pid_namespace, identity.start_ticks, at, at, expires,JSON.stringify(protectedPaths));
    auditEvent(db, { event: 'resource.acquire', actor: holder.owner, subject: key, payload: { epoch } });
    return rowToLock(db.prepare('SELECT * FROM resource_locks WHERE resource_key=?').get(key));
  }));}catch(error){if(/resource already has/.test(error.message)){withDb(dbPath,db=>withImmediateTransaction(db,()=>auditEvent(db,{event:'resource.conflict',actor:holder.owner,subject:holder.taskId,payload:{resource:key,kind:key.split(':',1)[0]}})));guardRolloutIfStarted({kind:key.startsWith('integration:')?'path':key.startsWith('release:')?'release':'resource',compliant:false,actor:holder.owner,subject:key,continue:{reason:'underlying exclusive lock remains authoritative'}},{cwd:guardCwd});}throw error;}
}

export function inspectResource({ dbPath, key }) { return withDb(dbPath, (db) => rowToLock(db.prepare('SELECT * FROM resource_locks WHERE resource_key=?').get(key))); }

function assertOwner(row, fencingEpoch, nonce) {
  if (!row || row.nonce !== nonce) throw new Error('resource owner nonce mismatch');
  if (row.fencing_epoch !== fencingEpoch) throw new Error('resource fencing epoch mismatch');
  if(!registeredProcessAlive({host_id:row.host_id,boot_id:row.boot_id,pid_namespace:row.pid_namespace,pid:row.pid,pgid:row.pgid,start_ticks:row.start_ticks,cwd:row.cwd,nonce:row.nonce}))throw new Error('resident resource holder is not alive');
}

export function portSocketOwners(port) {
  const hex = Number(port).toString(16).toUpperCase().padStart(4, '0');
  const inodes=new Set();
  for (const file of ['/proc/net/tcp', '/proc/net/tcp6']) {
    try {
      const rows = readFileSync(file, 'utf8').trim().split('\n').slice(1);
      for(const line of rows){const c=line.trim().split(/\s+/);if(c[1]?.endsWith(`:${hex}`)&&c[3]==='0A')inodes.add(c[9]);}
    } catch { return [{pid:null,inode:'unreadable'}]; }
  }
  const owners=[];for(const pid of readdirSync('/proc').filter(x=>/^\d+$/.test(x))){try{for(const fd of readdirSync(`/proc/${pid}/fd`)){try{const target=readlinkSync(`/proc/${pid}/fd/${fd}`),m=/^socket:\[(\d+)\]$/.exec(target);if(m&&inodes.has(m[1])){const stat=readFileSync(`/proc/${pid}/stat`,'utf8'),tail=stat.slice(stat.lastIndexOf(')')+2).split(' ');owners.push({pid:Number(pid),pgid:Number(tail[2]),start_ticks:Number(tail[19]),inode:m[1],fd:Number(fd)});}}catch{}}}catch{}}
  for(const inode of inodes)if(!owners.some(owner=>owner.inode===inode))owners.push({pid:null,pgid:null,start_ticks:null,inode,fd:null});
  return owners;
}

function matchingProcessAlive(row) { return registeredProcessAlive({host_id:row.host_id,boot_id:row.boot_id,pid_namespace:row.pid_namespace,pid:row.pid,pgid:row.pgid,start_ticks:row.start_ticks,cwd:row.cwd,nonce:row.nonce}); }

function resourceIsFree(row) {
  if (row.resource_key.startsWith('port:')) return portSocketOwners(row.resource_key.slice(5)).length===0;
  if (matchingProcessAlive(row)) return false;
  // Fail closed if another process in the recorded PGID remains alive.
  let pids;try{pids=readdirSync('/proc').filter((name)=>/^\d+$/.test(name));}catch{return false;}
  for(const pid of pids){let stat;try{stat=readFileSync(`/proc/${pid}/stat`,'utf8');}catch(error){if(error?.code==='ENOENT')continue;return false;}const tail=stat.slice(stat.lastIndexOf(')')+2).split(' ');if(tail[0]==='Z')continue;if(Number(tail[2])===row.pgid)return false;
    if(row.resource_key.startsWith('build:')){try{if(statSync(`/proc/${pid}`).uid!==process.getuid())continue;}catch(error){if(error?.code==='ENOENT')continue;return false;}const frozen=JSON.parse(row.protected_paths_json||'[]'),protectedRoots=[];for(const item of frozen){protectedRoots.push(item.canonical);try{protectedRoots.push(canonicalAbsolute(item.input));}catch{return false;}}let fds;try{fds=readdirSync(`/proc/${pid}/fd`);}catch(error){if(error?.code==='ENOENT')continue;return false;}for(const fd of fds){try{const target=readlinkSync(`/proc/${pid}/fd/${fd}`);if(protectedRoots.some(root=>target===root||target.startsWith(`${root}${sep}`)))return false;}catch(error){if(error?.code!=='ENOENT')return false;}}}
  }
  return true;
}

export function heartbeatResource({ dbPath, key, fencingEpoch, nonce, ttlMs, nowMs = Date.now() }) {
  if(!Number.isFinite(ttlMs)||ttlMs<=0)throw new Error('heartbeat ttl must be finite and positive');
  return withDb(dbPath, (db) => withImmediateTransaction(db, () => {
    const row = db.prepare('SELECT * FROM resource_locks WHERE resource_key=?').get(key); assertOwner(row, fencingEpoch, nonce);
    if (row.state !== 'active') throw new Error(`resource owner is ${row.state}`);
    db.prepare('UPDATE resource_locks SET heartbeat_at=?,expires_at=? WHERE resource_key=?').run(new Date(nowMs).toISOString(), new Date(nowMs + ttlMs).toISOString(), key);
    return rowToLock(db.prepare('SELECT * FROM resource_locks WHERE resource_key=?').get(key));
  }));
}

export function releaseResource({ dbPath, key, fencingEpoch, nonce, nowMs = Date.now() }) {
  return withDb(dbPath, (db) => withImmediateTransaction(db, () => {
    const row = db.prepare('SELECT * FROM resource_locks WHERE resource_key=?').get(key); assertOwner(row, fencingEpoch, nonce);
    if(row.state!=='active')throw new Error(`resource owner is ${row.state}`);
    db.prepare("UPDATE resource_locks SET state='released',released_at=? WHERE resource_key=?").run(new Date(nowMs).toISOString(), key);
    auditEvent(db, { event: 'resource.release', actor: row.owner, subject: key, payload: { fencingEpoch } });
    return rowToLock(db.prepare('SELECT * FROM resource_locks WHERE resource_key=?').get(key));
  }));
}

export function markResourceSuspect({ dbPath, key, nowMs = Date.now() }) {
  return withDb(dbPath, (db) => withImmediateTransaction(db, () => {
    const row = db.prepare('SELECT * FROM resource_locks WHERE resource_key=?').get(key);
    if (!row || row.state !== 'active') throw new Error('only active resource can become suspect');
    if (Date.parse(row.expires_at) > nowMs) throw new Error('resource heartbeat has not expired');
    const pending = nextFencingEpoch(db);
    db.prepare("UPDATE resource_locks SET state='suspect',pending_fencing_epoch=? WHERE resource_key=?").run(pending, key);
    auditEvent(db, { event: 'resource.suspect', actor: 'control-plane', subject: key, payload: { pending } });
    return rowToLock(db.prepare('SELECT * FROM resource_locks WHERE resource_key=?').get(key));
  }));
}

export function fenceResource({dbPath,key,expectedEpoch,actor,reason,evidence}){if(!actor||!reason||!evidence)throw new Error('fence requires actor, reason and evidence');return withDb(dbPath,db=>withImmediateTransaction(db,()=>{const row=db.prepare('SELECT * FROM resource_locks WHERE resource_key=?').get(key);if(!row||row.state!=='suspect'||row.pending_fencing_epoch!==expectedEpoch)throw new Error('suspect fencing epoch mismatch');db.prepare("UPDATE resource_locks SET state='fenced',evidence=? WHERE resource_key=?").run(evidence,key);auditEvent(db,{event:'resource.fence',actor,subject:key,reason,payload:{evidence,expectedEpoch}});return rowToLock(db.prepare('SELECT * FROM resource_locks WHERE resource_key=?').get(key));}));}

export function breakGlassResource({dbPath,key,actor,reason,evidence,ticketId}){if(!actor||!reason||!evidence||!ticketId)throw new Error('break-glass requires a verified single-use authorization');return withDb(dbPath,db=>withImmediateTransaction(db,()=>{const authorization=db.prepare("SELECT * FROM break_glass_uses WHERE ticket_id=? AND status='authorized'").get(ticketId);if(!authorization||authorization.actor!==actor||authorization.reason!==reason||authorization.evidence!==evidence||authorization.resource_key!==key)throw new Error('verified break-glass authorization is missing or mismatched');const expected=JSON.parse(authorization.expected_lock_json),row=db.prepare('SELECT * FROM resource_locks WHERE resource_key=?').get(key);if(!row||!['active','suspect'].includes(row.state)||row.owner!==expected.owner||row.task_id!==expected.task_id||row.commit_sha!==expected.commit_sha||row.fencing_epoch!==expected.fencing_epoch)throw new Error('resource current owner identity differs from signed break-glass target');if(key==='release:production'){const release=db.prepare('SELECT release_id,task_id,commander,commit_sha,release_fencing_epoch FROM release_runs WHERE release_id=?').get(authorization.release_id);if(!release||release.task_id!==row.task_id||release.commander!==row.owner||release.commit_sha!==row.commit_sha||release.release_fencing_epoch!==row.fencing_epoch)throw new Error('signed release identity does not own current production lock');}const epoch=nextFencingEpoch(db),outcome=`sha256:${createHash('sha256').update(JSON.stringify({ticket_id:ticketId,resource_key:key,state:'fenced',fencing_epoch:epoch})).digest('hex')}`;db.prepare("UPDATE resource_locks SET state='fenced',pending_fencing_epoch=?,evidence=? WHERE resource_key=?").run(epoch,evidence,key);db.prepare("UPDATE break_glass_uses SET status='operation_applied',operation_evidence=? WHERE ticket_id=? AND status='authorized'").run(outcome,ticketId);auditEvent(db,{event:'resource.break_glass',actor,subject:key,reason,payload:{evidence,ticket_id:ticketId,epoch,operation_outcome_digest:outcome,expected_lock:expected,release_id:authorization.release_id}});return rowToLock(db.prepare('SELECT * FROM resource_locks WHERE resource_key=?').get(key));}));}

export function reclaimResource({ dbPath, key, expectedEpoch, evidence }) {
  if (!evidence) throw new Error('reclaim evidence is required');
  return withDb(dbPath, (db) => withImmediateTransaction(db, () => {
    const row = db.prepare('SELECT * FROM resource_locks WHERE resource_key=?').get(key);
    if (!row || row.state !== 'fenced' || row.pending_fencing_epoch !== expectedEpoch) throw new Error('fenced epoch mismatch');
    if (!resourceIsFree(row)) throw new Error('resource still in use; fail closed');
    db.prepare("UPDATE resource_locks SET state='reclaimed',fencing_epoch=pending_fencing_epoch,pending_fencing_epoch=NULL,released_at=?,evidence=? WHERE resource_key=?").run(nowIso(), evidence, key);
    auditEvent(db, { event: 'resource.reclaim', actor: 'control-plane', subject: key, reason: evidence, payload: { expectedEpoch } });
    return rowToLock(db.prepare('SELECT * FROM resource_locks WHERE resource_key=?').get(key));
  }));
}
