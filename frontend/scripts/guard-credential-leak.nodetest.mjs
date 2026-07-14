import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const sourceGuard = join(dirname(fileURLToPath(import.meta.url)), 'guard-credential-leak.sh');

function run(cwd, command, args) {
  return spawnSync(command, args, { cwd, encoding: 'utf8' });
}

function git(cwd, ...args) {
  const result = run(cwd, 'git', args);
  assert.equal(result.status, 0, `${args.join(' ')} failed:\n${result.stdout}${result.stderr}`);
  return result;
}

function mergeFixture() {
  const root = mkdtempSync(join(tmpdir(), 'credential-merge-'));
  const guard = join(root, 'frontend/scripts/guard-credential-leak.sh');
  mkdirSync(dirname(guard), { recursive: true });
  cpSync(sourceGuard, guard);

  git(root, 'init', '-b', 'master');
  git(root, 'config', 'user.name', 'Guard Test');
  git(root, 'config', 'user.email', 'guard@example.invalid');
  writeFileSync(join(root, 'README.md'), 'base\n');
  git(root, 'add', 'README.md');
  git(root, 'commit', '-m', 'base');

  git(root, 'switch', '-c', 'incoming');
  const credentialKeyword = 'pass' + 'word';
  writeFileSync(join(root, 'fixture.py'), `${credentialKeyword} = "fixture-value-12345"\n`);
  git(root, 'add', 'fixture.py');
  git(root, 'commit', '-m', 'add an already-reviewed test fixture');

  git(root, 'switch', 'master');
  writeFileSync(join(root, 'master.txt'), 'master-only\n');
  git(root, 'add', 'master.txt');
  git(root, 'commit', '-m', 'master-only change');
  git(root, 'merge', '--no-ff', '--no-commit', 'incoming');

  return { root, guard };
}

test('merge does not re-report a credential-like fixture already present in one parent', () => {
  const { root, guard } = mergeFixture();
  try {
    const result = run(root, 'bash', [guard]);
    assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('merge still rejects a credential-like line newly added during integration', () => {
  const { root, guard } = mergeFixture();
  try {
    const credentialKeyword = 'pass' + 'word';
    writeFileSync(join(root, 'new-leak.py'), `${credentialKeyword} = "merge-value-12345"\n`);
    git(root, 'add', 'new-leak.py');
    const result = run(root, 'bash', [guard]);
    assert.notEqual(result.status, 0, 'a merge-only credential must remain blocked');
    assert.match(result.stdout, /疑似把真实密码\/密钥写进了本次提交/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
