#!/usr/bin/env node

import { execFileSync, spawnSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { lstatSync, readFileSync, realpathSync, statSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  canonicalizeRfc8785,
  digestBytes,
  digestCanonical,
  parseJsonNoDuplicateKeys,
} from "./execution_authority_ext.mjs";

export const AUTHORITY_ID = "product-authority.m0.v1";
export const REPOSITORY_IDENTITY = "gitee.com/msxn/chaotang-os";
export const TARGET_BRANCH = "ext-dev";
export const APPROVAL_SCHEMA_VERSION = "product-authority.m0.approval.v1";
export const APPROVAL_SCHEMA_VERSION_V2 = "product-authority.m0.approval.v2";
export const RESULT_SCHEMA_VERSION = "product-authority.m0.result.v1";
export const PREAUTH_BROKER_SOCKET = "/run/chaotang-product-verifier/verifier.sock";

export const PATH_BINDING_ORDERED_CASES = Object.freeze([
  "mkdir.home-ancestor.rename-directory-replacement",
  "mkdir.home-ancestor.symlink-replacement",
  "mount.home-ancestor.rename-directory-replacement",
  "mount.home-ancestor.symlink-replacement",
  "mount.target.rename-directory-replacement",
  "mount.target.symlink-replacement",
  "copy.home-ancestor.rename-directory-replacement",
  "copy.home-ancestor.symlink-replacement",
  "copy.target.rename-directory-replacement",
  "copy.target.symlink-replacement",
  "remount.home-ancestor.rename-directory-replacement",
  "remount.home-ancestor.symlink-replacement",
  "remount.target.rename-directory-replacement",
  "remount.target.symlink-replacement",
  "cleanup.home-ancestor.rename-directory-replacement",
  "cleanup.home-ancestor.symlink-replacement",
  "cleanup.target.rename-directory-replacement",
  "cleanup.target.symlink-replacement",
]);

export const PATH_BINDING_CASE_RECORDS = Object.freeze(PATH_BINDING_ORDERED_CASES.map((id) => {
  const [stage, target, attack] = id.split(".");
  return Object.freeze({
    id,
    stage,
    target,
    attack,
    observedStop: "VERIFICATION_PATH_IDENTITY_DRIFT",
    cleanup: "PASS",
    externalSentinel: "UNCHANGED",
  });
}));

export const PREAUTH_RUNNER_SOURCE = String.raw`
import base64, fcntl, hashlib, json, os, select, shutil, socket, stat, subprocess, sys, tempfile, time

ORDERED_CASES = ${JSON.stringify(PATH_BINDING_ORDERED_CASES)}
PATH_BINDING_RECORD_DIGEST = "sha256:7ba1eeb23769551d2be58f136c1038e8897f5141755f5a34ac2cf0c39fa0c572"
PATH_BINDING_SCHEMA_DIGEST = "sha256:9afc472beb987bfe1c233e61f3247a5f509d52aa37d375f124cb451a3ccdf049"

def stop(code):
    raise RuntimeError(code)

def pairs(values):
    result = {}
    for key, value in values:
        if key in result:
            stop("DUPLICATE_JSON_KEY")
        result[key] = value
    return result

def canonical(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")

def sha256(value):
    return "sha256:" + hashlib.sha256(value).hexdigest()

def identity(value):
    header = ("blob " + str(len(value)) + "\0").encode("utf-8")
    return {"bytes": len(value), "gitBlobSha1": hashlib.sha1(header + value).hexdigest(), "mode": "100644", "rawSha256": sha256(value)}

def sealed_source(name, source, expected):
    raw = source.encode("utf-8", "strict")
    if identity(raw) != expected:
        stop("PREAUTH_SOURCE_IDENTITY_INVALID")
    fd = os.memfd_create(name, os.MFD_ALLOW_SEALING | os.MFD_CLOEXEC)
    os.write(fd, raw)
    os.lseek(fd, 0, os.SEEK_SET)
    seals = fcntl.F_SEAL_GROW | fcntl.F_SEAL_SHRINK | fcntl.F_SEAL_WRITE | fcntl.F_SEAL_SEAL
    fcntl.fcntl(fd, fcntl.F_ADD_SEALS, seals)
    if fcntl.fcntl(fd, fcntl.F_GET_SEALS) != seals:
        stop("PREAUTH_SOURCE_NOT_SEALED")
    return fd, raw

def visible_fds():
    directory_fd = os.open("/proc/self/fd", os.O_RDONLY | os.O_DIRECTORY | os.O_CLOEXEC)
    try:
        return sorted(
            int(name) for name in os.listdir(directory_fd)
            if name.isdigit() and int(name) != directory_fd
        )
    finally:
        os.close(directory_fd)

def close_unlisted_fds(allowed):
    for fd in visible_fds():
        if fd > 2 and fd not in allowed:
            try:
                os.close(fd)
            except OSError:
                pass

def observe_root_identity(fd, source_manifest_digest):
    value = os.fstat(fd)
    mount_id = None
    with open("/proc/self/fdinfo/" + str(fd), "r", encoding="ascii") as stream:
        for line in stream:
            if line.startswith("mnt_id:"):
                mount_id = line.split(":", 1)[1].strip()
                break
    if mount_id is None or not mount_id.isdigit():
        stop("PREAUTH_ROOT_FD_IDENTITY_INVALID")
    return {
        "device": str(value.st_dev),
        "inode": str(value.st_ino),
        "mode": stat.S_IMODE(value.st_mode),
        "mountId": mount_id,
        "sourceManifestDigest": source_manifest_digest,
    }

def identity_tuple(fd):
    value = os.fstat(fd)
    return (value.st_dev, value.st_ino, value.st_mode, value.st_uid, value.st_gid)

def run_path_binding_cases():
    results = []
    for case_id in ORDERED_CASES:
        stage, target_name, attack = case_id.split(".")
        fixture = tempfile.mkdtemp(prefix="chaotang-path-binding-")
        try:
            home = os.path.join(fixture, "home")
            repository = os.path.join(home, "repository")
            target = os.path.join(repository, "target")
            source = os.path.join(fixture, "source")
            external = os.path.join(fixture, "external")
            os.makedirs(home)
            os.makedirs(source)
            os.makedirs(external)
            if stage != "mkdir":
                os.makedirs(target)
            source_payload = os.path.join(source, "payload")
            with open(source_payload, "xb") as stream:
                stream.write(b"SOURCE")
            if stage in ("copy", "remount", "cleanup"):
                with open(os.path.join(target, ".mount-view"), "xb") as stream:
                    stream.write(b"BOUND")
            if stage in ("remount", "cleanup"):
                shutil.copyfile(source_payload, os.path.join(target, "payload"))
            if stage == "cleanup":
                os.chmod(target, 0o500)
            sentinel = os.path.join(external, "sentinel")
            with open(sentinel, "xb") as stream:
                stream.write(b"UNCHANGED")
            attacked = home if target_name == "home-ancestor" else target
            bound_fd = os.open(attacked, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW | os.O_CLOEXEC)
            try:
                expected = identity_tuple(bound_fd)
                moved = attacked + ".bound"
                os.rename(attacked, moved)
                moved_target = target.replace(home, moved, 1) if attacked == home else moved
                if stage == "mkdir" and os.path.exists(moved_target):
                    stop("PATH_BINDING_STAGE_PRECONDITION_INVALID")
                if stage == "mount" and os.listdir(moved_target):
                    stop("PATH_BINDING_STAGE_PRECONDITION_INVALID")
                if stage in ("copy", "remount", "cleanup") and not os.path.isfile(os.path.join(moved_target, ".mount-view")):
                    stop("PATH_BINDING_STAGE_PRECONDITION_INVALID")
                if stage in ("remount", "cleanup") and open(os.path.join(moved_target, "payload"), "rb").read() != b"SOURCE":
                    stop("PATH_BINDING_STAGE_PRECONDITION_INVALID")
                if stage == "cleanup" and stat.S_IMODE(os.stat(moved_target).st_mode) != 0o500:
                    stop("PATH_BINDING_STAGE_PRECONDITION_INVALID")
                if attack == "rename-directory-replacement":
                    os.mkdir(attacked)
                elif attack == "symlink-replacement":
                    os.symlink(external, attacked)
                else:
                    stop("PATH_BINDING_CASE_INVALID")
                try:
                    fresh = os.open(attacked, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW | os.O_CLOEXEC)
                    try:
                        drifted = identity_tuple(fresh) != expected
                    finally:
                        os.close(fresh)
                except OSError:
                    drifted = True
                if not drifted:
                    stop("PATH_BINDING_CASE_FAILED")
                with open(sentinel, "rb") as stream:
                    if stream.read() != b"UNCHANGED":
                        stop("PATH_BINDING_SENTINEL_CHANGED")
                results.append({"id": case_id, "status": "PASS"})
            finally:
                os.close(bound_fd)
        finally:
            shutil.rmtree(fixture, ignore_errors=True)
    return results

def run_fd_process(command, source_fds, challenge, timeout_ms, max_reply_bytes):
    parent, child = socket.socketpair(socket.AF_UNIX, socket.SOCK_SEQPACKET)
    safe = [fcntl.fcntl(fd, fcntl.F_DUPFD_CLOEXEC, 32) for fd in (child.fileno(), source_fds[0], source_fds[1])]
    def map_fds():
        for source, target in zip(safe, (3, 4, 6)):
            os.dup2(source, target, inheritable=True)
        for source in safe:
            os.close(source)
        try:
            os.close(5)
        except OSError:
            pass
        close_unlisted_fds({0, 1, 2, 3, 4, 6})
    process = subprocess.Popen(
        command, stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        close_fds=False, preexec_fn=map_fds, start_new_session=True,
        env={"PATH":"/runtime/bin", "HOME":"/nonexistent", "LANG":"C.UTF-8", "LC_ALL":"C.UTF-8"},
    )
    for fd in safe:
        os.close(fd)
    child.close()
    try:
        parent.send(challenge)
        ready = select.poll(); ready.register(parent.fileno(), select.POLLIN | select.POLLHUP | select.POLLERR)
        if not ready.poll(timeout_ms):
            stop("PREAUTH_CHILD_TIMEOUT")
        reply = parent.recv(max_reply_bytes + 1)
        if not reply or len(reply) > max_reply_bytes:
            stop("PREAUTH_CHILD_REPLY_INVALID")
        process.wait(timeout=timeout_ms / 1000)
        if process.returncode != 0:
            stop("PREAUTH_CHILD_FAILED")
        parent.setblocking(False)
        try:
            trailing = parent.recv(1)
            if trailing:
                stop("PREAUTH_CHILD_REPLY_REPLAY")
        except BlockingIOError:
            stop("PREAUTH_CHILD_CHANNEL_OPEN")
        return reply
    finally:
        parent.close()
        if process.poll() is None:
            try:
                os.killpg(process.pid, 9)
            except ProcessLookupError:
                pass
            process.wait()

def main():
    if len(sys.argv) != 2:
        stop("PREAUTH_RUNNER_USAGE_INVALID")
    encoded = sys.argv[1].encode("ascii", "strict")
    raw = base64.b64decode(encoded, validate=True)
    if base64.b64encode(raw) != encoded or len(raw) > 262144:
        stop("PREAUTH_RUNNER_CONFIG_INVALID")
    config = json.loads(raw.decode("utf-8", "strict"), object_pairs_hook=pairs)
    if canonical(config) != raw or set(config) != {"baseChallenge", "controllerIdentity", "controllerSource", "maxChallengeBytes", "maxReceiptBytes", "timeoutMs", "verifierIdentity", "verifierSource"}:
        stop("PREAUTH_RUNNER_CONFIG_INVALID")
    root_fd = os.open(".", os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW | os.O_CLOEXEC)
    controller_fd, controller = sealed_source("preauth-controller", config["controllerSource"], config["controllerIdentity"])
    verifier_fd, verifier = sealed_source("preauth-verifier", config["verifierSource"], config["verifierIdentity"])
    root_identity = observe_root_identity(root_fd, config["baseChallenge"]["sourceObjectManifestDigest"])
    path_binding_results = run_path_binding_cases()
    challenge0 = {
        **config["baseChallenge"],
        "approvalSourceRootIdentity": root_identity,
        "pathBindingResults": path_binding_results,
    }
    challenge0_bytes = canonical(challenge0)
    if len(challenge0_bytes) > config["maxChallengeBytes"]:
        stop("PREAUTH_CHALLENGE_TOO_LARGE")
    controller_reply = run_fd_process(
        ["/runtime/bin/node", "--input-type=module", "--eval", controller.decode("utf-8", "strict")],
        (controller_fd, root_fd), challenge0_bytes, config["timeoutMs"], config["maxReceiptBytes"],
    )
    expected_ack = {"challengeDigest": sha256(challenge0_bytes), "status": "CONTROLLER_EXECUTED"}
    if controller_reply != canonical(expected_ack):
        stop("PREAUTH_CONTROLLER_FAILED")
    challenge = {**challenge0, "controllerExecutionDigest": sha256(controller_reply)}
    challenge_bytes = canonical(challenge)
    if len(challenge_bytes) > config["maxChallengeBytes"]:
        stop("PREAUTH_CHALLENGE_TOO_LARGE")
    receipt = run_fd_process(
        ["/runtime/bin/python3", "-I", "-c", verifier.decode("utf-8", "strict")],
        (verifier_fd, root_fd), challenge_bytes, config["timeoutMs"], config["maxReceiptBytes"],
    )
    parsed = json.loads(receipt.decode("utf-8", "strict"), object_pairs_hook=pairs)
    if canonical(parsed) != receipt:
        stop("PREAUTH_INNER_RECEIPT_INVALID")
    sys.stdout.buffer.write(receipt)

try:
    main()
except Exception as error:
    sys.stderr.write(type(error).__name__ + ":" + str(error)[:160])
    raise SystemExit(2)
`.trim();

const GIT_EXECUTABLE = "/usr/bin/git";
const TASK_ID_PATTERN = /^[A-Z0-9][A-Z0-9._-]{2,127}$/;
const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{2,127}$/;
const SHA_PATTERN = /^[0-9a-f]{40}$/;
const SHA256_PATTERN = /^sha256:[0-9a-f]{64}$/;
const NONCE_PATTERN = /^[0-9a-f]{64}$/;
const PREAUTH_POLICY_SCHEMA_VERSION = "product-authority.m0.pre-authorization-policy.v2";
const PREAUTH_REQUEST_SCHEMA_VERSION = "chaotang-product-verifier-preauthorization-request.v1";
const PREAUTH_RECEIPT_SCHEMA_VERSION = "chaotang-product-verifier-preauthorization-receipt.v1";
const PREAUTH_INNER_RECEIPT_SCHEMA_VERSION = "product-authority.m0.pre-authority-receipt.v2";
const PREAUTH_SOCKET_UNIT = "chaotang-product-verifier.socket";
const PREAUTH_PATH_BINDING_RECORD_DIGEST = "sha256:7ba1eeb23769551d2be58f136c1038e8897f5141755f5a34ac2cf0c39fa0c572";
const PREAUTH_PATH_BINDING_SCHEMA_DIGEST = "sha256:9afc472beb987bfe1c233e61f3247a5f509d52aa37d375f124cb451a3ccdf049";
const PREAUTH_RECEIPT_FIELDS = Object.freeze([
  "schemaVersion", "nonce", "requestDigest", "taskId", "approvalCommit", "approvalTree",
  "directBaseCommit", "approvalCanonicalDigest", "remoteHead", "sourceObjectManifestDigest",
  "runtimeProfileId", "runtimeProfileDigest", "installationManifestDigest",
  "dedicatedControllerManifestDigest", "controllerIdentity", "verifierIdentity",
  "executionProfileIdentity", "pathBindingRecordDigest", "pathBindingSchemaDigest",
  "issuedMonotonicMs", "expiresMonotonicMs", "innerPreauthorizationReceiptDigest",
  "innerReceipt", "peerPrimaryUid", "peerPrimaryGid", "peerKernelPid", "peerProcStarttime",
  "peerUserNamespaceDeviceInode", "peerCgroupPath", "workerUid", "workerGid",
  "socketUnitName", "workerServiceUnitName", "systemdInvocationId", "serviceCgroupPath",
  "serviceCgroupInode", "serviceCgroupOnlyBrokerBeforeReceipt", "startedMonotonicNs",
  "finishedMonotonicNs", "exitKind", "exitCode", "signal", "timedOut", "infrastructureCode",
]);
const PREAUTH_INNER_RECEIPT_FIELDS = Object.freeze([
  "schemaVersion", "status", "taskId", "approvalCommit", "approvalTree",
  "approvalCanonicalDigest", "sourceObjectManifestDigest", "nonce",
  "issuedMonotonicMs", "expiresMonotonicMs", "challengeDigest",
  "controllerExecutionDigest", "controllerIdentity", "verifierIdentity",
  "approvalSourceRootIdentity", "pathBinding",
]);
const MAX_GIT_OUTPUT = 4 * 1024 * 1024;
const MAX_COMMAND_OUTPUT = 1024 * 1024;
const TOOL_PATHS = Object.freeze({
  node: process.execPath,
  npm: "/usr/bin/npm",
  python3: "/usr/bin/python3",
});
const PROTECTED_PRODUCT_PATHS = Object.freeze([
  "AGENTS.md",
  "CLAUDE.md",
  ".agents/",
  ".claude/",
  ".codex/",
  ".github/workflows/",
  ".superpowers/",
  ".harness/",
  "backend/AGENTS.md",
  "backend/CLAUDE.md",
  "docs/contracts/execution-authority-ext-attestation.schema.json",
  "docs/contracts/execution-authority-ext-grant.schema.json",
  "docs/contracts/execution-authority-ext-trust-root.schema.json",
  "docs/decisions/",
  "docs/product/tasks/2026-08-15-ext-root-harness-bootstrap-g1.md",
  "docs/product/tasks/2026-08-15-ext-root-harness-convergence.md",
  "docs/product/tasks/2026-08-15-ext-successor-execution-authority.md",
  "docs/product/tasks/2026-08-16-ext-dev-proportional-governance-reset.md",
  "docs/product/tasks/2026-08-16-ext-root-observation-kernel-g1-corrective.md",
  "docs/product/tasks/2026-08-16-ext-root-observation-kernel-g1.md",
  "docs/product/tasks/2026-08-16-m0-solo-owner-product-authority.md",
  "docs/superpowers/plans/2026-08-15-ext-root-harness-bootstrap-g1.md",
  "docs/superpowers/plans/2026-08-15-ext-root-harness-convergence.md",
  "docs/superpowers/plans/2026-08-15-ext-successor-execution-authority.md",
  "docs/superpowers/plans/2026-08-16-ext-dev-proportional-governance-reset.md",
  "docs/superpowers/plans/2026-08-16-ext-root-observation-kernel-g1-corrective.md",
  "docs/superpowers/plans/2026-08-16-ext-root-observation-kernel-g1.md",
  "docs/superpowers/plans/2026-08-16-m0-solo-owner-product-authority.md",
  "frontend/AGENTS.md",
  "frontend/CLAUDE.md",
  "scripts/check_harness.mjs",
  "scripts/execution_authority_ext.mjs",
  "scripts/execution_authority_ext.test.mjs",
  "scripts/harness-doctor.mjs",
  "scripts/harness-doctor.test.mjs",
  "scripts/product-authority.mjs",
  "scripts/product-authority.test.mjs",
  "scripts/fixtures/execution-authority-ext-canonical-vectors.json",
]);

export class ProductAuthorityError extends Error {
  constructor(code) {
    super(code);
    this.name = "ProductAuthorityError";
    this.code = code;
  }
}

function fail(code) {
  throw new ProductAuthorityError(code);
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function assertClosedObject(value, fields, code = "APPROVAL_SCHEMA_INVALID") {
  if (!isPlainObject(value) || Object.keys(value).length !== fields.length) fail(code);
  if (fields.some((field) => !Object.hasOwn(value, field))) fail(code);
  if (Object.keys(value).some((field) => !fields.includes(field))) fail(code);
}

function assertString(value, { pattern = null, maxLength = 16_384, code = "APPROVAL_SCHEMA_INVALID" } = {}) {
  if (typeof value !== "string" || value.length === 0 || value.length > maxLength) fail(code);
  if (value.includes("\0") || (pattern && !pattern.test(value))) fail(code);
}

function bufferIdentity(source) {
  const bytes = Buffer.isBuffer(source) ? source : Buffer.from(source, "utf8");
  return {
    bytes: bytes.length,
    gitBlobSha1: createHash("sha1").update(Buffer.concat([
      Buffer.from(`blob ${bytes.length}\0`, "utf8"), bytes,
    ])).digest("hex"),
    mode: "100644",
    rawSha256: digestBytes(bytes),
  };
}

function validateSourceIdentity(identity, source = null) {
  assertClosedObject(identity, ["bytes", "gitBlobSha1", "mode", "rawSha256"], "PRE_AUTHORIZATION_IDENTITY_INVALID");
  if (!Number.isSafeInteger(identity.bytes) || identity.bytes < 1 || identity.mode !== "100644"
    || !SHA_PATTERN.test(identity.gitBlobSha1) || !SHA256_PATTERN.test(identity.rawSha256)) {
    fail("PRE_AUTHORIZATION_IDENTITY_INVALID");
  }
  if (source !== null && canonicalizeRfc8785(identity) !== canonicalizeRfc8785(bufferIdentity(source))) {
    fail("PRE_AUTHORIZATION_IDENTITY_INVALID");
  }
}

function verificationEntryById(manifest, id) {
  return manifest.verification.find((entry) => entry.id === id) ?? null;
}

function validatePreAuthorizationPolicy(manifest) {
  const policy = manifest.preAuthorizationReceipt;
  assertClosedObject(policy, [
    "schemaVersion", "controllerVerificationId", "verifierVerificationId",
    "controllerIdentity", "verifierIdentity", "pathBinding", "broker",
    "ttlMs", "maxChallengeBytes", "maxReceiptBytes",
  ], "PRE_AUTHORIZATION_POLICY_INVALID");
  if (policy.schemaVersion !== PREAUTH_POLICY_SCHEMA_VERSION
    || policy.controllerVerificationId === policy.verifierVerificationId
    || !Number.isSafeInteger(policy.ttlMs) || policy.ttlMs < 1000 || policy.ttlMs > 300000
    || policy.maxChallengeBytes !== 16384 || policy.maxReceiptBytes !== 65536) {
    fail("PRE_AUTHORIZATION_POLICY_INVALID");
  }
  const controller = verificationEntryById(manifest, policy.controllerVerificationId);
  const verifier = verificationEntryById(manifest, policy.verifierVerificationId);
  if (!controller || controller.tool !== "node" || controller.cwd !== "."
    || controller.args.length !== 3 || controller.args[0] !== "--input-type=module"
    || controller.args[1] !== "--eval"
    || !verifier || verifier.tool !== "python3" || verifier.cwd !== "."
    || verifier.args.length !== 3 || verifier.args[0] !== "-I" || verifier.args[1] !== "-c") {
    fail("PRE_AUTHORIZATION_POLICY_INVALID");
  }
  validateSourceIdentity(policy.controllerIdentity, controller.args[2]);
  validateSourceIdentity(policy.verifierIdentity, verifier.args[2]);
  assertClosedObject(policy.pathBinding, [
    "schemaVersion", "recordBytes", "recordDigest", "schemaBytes", "schemaDigest",
    "caseCount", "orderedCases",
  ], "PATH_BINDING_ATTESTATION_INVALID");
  if (policy.pathBinding.schemaVersion !== "chaotang.path-binding-self-test.attestation.v1"
    || policy.pathBinding.recordBytes !== 4123
    || policy.pathBinding.recordDigest !== PREAUTH_PATH_BINDING_RECORD_DIGEST
    || policy.pathBinding.schemaBytes !== 8475
    || policy.pathBinding.schemaDigest !== PREAUTH_PATH_BINDING_SCHEMA_DIGEST
    || policy.pathBinding.caseCount !== 18
    || !Array.isArray(policy.pathBinding.orderedCases)
    || policy.pathBinding.orderedCases.length !== 18) {
    fail("PATH_BINDING_ATTESTATION_INVALID");
  }
  if (canonicalizeRfc8785(policy.pathBinding.orderedCases)
    !== canonicalizeRfc8785(PATH_BINDING_CASE_RECORDS)) {
    fail("PATH_BINDING_ATTESTATION_INVALID");
  }
  assertClosedObject(policy.broker, [
    "socketPath", "runtimeProfileId", "runtimeProfileDigest", "installationManifestDigest",
    "dedicatedControllerManifestDigest", "executionProfileIdentity",
  ], "PRE_AUTHORIZATION_POLICY_INVALID");
  if (policy.broker.socketPath !== PREAUTH_BROKER_SOCKET
    || !IDENTIFIER_PATTERN.test(policy.broker.runtimeProfileId)
    || !SHA256_PATTERN.test(policy.broker.runtimeProfileDigest)
    || !SHA256_PATTERN.test(policy.broker.installationManifestDigest)
    || !SHA256_PATTERN.test(policy.broker.dedicatedControllerManifestDigest)) {
    fail("PRE_AUTHORIZATION_POLICY_INVALID");
  }
  validateSourceIdentity(policy.broker.executionProfileIdentity, PREAUTH_RUNNER_SOURCE);
  return policy;
}

function isSafeRepositoryPath(value, { allowDot = false } = {}) {
  if (value === ".") return allowDot;
  if (typeof value !== "string" || value.length === 0 || value.length > 512) return false;
  if (value.startsWith("/") || value.includes("\\") || /[\u0000-\u001f\u007f]/u.test(value) || value.includes("//")) return false;
  if (value.includes("*") || value.includes("?")) return false;
  const segments = value.split("/");
  return !segments.some((segment) => segment === "" || segment === "." || segment === "..")
    && path.posix.normalize(value) === value;
}

function validateOrderedPaths(paths, code, { product = false, maxItems = 128 } = {}) {
  if (!Array.isArray(paths) || paths.length === 0 || paths.length > maxItems) fail(code);
  if (paths.some((entry) => !isSafeRepositoryPath(entry))) fail(code);
  if (new Set(paths).size !== paths.length || JSON.stringify([...paths].sort()) !== JSON.stringify(paths)) fail(code);
  if (product && paths.some((entry) => PROTECTED_PRODUCT_PATHS.some((protectedPath) => (
    protectedPath.endsWith("/") ? entry.startsWith(protectedPath) : entry === protectedPath
  )))) fail("PRODUCT_PATH_PROTECTED");
  return paths;
}

function validateApprovalCommitPath(pathValue, approvalPath) {
  if (pathValue === approvalPath) return true;
  return (pathValue.startsWith("docs/product/tasks/") || pathValue.startsWith("docs/superpowers/plans/"))
    && pathValue.endsWith(".md");
}

export function approvalPathForTask(taskId) {
  assertString(taskId, { pattern: TASK_ID_PATTERN, maxLength: 128, code: "TASK_ID_INVALID" });
  return `.harness/approvals/${taskId}.json`;
}

export function parseJsonStrict(text) {
  return parseJsonNoDuplicateKeys(text);
}

export function canonicalDigest(value) {
  return digestCanonical(value);
}

export function validateApprovalManifest(manifest) {
  const commonFields = [
    "schemaVersion",
    "authorityId",
    "taskId",
    "repository",
    "request",
    "nonGoals",
    "verification",
    "state",
  ];
  if (!isPlainObject(manifest)) fail("APPROVAL_SCHEMA_INVALID");
  if (manifest.schemaVersion === APPROVAL_SCHEMA_VERSION) {
    assertClosedObject(manifest, commonFields);
  } else if (manifest.schemaVersion === APPROVAL_SCHEMA_VERSION_V2) {
    assertClosedObject(manifest, [...commonFields, "preAuthorizationReceipt"]);
  } else {
    fail("APPROVAL_IDENTITY_INVALID");
  }
  if (manifest.authorityId !== AUTHORITY_ID) fail("APPROVAL_IDENTITY_INVALID");
  assertString(manifest.taskId, { pattern: TASK_ID_PATTERN, maxLength: 128, code: "TASK_ID_INVALID" });
  assertClosedObject(manifest.repository, ["identity", "targetBranch"]);
  if (manifest.repository.identity !== REPOSITORY_IDENTITY || manifest.repository.targetBranch !== TARGET_BRANCH) {
    fail("REPOSITORY_IDENTITY_INVALID");
  }
  assertClosedObject(manifest.request, [
    "baseCommit",
    "baseTree",
    "approvalPath",
    "approvalCommitPaths",
    "productPaths",
  ]);
  if (!SHA_PATTERN.test(manifest.request.baseCommit) || !SHA_PATTERN.test(manifest.request.baseTree)) {
    fail("REQUEST_BASE_INVALID");
  }
  const expectedApprovalPath = approvalPathForTask(manifest.taskId);
  if (manifest.request.approvalPath !== expectedApprovalPath) fail("APPROVAL_PATH_INVALID");
  const approvalPaths = validateOrderedPaths(
    manifest.request.approvalCommitPaths,
    "APPROVAL_PATH_SCOPE_INVALID",
    { maxItems: 16 },
  );
  if (!approvalPaths.includes(expectedApprovalPath)
    || approvalPaths.some((entry) => !validateApprovalCommitPath(entry, expectedApprovalPath))) {
    fail("APPROVAL_PATH_SCOPE_INVALID");
  }
  validateOrderedPaths(manifest.request.productPaths, "PRODUCT_PATH_SCOPE_INVALID", { product: true });
  if (!Array.isArray(manifest.nonGoals) || manifest.nonGoals.length === 0 || manifest.nonGoals.length > 64) {
    fail("NON_GOALS_INVALID");
  }
  for (const entry of manifest.nonGoals) {
    assertString(entry, { pattern: /^[A-Z][A-Z0-9_]{2,127}$/, maxLength: 128, code: "NON_GOALS_INVALID" });
  }
  if (new Set(manifest.nonGoals).size !== manifest.nonGoals.length
    || JSON.stringify([...manifest.nonGoals].sort()) !== JSON.stringify(manifest.nonGoals)) {
    fail("NON_GOALS_INVALID");
  }
  if (!Array.isArray(manifest.verification) || manifest.verification.length === 0 || manifest.verification.length > 32) {
    fail("VERIFICATION_MATRIX_INVALID");
  }
  const verificationIds = [];
  for (const entry of manifest.verification) {
    assertClosedObject(entry, ["id", "tool", "args", "cwd", "timeoutMs"], "VERIFICATION_MATRIX_INVALID");
    assertString(entry.id, { pattern: IDENTIFIER_PATTERN, maxLength: 128, code: "VERIFICATION_MATRIX_INVALID" });
    if (!Object.hasOwn(TOOL_PATHS, entry.tool)) fail("VERIFICATION_MATRIX_INVALID");
    if (!Array.isArray(entry.args) || entry.args.length > 64) fail("VERIFICATION_MATRIX_INVALID");
    for (const argument of entry.args) {
      if (typeof argument !== "string" || argument.length > 4096 || argument.includes("\0")) {
        fail("VERIFICATION_MATRIX_INVALID");
      }
    }
    if (!isSafeRepositoryPath(entry.cwd, { allowDot: true })) fail("VERIFICATION_MATRIX_INVALID");
    if (!Number.isSafeInteger(entry.timeoutMs) || entry.timeoutMs < 1_000 || entry.timeoutMs > 300_000) {
      fail("VERIFICATION_MATRIX_INVALID");
    }
    verificationIds.push(entry.id);
  }
  if (new Set(verificationIds).size !== verificationIds.length
    || JSON.stringify([...verificationIds].sort()) !== JSON.stringify(verificationIds)) {
    fail("VERIFICATION_MATRIX_INVALID");
  }
  if (manifest.state !== "APPROVED_FOR_ONE_CHILD") fail("APPROVAL_STATE_INVALID");
  if (manifest.schemaVersion === APPROVAL_SCHEMA_VERSION_V2) validatePreAuthorizationPolicy(manifest);
  return manifest;
}

function gitEnvironment() {
  return {
    PATH: "/usr/bin:/bin",
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_NO_REPLACE_OBJECTS: "1",
    GIT_TERMINAL_PROMPT: "0",
  };
}

function runGit(args, { cwd, encoding = "utf8", code = "GIT_INSPECTION_FAILED", timeout = 10_000 } = {}) {
  try {
    const output = execFileSync(GIT_EXECUTABLE, ["--no-replace-objects", ...args], {
      cwd,
      encoding,
      env: gitEnvironment(),
      maxBuffer: MAX_GIT_OUTPUT,
      timeout,
      stdio: ["ignore", "pipe", "pipe"],
    });
    return typeof output === "string" ? output.trim() : output;
  } catch {
    fail(code);
  }
}

function ensureRepositoryIdentity(cwd) {
  const remote = runGit(["config", "--get", "remote.origin.url"], { cwd, code: "REPOSITORY_IDENTITY_INVALID" });
  const normalized = remote.replace(/^https?:\/\//, "").replace(/^git@/, "").replace(":", "/").replace(/\.git$/, "");
  if (normalized !== REPOSITORY_IDENTITY) fail("REPOSITORY_IDENTITY_INVALID");
  if (runGit(["rev-parse", "--is-shallow-repository"], { cwd }) !== "false") fail("SHALLOW_REPOSITORY_UNSUPPORTED");
}

function ensureCleanWorktree(cwd, code = "WORKTREE_DIRTY") {
  if (runGit(["status", "--porcelain=v1", "-z", "--untracked-files=all"], { cwd, encoding: null }).length !== 0) {
    fail(code);
  }
}

function commitParents(cwd, commit) {
  return runGit(["show", "-s", "--format=%P", commit], { cwd }).split(/\s+/).filter(Boolean);
}

function parseNameStatus(raw) {
  if (!Buffer.isBuffer(raw)) fail("GIT_INSPECTION_FAILED");
  const fields = raw.toString("utf8").split("\0");
  if (fields.at(-1) === "") fields.pop();
  const changes = [];
  for (let index = 0; index < fields.length;) {
    const status = fields[index++];
    if (!/^[AMD]$/.test(status) || index >= fields.length) fail("UNSUPPORTED_GIT_CHANGE");
    changes.push({ status, path: fields[index++] });
  }
  return changes;
}

function treeEntry(cwd, commit, repositoryPath) {
  const row = runGit(["ls-tree", commit, "--", repositoryPath], { cwd });
  if (row === "") return null;
  const match = row.match(/^(\d{6}) ([a-z]+) ([0-9a-f]{40})\t(.+)$/);
  if (!match || match[4] !== repositoryPath) fail("UNSUPPORTED_GIT_ENTRY_MODE");
  return { mode: match[1], type: match[2], object: match[3], path: match[4] };
}

function changedPaths(cwd, base, commit) {
  const raw = runGit(["diff-tree", "-r", "--no-commit-id", "--name-status", "-z", base, commit], {
    cwd,
    encoding: null,
  });
  const changes = parseNameStatus(raw);
  if (changes.some((entry) => entry.status === "D" || !isSafeRepositoryPath(entry.path))) fail("UNSUPPORTED_GIT_CHANGE");
  for (const change of changes) {
    const currentEntry = treeEntry(cwd, commit, change.path);
    if (!currentEntry || currentEntry.type !== "blob" || !["100644", "100755"].includes(currentEntry.mode)) {
      fail("UNSUPPORTED_GIT_ENTRY_MODE");
    }
    const baseEntry = treeEntry(cwd, base, change.path);
    if (change.status === "M" && (!baseEntry || baseEntry.mode !== currentEntry.mode)) {
      fail("UNSUPPORTED_GIT_ENTRY_MODE");
    }
  }
  return changes.map((entry) => entry.path).sort();
}

function readManifestAtCommit(cwd, commit, taskId) {
  const approvalPath = approvalPathForTask(taskId);
  let text;
  try {
    text = execFileSync(GIT_EXECUTABLE, ["--no-replace-objects", "show", `${commit}:${approvalPath}`], {
      cwd,
      encoding: "utf8",
      env: gitEnvironment(),
      maxBuffer: MAX_GIT_OUTPUT,
      timeout: 10_000,
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch {
    fail("APPROVAL_NOT_FOUND");
  }
  let manifest;
  try {
    manifest = parseJsonStrict(text);
  } catch (error) {
    if (error?.code === "DUPLICATE_JSON_KEY") fail("DUPLICATE_JSON_KEY");
    fail("APPROVAL_JSON_INVALID");
  }
  validateApprovalManifest(manifest);
  if (manifest.taskId !== taskId) fail("TASK_MISMATCH");
  return manifest;
}

export function inspectApprovalCommit({ cwd = process.cwd(), taskId, commit = null } = {}) {
  ensureRepositoryIdentity(cwd);
  const approvalCommit = commit ?? runGit(["rev-parse", "HEAD"], { cwd });
  if (!SHA_PATTERN.test(approvalCommit)) fail("APPROVAL_COMMIT_INVALID");
  const manifest = readManifestAtCommit(cwd, approvalCommit, taskId);
  const parents = commitParents(cwd, approvalCommit);
  if (parents.length !== 1 || parents[0] !== manifest.request.baseCommit) fail("APPROVAL_COMMIT_PARENT_INVALID");
  if (runGit(["rev-parse", `${manifest.request.baseCommit}^{tree}`], { cwd }) !== manifest.request.baseTree) {
    fail("REQUEST_BASE_INVALID");
  }
  const paths = changedPaths(cwd, manifest.request.baseCommit, approvalCommit);
  if (JSON.stringify(paths) !== JSON.stringify(manifest.request.approvalCommitPaths)) {
    fail("APPROVAL_COMMIT_SCOPE_INVALID");
  }
  if (treeEntry(cwd, approvalCommit, manifest.request.approvalPath)?.mode !== "100644") {
    fail("APPROVAL_FILE_MODE_INVALID");
  }
  return {
    commit: approvalCommit,
    tree: runGit(["rev-parse", `${approvalCommit}^{tree}`], { cwd }),
    parent: parents[0],
    manifest,
    manifestDigest: canonicalDigest(manifest),
    paths,
  };
}

async function defaultRemoteHeadResolver({ cwd, targetBranch }) {
  const output = runGit(["ls-remote", "--heads", "origin", targetBranch], {
    cwd,
    code: "REMOTE_HEAD_UNVERIFIED",
    timeout: 15_000,
  });
  const match = output.match(/^([0-9a-f]{40})\trefs\/heads\/([^\s]+)$/);
  if (!match || match[2] !== targetBranch) fail("REMOTE_HEAD_UNVERIFIED");
  return match[1];
}

async function requireRemoteHead(context, remoteHeadResolver, expectedCommit) {
  let remoteHead;
  try {
    remoteHead = await remoteHeadResolver({
      cwd: context.cwd,
      targetBranch: context.approval.manifest.repository.targetBranch,
    });
  } catch (error) {
    if (error instanceof ProductAuthorityError) throw error;
    fail("REMOTE_HEAD_UNVERIFIED");
  }
  if (remoteHead !== expectedCommit) fail("REMOTE_HEAD_MOVED");
}

const PREAUTH_ENVIRONMENT = Object.freeze({
  CI: "1",
  NODE_ENV: "test",
  PYTHONDONTWRITEBYTECODE: "1",
  NO_COLOR: "1",
  HOME: "/nonexistent",
  TMPDIR: "/tmp",
  TEMP: "/tmp",
  TMP: "/tmp",
  PATH: "/runtime/bin",
  LC_ALL: "C.UTF-8",
  LANG: "C.UTF-8",
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_CONFIG_GLOBAL: "/dev/null",
});

function domainDigest(domain, value) {
  return digestBytes(Buffer.concat([
    Buffer.from(domain, "utf8"), Buffer.from(canonicalizeRfc8785(value), "utf8"),
  ]));
}

function preauthorizationRequestDigest(request) {
  const payload = { ...request };
  delete payload.requestDigest;
  return domainDigest("chaotang-product-verifier-preauthorization-request-v1\0", payload);
}

export function buildPreAuthorizationBrokerRequest({
  approval,
  pack,
  sourceObjectManifestDigest,
  nonce = randomBytes(32).toString("hex"),
  issuedMonotonicMs = Number(process.hrtime.bigint() / 1_000_000n),
} = {}) {
  if (!isPlainObject(approval) || !Buffer.isBuffer(pack)
    || !SHA256_PATTERN.test(sourceObjectManifestDigest)
    || !NONCE_PATTERN.test(nonce) || !Number.isSafeInteger(issuedMonotonicMs)) {
    fail("PREAUTH_BROKER_REQUEST_INVALID");
  }
  const policy = validatePreAuthorizationPolicy(approval.manifest);
  const controller = verificationEntryById(approval.manifest, policy.controllerVerificationId);
  const verifier = verificationEntryById(approval.manifest, policy.verifierVerificationId);
  const expiresMonotonicMs = issuedMonotonicMs + policy.ttlMs;
  const baseChallenge = {
    approvalCanonicalDigest: approval.manifestDigest,
    approvalCommit: approval.commit,
    approvalTree: approval.tree,
    controllerIdentity: policy.controllerIdentity,
    expiresMonotonicMs,
    issuedMonotonicMs,
    nonce,
    pathBindingPolicyDigest: canonicalDigest(policy.pathBinding),
    schemaVersion: "product-authority.m0.pre-authority-challenge.v2",
    sourceObjectManifestDigest,
    taskId: approval.manifest.taskId,
    verifierIdentity: policy.verifierIdentity,
  };
  const runnerConfig = {
    baseChallenge,
    controllerIdentity: policy.controllerIdentity,
    controllerSource: controller.args[2],
    maxChallengeBytes: policy.maxChallengeBytes,
    maxReceiptBytes: policy.maxReceiptBytes,
    timeoutMs: Math.min(controller.timeoutMs, verifier.timeoutMs),
    verifierIdentity: policy.verifierIdentity,
    verifierSource: verifier.args[2],
  };
  const encodedConfig = Buffer.from(canonicalizeRfc8785(runnerConfig), "utf8").toString("base64");
  const args = ["-I", "-B", "-c", PREAUTH_RUNNER_SOURCE, encodedConfig];
  const request = {
    schemaVersion: PREAUTH_REQUEST_SCHEMA_VERSION,
    sourceKind: "PRE_AUTHORIZATION_SOURCE",
    nonce,
    requestDigest: "",
    taskId: approval.manifest.taskId,
    approvalCommit: approval.commit,
    approvalTree: approval.tree,
    directBaseCommit: approval.manifest.request.baseCommit,
    directBaseTree: approval.manifest.request.baseTree,
    approvalCanonicalDigest: approval.manifestDigest,
    remoteHead: approval.commit,
    sourceObjectManifestDigest,
    snapshotPackSha256: digestBytes(pack),
    snapshotPackBytes: pack.length,
    runtimeProfileId: policy.broker.runtimeProfileId,
    runtimeProfileDigest: policy.broker.runtimeProfileDigest,
    installationManifestDigest: policy.broker.installationManifestDigest,
    dedicatedControllerManifestDigest: policy.broker.dedicatedControllerManifestDigest,
    controllerIdentity: policy.controllerIdentity,
    verifierIdentity: policy.verifierIdentity,
    executionProfileIdentity: policy.broker.executionProfileIdentity,
    pathBindingRecordDigest: policy.pathBinding.recordDigest,
    pathBindingSchemaDigest: policy.pathBinding.schemaDigest,
    issuedMonotonicMs,
    expiresMonotonicMs,
    gateId: "preauthorization-receipt",
    tool: "/runtime/bin/python3",
    args,
    argsDigest: domainDigest("chaotang-product-verifier-args-v1\0", args),
    cwd: ".",
    workspaceMode: "READ_ONLY_APPROVAL_SOURCE",
    environment: { ...PREAUTH_ENVIRONMENT },
    environmentDigest: domainDigest("chaotang-product-verifier-environment-v1\0", PREAUTH_ENVIRONMENT),
    timeoutMs: Math.min(controller.timeoutMs, verifier.timeoutMs),
  };
  request.requestDigest = preauthorizationRequestDigest(request);
  return request;
}

function decodeOutputRecord(record, code) {
  assertClosedObject(record, ["encoding", "bytes", "sha256", "data"], code);
  if (record.encoding !== "base64" || !Number.isSafeInteger(record.bytes) || record.bytes < 1
    || !SHA256_PATTERN.test(record.sha256) || typeof record.data !== "string") fail(code);
  let bytes;
  try {
    bytes = Buffer.from(record.data, "base64");
  } catch {
    fail(code);
  }
  if (bytes.length !== record.bytes || bytes.toString("base64") !== record.data
    || digestBytes(bytes) !== record.sha256) fail(code);
  return bytes;
}

function observeCurrentControllerIdentity() {
  let statText;
  let cgroupText;
  let userNamespace;
  try {
    statText = readFileSync("/proc/self/stat", "ascii");
    cgroupText = readFileSync("/proc/self/cgroup", "ascii");
    userNamespace = statSync("/proc/self/ns/user");
  } catch {
    fail("PREAUTH_CONTROLLER_IDENTITY_UNVERIFIED");
  }
  const close = statText.lastIndexOf(")");
  const fields = close >= 0 ? statText.slice(close + 2).trim().split(/\s+/u) : [];
  const unified = cgroupText.trim().split("\n")
    .filter((line) => line.startsWith("0::"))
    .map((line) => line.slice(3));
  if (fields.length < 20 || !/^[0-9]+$/.test(fields[19]) || unified.length !== 1
    || !unified[0].startsWith("/") || unified[0].split("/").some((part) => part === "..")) {
    fail("PREAUTH_CONTROLLER_IDENTITY_UNVERIFIED");
  }
  return {
    peerPrimaryUid: process.getuid(),
    peerPrimaryGid: process.getgid(),
    peerKernelPid: process.pid,
    peerProcStarttime: fields[19],
    peerUserNamespaceDeviceInode: `${userNamespace.dev}:${userNamespace.ino}`,
    peerCgroupPath: unified[0],
  };
}

function validateInnerPreAuthorizationReceipt({ innerReceiptBytes, request }) {
  let innerReceipt;
  try {
    innerReceipt = parseJsonStrict(innerReceiptBytes.toString("utf8"));
  } catch {
    fail("PREAUTH_BROKER_RECEIPT_INVALID");
  }
  if (Buffer.from(canonicalizeRfc8785(innerReceipt), "utf8").compare(innerReceiptBytes) !== 0) {
    fail("PREAUTH_BROKER_RECEIPT_INVALID");
  }
  assertClosedObject(innerReceipt, PREAUTH_INNER_RECEIPT_FIELDS, "PREAUTH_BROKER_RECEIPT_INVALID");
  assertClosedObject(innerReceipt.approvalSourceRootIdentity, [
    "device", "inode", "mode", "mountId", "sourceManifestDigest",
  ], "PREAUTH_BROKER_RECEIPT_INVALID");
  const root = innerReceipt.approvalSourceRootIdentity;
  if (innerReceipt.schemaVersion !== PREAUTH_INNER_RECEIPT_SCHEMA_VERSION
    || innerReceipt.status !== "PASS"
    || typeof root.device !== "string" || !/^[0-9]+$/.test(root.device)
    || typeof root.inode !== "string" || !/^[1-9][0-9]*$/.test(root.inode)
    || typeof root.mountId !== "string" || !/^[1-9][0-9]*$/.test(root.mountId)
    || root.mode !== 0o555
    || root.sourceManifestDigest !== request.sourceObjectManifestDigest) {
    fail("PREAUTH_BROKER_RECEIPT_INVALID");
  }
  const policy = {
    orderedCaseResults: PATH_BINDING_ORDERED_CASES.map((id) => ({ id, status: "PASS" })),
    recordDigest: request.pathBindingRecordDigest,
    schemaDigest: request.pathBindingSchemaDigest,
  };
  assertClosedObject(innerReceipt.pathBinding, [
    "orderedCaseResults", "recordDigest", "schemaDigest",
  ], "PREAUTH_BROKER_RECEIPT_INVALID");
  const controllerChallenge = {
    approvalCanonicalDigest: request.approvalCanonicalDigest,
    approvalCommit: request.approvalCommit,
    approvalSourceRootIdentity: root,
    approvalTree: request.approvalTree,
    controllerIdentity: request.controllerIdentity,
    expiresMonotonicMs: request.expiresMonotonicMs,
    issuedMonotonicMs: request.issuedMonotonicMs,
    nonce: request.nonce,
    pathBindingPolicyDigest: canonicalDigest({
      schemaVersion: "chaotang.path-binding-self-test.attestation.v1",
      recordBytes: 4123,
      recordDigest: request.pathBindingRecordDigest,
      schemaBytes: 8475,
      schemaDigest: request.pathBindingSchemaDigest,
      caseCount: 18,
      orderedCases: PATH_BINDING_CASE_RECORDS,
    }),
    pathBindingResults: PATH_BINDING_ORDERED_CASES.map((id) => ({ id, status: "PASS" })),
    schemaVersion: "product-authority.m0.pre-authority-challenge.v2",
    sourceObjectManifestDigest: request.sourceObjectManifestDigest,
    taskId: request.taskId,
    verifierIdentity: request.verifierIdentity,
  };
  const controllerAck = {
    challengeDigest: digestBytes(Buffer.from(canonicalizeRfc8785(controllerChallenge), "utf8")),
    status: "CONTROLLER_EXECUTED",
  };
  const verifierChallenge = {
    ...controllerChallenge,
    controllerExecutionDigest: digestBytes(Buffer.from(canonicalizeRfc8785(controllerAck), "utf8")),
  };
  const expected = {
    schemaVersion: PREAUTH_INNER_RECEIPT_SCHEMA_VERSION,
    status: "PASS",
    taskId: request.taskId,
    approvalCommit: request.approvalCommit,
    approvalTree: request.approvalTree,
    approvalCanonicalDigest: request.approvalCanonicalDigest,
    sourceObjectManifestDigest: request.sourceObjectManifestDigest,
    nonce: request.nonce,
    issuedMonotonicMs: request.issuedMonotonicMs,
    expiresMonotonicMs: request.expiresMonotonicMs,
    challengeDigest: digestBytes(Buffer.from(canonicalizeRfc8785(verifierChallenge), "utf8")),
    controllerExecutionDigest: verifierChallenge.controllerExecutionDigest,
    controllerIdentity: request.controllerIdentity,
    verifierIdentity: request.verifierIdentity,
    approvalSourceRootIdentity: root,
    pathBinding: policy,
  };
  if (canonicalizeRfc8785(innerReceipt) !== canonicalizeRfc8785(expected)) {
    fail("PREAUTH_BROKER_RECEIPT_INVALID");
  }
  return innerReceipt;
}

export function validatePreAuthorizationBrokerReceipt({
  receipt, request, nowMonotonicMs, expectedControllerIdentity = null,
} = {}) {
  assertClosedObject(receipt, PREAUTH_RECEIPT_FIELDS, "PREAUTH_BROKER_RECEIPT_INVALID");
  if (!isPlainObject(request) || receipt.schemaVersion !== PREAUTH_RECEIPT_SCHEMA_VERSION
    || !Number.isSafeInteger(nowMonotonicMs)
    || nowMonotonicMs < request.issuedMonotonicMs || nowMonotonicMs > request.expiresMonotonicMs) {
    fail("PREAUTH_BROKER_RECEIPT_INVALID");
  }
  for (const field of [
    "nonce", "requestDigest", "taskId", "approvalCommit", "approvalTree", "directBaseCommit",
    "approvalCanonicalDigest", "remoteHead", "sourceObjectManifestDigest", "runtimeProfileId",
    "runtimeProfileDigest", "installationManifestDigest", "dedicatedControllerManifestDigest",
    "controllerIdentity", "verifierIdentity", "executionProfileIdentity",
    "pathBindingRecordDigest", "pathBindingSchemaDigest", "issuedMonotonicMs", "expiresMonotonicMs",
  ]) {
    if (canonicalizeRfc8785(receipt[field]) !== canonicalizeRfc8785(request[field])) {
      fail("PREAUTH_BROKER_RECEIPT_INVALID");
    }
  }
  if (receipt.socketUnitName !== PREAUTH_SOCKET_UNIT
    || !/^chaotang-product-verifier@[^/]+\.service$/.test(receipt.workerServiceUnitName)
    || !/^[0-9a-f]{32}$/.test(receipt.systemdInvocationId)
    || typeof receipt.serviceCgroupPath !== "string" || !receipt.serviceCgroupPath.startsWith("/")
    || !/^[1-9][0-9]*$/.test(receipt.serviceCgroupInode)
    || receipt.serviceCgroupOnlyBrokerBeforeReceipt !== true
    || receipt.exitKind !== "EXITED" || receipt.exitCode !== 0 || receipt.signal !== null
    || receipt.timedOut !== false || receipt.infrastructureCode !== "NONE") {
    fail("PREAUTH_BROKER_RECEIPT_INVALID");
  }
  for (const field of ["peerPrimaryUid", "peerPrimaryGid", "peerKernelPid", "workerUid", "workerGid", "startedMonotonicNs", "finishedMonotonicNs"]) {
    if (!Number.isSafeInteger(receipt[field]) || receipt[field] < 0) fail("PREAUTH_BROKER_RECEIPT_INVALID");
  }
  if (receipt.peerKernelPid < 1 || receipt.finishedMonotonicNs < receipt.startedMonotonicNs
    || typeof receipt.peerProcStarttime !== "string"
    || !/^[0-9]+:[0-9]+$/.test(receipt.peerUserNamespaceDeviceInode)
    || typeof receipt.peerCgroupPath !== "string" || !receipt.peerCgroupPath.startsWith("/")) {
    fail("PREAUTH_BROKER_RECEIPT_INVALID");
  }
  if (expectedControllerIdentity !== null) {
    assertClosedObject(expectedControllerIdentity, [
      "peerPrimaryUid", "peerPrimaryGid", "peerKernelPid", "peerProcStarttime",
      "peerUserNamespaceDeviceInode", "peerCgroupPath",
    ], "PREAUTH_CONTROLLER_IDENTITY_UNVERIFIED");
    for (const field of Object.keys(expectedControllerIdentity)) {
      if (receipt[field] !== expectedControllerIdentity[field]) {
        fail("PREAUTH_CONTROLLER_IDENTITY_UNVERIFIED");
      }
    }
  }
  const innerReceiptBytes = decodeOutputRecord(receipt.innerReceipt, "PREAUTH_BROKER_RECEIPT_INVALID");
  if (digestBytes(innerReceiptBytes) !== receipt.innerPreauthorizationReceiptDigest) {
    fail("PREAUTH_BROKER_RECEIPT_INVALID");
  }
  validateInnerPreAuthorizationReceipt({ innerReceiptBytes, request });
  return {
    innerReceiptBytes,
    receiptDigest: canonicalDigest(receipt),
    evidenceDigest: canonicalDigest({
      approvalCommit: request.approvalCommit,
      approvalCanonicalDigest: request.approvalCanonicalDigest,
      requestDigest: request.requestDigest,
      outerReceiptDigest: canonicalDigest(receipt),
      innerReceiptDigest: receipt.innerPreauthorizationReceiptDigest,
      serviceCgroupPath: receipt.serviceCgroupPath,
      systemdInvocationId: receipt.systemdInvocationId,
    }),
  };
}

function runGitWithInput(args, input, { cwd, code = "GIT_INSPECTION_FAILED", maxBuffer = 256 * 1024 * 1024 } = {}) {
  const completed = spawnSync(GIT_EXECUTABLE, ["--no-replace-objects", ...args], {
    cwd,
    env: gitEnvironment(),
    input,
    encoding: null,
    maxBuffer,
    timeout: 30000,
    shell: false,
    stdio: ["pipe", "pipe", "pipe"],
  });
  if (completed.error || completed.signal || completed.status !== 0) fail(code);
  return completed.stdout ?? Buffer.alloc(0);
}

function collectPreAuthorizationSource({ cwd, approval }) {
  const raw = runGit(["ls-tree", "-r", "-t", "-z", approval.tree], { cwd, encoding: null });
  const entries = raw.toString("utf8").split("\0").filter(Boolean).map((line) => {
    const match = line.match(/^(\d{6}) (blob|tree) ([0-9a-f]{40})\t(.+)$/s);
    if (!match || !isSafeRepositoryPath(match[4])) fail("PREAUTH_SOURCE_GRAPH_INVALID");
    return { mode: match[1], type: match[2], oid: match[3], path: match[4] };
  });
  const objectIds = new Set([approval.commit, approval.parent, approval.tree, ...entries.map((entry) => entry.oid)]);
  const manifestRecords = [];
  for (const oid of [approval.commit, approval.parent]) {
    const body = runGit(["cat-file", "commit", oid], { cwd, encoding: null });
    manifestRecords.push({ kind: "COMMIT", oid, type: "commit", bytes: body.length, rawSha256: digestBytes(body) });
  }
  const treeRecords = [{ mode: "040000", type: "tree", oid: approval.tree, path: "." }, ...entries.filter((entry) => entry.type === "tree")];
  for (const entry of treeRecords) {
    const body = runGit(["cat-file", entry.type, entry.oid], { cwd, encoding: null });
    manifestRecords.push({
      kind: "TREE", path: entry.path, mode: "040000", oid: entry.oid,
      type: "tree", bytes: body.length, rawSha256: digestBytes(body),
    });
  }
  for (const entry of entries.filter((item) => item.type === "blob")) {
    const body = runGit(["cat-file", "blob", entry.oid], { cwd, encoding: null });
    manifestRecords.push({
      kind: "BLOB", path: entry.path, mode: entry.mode, oid: entry.oid,
      type: "blob", bytes: body.length, rawSha256: digestBytes(body),
    });
  }
  const bytewise = (left, right) => Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
  manifestRecords.sort((left, right) => (
    bytewise(left.kind, right.kind)
      || bytewise(left.path ?? "", right.path ?? "")
      || bytewise(left.oid, right.oid)
  ));
  const sourceObjectManifestDigest = domainDigest(
    "chaotang-preauthorization-source-manifest-v1\0", manifestRecords,
  );
  const input = Buffer.from(`${[...objectIds].sort().join("\n")}\n`, "ascii");
  const pack = runGitWithInput(["pack-objects", "--stdout", "--no-reuse-delta"], input, {
    cwd, code: "PREAUTH_SOURCE_PACK_FAILED",
  });
  return { pack, sourceObjectManifestDigest };
}

function assertBrokerSocketIdentity() {
  let parent;
  let socketInfo;
  try {
    parent = lstatSync(path.dirname(PREAUTH_BROKER_SOCKET));
    socketInfo = lstatSync(PREAUTH_BROKER_SOCKET);
  } catch {
    fail("PREAUTH_BROKER_UNAVAILABLE");
  }
  if (!parent.isDirectory() || parent.isSymbolicLink() || parent.uid !== 0 || parent.gid !== 0
    || (parent.mode & 0o022) !== 0 || !socketInfo.isSocket() || socketInfo.isSymbolicLink()
    || socketInfo.uid !== 0 || (socketInfo.mode & 0o777) !== 0o660) {
    fail("PREAUTH_BROKER_IDENTITY_INVALID");
  }
}

function encodeBrokerRequest(request, pack) {
  const header = Buffer.from(canonicalizeRfc8785(request), "utf8");
  const prefix = Buffer.alloc(20);
  Buffer.from("CTPV1\0\0\0", "binary").copy(prefix, 0);
  prefix.writeUInt32BE(header.length, 8);
  prefix.writeBigUInt64BE(BigInt(pack.length), 12);
  return Buffer.concat([prefix.subarray(0, 12), header, prefix.subarray(12), pack]);
}

function decodeBrokerResponse(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 12
    || !bytes.subarray(0, 8).equals(Buffer.from("CTPR1\0\0\0", "binary"))) {
    fail("PREAUTH_BROKER_RECEIPT_INVALID");
  }
  const length = bytes.readUInt32BE(8);
  if (length < 2 || length > 24 * 1024 * 1024 || bytes.length !== 12 + length) {
    fail("PREAUTH_BROKER_RECEIPT_INVALID");
  }
  const body = bytes.subarray(12);
  let receipt;
  try {
    receipt = parseJsonStrict(body.toString("utf8"));
  } catch {
    fail("PREAUTH_BROKER_RECEIPT_INVALID");
  }
  if (Buffer.from(canonicalizeRfc8785(receipt), "utf8").compare(body) !== 0) {
    fail("PREAUTH_BROKER_RECEIPT_INVALID");
  }
  return receipt;
}

async function exchangeWithPreAuthorizationBroker(request, pack) {
  assertBrokerSocketIdentity();
  const frame = encodeBrokerRequest(request, pack);
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    let settled = false;
    const socket = net.createConnection({ path: PREAUTH_BROKER_SOCKET });
    const failExchange = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    };
    const timer = setTimeout(() => {
      socket.destroy();
      failExchange(new ProductAuthorityError("PREAUTH_BROKER_TIMEOUT"));
    }, request.timeoutMs + 35000);
    socket.on("connect", () => socket.end(frame));
    socket.on("data", (chunk) => {
      total += chunk.length;
      if (total > 24 * 1024 * 1024 + 12) {
        socket.destroy();
        failExchange(new ProductAuthorityError("PREAUTH_BROKER_RECEIPT_INVALID"));
        return;
      }
      chunks.push(chunk);
    });
    socket.on("error", () => failExchange(new ProductAuthorityError("PREAUTH_BROKER_UNAVAILABLE")));
    socket.on("close", () => {
      clearTimeout(timer);
      if (settled) return;
      if (total === 0) {
        failExchange(new ProductAuthorityError("PREAUTH_BROKER_RECEIPT_INVALID"));
        return;
      }
      try {
        const response = decodeBrokerResponse(Buffer.concat(chunks));
        settled = true;
        resolve(response);
      } catch (error) {
        failExchange(error);
      }
    });
  });
}

function verifyPostReplyCleanup(receipt) {
  const started = Date.now();
  let properties = null;
  while (Date.now() - started < 5000) {
    const completed = spawnSync("/usr/bin/systemctl", [
      "show", receipt.workerServiceUnitName,
      "--property=ActiveState", "--property=InvocationID", "--property=ControlGroup",
    ], {
      env: { PATH: "/usr/bin:/bin", LANG: "C.UTF-8", LC_ALL: "C.UTF-8" },
      encoding: "utf8", timeout: 1000, shell: false, stdio: ["ignore", "pipe", "pipe"],
    });
    if (!completed.error && !completed.signal && completed.status === 0) {
      properties = Object.fromEntries(completed.stdout.trim().split("\n").map((line) => line.split("=", 2)));
      if (properties.ActiveState === "inactive") break;
    }
  }
  if (!properties || properties.ActiveState !== "inactive"
    || properties.InvocationID !== receipt.systemdInvocationId
    || properties.ControlGroup !== receipt.serviceCgroupPath) {
    fail("PREAUTH_CLEANUP_UNVERIFIED");
  }
  const cgroupRoot = "/sys/fs/cgroup";
  let current = cgroupRoot;
  for (const component of receipt.serviceCgroupPath.split("/").filter(Boolean)) {
    if (component === "." || component === "..") fail("PREAUTH_CLEANUP_UNVERIFIED");
    current = path.join(current, component);
    let info;
    try {
      info = lstatSync(current);
    } catch {
      fail("PREAUTH_CLEANUP_UNVERIFIED");
    }
    if (info.isSymbolicLink() || !info.isDirectory()) fail("PREAUTH_CLEANUP_UNVERIFIED");
  }
  const info = statSync(current);
  if (String(info.ino) !== receipt.serviceCgroupInode) fail("PREAUTH_CLEANUP_UNVERIFIED");
  let cgroupProcs;
  try {
    const raw = readFileSync(path.join(current, "cgroup.procs"));
    if (raw.length > 4096) fail("PREAUTH_CLEANUP_UNVERIFIED");
    cgroupProcs = raw.toString("ascii").trim();
  } catch {
    fail("PREAUTH_CLEANUP_UNVERIFIED");
  }
  if (cgroupProcs !== "") fail("PREAUTH_CLEANUP_UNVERIFIED");
}

async function runPreAuthorizationBrokerGate({ cwd, approval }) {
  const { pack, sourceObjectManifestDigest } = collectPreAuthorizationSource({ cwd, approval });
  const request = buildPreAuthorizationBrokerRequest({ approval, pack, sourceObjectManifestDigest });
  const controllerIdentity = observeCurrentControllerIdentity();
  const receipt = await exchangeWithPreAuthorizationBroker(request, pack);
  const validated = validatePreAuthorizationBrokerReceipt({
    receipt, request, nowMonotonicMs: Number(process.hrtime.bigint() / 1_000_000n),
    expectedControllerIdentity: controllerIdentity,
  });
  if (canonicalizeRfc8785(observeCurrentControllerIdentity())
    !== canonicalizeRfc8785(controllerIdentity)) {
    fail("PREAUTH_CONTROLLER_IDENTITY_UNVERIFIED");
  }
  verifyPostReplyCleanup(receipt);
  return validated;
}

function result(fields) {
  return {
    schemaVersion: RESULT_SCHEMA_VERSION,
    authorityId: AUTHORITY_ID,
    command: fields.command,
    taskId: fields.taskId ?? null,
    decision: fields.decision,
    canExecuteProductWork: fields.canExecuteProductWork ?? false,
    canAcceptProductCandidate: fields.canAcceptProductCandidate ?? false,
    approvalDigest: fields.approvalDigest ?? null,
    candidateCommit: fields.candidateCommit ?? null,
    candidateTree: fields.candidateTree ?? null,
    evidenceDigest: fields.evidenceDigest ?? null,
    reason: fields.reason,
  };
}

export async function authorizeProductWork({
  cwd = process.cwd(),
  taskId,
} = {}) {
  ensureCleanWorktree(cwd);
  const approval = inspectApprovalCommit({ cwd, taskId });
  await requireRemoteHead({ cwd, approval }, defaultRemoteHeadResolver, approval.commit);
  let evidenceDigest = null;
  if (approval.manifest.schemaVersion === APPROVAL_SCHEMA_VERSION_V2) {
    evidenceDigest = (await runPreAuthorizationBrokerGate({ cwd, approval })).evidenceDigest;
  }
  ensureCleanWorktree(cwd);
  await requireRemoteHead({ cwd, approval }, defaultRemoteHeadResolver, approval.commit);
  return result({
    command: "authorize",
    taskId,
    decision: "GO",
    canExecuteProductWork: true,
    approvalDigest: approval.manifestDigest,
    evidenceDigest,
    reason: "APPROVED_FOR_ONE_CHILD",
  });
}

function verificationEnvironment() {
  return {
    PATH: "/usr/bin:/bin",
    CI: "1",
    NODE_ENV: "test",
    PYTHONDONTWRITEBYTECODE: "1",
    LANG: "C.UTF-8",
    LC_ALL: "C.UTF-8",
    NO_COLOR: "1",
    NEXT_TELEMETRY_DISABLED: "1",
  };
}

export function runVerificationMatrix({ cwd, verification, expectedCommit = null }) {
  const evidence = [];
  let repositoryRoot;
  try {
    repositoryRoot = realpathSync(cwd);
  } catch {
    fail("VERIFICATION_CWD_INVALID");
  }
  for (const entry of verification) {
    if (expectedCommit !== null && runGit(["rev-parse", "HEAD"], { cwd }) !== expectedCommit) {
      fail("PRODUCT_CANDIDATE_MOVED_DURING_VERIFICATION");
    }
    const executable = TOOL_PATHS[entry.tool];
    let commandCwd;
    try {
      commandCwd = realpathSync(entry.cwd === "." ? cwd : path.join(cwd, entry.cwd));
      if (!statSync(commandCwd).isDirectory()
        || (commandCwd !== repositoryRoot && !commandCwd.startsWith(`${repositoryRoot}${path.sep}`))) {
        fail("VERIFICATION_CWD_INVALID");
      }
    } catch (error) {
      if (error instanceof ProductAuthorityError) throw error;
      fail("VERIFICATION_CWD_INVALID");
    }
    const completed = spawnSync(executable, entry.args, {
      cwd: commandCwd,
      encoding: null,
      env: verificationEnvironment(),
      timeout: entry.timeoutMs,
      maxBuffer: MAX_COMMAND_OUTPUT,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    if (completed.error || completed.signal || completed.status !== 0) fail("VERIFICATION_FAILED");
    if (expectedCommit !== null && runGit(["rev-parse", "HEAD"], { cwd }) !== expectedCommit) {
      fail("PRODUCT_CANDIDATE_MOVED_DURING_VERIFICATION");
    }
    if (expectedCommit !== null) ensureCleanWorktree(cwd, "WORKTREE_DIRTY_AFTER_VERIFICATION");
    evidence.push({
      id: entry.id,
      exitCode: completed.status,
      stdoutDigest: digestBytes(completed.stdout ?? Buffer.alloc(0)),
      stderrDigest: digestBytes(completed.stderr ?? Buffer.alloc(0)),
    });
  }
  return { evidence, evidenceDigest: canonicalDigest(evidence) };
}

export async function verifyProductCandidate({
  cwd = process.cwd(),
  taskId,
} = {}) {
  ensureRepositoryIdentity(cwd);
  ensureCleanWorktree(cwd);
  const candidateCommit = runGit(["rev-parse", "HEAD"], { cwd });
  const parents = commitParents(cwd, candidateCommit);
  if (parents.length !== 1) fail("PRODUCT_CANDIDATE_PARENT_INVALID");
  const approval = inspectApprovalCommit({ cwd, taskId, commit: parents[0] });
  await requireRemoteHead({ cwd, approval }, defaultRemoteHeadResolver, approval.commit);
  const productPaths = changedPaths(cwd, approval.commit, candidateCommit);
  if (JSON.stringify(productPaths) !== JSON.stringify(approval.manifest.request.productPaths)) {
    fail("PRODUCT_COMMIT_SCOPE_INVALID");
  }
  const preAuthorizationIds = approval.manifest.schemaVersion === APPROVAL_SCHEMA_VERSION_V2
    ? new Set([
      approval.manifest.preAuthorizationReceipt.controllerVerificationId,
      approval.manifest.preAuthorizationReceipt.verifierVerificationId,
    ])
    : new Set();
  const candidateVerification = approval.manifest.verification.filter((entry) => !preAuthorizationIds.has(entry.id));
  if (candidateVerification.length === 0) fail("VERIFICATION_MATRIX_INVALID");
  const verificationResult = runVerificationMatrix({
    cwd,
    verification: candidateVerification,
    expectedCommit: candidateCommit,
  });
  if (runGit(["rev-parse", "HEAD"], { cwd }) !== candidateCommit) {
    fail("PRODUCT_CANDIDATE_MOVED_DURING_VERIFICATION");
  }
  ensureCleanWorktree(cwd, "WORKTREE_DIRTY_AFTER_VERIFICATION");
  await requireRemoteHead({ cwd, approval }, defaultRemoteHeadResolver, approval.commit);
  return result({
    command: "verify-candidate",
    taskId,
    decision: "PASS",
    canAcceptProductCandidate: true,
    approvalDigest: approval.manifestDigest,
    candidateCommit,
    candidateTree: runGit(["rev-parse", `${candidateCommit}^{tree}`], { cwd }),
    evidenceDigest: verificationResult.evidenceDigest,
    reason: "CANDIDATE_ELIGIBLE_FOR_OWNER_ACCEPTANCE",
  });
}

function parseCli(argv) {
  if (argv.length === 1 && argv[0] === "--status") return { command: "status", taskId: null };
  if (argv.length === 3 && argv[1] === "--task" && TASK_ID_PATTERN.test(argv[2])) {
    if (argv[0] === "--digest") return { command: "digest", taskId: argv[2] };
    if (argv[0] === "--authorize") return { command: "authorize", taskId: argv[2] };
    if (argv[0] === "--verify-candidate") return { command: "verify-candidate", taskId: argv[2] };
  }
  return { command: "invalid", taskId: null };
}

export async function runCli(argv = process.argv.slice(2), { cwd = process.cwd() } = {}) {
  const parsed = parseCli(argv);
  if (parsed.command === "invalid") {
    process.stdout.write(`${JSON.stringify(result({ command: "invalid", decision: "STOP", reason: "USAGE_INVALID" }))}\n`);
    return 64;
  }
  if (parsed.command === "status") {
    process.stdout.write(`${JSON.stringify(result({ command: "status", decision: "STOP", reason: "APPROVAL_NOT_SELECTED" }))}\n`);
    return 0;
  }
  try {
    let response;
    if (parsed.command === "digest") {
      ensureCleanWorktree(cwd);
      const approval = inspectApprovalCommit({ cwd, taskId: parsed.taskId });
      response = result({
        command: "digest",
        taskId: parsed.taskId,
        decision: "DIGEST",
        approvalDigest: approval.manifestDigest,
        reason: "APPROVAL_DIGEST_VALID",
      });
    } else if (parsed.command === "authorize") {
      response = await authorizeProductWork({ cwd, taskId: parsed.taskId });
    } else {
      response = await verifyProductCandidate({ cwd, taskId: parsed.taskId });
    }
    process.stdout.write(`${JSON.stringify(response)}\n`);
    return 0;
  } catch (error) {
    const reason = error instanceof ProductAuthorityError ? error.code : "INTERNAL_ERROR";
    process.stdout.write(`${JSON.stringify(result({
      command: parsed.command,
      taskId: parsed.taskId,
      decision: "STOP",
      reason,
    }))}\n`);
    return 2;
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  process.exitCode = await runCli();
}

export { canonicalizeRfc8785 };
