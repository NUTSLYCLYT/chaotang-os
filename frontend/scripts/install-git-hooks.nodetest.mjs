import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const git = (cwd, args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();

test('installer resolves the shared hooks directory from a linked worktree', () => {
  const repository = mkdtempSync(join(tmpdir(), 'linked-hook-repo-'));
  const linked = `${repository}-linked`;
  try {
    git(repository, ['init', '-q']);
    git(repository, ['config', 'user.email', 'hooks@test']);
    git(repository, ['config', 'user.name', 'Hooks']);
    mkdirSync(join(repository, 'frontend', 'scripts'), { recursive: true });
    cpSync(new URL('./install-git-hooks.mjs', import.meta.url), join(repository, 'frontend', 'scripts', 'install-git-hooks.mjs'));
    cpSync(new URL('./git-hooks', import.meta.url), join(repository, 'frontend', 'scripts', 'git-hooks'), { recursive: true });
    writeFileSync(join(repository, 'tracked'), 'base');
    git(repository, ['add', '.']);
    git(repository, ['commit', '-qm', 'base']);
    git(repository, ['worktree', 'add', '--detach', linked, 'HEAD']);

    const result = spawnSync(process.execPath, [join(linked, 'frontend', 'scripts', 'install-git-hooks.mjs')], { cwd: join(linked, 'frontend'), encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    const hooks = git(linked, ['rev-parse', '--path-format=absolute', '--git-path', 'hooks']);
    assert.match(readFileSync(join(hooks, 'pre-commit'), 'utf8'), /chaotang-hook-dispatcher-v1/);
    assert.match(readFileSync(join(hooks, 'pre-commit.d', 'chaotang-frontend'), 'utf8'), /guard-conflict-markers/);
  } finally {
    try { git(repository, ['worktree', 'remove', '--force', linked]); } catch {}
    rmSync(repository, { recursive: true, force: true });
    rmSync(linked, { recursive: true, force: true });
  }
});

test('installer honors core.hooksPath instead of overwriting dot-git paths', () => {
  const repository = mkdtempSync(join(tmpdir(), 'hooks-path-repo-'));
  try {
    git(repository, ['init', '-q']);
    mkdirSync(join(repository, 'frontend', 'scripts'), { recursive: true });
    cpSync(new URL('./install-git-hooks.mjs', import.meta.url), join(repository, 'frontend', 'scripts', 'install-git-hooks.mjs'));
    cpSync(new URL('./git-hooks', import.meta.url), join(repository, 'frontend', 'scripts', 'git-hooks'), { recursive: true });
    git(repository, ['config', 'core.hooksPath', '.managed-hooks']);
    const result = spawnSync(process.execPath, [join(repository, 'frontend', 'scripts', 'install-git-hooks.mjs')], { cwd: join(repository, 'frontend'), encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.match(readFileSync(join(repository, '.managed-hooks', 'pre-commit'), 'utf8'), /chaotang-hook-dispatcher-v1/);
    assert.equal(existsSync(join(repository, '.managed-hooks', 'pre-commit.d', 'chaotang-frontend')), true);
  } finally { rmSync(repository, { recursive: true, force: true }); }
});
