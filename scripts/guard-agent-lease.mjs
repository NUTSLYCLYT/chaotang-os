#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { leaseStatus } from './harness-lease.mjs';
import { normalizeRepoPath } from './lib/control-plane-db.mjs';
import { createLeaseAttestationRequest } from './lib/lease-attestation.mjs';

const [command,...raw]=process.argv.slice(2),args=Object.fromEntries(raw.flatMap((v,i,a)=>v.startsWith('--')?[[v.slice(2),a[i+1]]]:[]));
try{
  if(command==='attest'){
    if(!process.env.HARNESS_LEASE_CREDENTIALS)throw new Error('HARNESS_LEASE_CREDENTIALS JSON is required and must not be written to the repository');
    const result=createLeaseAttestationRequest({commit:args.commit??'HEAD',taskId:args.task,credentials:JSON.parse(process.env.HARNESS_LEASE_CREDENTIALS)});
    console.log(JSON.stringify({commit:result.request.payload.commit,request_digest:result.request.request_digest,path:result.path},null,2));
  }else{
    if(!process.env.HARNESS_TASK_ID||!process.env.HARNESS_OWNER)throw new Error('HARNESS_TASK_ID and HARNESS_OWNER are required for scoped feedback');
    const paths=execFileSync('git',['diff','--cached','--name-only','--diff-filter=ACMRD'],{encoding:'utf8'}).trim().split('\n').filter(Boolean).map(p=>normalizeRepoPath(p));const leases=leaseStatus().filter(l=>l.task_id===process.env.HARNESS_TASK_ID&&l.holder===process.env.HARNESS_OWNER&&l.state==='active'&&l.resource_type==='path'&&l.mode==='write');const uncovered=paths.filter(p=>!leases.some(l=>p===l.resource||p.startsWith(`${l.resource}/`)));if(uncovered.length)throw new Error(`staged paths lack active write lease: ${uncovered.join(', ')}`);console.log(`lease feedback: ${paths.length} staged path(s) covered`);
  }
}catch(error){console.error(`${command==='attest'?'ATTESTATION':'LEASE FEEDBACK'} STOP: ${error.message}`);process.exitCode=1;}
