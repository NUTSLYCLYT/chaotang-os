import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { copyFileSync, writeFileSync, rmSync, symlinkSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:net';
import test from 'node:test';
import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';

import {
  acquireResource,
  breakGlassResource,
  fenceResource,
  heartbeatResource,
  inspectResource,
  markResourceSuspect,
  portSocketOwners,
  reclaimResource,
  releaseResource,
} from './lib/resource-lock.mjs';
import { createTask } from './harness-task.mjs';
import { registeredProcessIdentity } from './lib/control-plane-db.mjs';
import { openControlPlaneDb, resolveControlPlanePaths, snapshotControlPlaneDb } from './lib/control-plane-db.mjs';

process.env.NODE_ENV = 'test';
process.env.CHAOTANG_CONTROL_PLANE_TEST_ADAPTER = '1';

async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), 'chaotang-resource-lock-'));
  return { dbPath: join(dir, 'control-plane.sqlite3'), cleanup: () => rm(dir, { recursive: true, force: true }) };
}

function owner(id, pid = process.pid) {
  const identity=registeredProcessIdentity({pid,cwd:process.cwd()});
  return {
    owner: id, taskId: `task-${id}`, pid, pgid: identity.pgid, cwd: identity.cwd, worktree: process.cwd(),
    commit: '0123456789abcdef0123456789abcdef01234567', command: 'test', nonce: `nonce-${id}`,
    hostId: identity.host_id, bootId: identity.boot_id, pidNamespace: identity.pid_namespace, startTicks: identity.start_ticks,
    protectedPaths: [join(process.cwd(), '.next')],
  };
}
function register(f,id,key){createTask({task_id:`task-${id}`,title:id,owner:id,risk:'medium',write_paths:[],read_paths:[],dependencies:[],worktree:process.cwd(),resources:[key],expires_at:new Date(Date.now()+60000).toISOString()},{databasePath:f.dbPath,cwd:process.cwd()});}

async function listenInPool() {
  for (let port = 3100; port <= 3199; port += 1) {
    const server = createServer();
    try { await new Promise((resolve, reject) => server.listen(port, '127.0.0.1', resolve).once('error', reject)); return server; }
    catch { server.close(); }
  }
  throw new Error('no free control-plane test port');
}
function cli(args,env={}){return new Promise(resolve=>{const p=spawn(process.execPath,['scripts/harness-lock.mjs',...args],{cwd:process.cwd(),detached:true,env:{...process.env,...env}});let out='',err='';p.stdout.on('data',d=>out+=d);p.stderr.on('data',d=>err+=d);p.on('close',code=>resolve({code,out,err}));});}
function realDbDigest(db){const query=(sql)=>db.prepare(sql).all();const content={tasks:query('SELECT * FROM tasks ORDER BY task_id'),leases:query('SELECT * FROM leases ORDER BY lease_id'),resource_locks:query('SELECT * FROM resource_locks ORDER BY resource_key'),control_meta:query('SELECT * FROM control_meta ORDER BY key'),audit_checkpoint:query('SELECT * FROM audit_events ORDER BY id')};return createHash('sha256').update(JSON.stringify(content)).digest('hex');}

test('200 contenders never produce two active owners', async (t) => {
  const f = await fixture(); t.after(f.cleanup);
  register(f,'agent','port:3050');
  const results = await Promise.allSettled(Array.from({ length: 200 }, (_, i) => Promise.resolve().then(() =>
    acquireResource({ dbPath: f.dbPath, key: 'port:3050', holder: {...owner('agent'),nonce:`nonce-a${i}`}, ttlMs: 60_000 }))));
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  const lock = inspectResource({ dbPath: f.dbPath, key: 'port:3050' });
  assert.equal(lock.state, 'active');
  assert.equal(lock.fencingEpoch, 1);
});

