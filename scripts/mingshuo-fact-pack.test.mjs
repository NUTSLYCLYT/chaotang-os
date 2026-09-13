import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, openSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { runRelay } from "./mingshuo-fact-pack.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const APPROVAL = "9642980fdc094eddf737cc6cff6fdfd6d1df07b6";
const PATHS = [
  "backend/app/api/mingshuo.py",
  "backend/app/main.py",
  "backend/app/mingshuo/__init__.py",
  "backend/app/mingshuo/fact_pack.py",
  "backend/app/mingshuo/models.py",
  "backend/app/mingshuo/service.py",
  "backend/app/mingshuo/storage.py",
  "backend/app/operations/runtime_data_registry.py",
  "backend/app/operations/sqlite_backup.py",
  "backend/tests/test_mingshuo_fact_pack.py",
  "backend/tests/test_mingshuo_vertical.py",
  "backend/tests/test_readiness.py",
  "backend/tests/test_sqlite_backup.py",
  "deploy/release-manifest.schema.json",
  "docs/contracts/mingshuo-project-fact-pack.source-provenance.v1.json",
  "scripts/build_offline_release.mjs",
  "scripts/build_offline_release.test.mjs",
  "scripts/mingshuo-fact-pack.mjs",
  "scripts/mingshuo-fact-pack.test.mjs",
  "scripts/run_rc1_release_acceptance.mjs",
  "scripts/run_rc1_release_acceptance.test.mjs",
  "scripts/verify_offline_release.mjs",
  "scripts/verify_offline_release.test.mjs",
];
const SOURCES = [
  "backend/app/mingshuo/fact_pack.py",
  "docs/contracts/mingshuo-project-fact-pack.schema.json",
  "docs/contracts/mingshuo-project-fact-pack.v1.golden.json",
  "scripts/mingshuo-fact-pack.mjs",
];
function git(root, args) { return execFileSync("/usr/bin/git", args, { cwd: root, encoding: "utf8" }).trim(); }
function refreshProvenance(root) {
  const sources = SOURCES.map((relative) => {
    const bytes = readFileSync(path.join(root, relative));
    return { path: relative, mode: "100644", bytes: bytes.length, rawSha256: `sha256:${createHash("sha256").update(bytes).digest("hex")}` };
  });
  writeFileSync(path.join(root, "docs/contracts/mingshuo-project-fact-pack.source-provenance.v1.json"), JSON.stringify({ schemaVersion: "mingshuo.fact-pack.source-provenance.v1", sources }));
}
function createCandidate(t, { extraCandidatePath = false, omitPath = null, parentGap = false, evaluatorSource = null, relayTransform = null, manifestTransform = null } = {}) {
  const root = mkdtempSync(path.join(tmpdir(), "mfp-candidate-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  execFileSync("/usr/bin/git", ["clone", "-q", "--shared", "--no-checkout", ROOT, root]);
  git(root, ["checkout", "-q", APPROVAL]); git(root, ["config", "user.email", "test.invalid"]); git(root, ["config", "user.name", "test"]);
  if (parentGap) { writeFileSync(path.join(root, "parent-gap.txt"), "gap\n"); git(root, ["add", "parent-gap.txt"]); git(root, ["commit", "-qm", "parent gap"]); }
  for (const relative of PATHS) { if (relative === omitPath) continue; const target = path.join(root, relative); mkdirSync(path.dirname(target), { recursive: true }); copyFileSync(path.join(ROOT, relative), target); }
  if (evaluatorSource !== null) writeFileSync(path.join(root, SOURCES[0]), evaluatorSource);
  if (relayTransform !== null) { const relay = path.join(root, SOURCES[3]); writeFileSync(relay, relayTransform(readFileSync(relay, "utf8"))); }
  refreshProvenance(root);
  if (manifestTransform !== null) { const manifest = path.join(root, "docs/contracts/mingshuo-project-fact-pack.source-provenance.v1.json"); writeFileSync(manifest, manifestTransform(readFileSync(manifest, "utf8"))); }
  if (extraCandidatePath) writeFileSync(path.join(root, "candidate-extra.txt"), "extra\n");
  git(root, ["add", "--", ...PATHS.filter((item) => item !== omitPath), ...(extraCandidatePath ? ["candidate-extra.txt"] : [])]); git(root, ["commit", "-qm", "exact23 candidate"]);
  return root;
}
function check(root, args = ["--check"], input = "") { return spawnSync(process.execPath, [path.join(root, "scripts/mingshuo-fact-pack.mjs"), ...args], { cwd: root, input, encoding: "utf8", env: { ...process.env, HOME: "/attacker", HTTPS_PROXY: "http://attacker.invalid:1", PYTHONPATH: "/attacker" } }); }

test("real approval to exact23 direct child passes check", (t) => {
  const root = createCandidate(t); const result = check(root);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).decision, "PASS", result.stdout);
});

