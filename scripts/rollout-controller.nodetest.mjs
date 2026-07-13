import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {chmodSync,copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {homedir,tmpdir} from 'node:os';
import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';

import {openControlPlaneDb,resolveControlPlanePaths} from './lib/control-plane-db.mjs';
import {openRolloutDb} from './lib/rollout-db.mjs';
import {invokePinnedAuthority} from './lib/external-rollout-authority.mjs';
import {createTask,finalizeTask,recordTaskStep} from './harness-task.mjs';
import {acquireLease} from './harness-lease.mjs';
import * as rolloutController from './lib/rollout-controller.mjs';
import {
  advanceRollout, collectProductionRelease, collectTaskMetric, evaluateRollout, guardRolloutIfStarted, guardRolloutOperation, inspectRollout,
  loadRolloutPolicy, recordAcceptance, recordProductionRelease, recordTaskMetric,
  startRollout, verifyAcceptance,
} from './lib/rollout-controller.mjs';

process.env.NODE_ENV='test';
process.env.CHAOTANG_CONTROL_PLANE_TEST_ADAPTER='1';
const DAY=86_400_000;
function fixture(){
  const root=mkdtempSync(join(tmpdir(),'s10-rollout-'));execFileSync('git',['init','-q'],{cwd:root});execFileSync('git',['config','user.email','s10@test'],{cwd:root});execFileSync('git',['config','user.name','S10'],{cwd:root});mkdirSync(join(root,'.harness','policy'),{recursive:true});mkdirSync(join(root,'scripts','lib','rollout-wrappers'),{recursive:true});
  const stablePath='scripts/lib/rollout-wrappers/stable-s9.cjs',candidatePath='scripts/lib/rollout-wrappers/candidate-s10.cjs';
  const stableSource="'use strict';\nmodule.exports=Object.freeze({version:'s9',decide:({stage,kind,compliant})=>Object.freeze({enforced:stage==='enforce_paths'&&kind==='path',warning:stage==='warn'&&!compliant})});\n";
  const candidateSource="'use strict';\nmodule.exports=Object.freeze({version:'s10',decide:({stage,compliant})=>Object.freeze({enforced:stage==='enforce_resources'||stage==='mandatory',warning:false&&!compliant})});\n";
  writeFileSync(join(root,stablePath),stableSource);writeFileSync(join(root,candidatePath),candidateSource);
  const digest=source=>`sha256:${createHash('sha256').update(source).digest('hex')}`;
  const policy={schema_version:1,policy_version:'s10-v1',stages:{observe:{minimum_ms:2*DAY},warn:{minimum_ms:2*DAY},enforce_paths:{minimum_ms:3*DAY},enforce_resources:{minimum_ms:3*DAY},mandatory:{minimum_ms:0}},thresholds:{minimum_window_tasks:20,duplicate_work_reduction:0.8,observation_conflicts:0,data_completeness:1,false_positive_warn:0.02,false_positive_rollback:0.05,path_false_positive_rollback:0.02,max_task_overhead_seconds:300,max_release_block_seconds:900,consecutive_releases:20},external:{integration_required_check:'required',release_trust_anchor:'required',rollout_anchor:'required',rollout_anchor_command:'/opt/test-rollout-authority',rollout_anchor_command_digest:`sha256:${'1'.repeat(64)}`},wrapper:{stable:'s9',candidate:'s10',artifacts:{s9:{path:stablePath,digest:digest(stableSource)},s10:{path:candidatePath,digest:digest(candidateSource)}}}};
  writeFileSync(join(root,'.harness','policy','control-plane-rollout.json'),`${JSON.stringify(policy,null,2)}\n`);execFileSync('git',['add','.'],{cwd:root});execFileSync('git',['commit','-qm','policy'],{cwd:root});
  const databasePath=join(root,'control.sqlite3'),rolloutDatabasePath=join(root,'rollout.sqlite3'),anchors=[];
  const options={cwd:root,databasePath,rolloutDatabasePath,testAdapter:true,policy,policyCommit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),externalAuthority:event=>{anchors.push(structuredClone(event));return{verified:true,sequence:event.sequence,digest:event.digest};}};
  return{root,databasePath,rolloutDatabasePath,policy,options,anchors};
}
const metric=(id,window,overrides={})=>({taskId:`task-${window}-${id}`,taskClass:'same-feature',window,totalSteps:10,duplicateSteps:window==='baseline'?5:0,pathConflicts:0,portConflicts:0,buildConflicts:0,falsePositive:false,overheadSeconds:30,dataComplete:true,...overrides});
function windows(f){for(let i=0;i<20;i++)recordTaskMetric(metric(i,'baseline'),f.options);for(let i=0;i<20;i++)recordTaskMetric(metric(i,'observation'),f.options);}
function acceptAll(f){for(let i=1;i<=12;i++)recordAcceptance({id:`A${i}`,commit:'a'.repeat(40),artifactDigest:`sha256:${String(i).padStart(64,'0')}`,passed:true},f.options);}
function advanceAt(f,to,nowMs,external={}){return advanceRollout({to,nowMs,external},f.options);}
function insertRawRolloutFact(f,kind,at){
  const opened=openRolloutDb(f.options),recordedAt=new Date(at).toISOString();
  try{
    if(kind==='task')opened.db.prepare('INSERT INTO rollout_task_metrics(task_id,task_class,window,total_steps,duplicate_steps,path_conflicts,port_conflicts,build_conflicts,false_positive,overhead_seconds,data_complete,source_audit_id,recorded_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').run('raw-task','same-feature','baseline',10,5,0,0,0,0,10,1,null,recordedAt);
    else if(kind==='release')opened.db.prepare('INSERT INTO rollout_release_metrics(release_id,commit_sha,profile,outcome,external_verified,incident,source_release_id,source_evidence_sequence,recorded_at) VALUES(?,?,?,?,?,?,?,?,?)').run('raw-release','a'.repeat(40),'production','ready',1,0,'raw-release',999,recordedAt);
    else if(kind==='acceptance')opened.db.prepare('INSERT INTO rollout_acceptance(acceptance_id,commit_sha,artifact_digest,passed,external_checkpoint,recorded_at) VALUES(?,?,?,?,?,?)').run('A1','a'.repeat(40),`sha256:${'1'.repeat(64)}`,1,JSON.stringify({verified:true,sequence:999,digest:`sha256:${'2'.repeat(64)}`}),recordedAt);
    else throw new Error(`unknown raw fact kind ${kind}`);
  }finally{opened.db.close();}
}
function insertFinalizedMetricAudit(f,{taskId,duplicateSteps,createdAt}){
  const opened=openControlPlaneDb(f.options),payload={taskClass:'same-feature',totalSteps:10,duplicateSteps,pathConflicts:0,portConflicts:0,buildConflicts:0,falsePositive:false,overheadSeconds:10,dataComplete:true};
  try{
    opened.db.prepare('INSERT INTO tasks(task_id,spec_json,owner,status,created_at,expires_at) VALUES(?,?,?,?,?,?)').run(taskId,'{}','worker','completed',createdAt,'2099-01-01T00:00:00.000Z');
    opened.db.prepare("INSERT INTO audit_events(event,actor,subject,payload_json,created_at) VALUES('task.metrics.finalized','worker',?,?,?)").run(taskId,JSON.stringify(payload),createdAt);
  }finally{opened.db.close();}
}

