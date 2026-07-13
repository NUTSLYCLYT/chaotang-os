import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';
import os from 'node:os';
import {mkdtemp,readFile,rm} from 'node:fs/promises';

const run=promisify(execFile);
export type TestSession={authorizationToken:string;sessionId:string|null;tenantId:string;subject:string;source:'ci-sidecar-materialized'|'existing-auth-contract';cleanupMode:'signed-isolation-disposal';cleanup:()=>Promise<void>};

export async function acquireTestSession():Promise<TestSession>{
  const root=path.resolve(__dirname,'../..'),cli=path.join(root,'scripts','test-identity.mjs'),secretDir=await mkdtemp(path.join(os.tmpdir(),'chaotang-e2e-')),businessTokenFile=path.join(secretDir,'business.token');
  let record:any;
  try{const{stdout}=await run(process.execPath,[cli,'resolve','--cwd',root],{cwd:root,env:{...process.env,CHAOTANG_TEST_BUSINESS_TOKEN_FILE:businessTokenFile},maxBuffer:1024*1024});record=JSON.parse(stdout.trim());const authorizationToken=(await readFile(businessTokenFile,'utf8')).trim();
    if(!authorizationToken||!record.tenantId||!record.subject||record.authorizationToken)throw new Error('test identity manager returned an incomplete or unsafe session');
    return{...record,authorizationToken,cleanup:async()=>{await run(process.execPath,[cli,'finalize','--lifecycle',record.lifecycleId,'--cwd',root],{cwd:root,env:process.env,maxBuffer:1024*1024});}};
  }catch(error){try{await run(process.execPath,[cli,'finalize-all','--cwd',root],{cwd:root,env:process.env,maxBuffer:1024*1024});}catch{}throw error;
  }finally{await rm(secretDir,{recursive:true,force:true});}
}

export async function finalizeAllTestSessions():Promise<void>{
  const root=path.resolve(__dirname,'../..'),cli=path.join(root,'scripts','test-identity.mjs');
  await run(process.execPath,[cli,'finalize-all','--cwd',root],{cwd:root,env:process.env,maxBuffer:1024*1024});
}
