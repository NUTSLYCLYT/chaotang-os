#!/usr/bin/env node
import { acquireResource, fenceResource, heartbeatResource, inspectResource, markResourceSuspect, reclaimResource, releaseResource } from './lib/resource-lock.mjs';
import { processIdentity, registeredProcessIdentity } from './lib/control-plane-db.mjs';
import { existsSync } from 'node:fs';

const [command, ...raw] = process.argv.slice(2);
const args = Object.fromEntries(raw.flatMap((value, index) => value.startsWith('--') ? [[value.slice(2), raw[index + 1]]] : []));
try {
  const barrier=process.env.CHAOTANG_TEST_BARRIER_FILE;if(barrier){if(process.env.NODE_ENV!=='test')throw new Error('barrier is test-only');while(!existsSync(barrier))Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,5);}
  const dbPath=args['test-db'];if(dbPath&&!(process.env.NODE_ENV==='test'&&process.env.CHAOTANG_CONTROL_PLANE_TEST_ADAPTER==='1'))throw new Error('test-db requires explicit test adapter');
  let result;
  if (command === 'status') result = inspectResource({ dbPath,key: args.key });
  else if (command === 'acquire') {
    const identity = args['holder-pid'] ? registeredProcessIdentity({pid:Number(args['holder-pid']),pgid:Number(args['holder-pgid']),start_ticks:Number(args['holder-start-ticks']),cwd:args['holder-cwd']}) : processIdentity();
    result = acquireResource({ dbPath,key: args.key, ttlMs: Number(args.ttl ?? 60000), holder: {
      owner: args.owner, taskId: args.task, pid: identity.pid, pgid: identity.pgid, cwd: identity.cwd,
      worktree: args.worktree ?? identity.cwd, commit: args.commit, command: args.command ?? 'unknown', nonce: identity.nonce,
      protectedPaths: args['protected-paths-json'] ? JSON.parse(args['protected-paths-json']) : undefined,
      hostId: identity.host_id, bootId: identity.boot_id, pidNamespace: identity.pid_namespace, startTicks: identity.start_ticks,
    } });
  } else if (command === 'heartbeat') result = heartbeatResource({ dbPath,key: args.key, fencingEpoch: Number(args.epoch), nonce: args.nonce, ttlMs: Number(args.ttl ?? 60000) });
  else if (command === 'release') result = releaseResource({ dbPath,key: args.key, fencingEpoch: Number(args.epoch), nonce: args.nonce });
  else if (command === 'suspect') result = markResourceSuspect({ dbPath,key: args.key });
  else if (command === 'fence') result = fenceResource({dbPath,key:args.key,expectedEpoch:Number(args.epoch),actor:args.actor,reason:args.reason,evidence:args.evidence});
  else if (command === 'reclaim') result = reclaimResource({ dbPath,key: args.key, expectedEpoch: Number(args.epoch), evidence: args.evidence });
  else throw new Error('usage: harness-lock.mjs acquire|heartbeat|release|status|suspect|fence|reclaim; signed emergency recovery uses harness-recovery.mjs');
  console.log(JSON.stringify(result, null, 2));
} catch (error) { console.error(`STOP/${error.message}`); process.exitCode = 1; }
