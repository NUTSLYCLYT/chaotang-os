#!/usr/bin/env node
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createTask } from './harness-task.mjs';
import { acquireLease } from './harness-lease.mjs';
import { processIdentity, resolveControlPlanePaths } from './lib/control-plane-db.mjs';
import { inspectResource } from './lib/resource-lock.mjs';
import { createWorktree, listWorktrees, retireWorktree } from './lib/worktree-manager.mjs';

process.env.NODE_ENV = 'test';
process.env.CHAOTANG_CONTROL_PLANE_TEST_ADAPTER = '1';
const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const git = (args, options = {}) => execFileSync('git', args, { cwd: root, encoding: 'utf8', ...options }).trim();
const commitment = (value) => createHash('sha256').update(String(value)).digest('hex');
const sha = (path) => existsSync(path) ? commitment(readFileSync(path)) : 'ENOENT';
const checkoutState = () => commitment(execFileSync('git', ['status', '--porcelain=v1', '-z'], { cwd: root }));
const temporary = mkdtempSync(join(tmpdir(), 's4-real-manager-'));
const databasePath = join(temporary, 'control.sqlite3');
const registryPath = join(temporary, 'worktrees.json');
const controlPaths = resolveControlPlanePaths(root);
const trueDatabase = controlPaths.databasePath;
const trueRegistry = join(controlPaths.runtimeDir, 'worktrees.json');
const trueDbBefore = sha(trueDatabase);
const trueRegistryBefore = sha(trueRegistry);
const checkoutBefore = checkoutState();
const tempIndex = join(temporary, 'index');
copyFileSync(join(controlPaths.gitCommonDir, 'index'), tempIndex);
const indexEnv = { ...process.env, GIT_INDEX_FILE: tempIndex };
execFileSync('git', ['add', 'frontend/scripts/install-git-hooks.mjs'], { cwd: root, env: indexEnv });
const tree = git(['write-tree'], { env: indexEnv });
const approvedBase = git(['commit-tree', tree, '-p', 'HEAD', '-m', 'test: S4 linked-worktree hook candidate'], { env: indexEnv });
const records = [];
const retired = new Set();

function runChild(record, phase, args, env = process.env) {
  const startedAt = new Date().toISOString();
  const startedMs = Date.now();
  return new Promise((resolve) => {
    const child = spawn('pnpm', args, { cwd: join(record.worktree, 'frontend'), env, stdio: ['ignore', 'pipe', 'pipe'] });
    const chunks = [];
    child.stdout.on('data', (chunk) => chunks.push(chunk));
    child.stderr.on('data', (chunk) => chunks.push(chunk));
    child.on('error', (error) => chunks.push(Buffer.from(`spawn error: ${error.message}\n`)));
    child.on('close', (code, signal) => {
      const completedMs = Date.now();
      const completedAt = new Date(completedMs).toISOString();
      writeFileSync(join(temporary, `${record.task_id}-${phase}.log`), Buffer.concat(chunks));
      resolve({ task_id: record.task_id, phase, started_at: startedAt, completed_at: completedAt, started_ms: startedMs, completed_ms: completedMs, exit: code, signal });
    });
  });
}

function assertSuccessful(results, phase) {
  const failed = results.filter((result) => result.exit !== 0);
  if (failed.length) throw new Error(`${phase} failed: ${failed.map((result) => `${result.task_id} exit=${result.exit} signal=${result.signal}`).join(', ')}`);
}

function assertThreeWayOverlap(results) {
  if (results.length !== 3 || Math.max(...results.map((result) => result.started_ms)) >= Math.min(...results.map((result) => result.completed_ms))) throw new Error('three production build intervals did not overlap');
}

function safeRegistry(entries) {
  return entries.map((record) => ({
    task_id: record.task_id, owner: record.owner, branch: record.branch, worktree: record.worktree,
    commit: record.commit, port: record.port,
    port_lock: { key: record.port_lock.key, fencing_epoch: record.port_lock.fencing_epoch, nonce_commitment: commitment(record.port_lock.nonce) },
    dist_dir: record.dist_dir, artifact_dir: record.artifact_dir,
    holder: { pid: record.holder.pid, pgid: record.holder.pgid, start_ticks: record.holder.start_ticks, cwd: record.holder.cwd, identity_commitment: commitment(record.holder.nonce) },
    state: record.state, handoff_token_commitment: commitment(record.handoff_token), created_at: record.created_at,
    ...(record.retired_at ? { retired_at: record.retired_at } : {}),
  }));
}