test('production policy starts from clean HEAD and later resolves the pinned commit across worktree drift',()=>{const f=fixture(),pinned=execFileSync('git',['rev-parse','HEAD'],{cwd:f.root,encoding:'utf8'}).trim();assert.equal(loadRolloutPolicy(f.root).policy_version,'s10-v1');writeFileSync(join(f.root,'.harness','policy','control-plane-rollout.json'),'{}\n');assert.throws(()=>loadRolloutPolicy(f.root),/clean committed Git object/);assert.equal(loadRolloutPolicy(f.root,pinned).policy_version,'s10-v1');execFileSync('git',['add','.'],{cwd:f.root});execFileSync('git',['commit','-qm','unrelated head drift'],{cwd:f.root});assert.notEqual(execFileSync('git',['rev-parse','HEAD'],{cwd:f.root,encoding:'utf8'}).trim(),pinned);assert.equal(loadRolloutPolicy(f.root,pinned).commit,pinned);});

test('fixed external authority executes a digest-pinned open inode and rejects tamper/symlink',()=>{const root=mkdtempSync(join(homedir(),'.s10-authority-')),command=join(root,'authority'),linked=join(root,'linked');try{chmodSync(root,0o700);writeFileSync(command,'#!/bin/sh\ncat >/dev/null\nprintf \'{"verified":true}\\n\'\n',{mode:0o500});const digest=`sha256:${createHash('sha256').update(readFileSync(command)).digest('hex')}`;assert.equal(invokePinnedAuthority({command,digest,input:'{}\n'}).verified,true);chmodSync(command,0o700);writeFileSync(command,'#!/bin/sh\nexit 1\n');chmodSync(command,0o500);assert.throws(()=>invokePinnedAuthority({command,digest,input:'{}\n'}),/digest mismatch/);symlinkSync(command,linked);assert.throws(()=>invokePinnedAuthority({command:linked,digest,input:'{}\n'}),/symlink/);}finally{rmSync(root,{recursive:true,force:true});}});

test('Observe records but never blocks and unknown history is not zero',()=>{const f=fixture(),at=Date.parse('2026-07-13T00:00:00Z');startRollout({nowMs:at},f.options);const decision=guardRolloutOperation({kind:'path',compliant:false,actor:'worker',subject:'x'},f.options);assert.equal(decision.allowed,true);const status=inspectRollout(f.options);assert.equal(status.stage,'observe');assert.equal(status.metrics.baseline.complete,false);assert.equal(evaluateRollout(f.options).eligible,false);});

test('pre-start status is read-only and does not create rollout storage',()=>{const f=fixture();assert.equal(inspectRollout(f.options).status,'NOT_STARTED');assert.equal(existsSync(f.rolloutDatabasePath),false);assert.equal(guardRolloutIfStarted({kind:'path',compliant:true,actor:'worker',subject:'docs/x'},f.options).status,'not_started');assert.equal(existsSync(f.rolloutDatabasePath),false);});

test('stage advancement rejects skipped stages, wall-clock rollback and insufficient real duration',()=>{const f=fixture(),at=Date.parse('2026-07-13T00:00:00Z');startRollout({nowMs:at},f.options);windows(f);assert.throws(()=>advanceAt(f,'enforce_paths',at+3*DAY),/next stage/);assert.throws(()=>advanceAt(f,'warn',at+DAY),/minimum/);assert.throws(()=>inspectRollout({...f.options,nowMs:at-1}),/clock rollback/);});

