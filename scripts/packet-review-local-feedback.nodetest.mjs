import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync, spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {
  chmodSync,
  cpSync,
  existsSync,
  linkSync,
  lstatSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';

import {parsePrePushUpdates, verifyPacketReviewPush} from './lib/packet-review-local-feedback.mjs';

const git = (cwd, args) => execFileSync('git', args, {cwd, encoding: 'utf8'}).trim();
const sha256 = value => createHash('sha256').update(value).digest('hex');

function commit(repository, message) {
  git(repository, ['add', '.']);
  git(repository, ['commit', '-qm', message]);
  return git(repository, ['rev-parse', 'HEAD']);
}

function makeRepository(options = {}) {
  const repository = mkdtempSync(join(tmpdir(), 'packet-review-gate-'));
  git(repository, ['init', '-q']);
  git(repository, ['config', 'user.email', 'gate@test']);
  git(repository, ['config', 'user.name', 'Gate Test']);
  writeFileSync(join(repository, 'base.txt'), 'base\n');
  const predecessor = commit(repository, 'base');
  git(repository, ['branch', '-M', 'feature-chaotang-ext']);
  git(repository, ['checkout', '-qb', 'task/p5']);
  mkdirSync(join(repository, 'backend'), {recursive: true});
  mkdirSync(join(repository, '.harness', 'changes', 'fix-test'), {recursive: true});
  writeFileSync(join(repository, 'backend', 'feature.py'), 'implemented = True\n');
  writeFileSync(join(repository, '.harness', 'changes', 'fix-test', 'summary.md'), `# fix-test\n\nPacket ID: ${options.summaryPacket ?? 'P5'}\n`);
  if (options.secondChange) {
    mkdirSync(join(repository, '.harness', 'changes', 'fix-second'), {recursive: true});
    writeFileSync(join(repository, '.harness', 'changes', 'fix-second', 'summary.md'), '# fix-second\n');
  }
  const implementation = commit(repository, 'implement packet');

  const reviewDir = join(repository, '.harness', 'changes', 'fix-test', 'packet_review');
  mkdirSync(reviewDir, {recursive: true});
  const reportPath = '.harness/changes/fix-test/packet_review/review-v1.md';
  const approvalPath = '.harness/changes/fix-test/packet_review/approval-v1.json';
  const report = options.report ?? '# Independent review\n\nPACKET_REVIEW_GO\n';
  writeFileSync(join(repository, reportPath), report);
  const approval = {
    schema_version: 1,
    status: 'LOCAL_FEEDBACK_ONLY',
    review_version: 1,
    packet_id: 'P5',
    change_id: 'fix-test',
    predecessor_integration_sha: options.predecessor ?? predecessor,
    reviewed_head_sha: implementation,
    report_path: reportPath,
    report_sha256: options.reportDigest ?? sha256(report),
    verdict: 'PACKET_REVIEW_GO',
  };
  writeFileSync(join(repository, approvalPath), `${JSON.stringify(approval, null, 2)}\n`);
  if (options.secondApproval) {
    const secondReportPath = '.harness/changes/fix-test/packet_review/review-v2.md';
    const secondApprovalPath = '.harness/changes/fix-test/packet_review/approval-v2.json';
    writeFileSync(join(repository, secondReportPath), report);
    writeFileSync(join(repository, secondApprovalPath), `${JSON.stringify({
      ...approval,
      review_version: 2,
      report_path: secondReportPath,
    }, null, 2)}\n`);
  }
  if (options.reviewTouchesCode) writeFileSync(join(repository, 'backend', 'feature.py'), 'review changed code\n');
  const review = commit(repository, 'independent review');

  git(repository, ['checkout', '-q', 'feature-chaotang-ext']);
  if (options.mergeTouchesTree) {
    git(repository, ['merge', '--no-ff', '--no-commit', 'task/p5']);
    writeFileSync(join(repository, 'merge-only.txt'), 'unreviewed merge resolution\n');
    commit(repository, 'merge packet with extra change');
  } else {
    git(repository, ['merge', '--no-ff', '-qm', 'merge packet', 'task/p5']);
  }
  const candidate = git(repository, ['rev-parse', 'HEAD']);
  return {repository, predecessor, implementation, review, candidate};
}

function verify(fixture, overrides = {}) {
  return verifyPacketReviewPush({
    cwd: fixture.repository,
    remoteName: 'origin',
    remoteRef: 'refs/heads/feature-chaotang-ext',
    remoteSha: fixture.predecessor,
    localSha: fixture.candidate,
    activationSha: fixture.predecessor,
    ...overrides,
  });
}

test('accepts one SHA-bound review-only commit merged without tree changes', () => {
  const fixture = makeRepository();
  try {
    assert.deepEqual(verify(fixture), {
      allowed: true,
      status: 'LOCAL_FEEDBACK_ONLY',
      packetId: 'P5',
      changeId: 'fix-test',
      reviewedHead: fixture.implementation,
      reviewCommit: fixture.review,
      candidate: fixture.candidate,
    });
  } finally {
    rmSync(fixture.repository, {recursive: true, force: true});
  }
});

test('rejects GO that is duplicated or is not the final non-empty line', () => {
  for (const report of [
    'PACKET_REVIEW_GO\nnotes after verdict\n',
    'PACKET_REVIEW_GO\nPACKET_REVIEW_GO\n',
    'PACKET_REVIEW_NO_GO\nPACKET_REVIEW_GO\n',
  ]) {
    const fixture = makeRepository({report});
    try {
      assert.throws(() => verify(fixture), /single terminal PACKET_REVIEW_GO/);
    } finally {
      rmSync(fixture.repository, {recursive: true, force: true});
    }
  }
});

test('rejects approval bound to a different predecessor', () => {
  const fixture = makeRepository({predecessor: '1'.repeat(40)});
  try {
    assert.throws(() => verify(fixture), /predecessor/);
  } finally {
    rmSync(fixture.repository, {recursive: true, force: true});
  }
});

test('rejects a report whose bytes do not match the approval digest', () => {
  const fixture = makeRepository({reportDigest: '0'.repeat(64)});
  try {
    assert.throws(() => verify(fixture), /report_sha256/);
  } finally {
    rmSync(fixture.repository, {recursive: true, force: true});
  }
});

test('rejects more than one packet approval in a single push', () => {
  const fixture = makeRepository({secondApproval: true});
  try {
    assert.throws(() => verify(fixture), /exactly one versioned packet approval/);
  } finally {
    rmSync(fixture.repository, {recursive: true, force: true});
  }
});

test('rejects a review commit that also changes product code', () => {
  const fixture = makeRepository({reviewTouchesCode: true});
  try {
    assert.throws(() => verify(fixture), /review-only commit/);
  } finally {
    rmSync(fixture.repository, {recursive: true, force: true});
  }
});

test('rejects merge-time changes that were not in the reviewed tree', () => {
  const fixture = makeRepository({mergeTouchesTree: true});
  try {
    assert.throws(() => verify(fixture), /merge tree/);
  } finally {
    rmSync(fixture.repository, {recursive: true, force: true});
  }
});

test('rejects a push that introduces more than one root change', () => {
  const fixture = makeRepository({secondChange: true});
  try {
    assert.throws(() => verify(fixture), /exactly one root change/);
  } finally {
    rmSync(fixture.repository, {recursive: true, force: true});
  }
});

test('rejects a packet label that disagrees with the root change summary', () => {
  const fixture = makeRepository({summaryPacket: 'P6'});
  try {
    assert.throws(() => verify(fixture), /Packet ID/);
  } finally {
    rmSync(fixture.repository, {recursive: true, force: true});
  }
});

test('non-target refs remain outside the local feedback gate', () => {
  const fixture = makeRepository();
  try {
    assert.deepEqual(verify(fixture, {remoteRef: 'refs/heads/dev'}), {
      allowed: true,
      status: 'not_target',
    });
  } finally {
    rmSync(fixture.repository, {recursive: true, force: true});
  }
});

test('rejects deletion, new-target creation, and non-fast-forward target updates', () => {
  const fixture = makeRepository();
  try {
    assert.throws(() => verify(fixture, {localSha: '0'.repeat(40)}), /local SHA/);
    assert.throws(() => verify(fixture, {remoteSha: '0'.repeat(40)}), /remote SHA/);
    const unrelated = git(fixture.repository, ['commit-tree', `${fixture.predecessor}^{tree}`, '-m', 'unrelated']);
    assert.throws(() => verify(fixture, {remoteSha: unrelated, activationSha: unrelated}), /fast-forward/);
  } finally {
    rmSync(fixture.repository, {recursive: true, force: true});
  }
});

test('pre-activation allows only the exact activation commit and rejects later or divergent history', () => {
  const fixture = makeRepository();
  try {
    assert.deepEqual(verify(fixture, {
      activationSha: fixture.implementation,
      localSha: fixture.implementation,
    }), {
      allowed: true,
      status: 'pre_activation',
    });
    assert.throws(
      () => verify(fixture, {activationSha: fixture.implementation}),
      /exact activation commit/,
    );
    const divergent = git(fixture.repository, ['commit-tree', `${fixture.predecessor}^{tree}`, '-m', 'divergent activation']);
    assert.throws(() => verify(fixture, {activationSha: divergent}), /activation history/);
  } finally {
    rmSync(fixture.repository, {recursive: true, force: true});
  }
});

test('pre-push stdin parsing preserves every ref update and rejects malformed rows', () => {
  assert.deepEqual(parsePrePushUpdates(
    `refs/heads/dev ${'1'.repeat(40)} refs/heads/dev ${'2'.repeat(40)}\n` +
    `refs/heads/feature-chaotang-ext ${'3'.repeat(40)} refs/heads/feature-chaotang-ext ${'4'.repeat(40)}\n`,
  ), [
    {localRef: 'refs/heads/dev', localSha: '1'.repeat(40), remoteRef: 'refs/heads/dev', remoteSha: '2'.repeat(40)},
    {localRef: 'refs/heads/feature-chaotang-ext', localSha: '3'.repeat(40), remoteRef: 'refs/heads/feature-chaotang-ext', remoteSha: '4'.repeat(40)},
  ]);
  assert.throws(() => parsePrePushUpdates('broken row\n'), /malformed pre-push update/);
});

const installer = fileURLToPath(new URL('./install-packet-review-hooks.mjs', import.meta.url));
const cli = fileURLToPath(new URL('./packet-review-pre-push.mjs', import.meta.url));
const coreVerifier = fileURLToPath(new URL('./lib/packet-review-local-feedback.mjs', import.meta.url));

function prepareHookRepository({hooksPath} = {}) {
  const repository = mkdtempSync(join(tmpdir(), 'packet-review-hook-'));
  git(repository, ['init', '-q']);
  git(repository, ['config', 'user.email', 'gate@test']);
  git(repository, ['config', 'user.name', 'Gate Test']);
  writeFileSync(join(repository, 'base.txt'), 'base\n');
  commit(repository, 'base without gate scripts');
  mkdirSync(join(repository, 'scripts'), {recursive: true});
  mkdirSync(join(repository, 'scripts', 'lib'), {recursive: true});
  cpSync(cli, join(repository, 'scripts', 'packet-review-pre-push.mjs'));
  cpSync(coreVerifier, join(repository, 'scripts', 'lib', 'packet-review-local-feedback.mjs'));
  commit(repository, 'add gate scripts');
  if (hooksPath) git(repository, ['config', 'core.hooksPath', hooksPath]);
  return repository;
}

function activeSnapshot(hooks) {
  const assetDir = join(hooks, 'chaotang-packet-review-local-feedback-v1');
  const bundle = readFileSync(join(assetDir, 'current'), 'utf8').trim();
  assert.match(bundle, /^bundle-[0-9a-f]{64}$/);
  return {assetDir, bundle, path: join(assetDir, 'bundles', bundle)};
}

test('status output admits the local feedback gate is bypassable and not enforced', () => {
  const result = spawnSync(process.execPath, [cli, '--status'], {encoding: 'utf8'});
  assert.equal(result.status, 0, result.stderr);
  const status = JSON.parse(result.stdout);
  assert.equal(status.implementation, 'LOCAL_FEEDBACK_ONLY');
  assert.equal(status.bootstrap_policy, 'exact_activation_commit_only');
  assert.equal(status.security_boundary, false);
  assert.equal(status.required_check_verified, false);
  assert.ok(status.bypassable_by.includes('git push --no-verify'));
});

test('installer honors core.hooksPath, is idempotent, and uninstalls only its subhook', () => {
  const repository = prepareHookRepository({hooksPath: '.managed-hooks'});
  try {
    for (let index = 0; index < 2; index += 1) {
      const result = spawnSync(process.execPath, [installer], {cwd: repository, encoding: 'utf8'});
      assert.equal(result.status, 0, result.stderr);
    }
    const hooks = join(repository, '.managed-hooks');
    const dispatcher = join(hooks, 'pre-push');
    const target = join(hooks, 'pre-push.d', 'chaotang-packet-review');
    assert.match(readFileSync(dispatcher, 'utf8'), /chaotang-pre-push-dispatcher-v1/);
    assert.match(readFileSync(target, 'utf8'), /LOCAL_FEEDBACK_ONLY/);
    const other = join(hooks, 'pre-push.d', 'other');
    writeFileSync(other, '#!/bin/sh\nexit 0\n');
    chmodSync(other, 0o755);
    const uninstall = spawnSync(process.execPath, [installer, '--uninstall'], {cwd: repository, encoding: 'utf8'});
    assert.equal(uninstall.status, 0, uninstall.stderr);
    assert.equal(existsSync(target), false);
    assert.equal(existsSync(other), true);
    assert.equal(existsSync(dispatcher), true);
  } finally {
    rmSync(repository, {recursive: true, force: true});
  }
});

test('installer resolves the shared hooks directory from a linked worktree', () => {
  const repository = prepareHookRepository();
  const linked = `${repository}-linked`;
  try {
    git(repository, ['worktree', 'add', '--detach', linked, 'HEAD']);
    const result = spawnSync(process.execPath, [installer], {cwd: linked, encoding: 'utf8'});
    assert.equal(result.status, 0, result.stderr);
    const hooks = git(linked, ['rev-parse', '--path-format=absolute', '--git-path', 'hooks']);
    assert.equal(existsSync(join(hooks, 'pre-push.d', 'chaotang-packet-review')), true);
  } finally {
    try { git(repository, ['worktree', 'remove', '--force', linked]); } catch {}
    rmSync(repository, {recursive: true, force: true});
    rmSync(linked, {recursive: true, force: true});
  }
});

test('installer refuses to overwrite an existing non-dispatcher pre-push hook', () => {
  const repository = prepareHookRepository();
  try {
    const hooks = git(repository, ['rev-parse', '--path-format=absolute', '--git-path', 'hooks']);
    const existing = join(hooks, 'pre-push');
    writeFileSync(existing, '#!/bin/sh\necho user-hook\n');
    const before = readFileSync(existing, 'utf8');
    const result = spawnSync(process.execPath, [installer], {cwd: repository, encoding: 'utf8'});
    assert.equal(result.status, 1);
    assert.equal(readFileSync(existing, 'utf8'), before);
  } finally {
    rmSync(repository, {recursive: true, force: true});
  }
});

test('installer refuses a symlinked pre-push.d parent without writing its target directory', () => {
  const repository = prepareHookRepository();
  try {
    const hooks = git(repository, ['rev-parse', '--path-format=absolute', '--git-path', 'hooks']);
    const userOwnedDir = join(repository, 'user-owned-hooks');
    mkdirSync(userOwnedDir);
    symlinkSync(userOwnedDir, join(hooks, 'pre-push.d'));

    const install = spawnSync(process.execPath, [installer], {cwd: repository, encoding: 'utf8'});
    assert.equal(install.status, 1);
    assert.equal(existsSync(join(userOwnedDir, 'chaotang-packet-review')), false);
  } finally {
    rmSync(repository, {recursive: true, force: true});
  }
});

test('snapshot refresh switches one current pointer while retaining the prior immutable bundle', () => {
  const repository = prepareHookRepository();
  try {
    const firstInstall = spawnSync(process.execPath, [installer], {cwd: repository, encoding: 'utf8'});
    assert.equal(firstInstall.status, 0, firstInstall.stderr);
    const hooks = git(repository, ['rev-parse', '--path-format=absolute', '--git-path', 'hooks']);
    const before = activeSnapshot(hooks);
    const beforeCli = readFileSync(join(before.path, 'packet-review-pre-push.mjs'), 'utf8');
    const sourceCli = join(repository, 'scripts', 'packet-review-pre-push.mjs');
    writeFileSync(sourceCli, `${readFileSync(sourceCli, 'utf8')}\n// refreshed bundle\n`);

    const secondInstall = spawnSync(process.execPath, [installer], {cwd: repository, encoding: 'utf8'});
    assert.equal(secondInstall.status, 0, secondInstall.stderr);
    const after = activeSnapshot(hooks);
    assert.notEqual(after.bundle, before.bundle);
    assert.equal(readFileSync(join(before.path, 'packet-review-pre-push.mjs'), 'utf8'), beforeCli);
    assert.match(readFileSync(join(after.path, 'packet-review-pre-push.mjs'), 'utf8'), /refreshed bundle/);
  } finally {
    rmSync(repository, {recursive: true, force: true});
  }
});

test('snapshot refresh does not rewrite an existing managed target subhook', () => {
  const repository = prepareHookRepository();
  let dispatcherDir;
  try {
    const firstInstall = spawnSync(process.execPath, [installer], {cwd: repository, encoding: 'utf8'});
    assert.equal(firstInstall.status, 0, firstInstall.stderr);
    const hooks = git(repository, ['rev-parse', '--path-format=absolute', '--git-path', 'hooks']);
    dispatcherDir = join(hooks, 'pre-push.d');
    const target = join(dispatcherDir, 'chaotang-packet-review');
    const targetBefore = readFileSync(target, 'utf8');
    const bundleBefore = activeSnapshot(hooks).bundle;
    const sourceCli = join(repository, 'scripts', 'packet-review-pre-push.mjs');
    writeFileSync(sourceCli, `${readFileSync(sourceCli, 'utf8')}\n// refreshed without target rewrite\n`);
    chmodSync(dispatcherDir, 0o555);

    const secondInstall = spawnSync(process.execPath, [installer], {cwd: repository, encoding: 'utf8'});
    assert.equal(secondInstall.status, 0, secondInstall.stderr);
    assert.notEqual(activeSnapshot(hooks).bundle, bundleBefore);
    assert.equal(readFileSync(target, 'utf8'), targetBefore);
  } finally {
    if (dispatcherDir) chmodSync(dispatcherDir, 0o755);
    rmSync(repository, {recursive: true, force: true});
  }
});

test('uninstall refuses to delete an unmanaged same-name packet-review subhook', () => {
  const repository = prepareHookRepository();
  try {
    const install = spawnSync(process.execPath, [installer], {cwd: repository, encoding: 'utf8'});
    assert.equal(install.status, 0, install.stderr);
    const hooks = git(repository, ['rev-parse', '--path-format=absolute', '--git-path', 'hooks']);
    const target = join(hooks, 'pre-push.d', 'chaotang-packet-review');
    writeFileSync(target, '#!/bin/sh\necho unmanaged\n');
    const before = readFileSync(target, 'utf8');
    const uninstall = spawnSync(process.execPath, [installer, '--uninstall'], {cwd: repository, encoding: 'utf8'});
    assert.equal(uninstall.status, 1);
    assert.equal(readFileSync(target, 'utf8'), before);
  } finally {
    rmSync(repository, {recursive: true, force: true});
  }
});

test('reinstall refuses a hard-linked packet-review subhook without overwriting its peer', () => {
  const repository = prepareHookRepository();
  try {
    const install = spawnSync(process.execPath, [installer], {cwd: repository, encoding: 'utf8'});
    assert.equal(install.status, 0, install.stderr);
    const hooks = git(repository, ['rev-parse', '--path-format=absolute', '--git-path', 'hooks']);
    const target = join(hooks, 'pre-push.d', 'chaotang-packet-review');
    const userOwned = join(repository, 'user-owned.txt');
    const before = `${readFileSync(target, 'utf8')}# USER SENTINEL\n`;
    writeFileSync(userOwned, before);
    rmSync(target);
    linkSync(userOwned, target);

    const reinstall = spawnSync(process.execPath, [installer], {cwd: repository, encoding: 'utf8'});
    assert.equal(reinstall.status, 1);
    assert.equal(readFileSync(userOwned, 'utf8'), before);
    assert.equal(lstatSync(target).nlink, 2);
  } finally {
    rmSync(repository, {recursive: true, force: true});
  }
});

function assertReinstallRefusesSnapshotSymlink(relativePath) {
  const repository = prepareHookRepository();
  try {
    const install = spawnSync(process.execPath, [installer], {cwd: repository, encoding: 'utf8'});
    assert.equal(install.status, 0, install.stderr);
    const hooks = git(repository, ['rev-parse', '--path-format=absolute', '--git-path', 'hooks']);
    const snapshotFile = join(activeSnapshot(hooks).path, relativePath);
    const userOwned = join(repository, 'user-owned.txt');
    writeFileSync(userOwned, 'preserve me\n');
    rmSync(snapshotFile);
    symlinkSync(userOwned, snapshotFile);

    const reinstall = spawnSync(process.execPath, [installer], {cwd: repository, encoding: 'utf8'});
    assert.equal(reinstall.status, 1);
    assert.equal(readFileSync(userOwned, 'utf8'), 'preserve me\n');
    assert.equal(lstatSync(snapshotFile).isSymbolicLink(), true);
  } finally {
    rmSync(repository, {recursive: true, force: true});
  }
}

test('reinstall refuses a symlinked snapshot CLI without overwriting its target', () => {
  assertReinstallRefusesSnapshotSymlink('packet-review-pre-push.mjs');
});

test('reinstall refuses a symlinked snapshot core without overwriting its target', () => {
  assertReinstallRefusesSnapshotSymlink(join('lib', 'packet-review-local-feedback.mjs'));
});

test('failed snapshot refresh preserves the complete previously active bundle', () => {
  const repository = prepareHookRepository();
  try {
    const install = spawnSync(process.execPath, [installer], {cwd: repository, encoding: 'utf8'});
    assert.equal(install.status, 0, install.stderr);
    const hooks = git(repository, ['rev-parse', '--path-format=absolute', '--git-path', 'hooks']);
    const snapshot = activeSnapshot(hooks);
    const snapshotCli = join(snapshot.path, 'packet-review-pre-push.mjs');
    const snapshotCore = join(snapshot.path, 'lib', 'packet-review-local-feedback.mjs');
    const beforeCli = readFileSync(snapshotCli, 'utf8');
    const beforeCore = readFileSync(snapshotCore, 'utf8');

    writeFileSync(join(repository, 'scripts', 'packet-review-pre-push.mjs'), '# new CLI bytes\n');
    const sourceCore = join(repository, 'scripts', 'lib', 'packet-review-local-feedback.mjs');
    rmSync(sourceCore);
    mkdirSync(sourceCore);

    const reinstall = spawnSync(process.execPath, [installer], {cwd: repository, encoding: 'utf8'});
    assert.equal(reinstall.status, 1);
    assert.equal(activeSnapshot(hooks).bundle, snapshot.bundle);
    assert.equal(readFileSync(snapshotCli, 'utf8'), beforeCli);
    assert.equal(readFileSync(snapshotCore, 'utf8'), beforeCore);
  } finally {
    rmSync(repository, {recursive: true, force: true});
  }
});

test('installed hook does not depend on the current linked worktree containing gate scripts', () => {
  const repository = prepareHookRepository();
  const linked = `${repository}-legacy-linked`;
  try {
    const legacyCommit = git(repository, ['rev-list', '--max-parents=0', 'HEAD']);
    git(repository, ['worktree', 'add', '--detach', linked, legacyCommit]);
    const install = spawnSync(process.execPath, [installer], {cwd: repository, encoding: 'utf8'});
    assert.equal(install.status, 0, install.stderr);
    const hooks = git(repository, ['rev-parse', '--path-format=absolute', '--git-path', 'hooks']);
    const input = `refs/heads/dev ${'1'.repeat(40)} refs/heads/dev ${'2'.repeat(40)}\n`;
    const result = spawnSync(join(hooks, 'pre-push'), ['origin', 'ssh://example'], {
      cwd: linked,
      input,
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr);
  } finally {
    try { git(repository, ['worktree', 'remove', '--force', linked]); } catch {}
    rmSync(repository, {recursive: true, force: true});
    rmSync(linked, {recursive: true, force: true});
  }
});

test('pre-push dispatcher replays identical stdin to every executable subhook', () => {
  const repository = prepareHookRepository();
  try {
    const install = spawnSync(process.execPath, [installer], {cwd: repository, encoding: 'utf8'});
    assert.equal(install.status, 0, install.stderr);
    const hooks = git(repository, ['rev-parse', '--path-format=absolute', '--git-path', 'hooks']);
    const subhooks = join(hooks, 'pre-push.d');
    const firstOut = join(repository, 'first.out');
    const secondOut = join(repository, 'second.out');
    for (const [name, output] of [['chaotang-packet-review', firstOut], ['other', secondOut]]) {
      const path = join(subhooks, name);
      writeFileSync(path, `#!/bin/sh\ncat > "${output}"\n`);
      chmodSync(path, 0o755);
    }
    const input = `refs/heads/dev ${'1'.repeat(40)} refs/heads/dev ${'2'.repeat(40)}\n`;
    const result = spawnSync(join(hooks, 'pre-push'), ['origin', 'ssh://example'], {
      cwd: repository,
      input,
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(readFileSync(firstOut, 'utf8'), input);
    assert.equal(readFileSync(secondOut, 'utf8'), input);
  } finally {
    rmSync(repository, {recursive: true, force: true});
  }
});

test('project manifest registers the local-only status, trust boundary, and reproducible assets', () => {
  const manifest = JSON.parse(readFileSync(join(process.cwd(), '.harness', 'manifest', 'project-harness.json'), 'utf8'));
  assert.deepEqual(manifest.packetReviewLocalFeedback, {
    status: 'LOCAL_FEEDBACK_ONLY',
    activationSha: 'd8d8a6ae23d013bede6b1db649b06eb5ed38ea1f',
    targetRemote: 'origin',
    targetRef: 'refs/heads/feature-chaotang-ext',
    securityBoundary: false,
    requiredCheckVerified: false,
    documentation: '.harness/wiki/packet-review-local-feedback.md',
    contract: '.harness/contracts/packet-review-approval.schema.json',
    installer: 'scripts/install-packet-review-hooks.mjs',
    verifier: 'scripts/packet-review-pre-push.mjs',
    verification: ['node --test scripts/packet-review-local-feedback.nodetest.mjs'],
  });
  for (const path of [
    manifest.packetReviewLocalFeedback.documentation,
    manifest.packetReviewLocalFeedback.contract,
    manifest.packetReviewLocalFeedback.installer,
    manifest.packetReviewLocalFeedback.verifier,
  ]) assert.equal(existsSync(join(process.cwd(), path)), true, path);
});
