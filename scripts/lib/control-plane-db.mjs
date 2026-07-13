import { DatabaseSync } from 'node:sqlite';
import { execFileSync } from 'node:child_process';
import { mkdirSync, realpathSync, statSync, readFileSync, copyFileSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { randomUUID } from 'node:crypto';

export const nowIso = () => new Date().toISOString();

export function resolveControlPlanePaths(cwd = process.cwd()) {
  const gitCommonRaw = execFileSync('git', ['rev-parse', '--git-common-dir'], { cwd, encoding: 'utf8' }).trim();
  const top = realpathSync(execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd, encoding: 'utf8' }).trim());
  const commonDir = realpathSync(isAbsolute(gitCommonRaw) ? gitCommonRaw : resolve(cwd, gitCommonRaw));
  const runtimeDir = join(commonDir, 'chaotang-harness');
  mkdirSync(runtimeDir, { recursive: true, mode: 0o700 });
  return { repositoryRoot: top, gitCommonDir: commonDir, repositoryIdentity: `${statSync(commonDir).dev}:${statSync(commonDir).ino}`, runtimeDir, databasePath: join(runtimeDir, 'control-plane.sqlite3') };
}

function migrate(db) {
  const version = db.prepare('PRAGMA user_version').get().user_version;
  if(version>7) throw new Error(`unknown control-plane schema version ${version}`);
  if (version < 1) {
    db.exec(`BEGIN IMMEDIATE;
      CREATE TABLE IF NOT EXISTS tasks(task_id TEXT PRIMARY KEY, spec_json TEXT NOT NULL, owner TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL, expires_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS leases(lease_id TEXT PRIMARY KEY, task_id TEXT NOT NULL REFERENCES tasks(task_id), owner TEXT NOT NULL, resource_type TEXT NOT NULL, resource TEXT NOT NULL, mode TEXT NOT NULL, acquired_at TEXT NOT NULL, heartbeat_at TEXT NOT NULL, expires_at TEXT NOT NULL, state TEXT NOT NULL, fencing_epoch INTEGER NOT NULL UNIQUE, process_json TEXT NOT NULL, released_at TEXT);
      CREATE INDEX IF NOT EXISTS idx_leases_active ON leases(state, resource_type, resource);
      CREATE TABLE IF NOT EXISTS audit_events(id INTEGER PRIMARY KEY AUTOINCREMENT, event TEXT NOT NULL, actor TEXT NOT NULL, subject TEXT NOT NULL, reason TEXT, payload_json TEXT NOT NULL, created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS control_meta(key TEXT PRIMARY KEY, integer_value INTEGER NOT NULL);
      INSERT OR IGNORE INTO control_meta(key, integer_value) VALUES('fencing_epoch', 0);
      PRAGMA user_version=1; COMMIT;`);
  }
  if(version<2){withImmediateTransaction(db,()=>{db.exec(`CREATE TABLE IF NOT EXISTS resource_locks(
    resource_key TEXT PRIMARY KEY, owner TEXT NOT NULL, task_id TEXT NOT NULL REFERENCES tasks(task_id), state TEXT NOT NULL CHECK(state IN ('active','suspect','fenced','released','reclaimed')),
    fencing_epoch INTEGER NOT NULL, pid INTEGER NOT NULL, pgid INTEGER NOT NULL, cwd TEXT NOT NULL,
    worktree TEXT NOT NULL, commit_sha TEXT NOT NULL, command TEXT NOT NULL, nonce TEXT NOT NULL,
    host_id TEXT NOT NULL, boot_id TEXT NOT NULL, pid_namespace TEXT NOT NULL, start_ticks INTEGER NOT NULL,
    acquired_at TEXT NOT NULL, heartbeat_at TEXT NOT NULL, expires_at TEXT NOT NULL,
    pending_fencing_epoch INTEGER, released_at TEXT, evidence TEXT);
    CREATE INDEX IF NOT EXISTS idx_resource_locks_state_expiry ON resource_locks(state,expires_at);
    CREATE INDEX IF NOT EXISTS idx_resource_locks_task ON resource_locks(task_id); PRAGMA user_version=2;`);});}
  if(version<3){withImmediateTransaction(db,()=>{const columns=db.prepare('PRAGMA table_info(resource_locks)').all().map(row=>row.name);if(!columns.includes('protected_paths_json'))db.exec("ALTER TABLE resource_locks ADD COLUMN protected_paths_json TEXT NOT NULL DEFAULT '[]'");db.exec('PRAGMA user_version=3');});}
  if(version<4){withImmediateTransaction(db,()=>{const columns=db.prepare('PRAGMA table_info(leases)').all().map(row=>row.name);if(!columns.includes('entry_resource')){db.exec('ALTER TABLE leases ADD COLUMN entry_resource TEXT');db.exec('UPDATE leases SET entry_resource=resource WHERE entry_resource IS NULL');}db.exec('CREATE INDEX IF NOT EXISTS idx_leases_entry_active ON leases(state,resource_type,entry_resource); PRAGMA user_version=4');});}
  if(version<5){withImmediateTransaction(db,()=>{db.exec(`CREATE TABLE IF NOT EXISTS release_runs(
    release_id TEXT PRIMARY KEY, task_id TEXT NOT NULL REFERENCES tasks(task_id), commander TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('planned','locked','building','starting','verifying','ready','failed','rolled_back')),
    commit_sha TEXT NOT NULL, attestation_digest TEXT NOT NULL, build_id TEXT, artifact_digest TEXT,
    release_fencing_epoch INTEGER, nonce_commitment TEXT, previous_release_id TEXT, failure_json TEXT,
    checks_json TEXT NOT NULL DEFAULT '[]', log_json TEXT NOT NULL DEFAULT '[]', created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS idx_release_runs_status ON release_runs(status,updated_at); PRAGMA user_version=5;`);});}
  if(version<6){withImmediateTransaction(db,()=>{const columns=db.prepare('PRAGMA table_info(release_runs)').all().map(row=>row.name);if(!columns.includes('phase'))db.exec("ALTER TABLE release_runs ADD COLUMN phase TEXT NOT NULL DEFAULT 'planned'");db.exec('PRAGMA user_version=6');});}
  if(version<7){withImmediateTransaction(db,()=>{const columns=db.prepare('PRAGMA table_info(release_runs)').all().map(row=>row.name);if(!columns.includes('release_pending'))db.exec('ALTER TABLE release_runs ADD COLUMN release_pending INTEGER NOT NULL DEFAULT 0');if(!columns.includes('terminal_target'))db.exec('ALTER TABLE release_runs ADD COLUMN terminal_target TEXT');db.exec('PRAGMA user_version=7');});}
  db.exec("CREATE TRIGGER IF NOT EXISTS trg_release_locked_phase AFTER UPDATE OF status ON release_runs WHEN NEW.status='locked' AND NEW.phase<>'frozen' BEGIN UPDATE release_runs SET phase='frozen' WHERE release_id=NEW.release_id; END;");
  db.exec("CREATE TRIGGER IF NOT EXISTS trg_release_planned_phase AFTER UPDATE OF status ON release_runs WHEN NEW.status='planned' AND NEW.phase<>'planned' BEGIN UPDATE release_runs SET phase='planned' WHERE release_id=NEW.release_id; END;");
  db.exec("CREATE TRIGGER IF NOT EXISTS trg_release_failed_phase AFTER UPDATE OF status ON release_runs WHEN NEW.status='failed' AND NEW.phase<>'red' BEGIN UPDATE release_runs SET phase='red' WHERE release_id=NEW.release_id; END;");
}