test('Warn needs complete comparable 20+20 windows and audits manual continue',()=>{const f=fixture(),at=Date.parse('2026-07-13T00:00:00Z');startRollout({nowMs:at},f.options);windows(f);advanceAt(f,'warn',at+2*DAY);assert.throws(()=>guardRolloutOperation({kind:'path',compliant:false,actor:'worker',subject:'x',nowMs:at+2*DAY},f.options),/manual continue/);assert.equal(guardRolloutOperation({kind:'path',compliant:false,actor:'worker',subject:'x',continue:{reason:'reviewed exception'},nowMs:at+2*DAY},f.options).allowed,true);const opened=openRolloutDb(f.options);try{assert.equal(JSON.parse(opened.db.prepare("SELECT payload_json FROM rollout_events WHERE event='rollout.guard' ORDER BY sequence DESC LIMIT 1").get().payload_json).continue_reason,'reviewed exception');}finally{opened.db.close();}});

test('metrics reject duplicate task IDs, incomplete data, conflicts, false positives and latency',()=>{const f=fixture(),at=Date.parse('2026-07-13T00:00:00Z');startRollout({nowMs:at},f.options);recordTaskMetric(metric(1,'baseline'),f.options);assert.throws(()=>recordTaskMetric(metric(1,'baseline'),f.options),/already recorded/);for(let i=2;i<=20;i++)recordTaskMetric(metric(i,'baseline'),f.options);for(let i=1;i<=20;i++)recordTaskMetric(metric(i,'observation',{dataComplete:i!==1,pathConflicts:i===2?1:0,falsePositive:i===3,overheadSeconds:i===4?301:30}),f.options);const e=evaluateRollout(f.options);assert.equal(e.eligible,false);assert.ok(e.failures.some(x=>/completeness/.test(x)));assert.ok(e.failures.some(x=>/conflict/.test(x)));assert.ok(e.failures.some(x=>/false positive/.test(x)));assert.ok(e.failures.some(x=>/overhead/.test(x)));});

test('path/resource enforcement is stage-specific and missing external gates fail closed',()=>{const f=fixture(),at=Date.parse('2026-07-13T00:00:00Z');startRollout({nowMs:at},f.options);windows(f);advanceAt(f,'warn',at+2*DAY);advanceAt(f,'enforce_paths',at+4*DAY,{integrationRequired:true});assert.throws(()=>guardRolloutOperation({kind:'path',compliant:false,actor:'x',subject:'p',nowMs:at+4*DAY},f.options),/blocked/);assert.equal(guardRolloutOperation({kind:'resource',compliant:false,actor:'x',subject:'r',nowMs:at+4*DAY},f.options).allowed,true);assert.throws(()=>advanceAt(f,'enforce_resources',at+7*DAY),/external.*trust/);});

test('blocked decisions remain audited while production direct facts and CLI time/external flags are rejected',()=>{const f=fixture(),at=Date.parse('2026-07-13T00:00:00Z');startRollout({nowMs:at},f.options);windows(f);advanceAt(f,'warn',at+2*DAY);advanceAt(f,'enforce_paths',at+4*DAY,{integrationRequired:true});assert.throws(()=>guardRolloutOperation({kind:'path',compliant:false,actor:'x',subject:'blocked',nowMs:at+4*DAY},f.options),/blocked/);let opened=openRolloutDb(f.options);try{const last=JSON.parse(opened.db.prepare("SELECT payload_json FROM rollout_events WHERE event='rollout.guard' ORDER BY sequence DESC LIMIT 1").get().payload_json);assert.equal(last.allowed,false);}finally{opened.db.close();}const production={cwd:f.root};assert.throws(()=>recordTaskMetric(metric(99,'baseline'),production),/direct metric input/);assert.throws(()=>recordProductionRelease({releaseId:'release-fake',status:'ready',profile:'production',externalVerified:true,incident:false,commit:'a'.repeat(40)},production),/direct input/);assert.throws(()=>recordAcceptance({id:'A1',commit:'a'.repeat(40),artifactDigest:`sha256:${'1'.repeat(64)}`,passed:true},production),/direct input/);assert.throws(()=>execFileSync(process.execPath,[join(process.cwd(),'scripts','rollout-control.mjs'),'advance','--to','warn','--now','1'],{cwd:f.root,env:{...process.env,NODE_ENV:'production'},stdio:'pipe'}),/Command failed/);});

test('threshold breaches automatically regress, freeze lease/lock state and preserve wrapper snapshot',()=>{const f=fixture(),at=Date.parse('2026-07-13T00:00:00Z');startRollout({nowMs:at},f.options);windows(f);advanceAt(f,'warn',at+2*DAY);for(let i=0;i<2;i++)guardRolloutOperation({kind:'path',compliant:true,actor:'x',subject:`ok-${i}`,nowMs:at+2*DAY},f.options);guardRolloutOperation({kind:'path',compliant:false,actor:'x',subject:'fp',continue:{reason:'false positive'},falsePositive:true,nowMs:at+2*DAY},f.options);const status=inspectRollout({...f.options,nowMs:at+2*DAY});assert.equal(status.stage,'observe');assert.equal(status.lastTransition.reason,'automatic threshold rollback');const opened=openRolloutDb(f.options);try{assert.ok(opened.db.prepare('SELECT count(*) n FROM rollout_snapshots').get().n>=1);}finally{opened.db.close();}});

test('release streak counts unique verified READY production releases only',()=>{const f=fixture(),at=Date.parse('2026-07-13T00:00:00Z');startRollout({nowMs:at},f.options);windows(f);advanceAt(f,'warn',at+2*DAY);recordProductionRelease({releaseId:'release-bad',status:'failed',profile:'production',externalVerified:true,incident:false,commit:'a'.repeat(40),nowMs:at+2*DAY},f.options);assert.throws(()=>recordProductionRelease({releaseId:'release-bad',status:'ready',profile:'production',externalVerified:true,incident:false,commit:'a'.repeat(40),nowMs:at+2*DAY},f.options),/already recorded/);for(let i=0;i<20;i++)recordProductionRelease({releaseId:`release-${i}`,status:'ready',profile:'production',externalVerified:true,incident:false,commit:'a'.repeat(40),nowMs:at+2*DAY},f.options);assert.equal(inspectRollout({...f.options,nowMs:at+2*DAY}).releaseStreak,20);recordProductionRelease({releaseId:'release-rolled',status:'rolled_back',profile:'production',externalVerified:true,incident:false,commit:'a'.repeat(40),nowMs:at+2*DAY},f.options);assert.equal(inspectRollout({...f.options,nowMs:at+2*DAY}).releaseStreak,0);});

