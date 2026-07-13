import assert from 'node:assert/strict';
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), 'system-restore.sh');

function fakeCommand(bin, name, body) {
  const path = join(bin, name);
  writeFileSync(path, `#!/bin/sh\n${body}\n`, 'utf8');
  chmodSync(path, 0o755);
}

function runDryRestore({ healthy }) {
  const root = mkdtempSync(join(tmpdir(), 'chaotang-restore-dry-'));
  const bin = join(root, 'bin');
  const restartMarker = join(root, 'restart-called');

  mkdirSync(bin, { recursive: true });

  fakeCommand(
    bin,
    'systemctl',
    `case "$*" in
  *list-units*) printf 'jiqun.service loaded inactive dead\\nnginx-app.service loaded inactive dead\\n'; exit 0 ;;
  *restart*) printf called > '${restartMarker}'; exit 99 ;;
  *is-active*) exit 3 ;;
esac
exit 0`,
  );
  fakeCommand(bin, 'curl', healthy ? 'exit 0' : 'exit 7');
  fakeCommand(
    bin,
    'ss',
    healthy
      ? "printf 'LISTEN :4444\\nLISTEN :18003\\nLISTEN :8081\\nLISTEN :3050\\n'"
      : 'exit 0',
  );
  fakeCommand(bin, 'sleep', 'exit 0');

  const result = spawnSync('bash', [SCRIPT, '--dry-run'], {
    encoding: 'utf8',
    env: { ...process.env, PATH: `${bin}:${process.env.PATH}` },
  });
  const restartProbe = spawnSync('test', ['-e', restartMarker]);
  rmSync(root, { recursive: true, force: true });
  return { ...result, restartCalled: restartProbe.status === 0 };
}

test('dry-run exits non-zero when registered services have no healthy endpoints', () => {
  const result = runDryRestore({ healthy: false });

  assert.notEqual(result.status, 0, result.stdout);
  assert.doesNotMatch(result.stdout, /全部服务恢复正常/);
  assert.equal(result.restartCalled, false, 'dry-run must never restart a service');
});

test('dry-run accepts manually running endpoints without restarting inactive units', () => {
  const result = runDryRestore({ healthy: true });

  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /全部服务恢复正常/);
  assert.doesNotMatch(result.stdout, /未监听/, result.stdout);
  assert.equal(result.restartCalled, false, 'dry-run must never restart a service');
});
