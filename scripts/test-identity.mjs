#!/usr/bin/env node
import {basename,join,relative,resolve,sep,isAbsolute} from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFile} from 'node:child_process';
import {chmodSync,existsSync,mkdirSync,readFileSync,realpathSync,rmSync,statSync,writeFileSync} from 'node:fs';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';
import {createTestIdentityManager,resolveTestIdentity} from './lib/test-identity-manager.mjs';
import {resolveControlPlanePaths} from './lib/control-plane-db.mjs';
import {loadIsolationTrust,verifyIsolationAttestation} from './lib/test-isolation-attestation.mjs';

const execFileAsync=promisify(execFile);
const value=(args,name,fallback)=>{const i=args.indexOf(`--${name}`);return i<0?fallback:args[i+1];};
const required=(name,input)=>{if(!input)throw new Error(`missing ${name}`);return input;};
const inside=(parent,child)=>{const rel=relative(parent,child);return rel===''||(!rel.startsWith(`..${sep}`)&&rel!=='..'&&!isAbsolute(rel));};
function testCrashWindow(name){if(process.env.NODE_ENV==='test'&&process.env.CHAOTANG_CONTROL_PLANE_TEST_ADAPTER==='1'&&process.env.CHAOTANG_TEST_IDENTITY_TEST_PAUSE===name){const marker=required('CHAOTANG_TEST_IDENTITY_TEST_MARKER',process.env.CHAOTANG_TEST_IDENTITY_TEST_MARKER);writeFileSync(marker,String(process.pid),{mode:0o600,flag:'wx'});const cell=new Int32Array(new SharedArrayBuffer(4));for(;;)Atomics.wait(cell,0,0,1000);}}

function config(args){
  const barrier=value(args,'barrier');while(barrier&&!existsSync(barrier))Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,10);
  const cwd=value(args,'cwd',process.cwd()),environment=process.env.CHAOTANG_TEST_IDENTITY_ENV??(process.env.CI?'ci':'local-test');
  if(environment!=='ci'&&environment!=='local-test')throw new Error('test identity profile must be ci or local-test');
  const paths=resolveControlPlanePaths(cwd);
  const stateOverride=process.env.CHAOTANG_TEST_IDENTITY_STATE;if(stateOverride&&!(process.env.NODE_ENV==='test'&&process.env.CHAOTANG_CONTROL_PLANE_TEST_ADAPTER==='1'))throw new Error('test identity state override requires explicit test adapter');
  return{cwd,environment,paths,manager(extra={}){return createTestIdentityManager({issuer:process.env.CHAOTANG_TEST_IDENTITY_ISSUER??'chaotang-ci-sidecar',audience:process.env.CHAOTANG_TEST_IDENTITY_AUDIENCE??'chaotang-e2e',scope:process.env.CHAOTANG_TEST_IDENTITY_SCOPE??'e2e:nonprivileged',environment,statePath:stateOverride??join(paths.runtimeDir,'test-identities.sqlite3'),maxSessions:Number(process.env.CHAOTANG_TEST_IDENTITY_QUOTA??64),...extra});}};
}

function secureDirectory(path,label){const real=realpathSync(path),st=statSync(real);if(!st.isDirectory()||(typeof process.getuid==='function'&&st.uid!==process.getuid())||(st.mode&0o077)!==0)throw new Error(`${label} directory must be owner-only`);return real;}
function secureCredentialPath(input,{paths},label,{mustExist=false}={}){
  const absolute=resolve(required(label,input));
  if(inside(paths.repositoryRoot,absolute)&&!inside(paths.gitCommonDir,absolute))throw new Error(`${label} must be outside the worktree`);
  const parent=secureDirectory(resolve(absolute,'..'),label);
  const canonicalTarget=join(parent,basename(absolute));
  if(inside(paths.repositoryRoot,canonicalTarget)&&!inside(paths.gitCommonDir,canonicalTarget))throw new Error(`${label} resolves inside the worktree`);
  if(mustExist){const real=realpathSync(absolute),st=statSync(real);if(!st.isFile()||(typeof process.getuid==='function'&&st.uid!==process.getuid())||(st.mode&0o077)!==0)throw new Error(`${label} must be an owner-only regular file`);if(realpathSync(resolve(real,'..'))!==parent)throw new Error(`${label} symlink is forbidden`);return real;}
  if(existsSync(absolute))throw new Error(`${label} already exists`);return absolute;
}
function ensureCredentialDir(paths){const dir=join(paths.runtimeDir,'test-identity-credentials');mkdirSync(dir,{recursive:true,mode:0o700});chmodSync(dir,0o700);secureDirectory(dir,'credential');return dir;}
function takeCredential(path,cfg){const secure=secureCredentialPath(path,cfg,'exchange credential',{mustExist:true}),token=readFileSync(secure,'utf8').trim();rmSync(secure);return required('exchange credential',token);}
function writeOnce(path,contents,cfg,label){const secure=secureCredentialPath(path,cfg,label);writeFileSync(secure,contents,{mode:0o600,flag:'wx'});chmodSync(secure,0o600);return secure;}