export function openControlPlaneDb({ cwd = process.cwd(), databasePath } = {}) {
  const paths = resolveControlPlanePaths(cwd);
  if(databasePath && !(process.env.NODE_ENV==='test' && process.env.CHAOTANG_CONTROL_PLANE_TEST_ADAPTER==='1')) throw new Error('databasePath override requires explicit test adapter');
  const path = databasePath ?? paths.databasePath;
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(path, { timeout: 10000 });
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=10000;');
  const integrity = db.prepare('PRAGMA integrity_check').get().integrity_check;
  if (integrity !== 'ok') { db.close(); throw new Error(`control-plane integrity check failed: ${integrity}`); }
  migrate(db);
  return { db, paths: { ...paths, databasePath: path } };
}

export function snapshotControlPlaneDb({cwd=process.cwd(),destination,databasePath}={}){const opened=openControlPlaneDb({cwd,databasePath});try{opened.db.exec('PRAGMA wal_checkpoint(TRUNCATE)');}finally{opened.db.close();}copyFileSync(opened.paths.databasePath,destination);return destination;}

export function withImmediateTransaction(db, fn) {
  db.exec('BEGIN IMMEDIATE');
  try { const value = fn(); db.exec('COMMIT'); return value; }
  catch (error) { try { db.exec('ROLLBACK'); } catch {} throw error; }
}

