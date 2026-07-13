import { execFileSync } from 'node:child_process';
import { createHash, createPrivateKey, createPublicKey, sign, verify } from 'node:crypto';
import {
  chmodSync, closeSync, existsSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, readdirSync,
  realpathSync, renameSync, statSync, writeFileSync,
} from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, sep } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const ZERO_HASH = `sha256:${'0'.repeat(64)}`;
const DIGEST = /^sha256:[0-9a-f]{64}$/;
const SHA = /^[0-9a-f]{40}$/;
const ALLOWED_BUILD_ENV = new Set(['NEXT_PUBLIC_API_MODE', 'BASE_PATH', 'NEXT_PUBLIC_BASE_PATH', 'NODE_ENV', 'CHAOTANG_BACKEND_API_URL']);

const sha = (value) => `sha256:${createHash('sha256').update(value).digest('hex')}`;
const git = (cwd, args, options = {}) => execFileSync('git', args, { cwd, encoding: 'utf8', ...options }).trim();
function canonical(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
}
export function readGitProvenance(cwd = process.cwd()) {
  const repository = realpathSync(git(cwd, ['rev-parse', '--show-toplevel']));
  const commit = git(repository, ['rev-parse', '--verify', 'HEAD']);
  const tree = git(repository, ['rev-parse', '--verify', 'HEAD^{tree}']);
  if (!SHA.test(commit) || !SHA.test(tree)) throw new Error('Git object provenance is not a full SHA-1 object id');
  git(repository, ['cat-file', '-e', `${commit}^{commit}`]);
  git(repository, ['cat-file', '-e', `${tree}^{tree}`]);
  let dirtyTracked = false;
  for (const args of [['diff-index', '--quiet', 'HEAD', '--'], ['diff-files', '--quiet', '--']]) {
    try { execFileSync('git', args, { cwd: repository, stdio: 'ignore' }); }
    catch (error) { if (error?.status === 1) dirtyTracked = true; else throw error; }
  }
  return { repository, commit, tree, dirtyTracked };
}

function walk(root) {
  if (!existsSync(root)) return [];
  const output = [];
  for (const name of readdirSync(root).sort()) {
    const path = join(root, name), stat = lstatSync(path);
    if (stat.isSymbolicLink()) throw new Error('artifact symlink is forbidden');
    if (stat.isDirectory()) output.push(...walk(path));
    else if (stat.isFile()) output.push(path);
    else throw new Error('unsupported artifact type');
  }
  return output;
}
function treeDigest(root) {
  const files = walk(root), hash = createHash('sha256');
  for (const path of files) {
    hash.update(relative(root, path).split(sep).join('/')); hash.update('\0');
    hash.update(readFileSync(path)); hash.update('\0');
  }
  return { digest: hash.digest('hex'), file_count: files.length };
}
export function computeReleaseArtifact(releaseRoot) {
  const next = treeDigest(join(releaseRoot, 'next'));
  const publicTree = treeDigest(join(releaseRoot, 'public'));
  const runtimeConfig = { digest: createHash('sha256').update(readFileSync(join(releaseRoot, 'next.config.ts'))).digest('hex'), file_count: 1 };
  return {
    digest: createHash('sha256').update(JSON.stringify({ next, public: publicTree, runtime_config: runtimeConfig })).digest('hex'),
    file_count: next.file_count + publicTree.file_count + 1,
    next, public: publicTree, runtime_config: runtimeConfig,
  };
}