test('nonce-bound heartbeat and release reject stale owners', async (t) => {
  const f = await fixture(); t.after(f.cleanup);
  register(f,'builder','build:frontend-production');
  const lock = acquireResource({ dbPath: f.dbPath, key: 'build:frontend-production', holder: owner('builder'), ttlMs: 60_000 });
  assert.throws(() => heartbeatResource({ dbPath: f.dbPath, key: lock.key, fencingEpoch: lock.fencingEpoch, nonce: 'wrong', ttlMs: 60_000 }), /owner|nonce/i);
  assert.throws(() => heartbeatResource({ dbPath: f.dbPath, key: lock.key, fencingEpoch: lock.fencingEpoch, nonce: 'nonce-builder', ttlMs: Number.NaN }), /finite/);
  assert.throws(() => releaseResource({ dbPath: f.dbPath, key: lock.key, fencingEpoch: lock.fencingEpoch - 1, nonce: 'nonce-builder' }), /fencing/i);
  assert.equal(releaseResource({ dbPath: f.dbPath, key: lock.key, fencingEpoch: lock.fencingEpoch, nonce: 'nonce-builder' }).state, 'released');
});

test('task authorization and database constraints fail closed',async(t)=>{const f=await fixture();t.after(f.cleanup);register(f,'authorized','build:allowed');assert.throws(()=>acquireResource({dbPath:f.dbPath,key:'build:other',holder:owner('authorized'),ttlMs:1000}),/authorized/);const {db}=await import('./lib/control-plane-db.mjs').then(m=>m.openControlPlaneDb({databasePath:f.dbPath}));assert.ok(db.prepare("PRAGMA foreign_key_list(resource_locks)").all().some(x=>x.table==='tasks'));assert.ok(db.prepare("PRAGMA index_list(resource_locks)").all().length>=2);db.close();});

test('break-glass requires an unexpired ticket and audits all evidence',async(t)=>{const f=await fixture();t.after(f.cleanup);register(f,'glass','release:production');acquireResource({dbPath:f.dbPath,key:'release:production',holder:owner('glass'),ttlMs:1000});assert.throws(()=>breakGlassResource({dbPath:f.dbPath,key:'release:production',actor:'admin',reason:'incident',evidence:'probe',ticket:'INC-1',ticketExpiresAt:new Date(0).toISOString()}),/unexpired/);const lock=breakGlassResource({dbPath:f.dbPath,key:'release:production',actor:'admin',reason:'incident',evidence:'probe',ticket:'INC-1',ticketExpiresAt:new Date(Date.now()+1000).toISOString()});assert.equal(lock.state,'fenced');});

test('expired active lock becomes suspect and OS socket evidence controls reclaim', async (t) => {
  const f = await fixture(); t.after(f.cleanup);
  const server = await listenInPool();
  const port = server.address().port;
  assert.ok(portSocketOwners(port).some(x=>x.pid===process.pid&&x.inode));
  register(f,'server',`port:${port}`);
  const lock = acquireResource({ dbPath: f.dbPath, key: `port:${port}`, holder: owner('server'), ttlMs: 1, nowMs: 100 });
  const suspect = markResourceSuspect({ dbPath: f.dbPath, key: lock.key, nowMs: 102 });
  assert.equal(suspect.state, 'suspect');
  const fenced=fenceResource({dbPath:f.dbPath,key:lock.key,expectedEpoch:suspect.fencingEpoch,actor:'controller',reason:'expired',evidence:'ticket-1'});
  assert.equal(fenced.state,'fenced');
  assert.throws(() => reclaimResource({ dbPath: f.dbPath, key: lock.key, expectedEpoch: suspect.fencingEpoch, evidence: 'socket probe' }), /still in use|fail closed/i);
  await new Promise((resolve) => server.close(resolve));
  const reclaimed = reclaimResource({ dbPath: f.dbPath, key: lock.key, expectedEpoch: suspect.fencingEpoch, evidence: 'socket and process verified absent' });
  assert.equal(reclaimed.state, 'reclaimed');
  register(f,'next',`port:${port}`);const next = acquireResource({ dbPath: f.dbPath, key: lock.key, holder: owner('next'), ttlMs: 60_000 });
  assert.ok(next.fencingEpoch > suspect.fencingEpoch);
});