function isolation(cfg,{attestationPath=process.env.CHAOTANG_TEST_ISOLATION_ATTESTATION,apiUrl=process.env.CHAOTANG_TEST_API_URL,purpose='materialize'}={}){
  return verifyIsolationAttestation({attestationPath:required('CHAOTANG_TEST_ISOLATION_ATTESTATION',attestationPath),expectedApiUrl:required('CHAOTANG_TEST_API_URL',apiUrl).replace(/\/$/,''),expectedEnvironment:cfg.environment,cwd:cfg.cwd,purpose});
}
function persistAttestation(cfg,proof){const dir=join(cfg.paths.runtimeDir,'test-identity-attestations');mkdirSync(dir,{recursive:true,mode:0o700});chmodSync(dir,0o700);secureDirectory(dir,'attestation');const target=join(dir,`${proof.attestation_id}.json`),bytes=proof.verified_envelope_bytes;if(!Buffer.isBuffer(bytes))throw new Error('verified attestation bytes missing');try{writeFileSync(target,bytes,{mode:0o600,flag:'wx'});chmodSync(target,0o600);}catch(error){if(error.code!=='EEXIST'||!readFileSync(target).equals(bytes))throw new Error('attestation id content collision');}return target;}

async function runWithStdin(command,input){return await new Promise((resolvePromise,reject)=>{const child=execFile(command[0],command.slice(1),{timeout:30000,maxBuffer:1024*1024},(error,stdout)=>error?reject(new Error(`signed provision command failed (exit ${Number.isInteger(error.code)?error.code:'unknown'})`)):resolvePromise(stdout));child.stdin.on('error',()=>{});child.stdin.end(input);});}
async function provision(credentials,proof){if(!proof.provision_command)return false;await runWithStdin(proof.provision_command,JSON.stringify({username:credentials.username,password:credentials.password,email:credentials.email,tenant_slug:credentials.tenantId}));return true;}
export function assertBusinessTokenLifetime(token,isolationExpiresAt,nowMs=Date.now()){let payload;try{payload=JSON.parse(Buffer.from(String(token).split('.')[1],'base64url'));}catch{throw new Error('materialized business token has malformed expiry');}const tokenExpiry=Date.parse(payload.exp),latest=Math.min(nowMs+1800000,Date.parse(isolationExpiresAt));if(!Number.isFinite(tokenExpiry)||tokenExpiry<=nowMs||tokenExpiry>latest)throw new Error('materialized business token exceeds 30-minute isolation lifetime');return tokenExpiry;}
async function existingAuthFallback(credentials,proof){
  const base=proof.api_url.replace(/\/$/,''),provisioned=await provision(credentials,proof);
  if(!provisioned){const invite=required('CHAOTANG_TEST_INVITE_CODE',process.env.CHAOTANG_TEST_INVITE_CODE),register=await fetch(`${base}/api/auth/register`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username:credentials.username,password:credentials.password,email:credentials.email,invite_code:invite})});if(!register.ok)throw new Error(`existing registration contract failed (${register.status})`);}
  const login=await fetch(`${base}/api/auth/login`,{method:'POST',headers:{'content-type':'application/json','x-real-ip':`ci-${credentials.tenantId}`},body:JSON.stringify({username:credentials.username,password:credentials.password})});
  if(!login.ok)throw new Error(`existing login contract failed (${login.status})`);
  const body=await login.json();if(typeof body.token!=='string'||body.user?.role==='admin')throw new Error('existing login contract returned invalid/nonprivileged identity');
  const me=await fetch(`${base}/api/auth/me`,{headers:{authorization:`Bearer ${body.token}`}}),meBody=me.ok?await me.json():null;
  if(!me.ok||meBody?.authenticated!==true||meBody.user?.role==='admin')throw new Error('materialized business token failed /api/auth/me verification');
  const tenantId=meBody.user?.tenant_slug??body.tenant?.slug;
  if(provisioned&&tenantId!==credentials.tenantId)throw new Error('materialized business token tenant mismatch');
  assertBusinessTokenLifetime(body.token,proof.expires_at);
  return{token:body.token,tenantId,subject:meBody.user?.username??body.user?.username??credentials.username,revoke:async()=>{}};
}
async function executeDisposal(proof){
  await execFileAsync(proof.dispose_command[0],proof.dispose_command.slice(1),{timeout:30000,maxBuffer:1024*1024});
  if(existsSync(proof.database_path))throw new Error('isolation disposal did not remove database');
  try{await fetch(proof.api_url,{signal:AbortSignal.timeout(1000)});throw new Error('isolation disposal left API reachable');}catch(error){if(error.message==='isolation disposal left API reachable')throw error;}
}
async function materialize(cfg,args){
  const proof=isolation(cfg),trust=loadIsolationTrust({cwd:cfg.cwd}),manager=cfg.manager({verificationPublicKey:trust.publicKey}),attestationPath=persistAttestation(cfg,proof);
  const lifecycleId=await manager.beginLifecycle({proof,attestationPath});let sidecar,businessTokenPath;
  try{
    const credentialPath=process.env.CHAOTANG_TEST_IDENTITY_CREDENTIAL_FILE;
    if(credentialPath)sidecar=await manager.exchange(takeCredential(credentialPath,cfg),{environment:cfg.environment,lifecycleId});
    testCrashWindow('after-exchange');
    const business=await resolveTestIdentity({environment:cfg.environment,isolated:true,fallback:credentials=>existingAuthFallback(credentials,proof)});
    const requested=value(args,'business-token-file',process.env.CHAOTANG_TEST_BUSINESS_TOKEN_FILE),target=requested??join(ensureCredentialDir(cfg.paths),`business-${lifecycleId}.token`);
    const reservedPath=secureCredentialPath(target,cfg,'business token');await manager.updateLifecycle(lifecycleId,{businessTokenPath:reservedPath,businessTokenHash:createHash('sha256').update(business.authorizationToken).digest('hex'),tenantId:business.tenantId,subject:business.subject,state:'pending'});
    businessTokenPath=writeOnce(reservedPath,business.authorizationToken,cfg,'business token');
    testCrashWindow('after-token-write');
    await manager.updateLifecycle(lifecycleId,{sessionId:sidecar?.sessionId,tenantId:business.tenantId,subject:business.subject,state:'active'});
    return{lifecycleId,sessionId:sidecar?.sessionId??null,tenantId:business.tenantId,subject:business.subject,source:sidecar?'ci-sidecar-materialized':'existing-auth-contract',authorizationTokenFile:businessTokenPath,expiresAt:sidecar?.expiresAt??null,cleanupMode:'signed-isolation-disposal'};
  }catch(error){
    if(businessTokenPath)rmSync(businessTokenPath,{force:true});
    if(sidecar?.sessionId)await manager.revoke(sidecar.sessionId).catch(()=>{});
    await manager.updateLifecycle(lifecycleId,{sessionId:sidecar?.sessionId,state:'failed',error:error.message}).catch(()=>{});
    try{const record=(await manager.pendingLifecycles()).find(item=>item.lifecycleId===lifecycleId);if(record)await cleanupLifecycle(cfg,manager,record,proof);}catch(cleanupError){throw new Error(`${error.message}; transactional isolation cleanup failed: ${cleanupError.message}`);}
    throw error;
  }
}
function assertLifecycleBinding(proof,item){if(proof.attestation_id!==item.attestationId||proof.attestation_digest!==item.attestationDigest||proof.environment!==item.environment||proof.api_url!==item.apiUrl||proof.database_path!==item.databasePath)throw new Error('lifecycle attestation binding mismatch');}
async function cleanupLifecycle(cfg,manager,record,verifiedProof){const proof=verifiedProof??isolation(cfg,{attestationPath:record.attestationPath,apiUrl:record.apiUrl,purpose:'dispose'});assertLifecycleBinding(proof,record);if(record.state!=='isolation_disposing')await manager.updateLifecycle(record.lifecycleId,{state:'disposing'});if(record.businessTokenPath){rmSync(record.businessTokenPath,{force:true});if(existsSync(record.businessTokenPath))throw new Error('business token artifact removal failed');}if(record.businessTokenHash){if(!proof.revoke_command)throw new Error('signed business-token revoke command required');await runWithStdin(proof.revoke_command,JSON.stringify({token_sha256:record.businessTokenHash,tenant_id:record.tenantId,subject:record.subject,lifecycle_id:record.lifecycleId}));}const result=await manager.finishLifecycleAndClaimDisposal(record.lifecycleId);if(result.shouldDispose){testCrashWindow('after-disposal-claim');await executeDisposal(proof);await manager.markIsolationDisposed(result.databasePath,result.apiUrl);}return result;}
async function finalizeRecord(cfg,manager,record,{force=false}={}){if(!force)return cleanupLifecycle(cfg,manager,record);const proof=isolation(cfg,{attestationPath:record.attestationPath,apiUrl:record.apiUrl,purpose:'dispose'}),related=(await manager.pendingLifecycles()).filter(item=>item.databasePath===record.databasePath&&item.apiUrl===record.apiUrl);for(const item of related){const itemProof=isolation(cfg,{attestationPath:item.attestationPath,apiUrl:item.apiUrl,purpose:'dispose'});assertLifecycleBinding(itemProof,item);await manager.updateLifecycle(item.lifecycleId,{state:'disposing'});if(item.businessTokenPath){rmSync(item.businessTokenPath,{force:true});if(existsSync(item.businessTokenPath))throw new Error('business token artifact removal failed');}}await executeDisposal(proof);await manager.finishIsolation(proof.attestation_id);return{remaining:0,shouldDispose:true};}

