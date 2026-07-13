import { readFileSync, readlinkSync, readdirSync, writeFileSync } from 'node:fs';
import { realpathSync } from 'node:fs';

export function captureProcessIdentity(pid,cwd,extra={}){const stat=readFileSync(`/proc/${pid}/stat`,'utf8'),tail=stat.slice(stat.lastIndexOf(')')+2).split(' ');return{schema_version:1,pid:Number(pid),pgid:Number(tail[2]),start_ticks:Number(tail[19]),cwd:realpathSync(cwd),recorded_at:new Date().toISOString(),...extra};}
export function processIdentityAlive(identity){try{const stat=readFileSync(`/proc/${identity.pid}/stat`,'utf8'),tail=stat.slice(stat.lastIndexOf(')')+2).split(' ');return Number(tail[2])===identity.pgid&&Number(tail[19])===identity.start_ticks&&readlinkSync(`/proc/${identity.pid}/cwd`)===identity.cwd;}catch{return false;}}
export function processGroupAlive(pgid){for(const pid of readdirSync('/proc')){if(!/^\d+$/.test(pid))continue;try{const stat=readFileSync(`/proc/${pid}/stat`,'utf8'),tail=stat.slice(stat.lastIndexOf(')')+2).split(' '),state=tail[0];if(Number(tail[2])===pgid&&state!=='Z')return true;}catch{}}return false;}
export function writeProcessIdentity(path,identity){writeFileSync(path,`${JSON.stringify(identity,null,2)}\n`,{mode:0o600});}
export function readProcessIdentity(path){return JSON.parse(readFileSync(path,'utf8'));}
