import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const frontendRoot = join(__dirname, '..');
const doctorScript = join(__dirname, 'harness-doctor.mjs');
const appRoot = join(frontendRoot, 'src', 'app');

function runDoctor() {
  return spawnSync(process.execPath, [doctorScript], { cwd: frontendRoot, encoding: 'utf8' });
}

test('BFF guard: clean repo has no src/app/api and no route.* handlers', () => {
  const result = runDoctor();
  const output = `${result.stdout}${result.stderr}`;
  assert.match(output, /\[ok\] no BFF directory: src\/app\/api/);
  assert.match(output, /\[ok\] no App Router route handlers in src\/app/);
});

test('BFF guard: fails when src/app/api exists', () => {
  const bffDir = join(appRoot, 'api', '__bff_guard_regression_test__');
  mkdirSync(bffDir, { recursive: true });
  try {
    const result = runDoctor();
    const output = `${result.stdout}${result.stderr}`;
    assert.notEqual(result.status, 0);
    assert.match(output, /BFF layer forbidden: remove src\/app\/api/);
  } finally {
    rmSync(join(appRoot, 'api'), { recursive: true, force: true });
  }
  assert.equal(existsSync(join(appRoot, 'api')), false);
});

test('BFF guard: fails when a route.ts handler exists under src/app', () => {
  const routeDir = join(appRoot, '__bff_guard_regression_test__');
  mkdirSync(routeDir, { recursive: true });
  writeFileSync(join(routeDir, 'route.ts'), 'export async function GET() {\n  return new Response("x");\n}\n');
  try {
    const result = runDoctor();
    const output = `${result.stdout}${result.stderr}`;
    assert.notEqual(result.status, 0);
    assert.match(output, /BFF route handlers forbidden/);
    assert.match(output, /__bff_guard_regression_test__\/route\.ts/);
  } finally {
    rmSync(routeDir, { recursive: true, force: true });
  }
  assert.equal(existsSync(routeDir), false);
});
