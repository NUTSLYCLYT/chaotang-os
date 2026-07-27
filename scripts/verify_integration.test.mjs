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