test('authoritative collector refuses cherry-picking and records every failed/incident outcome in order',()=>{const f=fixture(),at=Date.parse('2026-07-13T00:00:00Z');startRollout({nowMs:at},f.options);const control=openControlPlaneDb(f.options),commit='a'.repeat(40);try{control.db.exec('CREATE TABLE IF NOT EXISTS release_evidence(sequence INTEGER PRIMARY KEY,release_id TEXT UNIQUE,record_json TEXT,record_hash TEXT)');control.db.prepare('INSERT INTO tasks(task_id,spec_json,owner,status,created_at,expires_at) VALUES(?,?,?,?,?,?)').run('task-sequence','{}','commander','completed',new Date(at).toISOString(),new Date(at+10*DAY).toISOString());for(const[index,status]of ['ready','failed','ready'].entries()){const id=`release-seq-${index}`,time=new Date(at+index+1).toISOString();control.db.prepare("INSERT INTO release_runs(release_id,task_id,commander,status,commit_sha,attestation_digest,checks_json,log_json,created_at,updated_at,phase,release_pending) VALUES(?,?,?,?,?,?,'[]','[]',?,?,?,0)").run(id,'task-sequence','commander',status,commit,`sha256:${'b'.repeat(64)}`,time,time,status==='ready'?'green':'red');if(status==='ready')control.db.prepare('INSERT INTO release_evidence(sequence,release_id,record_json,record_hash) VALUES(?,?,?,?)').run(index+1,id,JSON.stringify({status:'verified',profile:'production'}),'sha256:'+'c'.repeat(64));}control.db.prepare("INSERT INTO audit_events(event,actor,subject,payload_json,created_at) VALUES('release.incident','system','release-seq-2','{}',?)").run(new Date(at+4).toISOString());}finally{control.db.close();}assert.throws(()=>collectProductionRelease('release-seq-2',f.options),/sequence gap/);collectProductionRelease('release-seq-0',f.options);collectProductionRelease('release-seq-1',f.options);collectProductionRelease('release-seq-2',f.options);const rollout=openRolloutDb(f.options);try{const rows=rollout.db.prepare('SELECT release_id,outcome,incident FROM rollout_release_metrics ORDER BY rowid').all().map(row=>({...row}));assert.deepEqual(rows,[{release_id:'release-seq-0',outcome:'ready',incident:0},{release_id:'release-seq-1',outcome:'failed',incident:1},{release_id:'release-seq-2',outcome:'ready',incident:1}]);}finally{rollout.db.close();}});

test('Mandatory rejects fabricated acceptance, nonconsecutive releases and absent external trust',()=>{const f=fixture(),at=Date.parse('2026-07-13T00:00:00Z');startRollout({nowMs:at},f.options);windows(f);advanceAt(f,'warn',at+2*DAY);advanceAt(f,'enforce_paths',at+4*DAY,{integrationRequired:true});assert.throws(()=>recordAcceptance({id:'A1',commit:'bad',artifactDigest:'x',passed:true},f.options),/acceptance/);acceptAll(f);assert.equal(inspectRollout({...f.options,nowMs:at+4*DAY}).acceptance.passed,12);assert.equal(inspectRollout({...f.options,nowMs:at+4*DAY}).status,'ROLLOUT');});

test('acceptance producer runs only the fixed verifier plan and emits authoritative audit',()=>{const f=fixture(),calls=[];const result=verifyAcceptance('A1',{...f.options,acceptanceRunner:step=>{calls.push(step);return{status:0,stdout:'ok',stderr:''};}});assert.equal(result.id,'A1');assert.equal(result.passed,true);assert.ok(calls.length>=1);assert.throws(()=>verifyAcceptance('A13',{...f.options,acceptanceRunner:()=>({status:0})}),/acceptance ID/);const control=openControlPlaneDb(f.options);try{const audit=control.db.prepare("SELECT subject,payload_json FROM audit_events WHERE event='verification.acceptance'").get();assert.equal(audit.subject,'A1');const payload=JSON.parse(audit.payload_json);assert.equal(payload.passed,true);assert.equal(payload.commit,execFileSync('git',['rev-parse','HEAD'],{cwd:f.root,encoding:'utf8'}).trim());assert.match(payload.artifact_digest,/^sha256:[0-9a-f]{64}$/);assert.ok(Array.isArray(payload.steps));assert.equal(payload.steps[0].command,calls[0].command);}finally{control.db.close();}});

