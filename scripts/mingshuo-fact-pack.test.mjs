import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, openSync, rmSync, writeFileSync } from "node:fs";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { runRelay } from "./mingshuo-fact-pack.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const APPROVAL = "0b03d13f9a5d966d793128cfbcce93c17ba55c0f";
const PATHS = [
  "backend/app/mingshuo/__init__.py", "backend/app/mingshuo/fact_pack.py",
  "backend/tests/test_mingshuo_fact_pack.py", "docs/contracts/mingshuo-project-fact-pack.source-provenance.v1.json",
  "docs/contracts/mingshuo-project-fact-pack.v1.golden.json", "docs/contracts/mingshuo-project-fact-pack.v1.md",
  "scripts/mingshuo-fact-pack.mjs", "scripts/mingshuo-fact-pack.test.mjs",
];
function git(root, args) { return execFileSync("/usr/bin/git", args, { cwd: root, encoding: "utf8" }).trim(); }
function createCandidate(t, { extraCandidatePath = false } = {}) {
  const root = mkdtempSync(path.join(tmpdir(), "mfp-candidate-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  execFileSync("/usr/bin/git", ["clone", "-q", "--no-checkout", ROOT, root]);
  git(root, ["checkout", "-q", APPROVAL]); git(root, ["config", "user.email", "test.invalid"]); git(root, ["config", "user.name", "test"]);
  for (const relative of PATHS) { const target = path.join(root, relative); mkdirSync(path.dirname(target), { recursive: true }); copyFileSync(path.join(ROOT, relative), target); }
  if (extraCandidatePath) writeFileSync(path.join(root, "candidate-extra.txt"), "extra\n");
  git(root, ["add", "--", ...PATHS, ...(extraCandidatePath ? ["candidate-extra.txt"] : [])]); git(root, ["commit", "-qm", "exact8 candidate"]);
  return root;
}
function check(root, args = ["--check"], input = "") { return spawnSync(process.execPath, [path.join(root, "scripts/mingshuo-fact-pack.mjs"), ...args], { cwd: root, input, encoding: "utf8", env: { ...process.env, HOME: "/attacker", HTTPS_PROXY: "http://attacker.invalid:1", PYTHONPATH: "/attacker" } }); }

test("real approval to exact8 direct child passes check", (t) => {
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

test("index executable drift stops even when local core.filemode is false", (t) => {
  const root = createCandidate(t);
  git(root, ["config", "core.filemode", "false"]);
  git(root, ["update-index", "--chmod=+x", "scripts/mingshuo-fact-pack.mjs"]);
  assert.equal(JSON.parse(check(root).stdout).decision, "STOP");
});

test("clean unrelated descendant passes, while exact8 descendant drift stops", (t) => {
  const root = createCandidate(t);
  writeFileSync(path.join(root, "scripts/product-authority.mjs"), "// unrelated candidate descendant\n");
  git(root, ["add", "scripts/product-authority.mjs"]); git(root, ["commit", "-qm", "unrelated descendant"]);
  assert.equal(JSON.parse(check(root).stdout).decision, "PASS", check(root).stdout);
  writeFileSync(path.join(root, "docs/contracts/mingshuo-project-fact-pack.v1.md"), "# drift\n");
  git(root, ["add", "docs/contracts/mingshuo-project-fact-pack.v1.md"]); git(root, ["commit", "-qm", "exact8 descendant drift"]);
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
  const pending = runRelay({ interpreterFd: fd, payload: Buffer.from("x"), spawn, kill: (...args) => killed.push(args), limits: { stdin: 1, stdout: 2, stderr: 2, timeoutMs: 5, killMs: 5 } });
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
    const pending = runRelay({ interpreterFd: openSync("/dev/null", "r"), payload: Buffer.from("x"), spawn: () => { child = new EventEmitter(); child.pid = 11; child.stdin = new PassThrough(); child.stdout = new PassThrough(); child.stderr = new PassThrough(); return child; }, kill: () => {}, limits: { stdin: 1, stdout: 2, stderr: 2, timeoutMs: 50, killMs: 1 } });
    child.stderr.write(Buffer.from("flood")); child.emit("close", 1); resolve(await pending);
  });
  assert.equal(result.errors[0], "RELAY_STDERR_LIMIT");
});

test("relay spawn errors and invalid utf8 output fail closed", async () => {
  const synchronous = await runRelay({ interpreterFd: openSync("/dev/null", "r"), payload: Buffer.from("x"), spawn: () => { throw new Error("no"); } });
  assert.equal(synchronous.errors[0], "RELAY_SPAWN_FAILED");
  const failure = await runRelay({ interpreterFd: openSync("/dev/null", "r"), payload: Buffer.from("x"), spawn: () => { const child = new EventEmitter(); child.stdin = new PassThrough(); child.stdout = new PassThrough(); child.stderr = new PassThrough(); queueMicrotask(() => child.emit("error", new Error("no"))); return child; } });
  assert.equal(failure.errors[0], "RELAY_SPAWN_FAILED");
  const invalid = await runRelay({ interpreterFd: openSync("/dev/null", "r"), payload: Buffer.from("x"), spawn: () => { const child = new EventEmitter(); child.pid = 9; child.stdin = new PassThrough(); child.stdout = new PassThrough(); child.stderr = new PassThrough(); queueMicrotask(() => { child.stdout.write(Buffer.from([0xff])); child.emit("close", 0); }); return child; } });
  assert.equal(invalid.errors[0], "RELAY_OUTPUT_INVALID");
});

test("relay stdin EPIPE is handled and does not leak an uncaught error", async () => {
  const result = await runRelay({ interpreterFd: openSync("/dev/null", "r"), payload: Buffer.from("x"), spawn: () => { const child = new EventEmitter(); child.pid = 10; child.stdin = new PassThrough(); child.stdout = new PassThrough(); child.stderr = new PassThrough(); queueMicrotask(() => { child.stdin.emit("error", Object.assign(new Error("EPIPE"), { code: "EPIPE" })); child.emit("close", 1); }); return child; } });
  assert.equal(result.errors[0], "RELAY_EXECUTION_FAILED");
});

test("input cap and malformed invocations remain fail-closed", () => {
  const result = spawnSync(process.execPath, [path.join(ROOT, "scripts/mingshuo-fact-pack.mjs"), "--evaluate-wire"], { cwd: ROOT, input: "x".repeat(1_048_577), encoding: "utf8" });
  assert.deepEqual(JSON.parse(result.stdout).errors, ["INPUT_BYTES_LIMIT"]);
  assert.equal(spawnSync(process.execPath, [path.join(ROOT, "scripts/mingshuo-fact-pack.mjs"), "--unknown"], { encoding: "utf8" }).status, 2);
});
