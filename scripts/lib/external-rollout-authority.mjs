import {execFileSync} from 'node:child_process';
import {closeSync, constants, fstatSync, lstatSync, openSync, readFileSync, realpathSync, statSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {dirname, isAbsolute} from 'node:path';

export function invokePinnedAuthority({command,digest,input}){
  if(!isAbsolute(command)||!/^sha256:[0-9a-f]{64}$/.test(digest??''))throw new Error('external rollout anchor command configuration invalid');
  if(lstatSync(command).isSymbolicLink())throw new Error('external rollout anchor command symlink forbidden');
  const resolved=realpathSync(command),owner=process.getuid(),stat=statSync(resolved);
  if(!stat.isFile()||![0,owner].includes(stat.uid)||(stat.mode&0o022)!==0)throw new Error('external rollout anchor command ownership/permissions invalid');
  for(let parent=dirname(resolved);parent!=='/';parent=dirname(parent)){const value=statSync(parent);if((value.mode&0o022)!==0)throw new Error('external rollout anchor parent directory is writable by group/world');}
  const fd=openSync(resolved,constants.O_RDONLY|constants.O_NOFOLLOW),actual=fstatSync(fd);try{if(actual.dev!==stat.dev||actual.ino!==stat.ino)throw new Error('external rollout anchor inode changed');const bytes=readFileSync(fd);if(`sha256:${createHash('sha256').update(bytes).digest('hex')}`!==digest)throw new Error('external rollout anchor command digest mismatch');const output=execFileSync('/proc/self/fd/3',[],{input,encoding:'utf8',env:{PATH:'/usr/bin:/bin',LANG:'C.UTF-8'},stdio:['pipe','pipe','pipe',fd]});return JSON.parse(output);}finally{closeSync(fd);}
}