test('task producer derives finalized metrics from registered task audit instead of caller numbers',()=>{const f=fixture(),at=Date.now()+DAY;createTask({task_id:'task-authoritative',title:'authoritative',owner:'worker',risk:'low',write_paths:['docs/task.md'],read_paths:[],dependencies:[],worktree:'wt',resources:[],expires_at:'2099-01-01T00:00:00.000Z',metadata:{rollout_class:'same-feature',rollout_steps:['step-1']}},f.options);const control=openControlPlaneDb(f.options);try{control.db.prepare("UPDATE tasks SET status='running' WHERE task_id='task-authoritative'").run();control.db.prepare("INSERT INTO audit_events(event,actor,subject,payload_json,created_at) VALUES('path.conflict','worker','task-authoritative','{}',?)").run(new Date(at-DAY).toISOString());}finally{control.db.close();}assert.throws(()=>recordTaskStep('task-authoritative','worker','step-1','completed',{cwd:f.root,databasePath:f.databasePath}),/live lease credential/);recordTaskStep('task-authoritative','worker','step-1','completed',f.options);const completed=finalizeTask('task-authoritative','worker',f.options);assert.equal(completed.metric.pathConflicts,1);assert.equal(completed.metric.totalSteps,1);startRollout({nowMs:at},f.options);const collected=collectTaskMetric('task-authoritative',f.options);assert.equal(collected.recorded,true);const rollout=openRolloutDb(f.options);try{const metric=rollout.db.prepare("SELECT task_class,total_steps,path_conflicts,source_audit_id FROM rollout_task_metrics WHERE task_id='task-authoritative'").get();assert.equal(metric.task_class,'same-feature');assert.equal(metric.total_steps,1);assert.equal(metric.path_conflicts,1);assert.ok(metric.source_audit_id>0);}finally{rollout.db.close();}});

test('copied old database is rejected by external monotonic anchor',()=>{const f=fixture(),at=Date.parse('2026-07-13T00:00:00Z');startRollout({nowMs:at},f.options);const old=join(f.root,'old.sqlite3');let db=openRolloutDb(f.options);db.db.exec('PRAGMA wal_checkpoint(TRUNCATE)');db.db.close();copyFileSync(f.rolloutDatabasePath,old);recordTaskMetric(metric(1,'baseline'),f.options);copyFileSync(old,f.rolloutDatabasePath);const latest=f.anchors.at(-1);const options={...f.options,externalAuthority:event=>{if(event.sequence<latest.sequence)throw new Error('external anchor rollback detected');return{verified:true};}};assert.throws(()=>inspectRollout(options),/external anchor rollback/);});

test('separate rollout schema upgrades v0 to v1 while the stable control DB remains v8-readable',()=>{const f=fixture();let control=openControlPlaneDb(f.options);assert.equal(control.db.prepare('PRAGMA user_version').get().user_version,8);control.db.close();const v0=join(f.root,'rollout-v0.sqlite3'),raw=new DatabaseSync(v0);raw.exec('PRAGMA user_version=0');raw.close();const old=join(f.root,'rollout-v0-copy.sqlite3');copyFileSync(v0,old);const upgraded=openRolloutDb({...f.options,rolloutDatabasePath:v0});assert.equal(upgraded.db.prepare('PRAGMA user_version').get().user_version,1);upgraded.db.close();const oldDb=new DatabaseSync(old,{readOnly:true});try{assert.equal(oldDb.prepare('PRAGMA user_version').get().user_version,0);}finally{oldDb.close();}});

test('raw INSERT task, release, or acceptance facts are rejected by status, evaluation, and advancement',async t=>{
  const at=Date.parse('2026-07-13T00:00:00Z');
  for(const kind of ['task','release','acceptance'])for(const operation of ['status','evaluate','advance'])await t.test(`${operation} rejects raw ${kind}`,()=>{
    const f=fixture();startRollout({nowMs:at},f.options);
    if(operation==='advance')windows(f);
    insertRawRolloutFact(f,kind,at+1);
    const run=operation==='status'?()=>inspectRollout(f.options):operation==='evaluate'?()=>evaluateRollout(f.options):()=>advanceAt(f,'warn',at+2*DAY);
    assert.throws(run,/authoritative|ledger|checkpoint|provenance|source|facts.event completeness/i);
  });
});

test('an activation pointer without its rollout database makes the core guard fail closed',()=>{
  const f=fixture(),at=Date.parse('2026-07-13T00:00:00Z');startRollout({nowMs:at},f.options);
  const pointer=join(resolveControlPlanePaths(f.root).runtimeDir,'rollout-wrapper-pointer.json');
  assert.equal(JSON.parse(readFileSync(pointer,'utf8')).version,f.policy.wrapper.stable);
  rmSync(f.rolloutDatabasePath,{force:true});rmSync(`${f.rolloutDatabasePath}-wal`,{force:true});rmSync(`${f.rolloutDatabasePath}-shm`,{force:true});
  assert.throws(()=>guardRolloutIfStarted({kind:'path',compliant:true,actor:'worker',subject:'docs/x'},f.options),/activation|database|state|fail.closed/i);
});

test('zero-duplicate baseline is unknown, never eligible for an 80 percent reduction claim',()=>{
  const f=fixture(),at=Date.parse('2026-07-13T00:00:00Z');startRollout({nowMs:at},f.options);
  for(let i=0;i<20;i++)recordTaskMetric(metric(i,'baseline',{duplicateSteps:0}),f.options);
  for(let i=0;i<20;i++)recordTaskMetric(metric(i,'observation',{duplicateSteps:0}),f.options);
  const result=evaluateRollout(f.options);assert.equal(result.eligible,false);assert.ok(result.failures.some(failure=>/baseline.*unknown|baseline.*non.zero|cannot.*reduction/i.test(failure)));
});

