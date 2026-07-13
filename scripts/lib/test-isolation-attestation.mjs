import {createHash,verify} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFileSync,realpathSync,statSync} from 'node:fs';
import {dirname,isAbsolute,join,relative,resolve,sep} from 'node:path';
import {resolveControlPlanePaths} from './control-plane-db.mjs';
import {portSocketOwners} from './resource-lock.mjs';

const canonical=value=>value===null||typeof value!=='object'?JSON.stringify(value):Array.isArray(value)?`[${value.map(canonical).join(',')}]`:`{${Object.keys(value).sort().map(k=>`${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
const fail=reason=>new Error(`isolation attestation rejected: ${reason}`);
const loopback=url=>{try{return['127.0.0.1','localhost','::1'].includes(new URL(url).hostname);}catch{return false;}};
const sha256=value=>createHash('sha256').update(value).digest('hex');
const inside=(parent,child)=>{const rel=relative(parent,child);return rel===''||(!rel.startsWith(`..${sep}`)&&rel!=='..'&&!isAbsolute(rel));};

function protectedRegularFile(path,label){
  const st=statSync(path);
  if(!st.isFile())throw fail(`${label} must be a regular file`);
  if(typeof process.getuid==='function'&&st.uid!==process.getuid())throw fail(`${label} owner`);
  if((st.mode&0o022)!==0)throw fail(`${label} must not be group/other writable`);
  const parent=statSync(dirname(path));
  if(typeof process.getuid==='function'&&parent.uid!==process.getuid())throw fail(`${label} directory owner`);
  if((parent.mode&0o022)!==0)throw fail(`${label} directory must not be group/other writable`);
  return st;
}
function protectedDirectoryChain(start,stop,label){let current=realpathSync(start),root=realpathSync(stop);while(true){const st=statSync(current);if(!st.isDirectory()||(typeof process.getuid==='function'&&st.uid!==process.getuid())||(st.mode&0o022)!==0)throw fail(`${label} directory chain`);if(current===root)return;const parent=dirname(current);if(parent===current||!inside(root,current))throw fail(`${label} directory escapes trust store`);current=parent;}}

export function loadIsolationTrust({cwd=process.cwd()}={}){
  const paths=resolveControlPlanePaths(cwd);
  let manifestText;
  try{manifestText=execFileSync('git',['show','HEAD:.harness/manifest/project-harness.json'],{cwd:paths.repositoryRoot,encoding:'utf8'});}catch{throw fail('committed control-plane trust manifest required');}
  let manifest;try{manifest=JSON.parse(manifestText);}catch{throw fail('invalid committed control-plane manifest');}
  const trust=manifest?.controlPlane?.testIdentityTrust;
  if(trust?.status!=='PINNED'||!/^[-A-Za-z0-9_.]{8,128}$/.test(trust.keyId??'')||!/^[a-f0-9]{64}$/.test(trust.publicKeySha256??'')||typeof trust.runtimePublicKey!=='string')throw fail('control-plane trust root is not externally pinned');
  if(isAbsolute(trust.runtimePublicKey)||trust.runtimePublicKey.split(/[\\/]/).includes('..'))throw fail('unsafe trust-store path');
  const keyPath=resolve(paths.runtimeDir,trust.runtimePublicKey);
  if(!inside(paths.runtimeDir,keyPath)||(inside(paths.repositoryRoot,keyPath)&&!inside(paths.gitCommonDir,keyPath)))throw fail('trust key must be outside the worktree');
  protectedDirectoryChain(dirname(keyPath),paths.runtimeDir,'trust key');
  protectedRegularFile(keyPath,'trust key');
  const keyBytes=readFileSync(keyPath);
  if(sha256(keyBytes)!==trust.publicKeySha256)throw fail('trust key fingerprint');
  return Object.freeze({keyId:trust.keyId,keyPath,publicKey:keyBytes,paths});
}

export function verifyIsolationAttestation({attestationPath,expectedApiUrl,expectedEnvironment,cwd=process.cwd(),nowMs=Date.now(),purpose='materialize'}={}){
  if(!attestationPath)throw fail('signed attestation required');
  if(expectedEnvironment!=='ci'&&expectedEnvironment!=='local-test')throw fail('actual CLI environment');
  protectedRegularFile(attestationPath,'attestation');
  const trust=loadIsolationTrust({cwd});
  let envelope,envelopeBytes;try{envelopeBytes=readFileSync(attestationPath);envelope=JSON.parse(envelopeBytes);}catch{throw fail('unreadable envelope');}
  const payload=envelope?.payload,signature=envelope?.signature;
  if(!payload||typeof signature!=='string'||payload.key_id!==trust.keyId||!verify(null,Buffer.from(canonical(payload)),trust.publicKey,Buffer.from(signature,'base64')))throw fail('signature or key id');
  if(!/^[A-Za-z0-9_-]{16,128}$/.test(payload.attestation_id??''))throw fail('attestation id');
  if(payload.environment!==expectedEnvironment)throw fail('cross-environment attestation');
  if(!loopback(payload.api_url)||payload.api_url.replace(/\/$/,'')!==String(expectedApiUrl??'').replace(/\/$/,''))throw fail('API origin must be exact loopback');
  const port=Number(new URL(payload.api_url).port);if(!Number.isInteger(port)||port<1)throw fail('API port');
  const owners=portSocketOwners(port);if(owners.length!==1||owners[0].pid!==payload.server_pid||owners[0].start_ticks!==payload.server_start_ticks||owners[0].inode!==String(payload.socket_inode??'')){
    if(!(purpose==='dispose'&&owners.length===0))throw fail('signed API process identity');
  }
  const issued=Date.parse(payload.issued_at),expires=Date.parse(payload.expires_at);
  if(!Number.isFinite(issued)||!Number.isFinite(expires)||issued>nowMs+30000||expires<=issued||expires-issued>1800000)throw fail('lifetime');
  if(purpose==='materialize'&&expires<=nowMs)throw fail('expired');
  if(!Number.isInteger(payload.max_sessions)||payload.max_sessions<1||payload.max_sessions>50)throw fail('max sessions');
  if(!isAbsolute(payload.database_path))throw fail('database path');
  let databasePath;
  try{databasePath=realpathSync(payload.database_path);}catch(error){if(purpose!=='dispose')throw fail('database path');databasePath=resolve(payload.database_path);}
  if(inside(trust.paths.repositoryRoot,databasePath)&&!inside(trust.paths.gitCommonDir,databasePath))throw fail('database must be outside the worktree');
  if(!Array.isArray(payload.dispose_command)||payload.dispose_command.length<1||!isAbsolute(payload.dispose_command[0]))throw fail('signed absolute dispose command required');
  if(payload.provision_command!==undefined&&(!Array.isArray(payload.provision_command)||payload.provision_command.length<1||!isAbsolute(payload.provision_command[0])))throw fail('signed absolute provision command required');
  if(payload.max_sessions>1&&(!Array.isArray(payload.revoke_command)||payload.revoke_command.length<1||!isAbsolute(payload.revoke_command[0])))throw fail('shared isolation requires signed revoke command');
  try{const dbStat=statSync(databasePath);if(payload.database_fingerprint!==`${dbStat.dev}:${dbStat.ino}`)throw fail('database fingerprint');}catch(error){if(purpose!=='dispose'||error.message?.startsWith('isolation attestation rejected:'))throw error;}
  return Object.freeze({...payload,database_path:databasePath,attestation_digest:sha256(Buffer.from(canonical(payload))),verified_envelope_bytes:envelopeBytes});
}

export const canonicalIsolationPayload=canonical;