export async function main(argv=process.argv.slice(2)){
  const[action,...args]=argv;if(args.includes('--token'))throw new Error('token argv is forbidden; use a 0600 credential file');const cfg=config(args),manager=cfg.manager();let output;
  if(action==='resolve')output=await materialize(cfg,args);
  else if(action==='finalize'||action==='dispose'){const id=required('--lifecycle',value(args,'lifecycle')),record=(await manager.pendingLifecycles()).find(item=>item.lifecycleId===id);if(!record)throw new Error('unknown or already disposed lifecycle');const result=await finalizeRecord(cfg,manager,record);output={status:'revoked',lifecycleId:id,isolationDisposed:Boolean(result.shouldDispose)};}
  else if(action==='finalize-all'){const pending=await manager.pendingLifecycles(),seen=new Set(),failures=[];for(const record of pending){const isolationKey=`${record.databasePath}\0${record.apiUrl}`;if(seen.has(isolationKey))continue;seen.add(isolationKey);try{await finalizeRecord(cfg,manager,record,{force:true});}catch(error){failures.push({lifecycleId:record.lifecycleId,error:error.message});}}if(failures.length)throw new Error(`finalize-all failed for ${failures.length} isolation(s): ${failures.map(item=>item.lifecycleId).join(',')}`);output={status:'disposed',isolations:seen.size,lifecycles:pending.length};}
  else if(action==='revoke'){await manager.revoke(required('--session',value(args,'session')));output={status:'revoked'};}
  else if(action==='list')output={sessions:await manager.list(),pendingLifecycles:await manager.pendingLifecycles()};
  else throw new Error('usage: test-identity.mjs resolve|finalize|finalize-all|revoke|list (issuance belongs to the external provisioner)');
  process.stdout.write(`${JSON.stringify(output)}\n`);return output;
}
if(import.meta.url===pathToFileURL(process.argv[1]??'').href)main().catch(error=>{process.stderr.write(`test identity command failed: ${error.message.replace(/[A-Za-z0-9_-]{24,}/g,'[REDACTED]')}\n`);process.exitCode=1;});