test('baseline classification requires finalized task audit evidence from before rollout activation',()=>{
  const f=fixture(),at=Date.parse('2026-07-13T00:00:00Z');
  for(let i=0;i<20;i++)insertFinalizedMetricAudit(f,{taskId:`pre-activation-${i}`,duplicateSteps:5,createdAt:new Date(at-i-1).toISOString()});
  startRollout({nowMs:at},f.options);
  for(let i=0;i<20;i++)collectTaskMetric(`pre-activation-${i}`,f.options);
  insertFinalizedMetricAudit(f,{taskId:'post-activation',duplicateSteps:0,createdAt:new Date(at+1).toISOString()});collectTaskMetric('post-activation',f.options);
  const opened=openRolloutDb(f.options);try{assert.equal(opened.db.prepare("SELECT count(*) n FROM rollout_task_metrics WHERE window='baseline'").get().n,20);assert.equal(opened.db.prepare("SELECT window FROM rollout_task_metrics WHERE task_id='post-activation'").get().window,'observation');}finally{opened.db.close();}
});

test('A11 and A12 never accept an injected runner, and a dirty verifier worktree is rejected',()=>{
  for(const id of ['A11','A12']){const f=fixture();assert.throws(()=>verifyAcceptance(id,{cwd:f.root,acceptanceRunner:()=>({status:0,stdout:'',stderr:''})}),/runner.*test.only|injection/i);}
  const f=fixture(),tracked=join(f.root,'tracked-verifier-input.txt');writeFileSync(tracked,'clean\n');execFileSync('git',['add','tracked-verifier-input.txt'],{cwd:f.root});execFileSync('git',['commit','-qm','add verifier input'],{cwd:f.root});writeFileSync(tracked,'dirty\n');
  assert.throws(()=>verifyAcceptance('A1',{cwd:f.root}),/dirty|clean.*worktree|tracked.*change/i);
});

test('Observe keeps guards available during external authority outage but blocks promotion',()=>{
  const f=fixture(),at=Date.parse('2026-07-13T00:00:00Z');startRollout({nowMs:at},f.options);windows(f);
  const outage={...f.options,externalAuthority:()=>{throw new Error('authority outage');}};
  assert.equal(guardRolloutOperation({kind:'path',compliant:true,actor:'worker',subject:'docs/x',nowMs:at+DAY},outage).allowed,true);
  assert.throws(()=>advanceRollout({to:'warn',nowMs:at+2*DAY},outage),/authority|external|outage/i);
});

test('authoritative audit telemetry, not caller booleans, drives automatic rollback',()=>{const f=fixture(),at=Date.parse('2026-07-13T00:00:00Z');startRollout({nowMs:at},f.options);windows(f);advanceAt(f,'warn',at+2*DAY);const control=openControlPlaneDb(f.options);try{control.db.prepare("INSERT INTO audit_events(event,actor,subject,payload_json,created_at) VALUES('control.false_positive_confirmed','reviewer','task-fp',?,?)").run(JSON.stringify({severity:'P1'}),new Date(at+2*DAY).toISOString());}finally{control.db.close();}const result=guardRolloutOperation({kind:'path',compliant:true,actor:'worker',subject:'docs/x',nowMs:at+2*DAY},f.options);assert.equal(result.stage,'observe');const rollout=openRolloutDb(f.options);try{const telemetry=rollout.db.prepare("SELECT payload_json FROM rollout_events WHERE event='rollout.telemetry'").get();assert.equal(JSON.parse(telemetry.payload_json).source_event,'control.false_positive_confirmed');}finally{rollout.db.close();}});

test('release created before activation but finished after it is collected and prior failed-resume history marks incident',()=>{const f=fixture(),at=Date.parse('2026-07-13T00:00:00Z'),commit='a'.repeat(40);startRollout({nowMs:at},f.options);const control=openControlPlaneDb(f.options);try{control.db.exec('CREATE TABLE IF NOT EXISTS release_evidence(sequence INTEGER PRIMARY KEY,release_id TEXT UNIQUE,record_json TEXT,record_hash TEXT)');control.db.prepare('INSERT INTO tasks(task_id,spec_json,owner,status,created_at,expires_at) VALUES(?,?,?,?,?,?)').run('task-history','{}','commander','completed',new Date(at-DAY).toISOString(),new Date(at+10*DAY).toISOString());control.db.prepare("INSERT INTO release_runs(release_id,task_id,commander,status,commit_sha,attestation_digest,checks_json,log_json,created_at,updated_at,phase,release_pending) VALUES('release-history','task-history','commander','ready',?,?,'[]','[]',?,?,'released',0)").run(commit,`sha256:${'b'.repeat(64)}`,new Date(at-DAY).toISOString(),new Date(at+1).toISOString());control.db.prepare("INSERT INTO audit_events(event,actor,subject,payload_json,created_at) VALUES('release.failed','commander','release-history','{}',?),('release.resumed','commander','release-history','{}',?)").run(new Date(at).toISOString(),new Date(at+1).toISOString());control.db.prepare("INSERT INTO release_evidence(sequence,release_id,record_json,record_hash) VALUES(1,'release-history',?,?)").run(JSON.stringify({status:'verified',profile:'production'}),`sha256:${'c'.repeat(64)}`);}finally{control.db.close();}collectProductionRelease('release-history',f.options);const rollout=openRolloutDb(f.options);try{const row=rollout.db.prepare("SELECT outcome,incident FROM rollout_release_metrics WHERE release_id='release-history'").get();assert.deepEqual({...row},{outcome:'ready',incident:1});}finally{rollout.db.close();}});