export function processIdentity(cwd = process.cwd()) {
  let bootId = 'unknown', startTicks = 0, pgid = process.pid, pidNamespace = 'unknown';
  try { bootId = readFileSync('/proc/sys/kernel/random/boot_id', 'utf8').trim(); } catch {}
  try { const tail=readFileSync(`/proc/${process.pid}/stat`, 'utf8').trim().slice(readFileSync(`/proc/${process.pid}/stat`, 'utf8').lastIndexOf(')')+2).split(' '); pgid=Number(tail[2]); startTicks=Number(tail[19]); } catch {}
  try { pidNamespace = realpathSync('/proc/self/ns/pid'); } catch {}
  return { host_id: process.env.HOSTNAME ?? 'unknown', boot_id: bootId, pid_namespace: pidNamespace, pid: process.pid, pgid, start_ticks: startTicks, cwd: realpathSync(cwd), nonce: randomUUID() };
}

export function registeredProcessIdentity({pid=process.pid,pgid,start_ticks,cwd=process.cwd(),nonce}={}){
  let stat,actualCwd;try{stat=readFileSync(`/proc/${pid}/stat`,'utf8');actualCwd=realpathSync(`/proc/${pid}/cwd`);}catch{throw new Error('registered holder process is not alive');}
  const tail=stat.trim().slice(stat.lastIndexOf(')')+2).split(' '),actualPgid=Number(tail[2]),actualStart=Number(tail[19]);
  const expectedCwd=realpathSync(cwd);if(pgid!==undefined&&Number(pgid)!==actualPgid||start_ticks!==undefined&&Number(start_ticks)!==actualStart||expectedCwd!==actualCwd)throw new Error('registered holder process identity mismatch');
  const base=processIdentity(actualCwd);return{...base,pid:Number(pid),pgid:actualPgid,start_ticks:actualStart,cwd:actualCwd,nonce:nonce??randomUUID()};
}

export function registeredProcessAlive(identity){try{const current=registeredProcessIdentity(identity);return current.pid===identity.pid&&current.pgid===identity.pgid&&current.start_ticks===identity.start_ticks&&current.cwd===identity.cwd;}catch{return false;}}

export function normalizeRepoPath(input, cwd = process.cwd()) {
  const { repositoryRoot } = resolveControlPlanePaths(cwd);
  const absolute = resolve(repositoryRoot, input);
  const rel = relative(repositoryRoot, absolute);
  if (rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) throw new Error(`path escapes repository: ${input}`);
  let existing = absolute, suffix = [];
  while (true) { try { existing = realpathSync(existing); break; } catch { const parent = dirname(existing); if (parent === existing) throw new Error(`cannot resolve path: ${input}`); suffix.unshift(existing.slice(parent.length + 1)); existing = parent; } }
  const canonical = join(existing, ...suffix);
  const canonicalRel = relative(repositoryRoot, canonical);
  if (canonicalRel === '..' || canonicalRel.startsWith(`..${sep}`) || isAbsolute(canonicalRel)) throw new Error(`symlink escapes repository: ${input}`);
  return canonicalRel.split(sep).join('/');
}
export function normalizeGitEntryPath(input,cwd=process.cwd()){const{repositoryRoot}=resolveControlPlanePaths(cwd),absolute=resolve(repositoryRoot,input);let parentInput=dirname(absolute),suffix=[];while(true){try{parentInput=realpathSync(parentInput);break;}catch{const up=dirname(parentInput);if(up===parentInput)throw new Error(`cannot resolve Git entry parent: ${input}`);suffix.unshift(basename(parentInput));parentInput=up;}}const entry=join(parentInput,...suffix,basename(absolute)),rel=relative(repositoryRoot,entry);if(rel==='..'||rel.startsWith(`..${sep}`)||isAbsolute(rel))throw new Error(`Git entry escapes repository: ${input}`);return rel.split(sep).join('/');}

export function pathsOverlap(a, b) { return a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`); }
export function nextFencingEpoch(db) { db.prepare("UPDATE control_meta SET integer_value=integer_value+1 WHERE key='fencing_epoch'").run(); return db.prepare("SELECT integer_value FROM control_meta WHERE key='fencing_epoch'").get().integer_value; }
export function auditEvent(db, { event, actor, subject, reason = null, payload = {} }) { db.prepare('INSERT INTO audit_events(event,actor,subject,reason,payload_json,created_at) VALUES(?,?,?,?,?,?)').run(event, actor, subject, reason, JSON.stringify(payload), nowIso()); }
