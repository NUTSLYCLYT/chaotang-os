import {DatabaseSync} from 'node:sqlite';
import {chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import {dirname, join} from 'node:path';
import {resolveControlPlanePaths} from './control-plane-db.mjs';

const testAdapter=options=>process.env.NODE_ENV==='test'&&process.env.CHAOTANG_CONTROL_PLANE_TEST_ADAPTER==='1'&&options.testAdapter===true;
function preserveFailure(path,error){try{if(!existsSync(path)||!statSync(path).isFile())return null;const directory=join(dirname(path),'recovery-snapshots');mkdirSync(directory,{recursive:true,mode:0o700});if((statSync(directory).mode&0o077)!==0)return null;const snapshot=join(directory,`rollout-open-failure-${Date.now()}-${randomUUID()}.sqlite3`);copyFileSync(path,snapshot);for(const suffix of ['-wal','-shm'])try{copyFileSync(`${path}${suffix}`,`${snapshot}${suffix}`);}catch{}chmodSync(snapshot,0o600);writeFileSync(`${snapshot}.json`,`${JSON.stringify({schema:'chaotang.rollout-failure.v1',database_path:path,snapshot_path:snapshot,failure_digest:`sha256:${createHash('sha256').update(error.message).digest('hex')}`,snapshot_digest:`sha256:${createHash('sha256').update(readFileSync(snapshot)).digest('hex')}`,captured_at:new Date().toISOString()},null,2)}\n`,{mode:0o600,flag:'wx'});return snapshot;}catch{return null;}}

export function openRolloutDb(options={}){
  if(options.rolloutDatabasePath&&!testAdapter(options))throw new Error('rollout database override requires explicit test adapter');
  const control=resolveControlPlanePaths(options.cwd??process.cwd());
  const path=options.rolloutDatabasePath??(options.databasePath&&testAdapter(options)?`${options.databasePath}.rollout`:join(control.runtimeDir,'rollout.sqlite3'));
  mkdirSync(dirname(path),{recursive:true,mode:0o700});
  const db=new DatabaseSync(path,{timeout:10000});
  try{
    db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=10000;');
    const version=db.prepare('PRAGMA user_version').get().user_version;
    if(version>1)throw new Error(`unknown rollout schema version ${version}`);
    if(version<1)db.exec(`BEGIN IMMEDIATE;
      CREATE TABLE rollout_state(singleton INTEGER PRIMARY KEY CHECK(singleton=1),stage TEXT NOT NULL CHECK(stage IN ('observe','warn','enforce_paths','enforce_resources','mandatory')),status TEXT NOT NULL CHECK(status IN ('ROLLOUT','ENFORCED')),policy_commit TEXT NOT NULL,policy_digest TEXT NOT NULL,stage_started_at TEXT NOT NULL,last_seen_at TEXT NOT NULL,event_sequence INTEGER NOT NULL DEFAULT 0,event_hash TEXT NOT NULL,wrapper_version TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
      CREATE TABLE rollout_task_metrics(task_id TEXT PRIMARY KEY,task_class TEXT NOT NULL,window TEXT NOT NULL CHECK(window IN ('baseline','observation')),total_steps INTEGER NOT NULL CHECK(total_steps>0),duplicate_steps INTEGER NOT NULL CHECK(duplicate_steps>=0 AND duplicate_steps<=total_steps),path_conflicts INTEGER NOT NULL CHECK(path_conflicts>=0),port_conflicts INTEGER NOT NULL CHECK(port_conflicts>=0),build_conflicts INTEGER NOT NULL CHECK(build_conflicts>=0),false_positive INTEGER NOT NULL CHECK(false_positive IN (0,1)),overhead_seconds REAL NOT NULL CHECK(overhead_seconds>=0),data_complete INTEGER NOT NULL CHECK(data_complete IN (0,1)),source_audit_id INTEGER,recorded_at TEXT NOT NULL);
      CREATE TABLE rollout_release_metrics(release_id TEXT PRIMARY KEY,commit_sha TEXT NOT NULL,profile TEXT NOT NULL,outcome TEXT NOT NULL,external_verified INTEGER NOT NULL CHECK(external_verified IN (0,1)),incident INTEGER NOT NULL CHECK(incident IN (0,1)),source_release_id TEXT,source_evidence_sequence INTEGER,recorded_at TEXT NOT NULL);
      CREATE TABLE rollout_acceptance(acceptance_id TEXT PRIMARY KEY,commit_sha TEXT NOT NULL,artifact_digest TEXT NOT NULL,passed INTEGER NOT NULL CHECK(passed IN (0,1)),external_checkpoint TEXT NOT NULL,recorded_at TEXT NOT NULL);
      CREATE TABLE rollout_snapshots(id INTEGER PRIMARY KEY AUTOINCREMENT,from_stage TEXT NOT NULL,to_stage TEXT NOT NULL,reason TEXT NOT NULL,wrapper_json TEXT NOT NULL,active_state_json TEXT NOT NULL,event_sequence INTEGER NOT NULL,event_hash TEXT NOT NULL,created_at TEXT NOT NULL);
      CREATE TABLE rollout_events(sequence INTEGER PRIMARY KEY,event TEXT NOT NULL,payload_json TEXT NOT NULL,previous_hash TEXT NOT NULL,event_hash TEXT NOT NULL UNIQUE,created_at TEXT NOT NULL);
      CREATE TRIGGER rollout_events_no_update BEFORE UPDATE ON rollout_events BEGIN SELECT RAISE(ABORT,'rollout ledger is append-only'); END;
      CREATE TRIGGER rollout_events_no_delete BEFORE DELETE ON rollout_events BEGIN SELECT RAISE(ABORT,'rollout ledger is append-only'); END;
      CREATE TRIGGER rollout_metrics_no_update BEFORE UPDATE ON rollout_task_metrics BEGIN SELECT RAISE(ABORT,'rollout task metric is immutable'); END;
      CREATE TRIGGER rollout_metrics_no_delete BEFORE DELETE ON rollout_task_metrics BEGIN SELECT RAISE(ABORT,'rollout task metric is immutable'); END;
      CREATE TRIGGER rollout_releases_no_update BEFORE UPDATE ON rollout_release_metrics BEGIN SELECT RAISE(ABORT,'rollout release metric is immutable'); END;
      CREATE TRIGGER rollout_releases_no_delete BEFORE DELETE ON rollout_release_metrics BEGIN SELECT RAISE(ABORT,'rollout release metric is immutable'); END;
      CREATE TRIGGER rollout_acceptance_no_update BEFORE UPDATE ON rollout_acceptance BEGIN SELECT RAISE(ABORT,'rollout acceptance is immutable'); END;
      CREATE TRIGGER rollout_acceptance_no_delete BEFORE DELETE ON rollout_acceptance BEGIN SELECT RAISE(ABORT,'rollout acceptance is immutable'); END;
      CREATE TRIGGER rollout_snapshots_no_update BEFORE UPDATE ON rollout_snapshots BEGIN SELECT RAISE(ABORT,'rollout snapshot is immutable'); END;
      CREATE TRIGGER rollout_snapshots_no_delete BEFORE DELETE ON rollout_snapshots BEGIN SELECT RAISE(ABORT,'rollout snapshot is immutable'); END;
      PRAGMA user_version=1; COMMIT;`);
    if(db.prepare('PRAGMA integrity_check').get().integrity_check!=='ok')throw new Error('rollout database integrity check failed');
    chmodSync(path,0o600);
    return{db,path};
  }catch(error){try{db.close();}catch{}const snapshot=preserveFailure(path,error);throw new Error(`rollout database failed closed${snapshot?`; snapshot=${snapshot}`:''}: ${error.message}`,{cause:error});}
}