test('pointer/database mismatch fails closed and explicit reconciliation restores the proven state',()=>{
  const f=fixture(),at=Date.parse('2026-07-13T00:00:00Z');startRollout({nowMs:at},f.options);
  const pointerPath=join(resolveControlPlanePaths(f.root).runtimeDir,'rollout-wrapper-pointer.json'),pointer=JSON.parse(readFileSync(pointerPath,'utf8'));
  writeFileSync(pointerPath,`${JSON.stringify({...pointer,version:f.policy.wrapper.candidate,generation:pointer.generation+1},null,2)}\n`,{mode:0o600});
  assert.throws(()=>inspectRollout(f.options),/pointer.*differs|mismatch/i);
  assert.equal(typeof rolloutController.reconcileRolloutState,'function','reconcileRolloutState API must exist before rollout activation');
  const result=rolloutController.reconcileRolloutState({actor:'release-commander',reason:'recover pointer-before-DB commit',expectedStateWrapper:f.policy.wrapper.stable,expectedPointerWrapper:f.policy.wrapper.candidate},f.options);
  assert.equal(result.reconciled,true);assert.equal(inspectRollout(f.options).wrapperVersion,f.policy.wrapper.stable);
});

test('pending local checkpoints replay in order and a divergent authority head fails closed',()=>{
  const f=fixture(),at=Date.parse('2026-07-13T00:00:00Z');startRollout({nowMs:at},f.options);recordTaskMetric(metric(1,'baseline'),f.options);
  const accepted=[],head={sequence:0,digest:`sha256:${'0'.repeat(64)}`};
  const authority=request=>{
    if(request.action==='head')return{verified:true,...head};
    if(request.action==='append'){assert.equal(request.sequence,head.sequence+1);head.sequence=request.sequence;head.digest=request.digest;accepted.push(request.sequence);return{verified:true,...head};}
    if(request.action==='verify'){assert.equal(request.sequence,head.sequence);assert.equal(request.digest,head.digest);return{verified:true,...head};}
    throw new Error(`unexpected authority action ${request.action}`);
  };
  const status=inspectRollout({...f.options,replayAuthority:true,externalAuthority:authority});
  assert.equal(status.external,'VERIFIED');assert.deepEqual(accepted,[1,2]);
  assert.throws(()=>inspectRollout({...f.options,replayAuthority:true,externalAuthority:request=>request.action==='head'?{verified:true,sequence:1,digest:`sha256:${'f'.repeat(64)}`} : authority(request)}),/diverges/i);
});

test('a failed local commit never advances authority and the next committed checkpoint replays safely',()=>{
  const f=fixture(),at=Date.parse('2026-07-13T00:00:00Z'),accepted=[],head={sequence:0,digest:`sha256:${'0'.repeat(64)}`};
  const authority=request=>{
    if(request.action==='head')return{verified:true,...head};
    if(request.action==='append'){head.sequence=request.sequence;head.digest=request.digest;accepted.push(request.sequence);return{verified:true,...head};}
    if(request.action==='verify')return{verified:true,...head};
    throw new Error(`unexpected authority action ${request.action}`);
  };
  const options={...f.options,replayAuthority:true,externalAuthority:authority,beforeRolloutCommit:()=>{throw new Error('simulated local commit failure');}};
  assert.throws(()=>startRollout({nowMs:at},options),/simulated local commit failure/);
  assert.equal(head.sequence,0);assert.deepEqual(accepted,[]);
  assert.equal(inspectRollout(f.options).status,'NOT_STARTED');
  startRollout({nowMs:at},{...f.options,replayAuthority:true,externalAuthority:authority});
  assert.equal(head.sequence,1);assert.deepEqual(accepted,[1]);
  assert.equal(inspectRollout({...f.options,replayAuthority:true,externalAuthority:authority}).external,'VERIFIED');
});

test('stage and stage-start time are derived from the immutable ledger, not mutable rollout_state',()=>{
  const f=fixture(),at=Date.parse('2026-07-13T00:00:00Z');startRollout({nowMs:at},f.options);
  const opened=openRolloutDb(f.options);try{opened.db.prepare("UPDATE rollout_state SET stage_started_at='2000-01-01T00:00:00.000Z'").run();}finally{opened.db.close();}
  assert.throws(()=>inspectRollout(f.options),/stage.time.*immutable ledger/i);
});

test('stable and candidate pointer versions dispatch different enforcement wrappers',()=>{
  const f=fixture(),at=Date.parse('2026-07-13T00:00:00Z');startRollout({nowMs:at},f.options);windows(f);
  advanceAt(f,'warn',at+2*DAY);advanceAt(f,'enforce_paths',at+4*DAY,{integrationRequired:true});advanceAt(f,'enforce_resources',at+7*DAY,{releaseTrust:true,recoveryPassed:true,rolloutAnchor:true});
  assert.equal(inspectRollout({...f.options,nowMs:at+7*DAY}).wrapperVersion,f.policy.wrapper.candidate);
  assert.throws(()=>guardRolloutIfStarted({kind:'resource',compliant:false,actor:'worker',subject:'port:8081',nowMs:at+7*DAY},f.options),/blocked/);
  rolloutController.rollbackRolloutStage({actor:'release-commander',reason:'verified candidate rollback'},{...f.options,nowMs:at+8*DAY});
  assert.equal(inspectRollout({...f.options,nowMs:at+8*DAY}).wrapperVersion,f.policy.wrapper.stable);
  assert.equal(guardRolloutIfStarted({kind:'resource',compliant:false,actor:'worker',subject:'port:8081',nowMs:at+8*DAY},f.options).allowed,true);
});

test('wrapper module worktree tamper fails closed before guard execution',()=>{
  const f=fixture(),at=Date.parse('2026-07-13T00:00:00Z');startRollout({nowMs:at},f.options);
  const stable=f.policy.wrapper.artifacts[f.policy.wrapper.stable];
  writeFileSync(join(f.root,stable.path),"'use strict';\nmodule.exports={version:'s9',decide:()=>({enforced:false,warning:false})};\n");
  assert.throws(()=>guardRolloutIfStarted({kind:'path',compliant:true,actor:'worker',subject:'docs/x',nowMs:at+1},f.options),/wrapper.*(?:Git object|digest|tamper|clean)/i);
});

