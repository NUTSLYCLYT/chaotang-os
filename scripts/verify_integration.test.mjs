import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("./verify_integration.mjs", import.meta.url), "utf8");

test("POSIX services run in isolated process groups and cleanup targets the whole group", () => {
  assert.match(source, /detached:\s*!IS_WINDOWS/);
  assert.match(source, /process\.kill\(-pid,\s*"SIGTERM"\)/);
  assert.match(source, /process\.kill\(-pid,\s*"SIGKILL"\)/);
  assert.match(source, /"taskkill",\s*\["\/pid",[\s\S]*?"\/T",\s*"\/F"\]/);
});

test("home-page integration checks visible markup instead of hydration symbols", () => {
  assert.doesNotMatch(
    source,
    /assertPage\("\/",\s*\{\s*contains:\s*"WelcomeGate"/,
  );
  assert.match(source, /assertPage\("\/"[\s\S]*?<h1\[\^>\]\*>朝堂 OS<\\\/h1>/);
  assert.match(source, /assertPage\("\/"[\s\S]*?href="\\\/login"/);
});

test("unavailable backend stays reserved by a sentinel until scenario cleanup", () => {
  assert.match(source, /createUnavailableBackendSentinel/);
  assert.match(source, /const sentinel = await createUnavailableBackendSentinel\(\)/);
  assert.match(source, /finally\s*\{[\s\S]*?await sentinel\.close\(\)/);
});

test("service startup retries fresh unique ports after bind or readiness races", () => {
  assert.match(source, /startManagedServiceWithRetry/);
  assert.match(source, /usedPorts\.has\(port\)/);
  assert.match(source, /for\s*\(let attempt = 1; attempt <= MAX_START_ATTEMPTS; attempt \+= 1\)/);
});

test("decree BFF connectivity scenario asserts validation on a healthy backend, not network", () => {
  assert.match(source, /runDecreeBffConnectivityScenario/);
  assert.match(source, /\/api\/auth\/register/);
  assert.match(source, /decreeText:\s*""/);
  assert.match(
    source,
    /decreeResponse\.status !== 422[\s\S]*?期望下旨 BFF 返回 422（validation）/,
  );
  assert.match(source, /decreeResponse\.json\.reason !== "validation"/);
});

test("decree BFF connectivity scenario asserts network/503 with no leaked internal address when backend is unreachable", () => {
  assert.match(source, /createUnavailableBackendSentinel\(\)/);
  assert.match(
    source,
    /decreeResponse\.status !== 503[\s\S]*?期望下旨 BFF 返回 503（network）/,
  );
  assert.match(source, /decreeResponse\.json\.reason !== "network"/);
  assert.match(
    source,
    /leakNeedles = \[String\(sentinel\.port\), "BACKEND_BASE_URL", "127\.0\.0\.1"\]/,
  );
});
