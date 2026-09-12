#!/usr/bin/env node
// Compatibility relay only: Python owns all Fact Pack semantic decisions.
import { createHash } from "node:crypto";
import childProcess from "node:child_process";
import { closeSync, constants as fsConstants, fstatSync, openSync, readFileSync, realpathSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = realpathSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."));
const GIT = "/usr/bin/git";
const PYTHON = "/usr/bin/python3.12";
const TASK = "MINGSHUO-FACT-PACK-V1-PYTHON-CANONICAL-RUNTIME-LINEAGE-SUCCESSOR-20260913";
const APPROVAL = `.harness/approvals/${TASK}.json`;
const MANIFEST = "docs/contracts/mingshuo-project-fact-pack.source-provenance.v1.json";
const SOURCES = Object.freeze(["backend/app/mingshuo/fact_pack.py", "docs/contracts/mingshuo-project-fact-pack.schema.json", "docs/contracts/mingshuo-project-fact-pack.v1.golden.json", "scripts/mingshuo-fact-pack.mjs"]);
const PRODUCT_PATHS = Object.freeze(["backend/app/mingshuo/__init__.py", "backend/app/mingshuo/fact_pack.py", "backend/tests/test_mingshuo_fact_pack.py", MANIFEST, "docs/contracts/mingshuo-project-fact-pack.v1.golden.json", "docs/contracts/mingshuo-project-fact-pack.v1.md", "scripts/mingshuo-fact-pack.mjs", "scripts/mingshuo-fact-pack.test.mjs"]);
const LIMITS = Object.freeze({ stdin: 1_048_576, stdout: 65_536, stderr: 16_384, timeoutMs: 5_000, killMs: 250 });
const MAX_SOURCE_BYTES = 10 * 1024 * 1024;
const GIT_GUARDS = Object.freeze(["-c", "core.filemode=true", "-c", "core.fsmonitor=false", "-c", "core.hooksPath=/dev/null", "-c", "core.pager=cat", "-c", "core.attributesfile=/dev/null"]);
const PYTHON_RELAY = [
  "import json,sys;", "take=lambda n:sys.stdin.buffer.read(n);", "item=lambda:take(int.from_bytes(take(8),'big'));",
  "source=item();schema=item();raw=item();", "assert sys.stdin.buffer.read(1)==b'';",
  "scope={'__file__':'backend/app/mingshuo/fact_pack.py','__name__':'mingshuo_verified_fact_pack'};",
  "exec(compile(source.decode('utf-8'),'backend/app/mingshuo/fact_pack.py','exec'),scope);",
  "scope['SCHEMA_BYTES']=schema;", "result=scope['evaluate_json_wire'](raw,now='2026-09-05T12:00:00Z');",
  "sys.stdout.write(json.dumps(result,ensure_ascii=False,sort_keys=True,separators=(',',':')))",
].join("");
function stop(code) { return { schemaVersion: "mingshuo.fact-pack.validation.v1", decision: "STOP", nonAuthorizing: true, errors: [code], holdReasons: [], blockReasons: [], evidenceDigest: null, factDigest: null, claimDigest: null, summary: { schemaVersion: "mingshuo.fact-pack.summary.v1", decision: "STOP", counts: { facts: 0, claims: 0, evidence: 0, errors: 1, holds: 0, blocks: 0 }, coverage: { evidence: 0, claims: 0 } }, businessSuccessMeasured: false, productionPromotionAuthorized: false }; }
function repoPath(relative) { return typeof relative === "string" && /^[A-Za-z0-9._/-]{1,240}$/.test(relative) && !relative.includes("//") && !relative.split("/").some((x) => !x || x === "." || x === "..") ? path.join(ROOT, ...relative.split("/")) : null; }
function closed(value, keys) { return value && typeof value === "object" && !Array.isArray(value) && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort()); }
function assertNoDuplicateJsonKeys(text) {
  let cursor = 0;
  const space = () => { while (/\s/u.test(text[cursor] ?? "")) cursor += 1; };
  const string = () => { if (text[cursor++] !== '"') throw new Error(); while (cursor < text.length) { const char = text[cursor++]; if (char === '"') return; if (char === "\\") { const escape = text[cursor++]; if (!'"\\/bfnrtu'.includes(escape ?? "")) throw new Error(); if (escape === "u") { for (let i = 0; i < 4; i += 1) if (!/[0-9a-f]/iu.test(text[cursor++] ?? "")) throw new Error(); } } else if (char < " ") throw new Error(); } throw new Error(); };
  const primitive = () => { const match = /^(?:-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null)/.exec(text.slice(cursor)); if (!match) throw new Error(); cursor += match[0].length; };
  const value = () => { space(); const token = text[cursor]; if (token === '"') return string(); if (token === "{") { cursor += 1; space(); const keys = new Set(); if (text[cursor] === "}") { cursor += 1; return; } while (true) { space(); const start = cursor; string(); const key = JSON.parse(text.slice(start, cursor)); if (keys.has(key)) throw new Error(); keys.add(key); space(); if (text[cursor++] !== ":") throw new Error(); value(); space(); if (text[cursor] === "}") { cursor += 1; return; } if (text[cursor++] !== ",") throw new Error(); } } if (token === "[") { cursor += 1; space(); if (text[cursor] === "]") { cursor += 1; return; } while (true) { value(); space(); if (text[cursor] === "]") { cursor += 1; return; } if (text[cursor++] !== ",") throw new Error(); } } primitive(); };
  value(); space(); if (cursor !== text.length) throw new Error();
}
function strictJson(bytes) {
  const text = bytes.toString("utf8");
  if (!Buffer.from(text, "utf8").equals(bytes)) throw new Error("SOURCE_IDENTITY_DRIFT");
  try { assertNoDuplicateJsonKeys(text); return JSON.parse(text); } catch { throw new Error("SOURCE_IDENTITY_DRIFT"); }
}
function stableRead(relative, record) {
  const expected = repoPath(relative); if (!expected || realpathSync(path.dirname(expected)) !== path.dirname(expected)) throw new Error("SOURCE_IDENTITY_DRIFT");
  const rootOwner = statSync(ROOT, { bigint: true });
  let fd; try { fd = openSync(expected, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW); const before = fstatSync(fd, { bigint: true }); if (!before.isFile() || before.nlink !== 1n || before.uid !== rootOwner.uid || before.gid !== rootOwner.gid || (before.mode & 0o777n) !== 0o644n || (before.mode & 0o022n) || realpathSync(expected) !== expected) throw new Error("SOURCE_IDENTITY_DRIFT"); const bytes = readFileSync(fd); const after = fstatSync(fd, { bigint: true }); if (after.dev !== before.dev || after.ino !== before.ino || after.ctimeNs !== before.ctimeNs || after.mtimeNs !== before.mtimeNs || after.nlink !== before.nlink || after.size !== before.size) throw new Error("SOURCE_IDENTITY_DRIFT"); if (record && (before.size !== BigInt(record.bytes) || bytes.length !== record.bytes || `sha256:${createHash("sha256").update(bytes).digest("hex")}` !== record.rawSha256)) throw new Error("SOURCE_IDENTITY_DRIFT"); return bytes; } finally { if (fd !== undefined) closeSync(fd); }
}
function openVerifiedTool(binary, version) {
  let fd;
  try {
    fd = openSync(binary, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW);
    const before = fstatSync(fd, { bigint: true });
    if (!before.isFile() || before.nlink !== 1n || before.uid !== 0n || before.gid !== 0n || (before.mode & 0o022n)) throw new Error();
    const result = childProcess.spawnSync(`/proc/self/fd/${fd}`, ["--version"], { encoding: "utf8", timeout: 2_000, env: { PATH: "/usr/bin:/bin", LANG: "C.UTF-8", LC_ALL: "C.UTF-8" } });
    const after = fstatSync(fd, { bigint: true });
    if (after.dev !== before.dev || after.ino !== before.ino || after.ctimeNs !== before.ctimeNs || result.status !== 0 || result.stdout.trim() !== version) throw new Error();
    return fd;
  } catch { if (fd !== undefined) closeSync(fd); throw new Error("SOURCE_IDENTITY_DRIFT"); }
}
function gitResult(args, { blob = false } = {}) {
  let fd;
  try {
    fd = openVerifiedTool(GIT, "git version 2.43.0");
    const result = childProcess.spawnSync(`/proc/self/fd/${fd}`, [...GIT_GUARDS, ...args], { cwd: ROOT, encoding: blob ? "buffer" : "utf8", timeout: 15_000, env: { PATH: "/usr/bin:/bin", LANG: "C.UTF-8", LC_ALL: "C.UTF-8", GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null", GIT_NO_REPLACE_OBJECTS: "1", GIT_TERMINAL_PROMPT: "0", GIT_PAGER: "cat", PAGER: "cat" } });
    return { status: result.status, stdout: blob ? Buffer.from(result.stdout ?? []) : String(result.stdout ?? "").trim() };
  } finally { if (fd !== undefined) closeSync(fd); }
}
function gitRun(args, options = {}) { const result = gitResult(args, options); return result.status === 0 ? result.stdout : null; }
function list(value) { return Array.isArray(value) && value.every((item) => typeof item === "string") ? value : null; }
export function verifyCandidateLineage() {
  try {
    if (gitRun(["status", "--porcelain=v1"]) !== "") return { ok: false, error: "LINEAGE_UNCOMMITTED_CANDIDATE" };
    const head = gitRun(["rev-parse", "HEAD"]); const tree = gitRun(["rev-parse", "HEAD^{tree}"]);
    const approval = strictJson(stableRead(APPROVAL)); const request = approval.request;
    if (!closed(approval, ["authorityId", "nonGoals", "repository", "request", "schemaVersion", "state", "taskId", "verification"]) || approval.schemaVersion !== "product-authority.m0.approval.v1" || approval.authorityId !== "product-authority.m0.v1" || approval.taskId !== TASK || !closed(approval.repository, ["identity", "targetBranch"]) || approval.repository.identity !== "gitee.com/msxn/chaotang-os" || approval.repository.targetBranch !== "ext-dev" || !request || request.approvalPath !== APPROVAL) return { ok: false, error: "LINEAGE_APPROVAL_IDENTITY_INVALID" };
    const productTouches = new Set(PRODUCT_PATHS.map((item) => gitRun(["log", "-1", "--format=%H", "HEAD", "--", item])));
    if (productTouches.size !== 1 || productTouches.has(null)) return { ok: false, error: "LINEAGE_LAST_TOUCH_INVALID" };
    const candidate = [...productTouches][0];
    const approvalCommit = gitRun(["log", "-1", "--format=%H", candidate, "--", APPROVAL]);
    const candidateLine = gitRun(["rev-list", "--parents", "-n", "1", candidate]);
    const approvalLine = approvalCommit && gitRun(["rev-list", "--parents", "-n", "1", approvalCommit]);
    const candidateChanged = (gitRun(["diff-tree", "--no-commit-id", "--name-only", "-r", candidate]) || "").split("\n").filter(Boolean).sort();
    const approvalChanged = approvalCommit && (gitRun(["diff-tree", "--no-commit-id", "--name-only", "-r", approvalCommit]) || "").split("\n").filter(Boolean).sort();
    if (!head || !tree || !request || approval.state !== "APPROVED_FOR_ONE_CHILD" || !candidateLine || candidateLine.split(" ").length !== 2 || !approvalLine || approvalLine.split(" ").length !== 2 || candidate === approvalCommit || candidateLine.split(" ")[1] !== approvalCommit || approvalLine.split(" ")[1] !== request.baseCommit || gitRun(["rev-parse", `${request.baseCommit}^{tree}`]) !== request.baseTree || gitResult(["merge-base", "--is-ancestor", candidate, head]).status !== 0) return { ok: false, error: "LINEAGE_PARENT_INVALID" };
    const approved = list(request.approvalCommitPaths); const products = list(request.productPaths);
    if (!approved || !products || JSON.stringify(approved) !== JSON.stringify([...approved].sort()) || JSON.stringify(products) !== JSON.stringify(PRODUCT_PATHS) || JSON.stringify(approvalChanged) !== JSON.stringify(approved) || JSON.stringify(candidateChanged) !== JSON.stringify(PRODUCT_PATHS)) return { ok: false, error: "LINEAGE_PATHS_INVALID" };
    const approvalBlob = gitRun(["show", `${approvalCommit}:${APPROVAL}`], { blob: true });
    if (!approvalBlob || !approvalBlob.equals(stableRead(APPROVAL))) return { ok: false, error: "LINEAGE_APPROVAL_BLOB_INVALID" };
    for (const item of PRODUCT_PATHS) {
      if (gitRun(["log", "-1", "--format=%H", "HEAD", "--", item]) !== candidate) return { ok: false, error: "LINEAGE_LAST_TOUCH_INVALID" };
      const expected = gitRun(["show", `${candidate}:${item}`], { blob: true });
      const index = gitRun(["ls-files", "-s", "--", item]);
      const treeEntry = gitRun(["ls-tree", candidate, "--", item]);
      const candidateBlob = gitRun(["rev-parse", `${candidate}:${item}`]);
      const indexFields = index?.split(/\s+/u) ?? [];
      const treeFields = treeEntry?.split(/\s+/u) ?? [];
      if (!expected || !index || !treeEntry || !candidateBlob || indexFields[0] !== "100644" || indexFields[1] !== candidateBlob || treeFields[0] !== "100644" || treeFields[2] !== candidateBlob || treeFields[3] !== item || !stableRead(item).equals(expected)) return { ok: false, error: "LINEAGE_CURRENT_BLOB_INVALID" };
    }
    return { ok: true, head, tree, candidate, approvalCommit };
  } catch { return { ok: false, error: "LINEAGE_APPROVAL_INVALID" }; }
}
function verifyInterpreter() { return openVerifiedTool(PYTHON, "Python 3.12.3"); }
function verifiedSources() {
  const lineage = verifyCandidateLineage(); if (!lineage.ok) throw new Error(lineage.error);
  const manifestBytes = stableRead(MANIFEST);
  const manifestBlob = gitRun(["show", `${lineage.candidate}:${MANIFEST}`], { blob: true });
  if (!manifestBlob || !manifestBytes.equals(manifestBlob)) throw new Error("SOURCE_IDENTITY_DRIFT");
  const manifest = strictJson(manifestBytes); if (!closed(manifest, ["schemaVersion", "sources"]) || manifest.schemaVersion !== "mingshuo.fact-pack.source-provenance.v1" || !Array.isArray(manifest.sources) || JSON.stringify(manifest.sources.map((x) => x?.path)) !== JSON.stringify(SOURCES)) throw new Error("SOURCE_IDENTITY_DRIFT");
  const records = new Map(); for (const record of manifest.sources) { if (!closed(record, ["bytes", "mode", "path", "rawSha256"]) || record.mode !== "100644" || !Number.isSafeInteger(record.bytes) || record.bytes < 1 || record.bytes > MAX_SOURCE_BYTES || !/^sha256:[0-9a-f]{64}$/.test(record.rawSha256)) throw new Error("SOURCE_IDENTITY_DRIFT"); const bytes = stableRead(record.path, record); const blob = gitRun(["show", `${lineage.candidate}:${record.path}`], { blob: true }); if (!blob || !bytes.equals(blob)) throw new Error("SOURCE_IDENTITY_DRIFT"); records.set(record.path, bytes); }
  return { evaluator: records.get(SOURCES[0]), schema: records.get(SOURCES[1]), golden: records.get(SOURCES[2]), interpreterFd: verifyInterpreter() };
}
function frame(bytes) { const size = Buffer.alloc(8); size.writeBigUInt64BE(BigInt(bytes.length)); return Buffer.concat([size, bytes]); }
export function runRelay({ interpreterFd, payload, spawn = childProcess.spawn, kill = process.kill, limits = LIMITS }) {
  return new Promise((resolve) => {
    let child;
    try { child = spawn(`/proc/self/fd/${interpreterFd}`, ["-I", "-c", PYTHON_RELAY], { cwd: path.join(ROOT, "backend"), shell: false, detached: true, env: { PATH: "/usr/bin:/bin", LANG: "C.UTF-8", LC_ALL: "C.UTF-8", PYTHONDONTWRITEBYTECODE: "1", PYTHONNOUSERSITE: "1", PYTHONSAFEPATH: "1" }, stdio: ["pipe", "pipe", "pipe"] }); } catch { closeSync(interpreterFd); resolve(stop("RELAY_SPAWN_FAILED")); return; }
    closeSync(interpreterFd); let out = Buffer.alloc(0); let err = Buffer.alloc(0); let pending; let killTimer; let done = false;
    const finish = (value) => { if (!done) { done = true; clearTimeout(timer); clearTimeout(killTimer); child.stdin.destroy(); child.stdout.destroy(); child.stderr.destroy(); resolve(value); } };
    const stopChild = (value) => { if (pending || done) return; pending = value; try { kill(-child.pid, "SIGTERM"); } catch {} killTimer = setTimeout(() => { try { kill(-child.pid, "SIGKILL"); } catch {} }, limits.killMs); killTimer.unref(); };
    const timer = setTimeout(() => stopChild(stop("RELAY_TIMEOUT")), limits.timeoutMs); timer.unref();
    child.on("error", () => finish(stop("RELAY_SPAWN_FAILED")));
    child.stdin.on("error", () => stopChild(stop("RELAY_EXECUTION_FAILED")));
    child.stdout.on("data", (chunk) => { if (pending || out.length + chunk.length > limits.stdout) stopChild(stop("RELAY_STDOUT_LIMIT")); else out = Buffer.concat([out, chunk]); });
    child.stderr.on("data", (chunk) => { if (pending || err.length + chunk.length > limits.stderr) stopChild(stop("RELAY_STDERR_LIMIT")); else err = Buffer.concat([err, chunk]); });
    child.on("close", (code) => { if (pending) return finish(pending); if (code !== 0 || err.length) return finish(stop("RELAY_EXECUTION_FAILED")); try { const result = strictJson(out); finish(result?.nonAuthorizing === true && typeof result.decision === "string" ? result : stop("RELAY_OUTPUT_INVALID")); } catch { finish(stop("RELAY_OUTPUT_INVALID")); } });
    child.stdin.end(payload);
  });
}
export async function evaluateWire(raw) {
  if (!Buffer.isBuffer(raw) || raw.length > LIMITS.stdin) return stop("INPUT_BYTES_LIMIT");
  let verified; try { verified = verifiedSources(); } catch (error) { return stop(error.message === "LINEAGE_UNCOMMITTED_CANDIDATE" ? error.message : "SOURCE_IDENTITY_DRIFT"); }
  return runRelay({ interpreterFd: verified.interpreterFd, payload: Buffer.concat([frame(verified.evaluator), frame(verified.schema), frame(raw)]) });
}
function fixture() { const golden = strictJson(stableRead("docs/contracts/mingshuo-project-fact-pack.v1.golden.json")); const item = golden.entries?.find((x) => x?.id === "synthetic-valid"); return item?.wire && item.expectedDecision === "PASS" ? Buffer.from(JSON.stringify(item.wire)) : null; }
function stdinBounded() { return new Promise((resolve) => { const chunks = []; let size = 0; let settled = false; const finish = (value) => { if (!settled) { settled = true; resolve(value); } }; process.stdin.on("data", (chunk) => { if (size + chunk.length > LIMITS.stdin) { process.stdin.pause(); process.stdin.destroy(); finish(null); return; } size += chunk.length; chunks.push(chunk); }); process.stdin.on("end", () => finish(Buffer.concat(chunks, size))); process.stdin.on("error", () => finish(null)); }); }
async function main() { const [arg] = process.argv.slice(2); if ((arg !== "--check" && arg !== "--evaluate-wire") || process.argv.length !== 3) { process.exitCode = 2; return; } if (arg === "--check") { const lineage = verifyCandidateLineage(); if (!lineage.ok) { process.stdout.write(`${JSON.stringify(stop(lineage.error))}\n`); return; } } const raw = arg === "--check" ? fixture() : await stdinBounded(); process.stdout.write(`${JSON.stringify(raw ? await evaluateWire(raw) : stop("INPUT_BYTES_LIMIT"))}\n`); }
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(() => { process.stdout.write(`${JSON.stringify(stop("RELAY_EXECUTION_FAILED"))}\n`); });
