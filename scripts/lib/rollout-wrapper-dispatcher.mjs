import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {lstatSync,readFileSync,realpathSync} from 'node:fs';
import {isAbsolute,join,normalize,sep} from 'node:path';

import {resolveControlPlanePaths} from './control-plane-db.mjs';

const SHA=/^[0-9a-f]{40}$/;
const DIGEST=/^sha256:[0-9a-f]{64}$/;
const sha=value=>`sha256:${createHash('sha256').update(value).digest('hex')}`;

function safeRepositoryPath(path){
  if(typeof path!=='string'||!path||isAbsolute(path)||normalize(path)!==path||path.split(/[\\/]/).includes('..'))throw new Error('rollout wrapper artifact path invalid');
  return path;
}

export function loadPinnedRolloutWrapper({cwd=process.cwd(),commit,policy,version}){
  if(!SHA.test(commit??''))throw new Error('rollout wrapper requires a pinned Git commit');
  const descriptor=policy?.wrapper?.artifacts?.[version];
  if(!descriptor||!DIGEST.test(descriptor.digest??''))throw new Error('rollout wrapper artifact digest is not pinned by policy');
  const relative=safeRepositoryPath(descriptor.path),root=resolveControlPlanePaths(cwd).repositoryRoot,absolute=join(root,relative),resolvedRoot=`${realpathSync(root)}${sep}`;
  const stat=lstatSync(absolute);
  if(!stat.isFile()||stat.isSymbolicLink()||stat.uid!==process.getuid()||(stat.mode&0o022)!==0||!realpathSync(absolute).startsWith(resolvedRoot))throw new Error('rollout wrapper runtime material must be an owner-controlled regular repository file');
  let tracked;
  try{tracked=execFileSync('git',['show',`${commit}:${relative}`],{cwd:root,encoding:'utf8'});}catch{throw new Error('rollout wrapper must exist in its pinned clean Git object');}
  const working=readFileSync(absolute,'utf8');
  if(working!==tracked)throw new Error('rollout wrapper worktree differs from its pinned clean Git object');
  if(sha(tracked)!==descriptor.digest)throw new Error('rollout wrapper digest differs from pinned policy');

  const compiled={exports:{}};
  Function('module','exports',`${tracked}\n//# sourceURL=${relative}@${commit}`)(compiled,compiled.exports);
  const wrapper=compiled.exports;
  if(!Object.isFrozen(wrapper)||wrapper?.version!==version||typeof wrapper.decide!=='function')throw new Error('rollout wrapper module contract invalid');
  return wrapper;
}