export function readAndVerifyBuildManifest(releaseRoot, { cwd = process.cwd(), requireHead = true } = {}) {
  const root = realpathSync(releaseRoot), manifestPath = join(root, 'manifest.json');
  let manifest;
  try { manifest = JSON.parse(readFileSync(manifestPath, 'utf8')); } catch { throw new Error('build manifest unreadable'); }
  if (manifest.schema_version !== 1 || basename(root) !== manifest.release_id || !SHA.test(manifest.commit ?? '') || !SHA.test(manifest.tree ?? '') || manifest.dirty !== false) throw new Error('build manifest provenance invalid');
  if (!Array.isArray(manifest.command) || manifest.command.some(item => typeof item !== 'string')) throw new Error('build command provenance invalid');
  if (!manifest.env || Object.keys(manifest.env).some(key => !ALLOWED_BUILD_ENV.has(key) || typeof manifest.env[key] !== 'string')) throw new Error('build environment is not allowlisted');
  const buildId = readFileSync(join(root, 'next', 'BUILD_ID'), 'utf8').trim();
  if (!buildId || buildId !== manifest.build_id) throw new Error('build ID mismatch');
  const actual = computeReleaseArtifact(root);
  if (actual.digest !== manifest.artifact?.digest || actual.file_count !== manifest.artifact?.file_count) throw new Error('runtime artifact digest mismatch');
  const provenance = readGitProvenance(cwd);
  git(provenance.repository, ['cat-file', '-e', `${manifest.commit}^{commit}`]);
  const objectTree = git(provenance.repository, ['rev-parse', `${manifest.commit}^{tree}`]);
  if (objectTree !== manifest.tree) throw new Error('build manifest tree does not match Git object database');
  if (requireHead && (provenance.commit !== manifest.commit || provenance.tree !== manifest.tree)) throw new Error('HEAD and build manifest provenance mismatch');
  if (provenance.dirtyTracked) throw new Error('dirty tracked worktree cannot pass runtime identity');
  return { root, manifest, artifact: actual, buildId, provenance };
}

