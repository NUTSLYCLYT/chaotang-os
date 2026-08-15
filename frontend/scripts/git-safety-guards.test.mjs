import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const sourceDir = dirname(fileURLToPath(import.meta.url));

function run(cwd, command, args) {
  return spawnSync(command, args, { cwd, encoding: 'utf8' });
}

function git(cwd, ...args) {
  const result = run(cwd, 'git', args);
  assert.equal(
    result.status,
    0,
    `${args.join(' ')} failed:\n${result.stdout}${result.stderr}`,
  );
}

function repositoryFixture() {
  const root = mkdtempSync(join(tmpdir(), 'chaotang-git-guards-'));
  const scriptDir = join(root, 'frontend', 'scripts');
  mkdirSync(scriptDir, { recursive: true });
  for (const name of ['guard-conflict-markers.sh', 'guard-credential-leak.sh']) {
    cpSync(join(sourceDir, name), join(scriptDir, name));
  }
  git(root, 'init', '-q');
  git(root, 'config', 'user.name', 'Guard Test');
  git(root, 'config', 'user.email', 'guard@example.invalid');
  writeFileSync(join(root, 'README.md'), 'clean\n');
  git(root, 'add', 'README.md');
  git(root, 'commit', '-qm', 'base');
  return { root, scriptDir };
}

test('guards accept a clean staged documentation change', () => {
  const { root, scriptDir } = repositoryFixture();
  try {
    writeFileSync(join(root, 'README.md'), 'clean update\n');
    git(root, 'add', 'README.md');
    for (const name of ['guard-conflict-markers.sh', 'guard-credential-leak.sh']) {
      const result = run(root, 'bash', [join(scriptDir, name)]);
      assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('conflict guard rejects an unresolved marker in a tracked document', () => {
  const { root, scriptDir } = repositoryFixture();
  try {
    const marker = '<'.repeat(7);
    writeFileSync(join(root, 'README.md'), `${marker} HEAD\nconflict\n`);
    git(root, 'add', 'README.md');
    const result = run(root, 'bash', [join(scriptDir, 'guard-conflict-markers.sh')]);
    assert.notEqual(result.status, 0);
    assert.match(result.stdout, /发现未解决的合并冲突标记/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('credential guard rejects a newly staged credential-like literal', () => {
  const { root, scriptDir } = repositoryFixture();
  try {
    const keyword = 'pass' + 'word';
    const value = 'guard-' + 'fixture-12345';
    writeFileSync(join(root, 'fixture.py'), `${keyword} = "${value}"\n`);
    git(root, 'add', 'fixture.py');
    const result = run(root, 'bash', [join(scriptDir, 'guard-credential-leak.sh')]);
    assert.notEqual(result.status, 0);
    assert.match(result.stdout, /疑似把真实密码\/密钥写进了本次提交/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