test('owner-only pointer is cryptographically bound to the selected wrapper artifact',()=>{
  const f=fixture(),at=Date.parse('2026-07-13T00:00:00Z');startRollout({nowMs:at},f.options);
  const pointerPath=join(resolveControlPlanePaths(f.root).runtimeDir,'rollout-wrapper-pointer.json'),pointer=JSON.parse(readFileSync(pointerPath,'utf8'));
  writeFileSync(pointerPath,`${JSON.stringify({...pointer,artifact_digest:`sha256:${'f'.repeat(64)}`},null,2)}\n`,{mode:0o600});
  assert.throws(()=>guardRolloutIfStarted({kind:'path',compliant:true,actor:'worker',subject:'docs/x',nowMs:at+1},f.options),/pointer.*(?:artifact|digest|mismatch|invalid)/i);
});

test('production task-step evidence requires a live nonce- and fencing-bound lease',()=>{
  const f=fixture();createTask({task_id:'task-step-lease',title:'step lease',owner:'worker',risk:'low',write_paths:['docs/task.md'],read_paths:[],dependencies:[],worktree:'.',resources:[],expires_at:'2099-01-01T00:00:00.000Z',metadata:{rollout_class:'same-feature',rollout_steps:['step-real']}},f.options);
  const lease=acquireLease({task_id:'task-step-lease',owner:'worker',resource:'docs/task.md',holder_process:{pid:process.pid,cwd:process.cwd()}},f.options),base={cwd:f.root,databasePath:f.databasePath};
  assert.throws(()=>recordTaskStep('task-step-lease','worker','step-real','completed',{...base,leaseCredential:{lease_id:lease.lease_id,fencing_epoch:lease.fencing_epoch+1,nonce:lease.process.nonce}}),/invalid|expired/);
  assert.throws(()=>recordTaskStep('task-step-lease','worker','step-real','completed',{...base,leaseCredential:{lease_id:lease.lease_id,fencing_epoch:lease.fencing_epoch,nonce:'wrong-nonce'}}),/not live/);
  const opened=openControlPlaneDb(f.options);let original;try{original=opened.db.prepare('SELECT process_json FROM leases WHERE lease_id=?').get(lease.lease_id).process_json;const dead={...JSON.parse(original),pid:99999999,pgid:99999999};opened.db.prepare('UPDATE leases SET process_json=? WHERE lease_id=?').run(JSON.stringify(dead),lease.lease_id);}finally{opened.db.close();}
  assert.throws(()=>recordTaskStep('task-step-lease','worker','step-real','completed',{...base,leaseCredential:{lease_id:lease.lease_id,fencing_epoch:lease.fencing_epoch,nonce:lease.process.nonce}}),/not live/);
  const restore=openControlPlaneDb(f.options);try{restore.db.prepare('UPDATE leases SET process_json=? WHERE lease_id=?').run(original,lease.lease_id);}finally{restore.db.close();}
  assert.equal(recordTaskStep('task-step-lease','worker','step-real','completed',{...base,leaseCredential:{lease_id:lease.lease_id,fencing_epoch:lease.fencing_epoch,nonce:lease.process.nonce}}).outcome,'completed');
});

test('detached acceptance verifier scrubs hostile env and never links mutable dependencies',()=>{
  const f=fixture();mkdirSync(join(f.root,'scripts'),{recursive:true});writeFileSync(join(f.root,'scripts','resource-lock.nodetest.mjs'),"import test from 'node:test';import assert from 'node:assert/strict';import {existsSync,lstatSync} from 'node:fs';test('isolated',()=>{assert.equal(process.env.NODE_OPTIONS,undefined);assert.equal(process.env.NODE_PATH,undefined);assert.equal(process.env.CHAOTANG_TEST_COMMANDER_BYPASS,undefined);assert.equal(existsSync('node_modules')&&lstatSync('node_modules').isSymbolicLink(),false);});\n");execFileSync('git',['add','scripts/resource-lock.nodetest.mjs'],{cwd:f.root});execFileSync('git',['commit','-qm','isolated verifier fixture'],{cwd:f.root});
  const attacker=mkdtempSync(join(tmpdir(),'s10-attacker-bin-'));writeFileSync(join(attacker,'node'),'#!/bin/sh\nexit 0\n',{mode:0o755});const previous={PATH:process.env.PATH,NODE_OPTIONS:process.env.NODE_OPTIONS,NODE_PATH:process.env.NODE_PATH,CHAOTANG_TEST_COMMANDER_BYPASS:process.env.CHAOTANG_TEST_COMMANDER_BYPASS};process.env.PATH=`${attacker}:${process.env.PATH}`;process.env.NODE_OPTIONS='--trace-warnings';process.env.NODE_PATH='/tmp/attacker';process.env.CHAOTANG_TEST_COMMANDER_BYPASS='1';
  try{assert.equal(verifyAcceptance('A2',{cwd:f.root}).passed,true);}finally{for(const[key,value]of Object.entries(previous))if(value===undefined)delete process.env[key];else process.env[key]=value;rmSync(attacker,{recursive:true,force:true});}
  const calls=[];verifyAcceptance('A9',{...f.options,acceptanceRunner:step=>{calls.push(step);return{status:0,stdout:'ok',stderr:''};}});const install=calls.findIndex(step=>step.args.includes('install')),build=calls.findIndex(step=>step.args.includes('build'));assert.ok(install>=0&&install<build);assert.ok(calls[install].args.includes('--offline')&&calls[install].args.includes('--frozen-lockfile'));
});
