import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, chmodSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync, spawn } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createTask } from './harness-task.mjs';
import { acquireLease } from './harness-lease.mjs';
import { processIdentity, registeredProcessIdentity, resolveControlPlanePaths } from './lib/control-plane-db.mjs';
import { inspectResource, portSocketOwners } from './lib/resource-lock.mjs';
import { createWorktree, listWorktrees, recoverWorktrees, retireWorktree } from './lib/worktree-manager.mjs';

process.env.NODE_ENV = 'test';
process.env.CHAOTANG_CONTROL_PLANE_TEST_ADAPTER = '1';
const git = (cwd, args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();

function repository(prefix) {
  const cwd = mkdtempSync(join(tmpdir(), prefix));
  git(cwd, ['init', '-q']);
  git(cwd, ['config', 'user.email', 's4@test']);
  git(cwd, ['config', 'user.name', 'S4']);
  writeFileSync(join(cwd, 'tracked'), 'base');
  git(cwd, ['add', '.']);
  git(cwd, ['commit', '-qm', 'base']);
  return cwd;
}

function freePort() {
  for (let port = 3199; port >= 3150; port -= 1) if (!portSocketOwners(port).length) return port;
  throw new Error('no test port available');
}

function authorized(cwd, databasePath, { taskId = 'task-negative', owner = 'worker', port = freePort(), worktree = `.worktrees/${taskId}`, base = git(cwd, ['rev-parse', 'HEAD']) } = {}) {
  const options = { cwd, databasePath };
  const resource = `src/${taskId}`;
  createTask({ task_id: taskId, title: taskId, owner, risk: 'high', write_paths: [resource], read_paths: [], dependencies: [], worktree, resources: [`port:${port}`], expires_at: new Date(Date.now() + 120000).toISOString(), metadata: { approved_base_sha: base } }, options);
  acquireLease({ task_id: taskId, owner, resource, mode: 'write', holder_process: { pid: process.pid, cwd: process.cwd() } }, options);
  return { taskId, owner, port };
}

test('registry truncation, schema, digest and permissions all stop closed', () => {
  const cwd = repository('s4-registry-negative-');
  try {
    const registry = join(resolveControlPlanePaths(cwd).runtimeDir, 'worktrees.json');
    mkdirSync(join(registry, '..'), { recursive: true });
    for (const body of ['{"schema_version":', '{"schema_version":2,"entries":{},"digest":"x"}', '{"schema_version":1,"entries":{},"digest":"wrong"}']) {
      writeFileSync(registry, body, { mode: 0o600 });
      assert.throws(() => listWorktrees({ cwd }), /corrupt|schema\/digest/);
    }
    writeFileSync(registry, '{"schema_version":1,"entries":{},"digest":"44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a"}', { mode: 0o600 });
    chmodSync(registry, 0o644);
    assert.throws(() => listWorktrees({ cwd }), /permissions/);
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test('Task-approved full SHA and canonical worktree path cannot drift', () => {
  const cwd = repository('s4-task-negative-');
  const databasePath = join(cwd, 'control.sqlite3');
  try {
    const approved = git(cwd, ['rev-parse', 'HEAD']);
    authorized(cwd, databasePath, { taskId: 'task-wrong-path', worktree: '.worktrees/somewhere-else', base: approved });
    assert.throws(() => createWorktree({ taskId: 'task-wrong-path', owner: 'worker', holder: processIdentity(), cwd, databasePath }), /canonical target/);
    writeFileSync(join(cwd, 'later'), 'drift');
    git(cwd, ['add', '.']);
    git(cwd, ['commit', '-qm', 'later']);
    authorized(cwd, databasePath, { taskId: 'task-wrong-base', base: approved });
    assert.throws(() => createWorktree({ taskId: 'task-wrong-base', owner: 'worker', holder: processIdentity(), cwd, databasePath, base: 'HEAD' }), /approved_base_sha/);
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test('wrong handoff token stops normal retire and Git removal failure retains the port', () => {
  const cwd = repository('s4-retire-negative-');
  const databasePath = join(cwd, 'control.sqlite3');
  try {
    const task = authorized(cwd, databasePath, {});
    const record = createWorktree({ ...task, holder: processIdentity(), cwd, databasePath });
    assert.throws(() => retireWorktree({ taskId: task.taskId, cwd, databasePath, handoffToken: 'wrong', actor: 'supervisor', reason: 'test', evidence: 'joined' }), /handoff token/);
    git(cwd, ['worktree', 'remove', '--force', record.worktree]);
    assert.throws(() => retireWorktree({ taskId: task.taskId, cwd, databasePath, handoffToken: record.handoff_token, actor: 'supervisor', reason: 'test', evidence: 'joined' }));
    assert.equal(listWorktrees({ cwd })[0].state, 'blocked');
    assert.equal(inspectResource({ dbPath: databasePath, key: record.port_lock.key }).state, 'active');
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test('crash recovery blocks reclaim while the assigned port is listening', async () => {
  const cwd = repository('s4-listener-negative-');
  const databasePath = join(cwd, 'control.sqlite3');
  const resident = spawn('setsid', ['sleep', '30']);
  let listener;
  try {
    const task = authorized(cwd, databasePath, {});
    await new Promise((resolve) => setTimeout(resolve, 20));
    const holder = registeredProcessIdentity({ pid: resident.pid, cwd: process.cwd() });
    createWorktree({ ...task, holder, cwd, databasePath });
    resident.kill();
    await new Promise((resolve) => resident.once('close', resolve));
    listener = spawn(process.execPath, ['-e', `require('net').createServer().listen(${task.port},'127.0.0.1');setInterval(()=>{},1000)`]);
    await new Promise((resolve) => setTimeout(resolve, 100));
    const result = recoverWorktrees({ cwd, databasePath, actor: 'supervisor', reason: 'crash', evidence: 'listener observed', ticket: 'INC-LISTENER' });
    assert.equal(result[0].state, 'blocked');
    assert.match(result[0].reason, /signed break-glass authorization required/);
    assert.equal(inspectResource({ dbPath: databasePath, key: `port:${task.port}` }).state, 'active');
  } finally {
    resident.kill();
    listener?.kill();
    rmSync(cwd, { recursive: true, force: true });
  }
});