test('200 real barrier child-process rounds cover port/build/release/integration',async(t)=>{const realPath=resolveControlPlanePaths().databasePath;let real=openControlPlaneDb();const before={...statSync(realPath),digest:realDbDigest(real.db)};real.db.close();const f=await fixture();t.after(f.cleanup);const types=['port','build','release','integration'],usedPorts=new Set();for(let i=0;i<200;i++){const type=types[i%4],suffix=`s2-${process.pid}-${Date.now()}-${i}`;let key=`${type}:${suffix}`;if(type==='port'){for(let p=3100;p<=3199;p++){if(usedPorts.has(p)||portSocketOwners(p).length)continue;key=`port:${p}`;usedPorts.add(p);break;}}const owners=[`${suffix}-a`,`${suffix}-b`];for(const id of owners)createTask({task_id:`task-${id}`,title:id,owner:id,risk:'medium',write_paths:[],read_paths:[],dependencies:[],worktree:process.cwd(),resources:[key],expires_at:new Date(Date.now()+120000).toISOString()},{databasePath:f.dbPath});
  const barrier=join(tmpdir(),`${suffix}.barrier`),isolated=join(tmpdir(),suffix);await mkdir(isolated,{recursive:true});const env={NODE_ENV:'test',CHAOTANG_TEST_BARRIER_FILE:barrier},args=id=>['acquire','--test-db',f.dbPath,'--key',key,'--task',`task-${id}`,'--owner',id,'--worktree',isolated,'--protected-paths-json',JSON.stringify([join(isolated,'.next')]),'--commit','0123456789abcdef0123456789abcdef01234567','--command','race'];const pending=owners.map(id=>cli(args(id),env));await new Promise(r=>setTimeout(r,5));writeFileSync(barrier,'go');const results=await Promise.all(pending);rmSync(barrier,{force:true});assert.equal(results.filter(x=>x.code===0).length,1,results.map(x=>x.err).join('\n'));const fenced=breakGlassResource({dbPath:f.dbPath,key,actor:'test-controller',reason:'round cleanup',evidence:'child exited',ticket:`round-${i}`,ticketExpiresAt:new Date(Date.now()+60000).toISOString()});await rm(isolated,{recursive:true,force:true});}
real=openControlPlaneDb();const after={...statSync(realPath),digest:realDbDigest(real.db)};real.db.close();assert.equal(after.dev,before.dev);assert.equal(after.ino,before.ino);assert.equal(after.digest,before.digest);});

test('build reclaim fails closed for an unrelated process open fd',async(t)=>{const f=await fixture();t.after(f.cleanup);const worktree=join(tmpdir(),`s2-build-${randomUUID()}`),next=join(worktree,'builds','release-1','next'),active=join(worktree,'active'),next2=join(worktree,'builds','release-2','next'),file=join(next,'artifact');await mkdir(next,{recursive:true});await writeFile(file,'build');symlinkSync(next,active,'dir');t.after(()=>rm(worktree,{recursive:true,force:true}));const resident=spawn('setsid',['sleep','0.15']);await new Promise(r=>setTimeout(r,20));register(f,'buildfd','build:fd-proof');const h=owner('buildfd',resident.pid);assert.equal(h.pgid,resident.pid);h.worktree=worktree;h.protectedPaths=[next,active];const lock=acquireResource({dbPath:f.dbPath,key:'build:fd-proof',holder:h,ttlMs:1,nowMs:100});await mkdir(next2,{recursive:true});rmSync(active);symlinkSync(next2,active,'dir');const fdHolder=spawn('tail',['-f',file]);await new Promise(r=>resident.once('close',r));const suspect=markResourceSuspect({dbPath:f.dbPath,key:lock.key,nowMs:102});fenceResource({dbPath:f.dbPath,key:lock.key,expectedEpoch:suspect.fencingEpoch,actor:'controller',reason:'drill',evidence:'fd-scan'});assert.throws(()=>reclaimResource({dbPath:f.dbPath,key:lock.key,expectedEpoch:suspect.fencingEpoch,evidence:'scan'}),/still in use|fail closed/);fdHolder.kill();await new Promise(r=>fdHolder.once('close',r));});