try {
  for (let index = 1; index <= 3; index += 1) {
    const taskId = `task-s4-manager-real-${index}`;
    const owner = `s4-real-worker-${index}`;
    const port = 3110 + index;
    const options = { cwd: root, databasePath };
    createTask({ task_id: taskId, title: taskId, owner, risk: 'high', write_paths: [`frontend/s4-real-${index}`], read_paths: ['frontend'], dependencies: [], worktree: `.worktrees/${taskId}`, resources: [`port:${port}`], expires_at: new Date(Date.now() + 20 * 60 * 1000).toISOString(), metadata: { approved_base_sha: approvedBase } }, options);
    acquireLease({ task_id: taskId, owner, resource: `frontend/s4-real-${index}`, mode: 'write', holder_process: { pid: process.pid, cwd: root } }, options);
    records.push(createWorktree({ taskId, owner, holder: processIdentity(root), cwd: root, databasePath, registryPath }));
  }

  const installResults = await Promise.all(records.map((record) => runChild(record, 'install', ['install', '--offline', '--frozen-lockfile'])));
  assertSuccessful(installResults, 'standard pnpm install');

  const buildResults = await Promise.all(records.map((record) => runChild(record, 'build', ['build'], {
    ...process.env, NEXT_PUBLIC_API_MODE: 'real', NEXT_DIST_DIR: record.dist_dir, PORT: String(record.port),
    PLAYWRIGHT_OUTPUT_DIR: join(record.artifact_dir, 'playwright'), TEST_RESULTS_DIR: join(record.artifact_dir, 'test-results'),
  })));
  assertSuccessful(buildResults, 'production build');
  assertThreeWayOverlap(buildResults);

  const activeRegistry = listWorktrees({ cwd: root, registryPath });
  const activeLocks = records.map((record) => inspectResource({ dbPath: databasePath, key: record.port_lock.key }));
  if (activeLocks.some((lock) => lock?.state !== 'active')) throw new Error('resource lock was not active through build completion');
  const builds = buildResults.map((timing) => {
    const record = records.find((entry) => entry.task_id === timing.task_id);
    return { ...timing, port: record.port, dist_dir: record.dist_dir, commit: record.commit, build_id_sha256: sha(join(record.worktree, 'frontend', record.dist_dir, 'BUILD_ID')) };
  });

  for (const record of records) {
    retireWorktree({ taskId: record.task_id, cwd: root, databasePath, registryPath, handoffToken: record.handoff_token, actor: 's4-supervisor', reason: 'concurrent real builds completed', evidence: 'three overlapping production builds exited zero' });
    retired.add(record.task_id);
  }
  const retiredRegistry = listWorktrees({ cwd: root, registryPath });
  const result = {
    approved_base_sha: approvedBase, concurrency_assertion: 'three build intervals overlap',
    primary_checkout_before: checkoutBefore, primary_checkout_after: checkoutState(),
    true_db_before: trueDbBefore, true_db_after: sha(trueDatabase),
    true_registry_before: trueRegistryBefore, true_registry_after: sha(trueRegistry),
    active_registry: safeRegistry(activeRegistry), retired_registry: safeRegistry(retiredRegistry),
    installs: installResults, builds,
  };
  if (result.primary_checkout_before !== result.primary_checkout_after || result.true_db_before !== result.true_db_after || result.true_registry_before !== result.true_registry_after) throw new Error('primary checkout or true control plane changed');
  writeFileSync(join(temporary, 'result.json'), `${JSON.stringify(result, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ ...result, evidence_dir: temporary }, null, 2)}\n`);
} catch (error) {
  process.stderr.write(`S4 REAL BUILD STOP: ${error.message}\nevidence_dir=${temporary}\n`);
  process.exitCode = 1;
} finally {
  for (const record of records) {
    if (!retired.has(record.task_id) && existsSync(record.worktree)) {
      try {
        retireWorktree({ taskId: record.task_id, cwd: root, databasePath, registryPath, handoffToken: record.handoff_token, actor: 's4-supervisor', reason: 'real build run failed after child processes joined', evidence: 'all spawned install/build children reached close before cleanup' });
      } catch {}
    }
    if (existsSync(record.worktree)) { try { git(['worktree', 'remove', '--force', record.worktree]); } catch {} }
    try { git(['branch', '-D', record.branch]); } catch {}
  }
  rmSync(tempIndex, { force: true });
}
