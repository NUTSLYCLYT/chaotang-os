#!/usr/bin/env node
import{existsSync}from'node:fs';import{resolve}from'node:path';import{immutableBuildPaths}from'./lib/immutable-build-manager.mjs';import{processIdentityAlive,readProcessIdentity}from'./lib/process-identity.mjs';
import{resolveControlPlanePaths}from'../../scripts/lib/control-plane-db.mjs';import{assertReleaseCommander}from'../../scripts/lib/release-commander.mjs';
const test=process.env.NODE_ENV==='test'&&process.env.CHAOTANG_CONTROL_PLANE_TEST_ADAPTER==='1';
const root=test&&process.env.CHAOTANG_TEST_REPOSITORY_ROOT?resolve(process.env.CHAOTANG_TEST_REPOSITORY_ROOT):resolve(import.meta.dirname,'../..');
const record=test&&process.env.CHAOTANG_TEST_RUNTIME_RECORD?resolve(process.env.CHAOTANG_TEST_RUNTIME_RECORD):immutableBuildPaths(root).runtimeRecord;
const dbPath=test&&process.env.CHAOTANG_TEST_DB_PATH?resolve(process.env.CHAOTANG_TEST_DB_PATH):resolveControlPlanePaths(root).databasePath;if(!(test&&process.env.CHAOTANG_TEST_COMMANDER_BYPASS==='1'))assertReleaseCommander({releaseId:process.env.CHAOTANG_RELEASE_RUN_ID,taskId:process.env.CHAOTANG_RELEASE_TASK_ID,commander:process.env.CHAOTANG_RELEASE_COMMANDER,credential:{fencingEpoch:Number(process.env.CHAOTANG_RELEASE_EPOCH),nonce:process.env.CHAOTANG_RELEASE_NONCE}},{cwd:root,databasePath:dbPath});
const termMs=test?Number(process.env.CHAOTANG_TEST_TERM_MS??300):10000,killMs=test?Math.max(Number(process.env.CHAOTANG_TEST_KILL_MS??5000),5000):5000;
if(!existsSync(record)){console.log('production runtime already stopped');process.exit(0);}
const identity=readProcessIdentity(record);if(!processIdentityAlive(identity))throw new Error('STOP: recorded child identity mismatch');
process.kill(-identity.pgid,'SIGTERM');let deadline=Date.now()+termMs;while(processIdentityAlive(identity)&&Date.now()<deadline)await new Promise(wait=>setTimeout(wait,50));
if(processIdentityAlive(identity)){process.kill(-identity.pgid,'SIGKILL');deadline=Date.now()+killMs;while(processIdentityAlive(identity)&&Date.now()<deadline)await new Promise(wait=>setTimeout(wait,50));}
if(processIdentityAlive(identity))throw new Error('STOP: process survived; runtime retained');deadline=Date.now()+killMs;while(existsSync(record)&&Date.now()<deadline)await new Promise(wait=>setTimeout(wait,50));if(existsSync(record))throw new Error('STOP: supervisor did not verify socket/release lock; runtime retained');console.log(`stopped production pid ${identity.pid}`);