function validateEvidence(record) {
  if (record?.schema_version !== 1 || record.profile !== 'production' || !/^release-[A-Za-z0-9._-]+$/.test(record.release_id ?? '') || !record.repository_id || !isAbsolute(record.worktree ?? '')) throw new Error('release evidence identity invalid');
  for (const key of ['commit_sha', 'rollback_commit_sha']) if (!SHA.test(record[key] ?? '')) throw new Error(`release evidence ${key} invalid`);
  for (const value of [record.build_digest, record.runtime_artifact_digest, record.gate_report?.digest]) if (!DIGEST.test(value ?? '')) throw new Error('release evidence digest invalid');
  if (!['verified', 'rejected', 'rolled_back'].includes(record.status) || !/^lease-[A-Za-z0-9._-]+$/.test(record.commander_lease_id ?? '') || !record.build_id) throw new Error('release evidence release fields invalid');
  if (!record.runtime_process || !record.listener || record.runtime_process.pid !== record.listener.pid || !record.listener.socket_inode || !Number.isInteger(record.listener.port)) throw new Error('release evidence runtime identity invalid');
  if (!record.base_url || !record.gate_report?.path || !Array.isArray(record.checks) || !Number.isFinite(Date.parse(record.started_at)) || !Number.isFinite(Date.parse(record.completed_at)) || Date.parse(record.completed_at) < Date.parse(record.started_at)) throw new Error('release evidence gate/timeline invalid');
  if (new Set(record.checks.map(check => check.id)).size !== record.checks.length || record.checks.some(check => !check.id || !['passed', 'failed', 'skipped'].includes(check.status) || !check.evidence)) throw new Error('release evidence checks invalid');
  if (record.status === 'rejected' && !record.checks.some(check => check.status === 'failed')) throw new Error('rejected release evidence must bind a failed check');
  return structuredClone(record);
}
function openLedger(dbPath) {
  mkdirSync(dirname(dbPath), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(dbPath, { timeout: 10000 });
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=10000;
    CREATE TABLE IF NOT EXISTS release_evidence(
      sequence INTEGER PRIMARY KEY AUTOINCREMENT, release_id TEXT NOT NULL UNIQUE,
      record_json TEXT NOT NULL, previous_hash TEXT NOT NULL, record_hash TEXT NOT NULL UNIQUE,
      appended_at TEXT NOT NULL);
    CREATE TRIGGER IF NOT EXISTS release_evidence_no_update BEFORE UPDATE ON release_evidence BEGIN SELECT RAISE(ABORT,'release evidence is append-only'); END;
    CREATE TRIGGER IF NOT EXISTS release_evidence_no_delete BEFORE DELETE ON release_evidence BEGIN SELECT RAISE(ABORT,'release evidence is append-only'); END;`);
  return db;
}
function hashRecord(sequence, previousHash, record) { return sha(canonical({ sequence, previous_hash: previousHash, record })); }

export function appendReleaseEvidence({ dbPath, evidence }) {
  const record = validateEvidence(evidence), db = openLedger(dbPath);
  try {
    db.exec('BEGIN IMMEDIATE');
    const existing = db.prepare('SELECT sequence,record_json,previous_hash,record_hash,appended_at FROM release_evidence WHERE release_id=?').get(record.release_id);
    if (existing) {
      if (existing.record_json !== canonical(record) || existing.record_hash !== hashRecord(existing.sequence, existing.previous_hash, record)) throw new Error('release evidence ID already binds different immutable payload');
      db.exec('COMMIT');
      return { sequence: existing.sequence, previous_hash: existing.previous_hash, record_hash: existing.record_hash, appended_at: existing.appended_at, evidence: record, idempotent: true };
    }
    const last = db.prepare('SELECT sequence,record_hash FROM release_evidence ORDER BY sequence DESC LIMIT 1').get();
    const sequence = Number(last?.sequence ?? 0) + 1, previous = last?.record_hash ?? ZERO_HASH, recordHash = hashRecord(sequence, previous, record), appendedAt = new Date().toISOString();
    db.prepare('INSERT INTO release_evidence(sequence,release_id,record_json,previous_hash,record_hash,appended_at) VALUES(?,?,?,?,?,?)').run(sequence, record.release_id, canonical(record), previous, recordHash, appendedAt);
    db.exec('COMMIT');
    return { sequence, previous_hash: previous, record_hash: recordHash, appended_at: appendedAt, evidence: record };
  } catch (error) { try { db.exec('ROLLBACK'); } catch {} throw error; }
  finally { db.close(); }
}

function fingerprint(publicKeyPem) { return sha(createPublicKey(publicKeyPem).export({ type: 'spki', format: 'der' })); }
function validateTrust(trust) {
  if (trust?.schema_version !== 1 || !trust.key_id || !trust.provider || typeof trust.public_key_pem !== 'string' || typeof trust.independent !== 'boolean' || trust.authority_mode !== 'local-private-key') throw new Error('release anchor trust configuration invalid');
  if (trust.independent) throw new Error('external authority adapter is not configured; only non-independent local checkpoints are supported');
  const actual = fingerprint(trust.public_key_pem);
  if (trust.public_key_fingerprint && trust.public_key_fingerprint !== actual) throw new Error('release anchor public key fingerprint mismatch');
  return { ...trust, public_key_fingerprint: actual };
}
function validatePrivateKey(path, trust) {
  const stat = statSync(path);
  if (!stat.isFile() || stat.uid !== process.getuid() || (stat.mode & 0o777) !== 0o600) throw new Error('release anchor private key must be owner-only mode 0600');
  const parent = statSync(dirname(realpathSync(path)));
  if (parent.uid !== process.getuid() || (parent.mode & 0o077) !== 0) throw new Error('release anchor private key directory must be owner-only');
  const privateKey = createPrivateKey(readFileSync(path));
  if (fingerprint(createPublicKey(privateKey).export({ type: 'spki', format: 'pem' })) !== trust.public_key_fingerprint) throw new Error('release anchor private key does not match pinned trust root');
  return privateKey;
}
function readAnchor(anchorPath) {
  if (!existsSync(anchorPath)) return { schema_version: 1, checkpoints: [] };
  const stat = statSync(anchorPath), parent = statSync(dirname(realpathSync(anchorPath)));
  if (stat.uid !== process.getuid() || (stat.mode & 0o777) !== 0o600 || parent.uid !== process.getuid() || (parent.mode & 0o077) !== 0) throw new Error('release anchor path permissions are not owner-only');
  let anchor; try { anchor = JSON.parse(readFileSync(anchorPath, 'utf8')); } catch { throw new Error('release anchor unreadable'); }
  if (anchor.schema_version !== 1 || !Array.isArray(anchor.checkpoints)) throw new Error('release anchor invalid');
  return anchor;
}
function verifyAnchor(anchor, trust) {
  let previous = ZERO_HASH;
  for (const entry of anchor.checkpoints) {
    if (entry.key_id !== trust.key_id || entry.provider !== trust.provider || entry.previous_checkpoint_hash !== previous) throw new Error('release checkpoint key or chain mismatch');
    const payload = { ...entry }; delete payload.signature;
    if (!verify(null, Buffer.from(canonical(payload)), createPublicKey(trust.public_key_pem), Buffer.from(entry.signature ?? '', 'base64'))) throw new Error('release checkpoint signature invalid');
    previous = sha(canonical(entry));
  }
  return anchor.checkpoints.at(-1) ?? null;
}
function ledgerRows(db) { return db.prepare('SELECT sequence,release_id,record_json,previous_hash,record_hash,appended_at FROM release_evidence ORDER BY sequence').all(); }
function writeAnchor(anchorPath, anchor) {
  const temp = `${anchorPath}.${process.pid}.tmp`;
  mkdirSync(dirname(anchorPath), { recursive: true, mode: 0o700 });
  writeFileSync(temp, `${JSON.stringify(anchor, null, 2)}\n`, { mode: 0o600 });
  const file = openSync(temp, 'r'); fsyncSync(file); closeSync(file); renameSync(temp, anchorPath); chmodSync(anchorPath, 0o600);
  const directory = openSync(dirname(anchorPath), 'r'); fsyncSync(directory); closeSync(directory);
}

export function checkpointLedger({ dbPath, anchorPath, privateKeyPath, trust: inputTrust }) {
  const trust = validateTrust(inputTrust);
  if (trust.authority_mode !== 'local-private-key' || trust.independent) throw new Error('independent checkpoints must come from the external attestation authority');
  const privateKey = validatePrivateKey(privateKeyPath, trust), db = openLedger(dbPath);
  let latest;
  try { latest = ledgerRows(db).at(-1); } finally { db.close(); }
  if (!latest) throw new Error('cannot checkpoint an empty release ledger');
  const anchor = readAnchor(anchorPath), prior = verifyAnchor(anchor, trust), previousCheckpointHash = prior ? sha(canonical(anchor.checkpoints.at(-1))) : ZERO_HASH;
  if (prior && (prior.sequence > latest.sequence || (prior.sequence === latest.sequence && prior.record_hash !== latest.record_hash))) throw new Error('release ledger rollback or divergent checkpoint detected');
  if (prior?.sequence === latest.sequence) return prior;
  const payload = { schema_version: 1, key_id: trust.key_id, provider: trust.provider, sequence: latest.sequence, record_hash: latest.record_hash, previous_checkpoint_hash: previousCheckpointHash, issued_at: new Date().toISOString() };
  const entry = { ...payload, signature: sign(null, Buffer.from(canonical(payload)), privateKey).toString('base64') };
  writeAnchor(anchorPath, { schema_version: 1, checkpoints: [...anchor.checkpoints, entry] });
  return entry;
}

export function verifyEvidenceLedger({ dbPath, anchorPath, trust: inputTrust }) {
  const trust = validateTrust(inputTrust), db = openLedger(dbPath); let rows;
  try { rows = ledgerRows(db); } finally { db.close(); }
  if (!rows.length) throw new Error('release evidence ledger is empty');
  let previous = ZERO_HASH;
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index], sequence = index + 1;
    if (row.sequence !== sequence || row.previous_hash !== previous) throw new Error('release evidence hash chain sequence mismatch');
    let record; try { record = validateEvidence(JSON.parse(row.record_json)); } catch { throw new Error('release evidence hash chain record invalid'); }
    if (row.release_id !== record.release_id || row.record_hash !== hashRecord(sequence, previous, record)) throw new Error('release evidence hash chain digest mismatch');
    previous = row.record_hash;
  }
  const latest = rows.at(-1), anchor = readAnchor(anchorPath), checkpoint = verifyAnchor(anchor, trust);
  if (!checkpoint || checkpoint.sequence !== latest.sequence || checkpoint.record_hash !== latest.record_hash) throw new Error('release ledger checkpoint rollback or sequence mismatch');
  return { valid: true, latest, checkpoint, trust, readyEligible: false, status: 'IMPLEMENTED_LOCAL' };
}

export function assertReleaseAlignment({ gitProvenance, build, runtime, evidence, gateReport }) {
  const commits = [gitProvenance.commit, build.manifest.commit, runtime.commit, evidence.commit_sha, gateReport.commit_sha];
  if (new Set(commits).size !== 1 || commits.some(value => !SHA.test(value ?? ''))) throw new Error('STOP/runtime_identity_mismatch: commit alignment failed');
  const digest = `sha256:${build.artifact.digest}`;
  if (runtime.artifactDigest !== digest || evidence.build_digest !== digest || evidence.runtime_artifact_digest !== digest) throw new Error('STOP/runtime_identity_mismatch: artifact alignment failed');
  if (build.buildId !== runtime.buildId || build.buildId !== evidence.build_id) throw new Error('STOP/runtime_identity_mismatch: build ID alignment failed');
  if (gitProvenance.dirtyTracked) throw new Error('STOP/runtime_identity_mismatch: dirty tracked worktree');
  return { commit: commits[0], buildId: build.buildId, artifactDigest: digest };
}

export { canonical, fingerprint, ZERO_HASH };
