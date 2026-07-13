import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {chmodSync,existsSync,mkdirSync,mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';

const source=new URL('./reference/chaotang-rollout-authority.mjs',import.meta.url).pathname;
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));

test('real authority socket lifecycle leaves no process or socket behind',async t=>{
  if(spawnSync('bwrap',['--version']).status!==0)return t.skip('bwrap unavailable');
  const root=mkdtempSync(join(tmpdir(),'s10-authority-process-')),varlib=join(root,'varlib'),runtime=join(root,'runtime'),state=join(varlib,'chaotang-rollout-authority'),run=join(runtime,'chaotang-rollout-authority'),socket=join(run,'authority.sock');mkdirSync(state,{recursive:true,mode:0o700});mkdirSync(run,{recursive:true,mode:0o750});chmodSync(state,0o700);chmodSync(run,0o750);
  const mountArgs=['--ro-bind','/','/','--bind',varlib,'/var/lib','--bind',runtime,'/run',source],init=spawnSync('bwrap',[...mountArgs,'--init'],{encoding:'utf8'});assert.equal(init.status,0,init.stderr);
  const staleLock=join(state,'.authority.lock');mkdirSync(staleLock,{mode:0o700});writeFileSync(join(staleLock,'owner'),JSON.stringify({pid:99999999,start_ticks:1,boot_id:readFileSync('/proc/sys/kernel/random/boot_id','utf8').trim()}),{mode:0o600});
  const server=spawn('bwrap',[...mountArgs,'--serve'],{stdio:['ignore','pipe','pipe']}),closed=new Promise(resolve=>server.once('close',resolve));let innerPid=null;
  t.after(async()=>{if(server.exitCode===null){try{const children=readFileSync(`/proc/${server.pid}/task/${server.pid}/children`,'utf8').trim().split(/\s+/).filter(Boolean);innerPid=Number(children[0]??0)||innerPid;if(innerPid)process.kill(innerPid,'SIGTERM');}catch{}await Promise.race([closed,wait(3000)]);if(server.exitCode===null)server.kill('SIGTERM');await Promise.race([closed,wait(3000)]);}assert.equal(existsSync(socket),false,'authority socket leaked after shutdown');if(innerPid)assert.equal(existsSync(`/proc/${innerPid}`),false,'authority child process leaked');rmSync(root,{recursive:true,force:true});});
  for(let i=0;i<100&&!existsSync(socket);i++)await wait(20);assert.equal(existsSync(socket),true,'authority socket did not start');
  const client=request=>spawnSync('bwrap',mountArgs,{input:`${JSON.stringify(request)}\n`,encoding:'utf8'}),policy=`sha256:${'a'.repeat(64)}`,digest=`sha256:${'b'.repeat(64)}`,head=client({action:'head',policy_digest:policy});assert.equal(head.status,0,head.stderr);assert.equal(JSON.parse(head.stdout).sequence,0);
  assert.equal(existsSync(staleLock),false,'dead PID/start/boot authority lock was not recovered');
  const appended=client({action:'append',sequence:1,digest,policy_digest:policy,stage:'observe',event:'rollout.started',payload:{stage:'observe'}});assert.equal(appended.status,0,appended.stderr);assert.equal(JSON.parse(appended.stdout).sequence,1);assert.equal(client({action:'verify',sequence:1,digest,policy_digest:policy,stage:'observe'}).status,0);assert.notEqual(client({action:'head',policy_digest:`sha256:${'c'.repeat(64)}`}).status,0);
  assert.notEqual(client({action:'append',sequence:2,digest:`sha256:${'e'.repeat(64)}`,policy_digest:policy,stage:'mandatory',event:'rollout.advanced',payload:{from:'observe',to:'mandatory'}}).status,0,'hash-consistent direct Mandatory jump must be rejected');
  assert.notEqual(client({action:'append',sequence:2,digest:`sha256:${'e'.repeat(64)}`,policy_digest:policy,stage:'observe',event:'rollout.acceptance',payload:{id:'A1',commit:'a'.repeat(40),artifact_digest:`sha256:${'f'.repeat(64)}`}}).status,0,'paired acceptance fact/event without authority receipt must be rejected');
  assert.notEqual(client({action:'append',sequence:2,digest:`sha256:${'e'.repeat(64)}`,policy_digest:policy,stage:'observe',event:'rollout.release',payload:{release_id:'release-forged',outcome:'ready',incident:false}}).status,0,'paired READY release fact/event without authority receipt must be rejected');
  const approve=request=>{const path=join(root,`${request.action}.json`);writeFileSync(path,JSON.stringify({ticket_id:`INC-S10-${request.action}`,request}),{mode:0o600});const result=spawnSync('bwrap',[...mountArgs,'--approve-operation',path],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);};
  for(const request of [{action:'manual-rollback',actor:'release-commander',reason:'verified incident rollback',from:'warn',to:'observe',sequence:1,digest},{action:'reconcile-pointer',actor:'release-commander',reason:'verified pointer recovery',state_wrapper:'s9-local',pointer_wrapper:'s10-local',sequence:1,digest}]){approve(request);assert.notEqual(client({...request,digest:`sha256:${'d'.repeat(64)}`}).status,0,'wrong binding must fail');assert.equal(client(request).status,0,'approved request must pass');assert.notEqual(client(request).status,0,'approval must be one-use');}
  const children=readFileSync(`/proc/${server.pid}/task/${server.pid}/children`,'utf8').trim().split(/\s+/).filter(Boolean);innerPid=Number(children[0]);assert.ok(innerPid>0);process.kill(innerPid,'SIGTERM');await Promise.race([closed,wait(3000)]);assert.notEqual(server.exitCode,null,'authority wrapper failed to exit after child shutdown');assert.equal(existsSync(socket),false);
});