test("real candidate rejects uncommitted and committed source tampering", (t) => {
  const root = createCandidate(t); writeFileSync(path.join(root, "backend/app/mingshuo/fact_pack.py"), "# drift\n");
  assert.equal(JSON.parse(check(root).stdout).decision, "STOP");
  git(root, ["add", "backend/app/mingshuo/fact_pack.py"]);
  assert.equal(JSON.parse(check(root).stdout).decision, "STOP");
  git(root, ["add", "backend/app/mingshuo/fact_pack.py"]); git(root, ["commit", "-qm", "tamper"]);
  assert.equal(JSON.parse(check(root).stdout).decision, "STOP");
});

test("candidate with an extra product change is rejected", (t) => {
  const root = createCandidate(t, { extraCandidatePath: true });
  assert.equal(JSON.parse(check(root).stdout).decision, "STOP");
});

test("candidate missing one exact23 path and non-direct child are rejected", (t) => {
  const missing = createCandidate(t, { omitPath: "scripts/verify_offline_release.test.mjs" });
  assert.equal(JSON.parse(check(missing).stdout).decision, "STOP");
  const gap = createCandidate(t, { parentGap: true });
  assert.equal(JSON.parse(check(gap).stdout).decision, "STOP");
});

test("source manifest reorder, duplicate, extra and stale identities fail closed", (t) => {
  const mutations = [
    (manifest) => JSON.stringify({ ...JSON.parse(manifest), sources: JSON.parse(manifest).sources.toReversed() }),
    (manifest) => { const value = JSON.parse(manifest); value.sources.push(value.sources[0]); return JSON.stringify(value); },
    (manifest) => { const value = JSON.parse(manifest); value.sources.push({ path: "extra.py", mode: "100644", bytes: 1, rawSha256: `sha256:${"0".repeat(64)}` }); return JSON.stringify(value); },
    (manifest) => { const value = JSON.parse(manifest); value.sources[0].rawSha256 = `sha256:${"0".repeat(64)}`; return JSON.stringify(value); },
  ];
  for (const manifestTransform of mutations) {
    const root = createCandidate(t, { manifestTransform });
    assert.equal(JSON.parse(check(root).stdout).decision, "STOP");
  }
});

test("unshare identity and exact version drift fail before evaluator execution", (t) => {
  const missing = createCandidate(t, { relayTransform: (source) => source.replace('const UNSHARE = "/usr/bin/unshare";', 'const UNSHARE = "/missing/unshare";') });
  assert.equal(JSON.parse(check(missing).stdout).decision, "STOP");
  const version = createCandidate(t, { relayTransform: (source) => source.replace("unshare from util-linux 2.39.3", "unshare from util-linux 0.0.0") });
  assert.equal(JSON.parse(check(version).stdout).decision, "STOP");
});

