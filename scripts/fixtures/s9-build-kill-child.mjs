import { writeFileSync } from 'node:fs';
import { acquireResource } from '../lib/resource-lock.mjs';
import { processIdentity } from '../lib/control-plane-db.mjs';
import { buildCandidate } from '../../frontend/scripts/lib/immutable-build-manager.mjs';

const [root,databasePath,buildRoot,activePointer,readyPath,commit]=process.argv.slice(2),identity=processIdentity(root);
const lock=acquireResource({dbPath:databasePath,key:'build:frontend-production',holder:{owner:'kill-builder',taskId:'task-kill-builder',pid:identity.pid,pgid:identity.pgid,cwd:identity.cwd,worktree:root,commit,command:'s9-real-kill',nonce:identity.nonce,protectedPaths:[buildRoot,activePointer]},ttlMs:60000});
await buildCandidate({cwd:root,frontendRoot:`${root}/frontend`,buildRoot,activePointer,databasePath,lock:{key:lock.key,fencingEpoch:lock.fencingEpoch,nonce:lock.nonce},releaseId:'release-killed',runner:async()=>{writeFileSync(readyPath,JSON.stringify({epoch:lock.fencingEpoch}));await new Promise(resolve=>setInterval(resolve,60_000));}});
