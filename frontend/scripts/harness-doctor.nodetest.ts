import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, basename } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const frontendRoot = join(__dirname, '..');
const doctorScript = join(__dirname, 'harness-doctor.mjs');
const appRoot = join(frontendRoot, 'src', 'app');

function runDoctor() {
  return spawnSync(process.execPath, [doctorScript], { cwd: frontendRoot, encoding: 'utf8' });
}

// Removes exactly the path we created, then tries to remove its parent only
// if that parent is now empty. Never recursively deletes a shared directory
// (like src/app/api itself) — that could destroy a concurrent process's or
// the user's real, uncommitted content sitting alongside our test artifact.
function removeOwnArtifact(path: string, parent: string | null) {
  rmSync(path, { recursive: true, force: true });
  if (parent) {
    try {
      rmdirSync(parent);
    } catch {
      // Parent still has other content (or never existed) — leave it alone.
    }
  }
}

test('BFF guard: clean repo has no src/app/api and no route.* handlers', () => {
  const result = runDoctor();
  const output = `${result.stdout}${result.stderr}`;
  assert.match(output, /\[ok\] no BFF directory: src\/app\/api/);
  assert.match(output, /\[ok\] no App Router route handlers in src\/app/);
});

test('BFF guard: fails when src/app/api exists', () => {
  const apiDir = join(appRoot, 'api');
  const apiDirPreexisted = existsSync(apiDir);
  if (!apiDirPreexisted) mkdirSync(apiDir, { recursive: true });
  // mkdtempSync asks the OS for an atomically-unique path — unlike a
  // hand-rolled name (e.g. process.pid), this cannot collide with a stale
  // leftover, a concurrent run in a different PID namespace, or anything
  // else already present, so it's safe to create-then-delete unconditionally.
  const bffMarker = mkdtempSync(join(apiDir, 'bff-guard-test-'));
  try {
    const result = runDoctor();
    const output = `${result.stdout}${result.stderr}`;
    assert.notEqual(result.status, 0);
    assert.match(output, /BFF layer forbidden: remove src\/app\/api/);
  } finally {
    // Only remove the api/ parent ourselves if it did not exist before this
    // test — otherwise whatever was already there (ours or someone else's)
    // is left untouched.
    removeOwnArtifact(bffMarker, apiDirPreexisted ? null : apiDir);
  }
  assert.equal(existsSync(bffMarker), false);
});

test('BFF guard: fails when a route.ts handler exists under src/app', () => {
  // appRoot (src/app) always exists in a real Next.js project, so no
  // preexistence tracking/parent-removal is needed here — same
  // mkdtempSync-for-uniqueness reasoning as the case above.
  const routeDir = mkdtempSync(join(appRoot, 'bff-guard-test-'));
  writeFileSync(join(routeDir, 'route.ts'), 'export async function GET() {\n  return new Response("x");\n}\n');
  try {
    const result = runDoctor();
    const output = `${result.stdout}${result.stderr}`;
    assert.notEqual(result.status, 0);
    assert.match(output, /BFF route handlers forbidden/);
    assert.match(output, new RegExp(`${basename(routeDir)}/route\\.ts`));
  } finally {
    removeOwnArtifact(routeDir, null);
  }
  assert.equal(existsSync(routeDir), false);
});
