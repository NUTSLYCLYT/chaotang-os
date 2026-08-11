import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { resolvePythonExecutable } from "./verify_integration_runtime.mjs";

const source = await readFile(new URL("./verify_integration.mjs", import.meta.url), "utf8");
const runtimeSource = await readFile(
  new URL("./verify_integration_runtime.mjs", import.meta.url),
  "utf8",
);

test("POSIX services run in isolated process groups and cleanup targets the whole group", () => {
  assert.match(source, /detached:\s*!IS_WINDOWS/);
  assert.match(source, /process\.kill\(-pid,\s*"SIGTERM"\)/);
  assert.match(source, /process\.kill\(-pid,\s*"SIGKILL"\)/);
  assert.match(source, /"taskkill",\s*\["\/pid",[\s\S]*?"\/T",\s*"\/F"\]/);
});

test("home-page integration checks visible markup instead of hydration symbols", () => {
  assert.doesNotMatch(source, /assertPage\("\/",\s*\{\s*contains:\s*"WelcomeGate"/);
  assert.match(source, /assertPage\("\/"[\s\S]*?<h1\[\^>\]\*>启 朝/);
  assert.match(source, /assertPage\("\/"[\s\S]*?href="\\\/login"/);
  assert.match(source, /assertPage\("\/"[\s\S]*?已有朝堂？登录/);
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

test("integration backend uses only temporary storage and cleans it after the run", () => {
  assert.match(source, /tests\.integration_isolated_app:app/);
  assert.match(source, /CHAOTANG_INTEGRATION_TMP/);
  assert.match(source, /mkdtemp/);
  assert.match(source, /rm\([\s\S]*?recursive:\s*true[\s\S]*?force:\s*true/);
});

test("integration Python pin is validated by executable behavior", () => {
  const absolutePython = "C:\\Python314\\python.exe";
  const backendDir = "C:\\repo\\backend";
  const options = {
    isWindows: true,
    backendDir,
    pathExists: (candidate) => candidate === absolutePython,
    pathIsFile: (candidate) => candidate === absolutePython,
    log: () => {},
  };

  assert.equal(
    resolvePythonExecutable({
      ...options,
      env: { CHAOTANG_INTEGRATION_PYTHON: absolutePython },
    }),
    absolutePython,
  );
  assert.equal(
    resolvePythonExecutable({
      env: { CHAOTANG_INTEGRATION_PYTHON: "/usr/bin/python3" },
      isWindows: false,
      backendDir: "/repo/backend",
      pathExists: (candidate) => candidate === "/usr/bin/python3",
      pathIsFile: (candidate) => candidate === "/usr/bin/python3",
      log: () => {},
    }),
    "/usr/bin/python3",
  );
  for (const invalid of ["", "   ", ".\\python.exe", "C:\\missing\\python.exe"]) {
    assert.throws(
      () => resolvePythonExecutable({
        ...options,
        env: { CHAOTANG_INTEGRATION_PYTHON: invalid },
      }),
      /CHAOTANG_INTEGRATION_PYTHON/,
    );
  }
  assert.throws(
    () => resolvePythonExecutable({
      ...options,
      env: { CHAOTANG_INTEGRATION_PYTHON: "C:\\Python314" },
      pathExists: () => true,
      pathIsFile: () => false,
    }),
    /CHAOTANG_INTEGRATION_PYTHON/,
  );
});

test("integration Python uses legacy fallback only when the pin is truly unset", () => {
  const backendDir = "C:\\repo\\backend";
  const venvPython = "C:\\repo\\backend\\.venv\\Scripts\\python.exe";
  assert.equal(
    resolvePythonExecutable({
      env: {},
      isWindows: true,
      backendDir,
      pathExists: (candidate) => candidate === venvPython,
      pathIsFile: () => true,
      log: () => {},
    }),
    venvPython,
  );
  assert.equal(
    resolvePythonExecutable({
      env: {},
      isWindows: true,
      backendDir,
      pathExists: () => false,
      pathIsFile: () => false,
      log: () => {},
    }),
    "python",
  );
});

test("integration Python validation uses the selected platform path semantics", () => {
  assert.match(runtimeSource, /pathApi\.isAbsolute\(configuredPython\)/);
  assert.doesNotMatch(runtimeSource, /(?<!pathApi)path\.isAbsolute\(configuredPython\)/);
});

test("all random loopback allocations explicitly exclude protected ports", () => {
  for (const port of [3000, 8000, 13000, 18000, 13381, 18381]) {
    assert.match(source, new RegExp(`PROTECTED_PORTS[\\s\\S]*?${port}`));
  }
  assert.match(source, /PROTECTED_PORTS\.has\(port\)/);
});

test("decree BFF connectivity proves backend reachability without invoking a model", () => {
  assert.match(source, /runDecreeBffConnectivityScenario/);
  assert.match(source, /\/api\/auth\/register/);
  assert.match(source, /\/api\/auth\/login/);
  assert.match(source, /draftVersion:\s*1/);
  assert.match(source, /draftFingerprint:\s*"0"\.repeat\(64\)/);
  assert.match(source, /idempotencyKey:/);
  assert.match(source, /decreeResponse\.status !== 409/);
  assert.match(source, /decreeResponse\.json\.reason !== "draft_not_current"/);
});

test("authenticated production entry smoke covers study and legacy Jinyiwei pages", () => {
  assert.match(source, /assertPage\("\/study"[\s\S]*?contains:\s*"上书房"/);
  assert.match(source, /assertPage\("\/jinyiwei"[\s\S]*?contains:\s*"锦衣卫"/);
  assert.match(source, /headers:\s*\{\s*cookie:\s*sessionCookieHeader\s*\}/);
});

test("unreachable backend maps to network 503 without internal address leakage", () => {
  assert.match(source, /decreeResponse\.status !== 503/);
  assert.match(source, /decreeResponse\.json\.reason !== "network"/);
  assert.match(
    source,
    /leakNeedles = \[String\(sentinel\.port\), "BACKEND_BASE_URL", "127\.0\.0\.1"\]/,
  );
});
