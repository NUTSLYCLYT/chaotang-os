import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { openControlPlaneDb, withImmediateTransaction, normalizeRepoPath, nowIso, auditEvent } from './lib/control-plane-db.mjs';

const STATUSES = new Set(['draft','ready','leased','running','blocked','review','completed','cancelled']);
export function createTask(spec, options = {}) {
  const required = ['task_id','title','owner','risk','write_paths','read_paths','dependencies','worktree','resources','expires_at'];
  const allowed=new Set([...required,'metadata']);for(const key of Object.keys(spec))if(!allowed.has(key))throw new Error(`unknown task field: ${key}`);
  for (const key of required) if (!(key in spec)) throw new Error(`missing ${key}`);
  for(const key of ['schema_version','status','created_at','updated_at']) if(key in spec) throw new Error(`${key} is system managed`);
  if(new Set(spec.dependencies).size!==spec.dependencies.length||new Set(spec.write_paths).size!==spec.write_paths.length||new Set(spec.read_paths).size!==spec.read_paths.length||new Set(spec.resources).size!==spec.resources.length)throw new Error('duplicate task values');
  for(const p of [...spec.write_paths,...spec.read_paths])if(typeof p!=='string'||!p||p.startsWith('/')||/(^|\/)\.\.(\/|$)|[*?\[\]{}]/.test(p))throw new Error(`invalid task path: ${p}`);
  if (spec.dependencies.includes(spec.task_id)) throw new Error('task cannot depend on itself');
  if (!['low','medium','high','critical'].includes(spec.risk)) throw new Error('invalid risk');
  if(typeof spec.title!=='string'||!spec.title||typeof spec.owner!=='string'||!spec.owner||typeof spec.worktree!=='string'||!spec.worktree)throw new Error('invalid task strings');
  if(!Array.isArray(spec.dependencies)||!Array.isArray(spec.write_paths)||!Array.isArray(spec.read_paths)||!Array.isArray(spec.resources))throw new Error('task lists must be arrays');
  if(!Number.isFinite(Date.parse(spec.expires_at)))throw new Error('invalid expires_at');
  for(const r of spec.resources)if(!/^(port:(3002|3050|31\d{2})|build:[A-Za-z0-9._-]+|release:[A-Za-z0-9._-]+|integration:[A-Za-z0-9._-]+)$/.test(r))throw new Error(`invalid resource: ${r}`);
  const { db } = openControlPlaneDb(options);
  try { return withImmediateTransaction(db, () => {
    if (db.prepare('SELECT 1 FROM tasks WHERE task_id=?').get(spec.task_id)) throw new Error('task already exists');
    for (const dep of spec.dependencies) if (!db.prepare('SELECT 1 FROM tasks WHERE task_id=?').get(dep)) throw new Error(`dependency not found: ${dep}`);
    // Existing graph is acyclic; requiring dependencies to pre-exist prevents forward-reference cycles.
    const createdAt = nowIso();if(Date.parse(spec.expires_at)<=Date.parse(createdAt))throw new Error('task expires_at must be after created_at');
    if(!/^task-[A-Za-z0-9._-]+$/.test(spec.task_id)) throw new Error('invalid task_id');
    const publicRecord={schema_version:1,status:'ready',created_at:createdAt,...spec};
    const record={...publicRecord,metadata:{...(spec.metadata??{}),_control_plane:{canonical_read_paths:spec.read_paths.map(p=>normalizeRepoPath(p,options.cwd)),canonical_write_paths:spec.write_paths.map(p=>normalizeRepoPath(p,options.cwd))}}};
    db.prepare('INSERT INTO tasks VALUES(?,?,?,?,?,?)').run(spec.task_id, JSON.stringify(record), spec.owner, 'ready', createdAt, spec.expires_at);
    auditEvent(db,{event:'task.created',actor:spec.owner,subject:spec.task_id,payload:{dependencies:spec.dependencies}});
    return publicRecord;
  }); } finally { db.close(); }
}
export function listTasks(options={}) { const {db}=openControlPlaneDb(options); try{return db.prepare('SELECT spec_json,status FROM tasks ORDER BY created_at').all().map(r=>{const spec=JSON.parse(r.spec_json),metadata={...(spec.metadata??{})};delete metadata._control_plane;return{...spec,status:r.status,...(Object.keys(metadata).length?{metadata}:{metadata:undefined})};});}finally{db.close();} }

async function main(){ const [cmd,...args]=process.argv.slice(2); const json=args.includes('--json'); if(cmd==='create'){const i=args.indexOf('--spec'); if(i<0)throw new Error('--spec required'); console.log(JSON.stringify(createTask(JSON.parse(readFileSync(args[i+1],'utf8')))));} else if(cmd==='list')console.log(JSON.stringify(listTasks(),null,json?2:0)); else throw new Error('usage: create --spec FILE | list --json'); }
if(import.meta.url===pathToFileURL(process.argv[1]??'').href) main().catch(e=>{console.error(e.message);process.exitCode=1;});
