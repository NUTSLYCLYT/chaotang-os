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

function gitOutput(cwd, ...args) {
  const result = run(cwd, 'git', args);
  assert.equal(
    result.status,
    0,
    `${args.join(' ')} failed:\n${result.stdout}${result.stderr}`,
  );
  return result.stdout.trim();
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

test('credential guard accepts security marker values and paths beside long error codes', () => {
  const { root, scriptDir } = repositoryFixture();
  try {
    const marker = ['se', 'cret'].join('');
    const posixPath = ['../../etc/', 'pass', 'wd'].join('');
    const unicodePath = ['capability／..／', 'se', 'cret'].join('');
    const fixtures = [
      { patch: { prompt: marker }, expected_error: 'capsule_non_authority_boundary_invalid' },
      { patch: { artifact_path: posixPath }, expected_error: 'capsule_envelope_shape_invalid' },
      { patch: { artifact_path: unicodePath }, expected_error: 'capsule_envelope_shape_invalid' },
    ];
    writeFileSync(
      join(root, 'security-cases.json'),
      `${fixtures.map((fixture) => JSON.stringify(fixture)).join('\n')}\n`,
    );
    git(root, 'add', 'security-cases.json');
    const result = run(root, 'bash', [join(scriptDir, 'guard-credential-leak.sh')]);
    assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('credential guard rejects code and JSON credential-key assignments', () => {
  const { root, scriptDir } = repositoryFixture();
  try {
    const keyword = ['api', '_key'].join('');
    const value = ['guard', '-fixture-12345'].join('');
    writeFileSync(
      join(root, 'assignments.json'),
      `${JSON.stringify({ [keyword]: value })}\n`,
    );
    git(root, 'add', 'assignments.json');
    const jsonResult = run(root, 'bash', [join(scriptDir, 'guard-credential-leak.sh')]);
    assert.notEqual(jsonResult.status, 0);

    git(root, 'reset', '-q');
    rmSync(join(root, 'assignments.json'));
    writeFileSync(join(root, 'assignment.js'), `${keyword} = "${value}";\n`);
    git(root, 'add', 'assignment.js');
    const codeResult = run(root, 'bash', [join(scriptDir, 'guard-credential-leak.sh')]);
    assert.notEqual(codeResult.status, 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('credential guard rejects prefixed snake case uppercase and camel case assignments', () => {
  const { root, scriptDir } = repositoryFixture();
  try {
    const passwordName = ['db_', 'pass', 'word'].join('');
    const apiKeyName = ['OPENAI_', 'API', '_KEY'].join('');
    const secretName = ['client', 'Secret'].join('');
    const value = ['guard', '-fixture-12345'].join('');
    const cases = [
      ['snake-case.js', `${passwordName} = "${value}";\n`],
      ['uppercase.js', `${apiKeyName} = "${value}";\n`],
      ['camel-case.js', `${secretName} = "${value}";\n`],
      ['snake-case.json', `${JSON.stringify({ [passwordName]: value })}\n`],
    ];

    for (const [fileName, content] of cases) {
      writeFileSync(join(root, fileName), content);
      git(root, 'add', fileName);
      const result = run(root, 'bash', [join(scriptDir, 'guard-credential-leak.sh')]);
      assert.notEqual(result.status, 0, `${fileName} was not rejected`);
      assert.match(
        result.stdout,
        /疑似把真实密码\/密钥写进了本次提交/,
        `${fileName} did not report the credential guard rejection`,
      );
      git(root, 'reset', '-q');
      rmSync(join(root, fileName));
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('credential guard does not treat values paths errors or subwords as assignments', () => {
  const { root, scriptDir } = repositoryFixture();
  try {
    const keyword = ['se', 'cret'].join('');
    const document = {
      marker: keyword,
      artifact_path: `outside/${keyword}/fixture`,
      expected_error: `${keyword}_validation_failure_code`,
      ordinary_identifier: `not_a_${keyword}_assignment`,
    };
    writeFileSync(join(root, 'ordinary.json'), `${JSON.stringify(document)}\n`);
    git(root, 'add', 'ordinary.json');
    const result = run(root, 'bash', [join(scriptDir, 'guard-credential-leak.sh')]);
    assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('credential guard keeps the narrow E2E safe line without allowing adjacent credentials', () => {
  const { root, scriptDir } = repositoryFixture();
  try {
    const keyword = ['SE', 'CRET'].join('');
    const value = ['E2E', 'fixture12345'].join('');
    const path = join(root, 'e2e-fixture.js');
    writeFileSync(path, `const E2E_${keyword} = "${value}";\n`);
    git(root, 'add', 'e2e-fixture.js');
    const safeResult = run(root, 'bash', [join(scriptDir, 'guard-credential-leak.sh')]);
    assert.equal(safeResult.status, 0, `${safeResult.stdout}${safeResult.stderr}`);

    writeFileSync(
      path,
      `const E2E_${keyword} = "${value}";\nconst ${keyword.toLowerCase()} = "guard-fixture-67890";\n`,
    );
    git(root, 'add', 'e2e-fixture.js');
    const unsafeResult = run(root, 'bash', [join(scriptDir, 'guard-credential-leak.sh')]);
    assert.notEqual(unsafeResult.status, 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('credential guard intersects staged additions across merge parents', () => {
  const { root, scriptDir } = repositoryFixture();
  try {
    const base = gitOutput(root, 'rev-parse', 'HEAD');
    git(root, 'checkout', '-qb', 'merge-side', base);
    writeFileSync(join(root, 'side.txt'), 'side parent\n');
    git(root, 'add', 'side.txt');
    git(root, 'commit', '-qm', 'side parent');
    const sideParent = gitOutput(root, 'rev-parse', 'HEAD');

    git(root, 'checkout', '-q', '--detach', base);
    const keyword = ['pass', 'word'].join('');
    const value = ['guard', '-fixture-12345'].join('');
    writeFileSync(join(root, 'first-parent-only.py'), `${keyword} = "${value}"\n`);
    git(root, 'add', 'first-parent-only.py');
    git(root, 'commit', '-qm', 'first parent only');
    writeFileSync(join(root, '.git', 'MERGE_HEAD'), `${sideParent}\n`);

    const singleParentResult = run(root, 'bash', [join(scriptDir, 'guard-credential-leak.sh')]);
    assert.equal(singleParentResult.status, 0, `${singleParentResult.stdout}${singleParentResult.stderr}`);

    writeFileSync(join(root, 'both-parents.py'), `${keyword} = "guard-fixture-67890"\n`);
    git(root, 'add', 'both-parents.py');
    const bothParentsResult = run(root, 'bash', [join(scriptDir, 'guard-credential-leak.sh')]);
    assert.notEqual(bothParentsResult.status, 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