test("evaluator and its child have no host network, credential environment or inherited fds", (t) => {
  const evaluatorSource = String.raw`
import os, socket, subprocess
def network_blocked(family, address):
    sock = socket.socket(family, socket.SOCK_STREAM)
    sock.settimeout(0.2)
    try:
        sock.connect(address)
        return False
    except OSError:
        return True
    finally:
        sock.close()
def evaluate_json_wire(raw, now):
    forbidden = ("HOME", "HTTPS_PROXY", "HTTP_PROXY", "ALL_PROXY", "AWS_ACCESS_KEY_ID", "SSH_AUTH_SOCK", "SECRET_TOKEN")
    env_clean = not any(key in os.environ for key in forbidden)
    fds_clean = True
    for fd in range(3, 64):
        try:
            os.fstat(fd)
            fds_clean = False
        except OSError:
            pass
    interfaces = [line.split(":", 1)[0].strip() for line in open("/proc/net/dev", encoding="utf-8").read().splitlines() if ":" in line]
    ipv4 = network_blocked(socket.AF_INET, ("1.1.1.1", 53))
    ipv6 = network_blocked(socket.AF_INET6, ("2606:4700:4700::1111", 53, 0, 0))
    try:
        socket.getaddrinfo("example.com", 443)
        dns = False
    except OSError:
        dns = True
    child = subprocess.run(["/usr/bin/python3.12", "-I", "-c", "import socket,sys;s=socket.socket();s.settimeout(.2);\ntry:s.connect(('1.1.1.1',53));sys.exit(2)\nexcept OSError:sys.exit(0)"], env={"PATH":"/usr/bin:/bin"}, close_fds=True, check=False)
    safe = env_clean and fds_clean and interfaces == ["lo"] and ipv4 and ipv6 and dns and child.returncode == 0
    return {"decision": "PASS" if safe else "STOP", "nonAuthorizing": True}
`;
  const root = createCandidate(t, { evaluatorSource });
  const result = check(root);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).decision, "PASS", result.stdout);
});

test("index executable drift stops even when local core.filemode is false", (t) => {
  const root = createCandidate(t);
  git(root, ["config", "core.filemode", "false"]);
  git(root, ["update-index", "--chmod=+x", "scripts/mingshuo-fact-pack.mjs"]);
  assert.equal(JSON.parse(check(root).stdout).decision, "STOP");
});

test("clean unrelated descendant passes, while exact23 descendant drift stops", (t) => {
  const root = createCandidate(t);
  writeFileSync(path.join(root, "scripts/product-authority.mjs"), "// unrelated candidate descendant\n");
  git(root, ["add", "scripts/product-authority.mjs"]); git(root, ["commit", "-qm", "unrelated descendant"]);
  assert.equal(JSON.parse(check(root).stdout).decision, "PASS", check(root).stdout);
  writeFileSync(path.join(root, "backend/app/mingshuo/service.py"), "# drift\n");
  git(root, ["add", "backend/app/mingshuo/service.py"]); git(root, ["commit", "-qm", "exact23 descendant drift"]);
  assert.equal(JSON.parse(check(root).stdout).decision, "STOP");
});

test("local git fsmonitor configuration cannot execute during trusted checks", (t) => {
  const root = createCandidate(t); const outside = mkdtempSync(path.join(tmpdir(), "mfp-fsmonitor-")); t.after(() => rmSync(outside, { recursive: true, force: true })); const marker = path.join(outside, "fsmonitor-ran"); const hook = path.join(outside, "fsmonitor-hook");
  writeFileSync(hook, `#!/bin/sh\ntouch '${marker}'\n`); chmodSync(hook, 0o755);
  git(root, ["config", "core.fsmonitor", hook]);
  const result = check(root);
  assert.equal(JSON.parse(result.stdout).decision, "PASS", result.stdout);
  assert.equal(existsSync(marker), false);
});

test("relay limits and timeout resolve only after child close and reap", async () => {
  class FakeChild extends EventEmitter {
    constructor() { super(); this.pid = 4242; this.stdin = new PassThrough(); this.stdout = new PassThrough(); this.stderr = new PassThrough(); }
  }
  const killed = []; let child;
  const spawn = () => { child = new FakeChild(); return child; };
  const fd = openSync("/dev/null", "r");
  const pending = runRelay({ interpreterFd: fd, unshareFd: openSync("/dev/null", "r"), payload: Buffer.from("x"), spawn, kill: (...args) => killed.push(args), limits: { stdin: 1, stdout: 2, stderr: 2, timeoutMs: 5, killMs: 5 } });
  child.stdout.write(Buffer.from("flood"));
  await new Promise((resolve) => setTimeout(resolve, 15));
  assert.deepEqual(killed.map((entry) => entry[1]), ["SIGTERM", "SIGKILL"]);
  let settled = false; pending.then(() => { settled = true; });
  assert.equal(settled, false);
  child.emit("close", 0);
  assert.equal((await pending).errors[0], "RELAY_STDOUT_LIMIT");
});