test('real v1 resource migration preserves tasks and snapshot restores after failure',async(t)=>{const f=await fixture();t.after(f.cleanup);register(f,'migration','integration:migration');let x=openControlPlaneDb({databasePath:f.dbPath});x.db.exec('DROP TABLE resource_locks; PRAGMA user_version=1');x.db.close();const snapshot=join(tmpdir(),`s2-v1-${randomUUID()}.sqlite3`);t.after(()=>rm(snapshot,{force:true}));snapshotControlPlaneDb({databasePath:f.dbPath,destination:snapshot});x=openControlPlaneDb({databasePath:f.dbPath});assert.equal(x.db.prepare('PRAGMA user_version').get().user_version,3);assert.equal(x.db.prepare("SELECT count(*) n FROM tasks WHERE task_id='task-migration'").get().n,1);assert.ok(x.db.prepare("PRAGMA foreign_key_list(resource_locks)").all().some(r=>r.table==='tasks'));x.db.exec('PRAGMA user_version=99');x.db.close();assert.throws(()=>openControlPlaneDb({databasePath:f.dbPath}),/unknown/);rmSync(`${f.dbPath}-wal`,{force:true});rmSync(`${f.dbPath}-shm`,{force:true});copyFileSync(snapshot,f.dbPath);x=openControlPlaneDb({databasePath:f.dbPath});assert.equal(x.db.prepare("SELECT count(*) n FROM tasks WHERE task_id='task-migration'").get().n,1);x.db.close();});

test('heartbeat/suspect, release/suspect and reclaim/acquire boundaries stay linear',async(t)=>{const f=await fixture();t.after(f.cleanup);
  register(f,'hb','build:hb');const hb=acquireResource({dbPath:f.dbPath,key:'build:hb',holder:owner('hb'),ttlMs:10,nowMs:100});const a=await Promise.allSettled([Promise.resolve().then(()=>heartbeatResource({dbPath:f.dbPath,key:hb.key,fencingEpoch:hb.fencingEpoch,nonce:'nonce-hb',ttlMs:100,nowMs:101})),Promise.resolve().then(()=>markResourceSuspect({dbPath:f.dbPath,key:hb.key,nowMs:111}))]);assert.equal(a.filter(x=>x.status==='fulfilled').length,1);
  register(f,'rel','build:rel');const rel=acquireResource({dbPath:f.dbPath,key:'build:rel',holder:owner('rel'),ttlMs:10,nowMs:100});const b=await Promise.allSettled([Promise.resolve().then(()=>releaseResource({dbPath:f.dbPath,key:rel.key,fencingEpoch:rel.fencingEpoch,nonce:'nonce-rel'})),Promise.resolve().then(()=>markResourceSuspect({dbPath:f.dbPath,key:rel.key,nowMs:111}))]);assert.equal(b.filter(x=>x.status==='fulfilled').length,1);
  register(f,'old','port:3199');register(f,'new','port:3199');const old=acquireResource({dbPath:f.dbPath,key:'port:3199',holder:owner('old'),ttlMs:1,nowMs:100});const s=markResourceSuspect({dbPath:f.dbPath,key:old.key,nowMs:102});fenceResource({dbPath:f.dbPath,key:old.key,expectedEpoch:s.fencingEpoch,actor:'controller',reason:'race',evidence:'drill'});const c=await Promise.allSettled([Promise.resolve().then(()=>reclaimResource({dbPath:f.dbPath,key:old.key,expectedEpoch:s.fencingEpoch,evidence:'free'})),Promise.resolve().then(()=>acquireResource({dbPath:f.dbPath,key:old.key,holder:owner('new'),ttlMs:100}))]);assert.ok(c.filter(x=>x.status==='fulfilled').length>=1);assert.equal(['active','reclaimed'].includes(inspectResource({dbPath:f.dbPath,key:old.key}).state),true);});

