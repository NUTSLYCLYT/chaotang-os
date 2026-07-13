#!/usr/bin/env node
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';

const root=execFileSync('git',['rev-parse','--show-toplevel'],{encoding:'utf8'}).trim();
const files=execFileSync('git',['ls-files','-z','scripts','frontend/scripts','backend/scripts'],{cwd:root,encoding:'buffer'}).toString().split('\0').filter(path=>path&&!/(?:node)?test|fixtures?\//i.test(path)&&/\.(?:mjs|js|ts|py|sh)$/.test(path));
const forbidden=[/\b(?:pkill|killall)\b/,/\bkill\s+-9\s+[^-\d]/,/\b(?:pgrep|pidof)\b.*\bkill\b/];
const violations=[];
for(const path of files){const lines=readFileSync(`${root}/${path}`,'utf8').split('\n');for(const[index,line]of lines.entries())if(!line.trimStart().startsWith('#')&&forbidden.some(pattern=>pattern.test(line)))violations.push(`${path}:${index+1}`);}
if(violations.length)throw new Error(`broad process-kill patterns forbidden: ${violations.join(', ')}`);
console.log(JSON.stringify({status:'GREEN',checked_files:files.length,rule:'no broad kill by name or discovered PID'}));