test("relay stderr flood is bounded and fails closed", async () => {
  const result = await new Promise(async (resolve) => {
    let child;
    const pending = runRelay({ interpreterFd: openSync("/dev/null", "r"), unshareFd: openSync("/dev/null", "r"), payload: Buffer.from("x"), spawn: () => { child = new EventEmitter(); child.pid = 11; child.stdin = new PassThrough(); child.stdout = new PassThrough(); child.stderr = new PassThrough(); return child; }, kill: () => {}, limits: { stdin: 1, stdout: 2, stderr: 2, timeoutMs: 50, killMs: 1 } });
    child.stderr.write(Buffer.from("flood")); child.emit("close", 1); resolve(await pending);
  });
  assert.equal(result.errors[0], "RELAY_STDERR_LIMIT");
});

test("relay spawn errors and invalid utf8 output fail closed", async () => {
  const synchronous = await runRelay({ interpreterFd: openSync("/dev/null", "r"), unshareFd: openSync("/dev/null", "r"), payload: Buffer.from("x"), spawn: () => { throw new Error("no"); } });
  assert.equal(synchronous.errors[0], "RELAY_SPAWN_FAILED");
  const failure = await runRelay({ interpreterFd: openSync("/dev/null", "r"), unshareFd: openSync("/dev/null", "r"), payload: Buffer.from("x"), spawn: () => { const child = new EventEmitter(); child.stdin = new PassThrough(); child.stdout = new PassThrough(); child.stderr = new PassThrough(); queueMicrotask(() => child.emit("error", new Error("no"))); return child; } });
  assert.equal(failure.errors[0], "RELAY_SPAWN_FAILED");
  const invalid = await runRelay({ interpreterFd: openSync("/dev/null", "r"), unshareFd: openSync("/dev/null", "r"), payload: Buffer.from("x"), spawn: () => { const child = new EventEmitter(); child.pid = 9; child.stdin = new PassThrough(); child.stdout = new PassThrough(); child.stderr = new PassThrough(); queueMicrotask(() => { child.stdout.write(Buffer.from([0xff])); child.emit("close", 0); }); return child; } });
  assert.equal(invalid.errors[0], "RELAY_OUTPUT_INVALID");
});

test("relay stdin EPIPE is handled and does not leak an uncaught error", async () => {
  const result = await runRelay({ interpreterFd: openSync("/dev/null", "r"), unshareFd: openSync("/dev/null", "r"), payload: Buffer.from("x"), spawn: () => { const child = new EventEmitter(); child.pid = 10; child.stdin = new PassThrough(); child.stdout = new PassThrough(); child.stderr = new PassThrough(); queueMicrotask(() => { child.stdin.emit("error", Object.assign(new Error("EPIPE"), { code: "EPIPE" })); child.emit("close", 1); }); return child; } });
  assert.equal(result.errors[0], "RELAY_EXECUTION_FAILED");
});

test("input cap and malformed invocations remain fail-closed", () => {
  const result = spawnSync(process.execPath, [path.join(ROOT, "scripts/mingshuo-fact-pack.mjs"), "--evaluate-wire"], { cwd: ROOT, input: "x".repeat(1_048_577), encoding: "utf8" });
  assert.deepEqual(JSON.parse(result.stdout).errors, ["INPUT_BYTES_LIMIT"]);
  assert.equal(spawnSync(process.execPath, [path.join(ROOT, "scripts/mingshuo-fact-pack.mjs"), "--unknown"], { encoding: "utf8" }).status, 2);
});