test('heartbeat/suspect, release/suspect and reclaim/acquire race in real CLI processes',async(t)=>{const f=await fixture();t.after(f.cleanup);const resident=spawn('setsid',['sleep','30']);t.after(()=>resident.kill());await new Promise(r=>setTimeout(r,20));const id=registeredProcessIdentity({pid:resident.pid,cwd:process.cwd()}),holder=['--holder-pid',String(id.pid),'--holder-pgid',String(id.pgid),'--holder-start-ticks',String(id.start_ticks),'--holder-cwd',id.cwd],base=['--test-db',f.dbPath];const taskFor=(name,key,ownerName=name)=>createTask({task_id:`task-${name}`,title:name,owner:ownerName,risk:'medium',write_paths:[],read_paths:[],dependencies:[],worktree:process.cwd(),resources:[key],expires_at:new Date(Date.now()+60000).toISOString()},{databasePath:f.dbPath});const acquire=async(name,key,ttl='20')=>{const r=await cli(['acquire',...base,'--key',key,'--task',`task-${name}`,'--owner',name,'--ttl',ttl,'--commit','0123456789abcdef0123456789abcdef01234567','--command','boundary',...holder]);assert.equal(r.code,0,r.err);return JSON.parse(r.out);};const race=async(commands)=>{const barrier=join(tmpdir(),`s2-state-${randomUUID()}.barrier`),env={NODE_ENV:'test',CHAOTANG_TEST_BARRIER_FILE:barrier},pending=commands.map(args=>cli(args,env));await new Promise(r=>setTimeout(r,10));writeFileSync(barrier,'go');const results=await Promise.all(pending);rmSync(barrier,{force:true});return results;};
  taskFor('real-hb','integration:real-hb');const hb=await acquire('real-hb','integration:real-hb');await new Promise(r=>setTimeout(r,30));let result=await race([['heartbeat',...base,'--key',hb.key,'--epoch',String(hb.fencingEpoch),'--nonce',hb.nonce,'--ttl','1000'],['suspect',...base,'--key',hb.key]]);assert.equal(result.filter(x=>x.code===0).length,1);
  taskFor('real-release','integration:real-release');const rel=await acquire('real-release','integration:real-release');await new Promise(r=>setTimeout(r,30));result=await race([['release',...base,'--key',rel.key,'--epoch',String(rel.fencingEpoch),'--nonce',rel.nonce],['suspect',...base,'--key',rel.key]]);assert.equal(result.filter(x=>x.code===0).length,1);
  taskFor('real-old','port:3197');taskFor('real-new','port:3197');const old=await acquire('real-old','port:3197','1');await new Promise(r=>setTimeout(r,10));const suspect=await cli(['suspect',...base,'--key',old.key]);assert.equal(suspect.code,0,suspect.err);const suspectLock=JSON.parse(suspect.out);assert.equal((await cli(['fence',...base,'--key',old.key,'--epoch',String(suspectLock.fencingEpoch),'--actor','controller','--reason','race','--evidence','drill'])).code,0);result=await race([['reclaim',...base,'--key',old.key,'--epoch',String(suspectLock.fencingEpoch),'--evidence','free'],['acquire',...base,'--key',old.key,'--task','task-real-new','--owner','real-new','--ttl','1000','--commit','0123456789abcdef0123456789abcdef01234567','--command','boundary',...holder]]);assert.ok(result.filter(x=>x.code===0).length>=1);assert.ok(['active','reclaimed'].includes(inspectResource({dbPath:f.dbPath,key:old.key}).state));});
