import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { chmod, mkdir, mkdtemp, open, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { canonicalizeRfc8785 } from "./execution_authority_ext.mjs";

import {
  GIT_EXECUTABLE,
  AUTHORITY_ID,
  APPROVAL_SCHEMA_VERSION_V2,
  PATH_BINDING_CASE_RECORDS,
  PATH_BINDING_ORDERED_CASES,
  PREAUTH_BROKER_SOCKET,
  PREAUTH_RUNNER_SOURCE,
  ProductAuthorityError,
  approvalPathForTask,
  authorizeProductWork,
  canonicalDigest,
  buildPreAuthorizationBrokerRequest,
  inspectApprovalCommit,
  parseJsonStrict,
  runVerificationMatrix,
  validatePreAuthorizationBrokerReceipt,
  validateApprovalManifest,
  verifyProductCandidate,
} from "./product-authority.mjs";

const REPOSITORY_ROOT = fileURLToPath(new URL("../", import.meta.url));
const AUTHORITY_PATH = path.join(REPOSITORY_ROOT, "scripts", "product-authority.mjs");
const TEST_PATH = process.platform === "win32"
  ? (process.env.Path ?? process.env.PATH ?? "")
  : "/usr/bin:/bin";
const TEST_GIT_LITERAL = JSON.stringify(GIT_EXECUTABLE);
const APPROVAL_SCHEMA_PATH = path.join(
  REPOSITORY_ROOT,
  ".harness",
  "contracts",
  "product-approval.schema.json",
);
const TASK_ID = "H1-HUBU-RICH-MEMORIAL-20260816";
const INSTALLED_ACCEPTANCE_ENABLED = process.env.CHAOTANG_INSTALLED_PREAUTH_ACCEPTANCE === "1";
const EXACT2_PATHS = [
  "scripts/product-authority.test.mjs",
  "scripts/reference/test_chaotang_product_verifier_broker.py",
];

function git(cwd, args, encoding = "utf8") {
  return execFileSync(GIT_EXECUTABLE, ["--no-replace-objects", ...args], {
    cwd,
    encoding,
    env: { PATH: TEST_PATH, GIT_CONFIG_NOSYSTEM: "1", GIT_TERMINAL_PROMPT: "0" },
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function gitBytes(cwd, args) {
  return execFileSync(GIT_EXECUTABLE, ["--no-replace-objects", ...args], {
    cwd,
    env: {
      HOME: "/nonexistent", PATH: TEST_PATH, LANG: "C", LC_ALL: "C",
      GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null",
      GIT_CONFIG_SYSTEM: "/dev/null", GIT_TERMINAL_PROMPT: "0",
      GIT_NO_REPLACE_OBJECTS: "1", GIT_OPTIONAL_LOCKS: "0",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
}

async function initializeRepository(t, { productFile = false } = {}) {
  const root = await mkdtemp(path.join(tmpdir(), "chaotang-m0-authority-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  git(root, ["init", "-b", "ext-dev"]);
  git(root, ["config", "user.name", "M0 Test"]);
  git(root, ["config", "user.email", "m0@example.invalid"]);
  git(root, ["remote", "add", "origin", "git@gitee.com:msxn/chaotang-os.git"]);
  await writeFile(path.join(root, "README.md"), "base\n", "utf8");
  if (productFile) {
    await mkdir(path.join(root, "src"), { recursive: true });
    await writeFile(path.join(root, "src", "feature.txt"), "base feature\n", "utf8");
  }
  git(root, ["add", "README.md", ...(productFile ? ["src/feature.txt"] : [])]);
  git(root, ["commit", "-m", "base"]);
  return {
    root,
    baseCommit: git(root, ["rev-parse", "HEAD"]),
    baseTree: git(root, ["rev-parse", "HEAD^{tree}"]),
  };
}

function approvalManifest({ baseCommit, baseTree, verification = null } = {}) {
  return {
    schemaVersion: "product-authority.m0.approval.v1",
    authorityId: AUTHORITY_ID,
    taskId: TASK_ID,
    repository: {
      identity: "gitee.com/msxn/chaotang-os",
      targetBranch: "ext-dev",
    },
    request: {
      baseCommit,
      baseTree,
      approvalPath: approvalPathForTask(TASK_ID),
      approvalCommitPaths: [approvalPathForTask(TASK_ID)],
      productPaths: ["src/feature.txt"],
    },
    nonGoals: ["NO_AUTHORITY_HARNESS_OR_MANIFEST_CHANGE", "NO_PRODUCTION_EXTERNAL_SIDE_EFFECTS"],
    verification: verification ?? [{
      id: "node-smoke",
      tool: "node",
      args: ["-e", "process.exit(0)"],
      cwd: ".",
      timeoutMs: 5_000,
    }],
    state: "APPROVED_FOR_ONE_CHILD",
  };
}

function sourceIdentity(source) {
  const bytes = Buffer.from(source, "utf8");
  return {
    bytes: bytes.length,
    gitBlobSha1: createHash("sha1").update(Buffer.concat([
      Buffer.from(`blob ${bytes.length}\0`), bytes,
    ])).digest("hex"),
    mode: "100644",
    rawSha256: `sha256:${createHash("sha256").update(bytes).digest("hex")}`,
  };
}

function domainDigest(domain, value) {
  return `sha256:${createHash("sha256")
    .update(Buffer.from(domain, "utf8"))
    .update(Buffer.from(canonicalizeRfc8785(value), "utf8"))
    .digest("hex")}`;
}

function frozenSourceRecord({ commit, tree, relativePath }) {
  assert.equal(git(REPOSITORY_ROOT, ["rev-parse", `${commit}^{tree}`]), tree);
  const record = git(REPOSITORY_ROOT, ["ls-tree", commit, "--", relativePath]);
  const match = /^100644 blob ([0-9a-f]{40})\t(.+)$/u.exec(record);
  assert.ok(match, `FROZEN_SOURCE_RECORD_INVALID:${relativePath}`);
  assert.equal(match[2], relativePath);
  const payload = gitBytes(REPOSITORY_ROOT, ["cat-file", "blob", `${commit}:${relativePath}`]);
  assert.deepEqual(readFileSync(path.join(REPOSITORY_ROOT, relativePath)), payload);
  return {
    path: relativePath,
    sourceCommit: commit,
    sourceTree: tree,
    mode: "100644",
    bytes: payload.length,
    rawSha256: `sha256:${createHash("sha256").update(payload).digest("hex")}`,
    gitBlobOid: match[1],
  };
}

function verifyReadonlyExact2Tree(installation) {
  const commit = process.env.CHAOTANG_EXACT2_COMMIT ?? "";
  const tree = process.env.CHAOTANG_EXACT2_TREE ?? "";
  assert.match(commit, /^[0-9a-f]{40}$/);
  assert.match(tree, /^[0-9a-f]{40}$/);
  assert.equal(git(REPOSITORY_ROOT, ["rev-parse", "HEAD"]), commit);
  assert.equal(git(REPOSITORY_ROOT, ["rev-parse", "HEAD^{tree}"]), tree);
  assert.equal(git(REPOSITORY_ROOT, ["status", "--porcelain=v1", "--untracked-files=all"]), "");
  assert.match(installation.exact4Commit, /^[0-9a-f]{40}$/);
  assert.match(installation.exact4Tree, /^[0-9a-f]{40}$/);
  const ancestry = spawnSync(GIT_EXECUTABLE, [
    "--no-replace-objects", "merge-base", "--is-ancestor", installation.exact4Commit, commit,
  ], {
    cwd: REPOSITORY_ROOT, stdio: "ignore", shell: false,
    env: {
      HOME: "/nonexistent", PATH: TEST_PATH, LANG: "C", LC_ALL: "C",
      GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null",
      GIT_CONFIG_SYSTEM: "/dev/null", GIT_NO_REPLACE_OBJECTS: "1",
    },
  });
  assert.equal(ancestry.status, 0, "EXACT9_NOT_ANCESTOR_OF_EXACT2");
  const readonly = spawnSync("/usr/bin/python3", [
    "-I", "-c",
    "import os,sys;raise SystemExit(0 if os.statvfs(sys.argv[1]).f_flag & os.ST_RDONLY else 1)",
    REPOSITORY_ROOT,
  ], {
    env: { PATH: TEST_PATH, LANG: "C.UTF-8", LC_ALL: "C.UTF-8" },
    stdio: "ignore", timeout: 5000, shell: false,
  });
  assert.equal(readonly.status, 0, "EXACT2_TREE_NOT_READ_ONLY");
  const records = [
    frozenSourceRecord({
      commit: installation.exact4Commit,
      tree: installation.exact4Tree,
      relativePath: "scripts/product-authority.mjs",
    }),
    ...EXACT2_PATHS.map((relativePath) => frozenSourceRecord({ commit, tree, relativePath })),
  ].sort((left, right) => Buffer.from(left.path).compare(Buffer.from(right.path)));
  const provenancePath = process.env.CHAOTANG_EXACT2_PROVENANCE ?? "";
  const expectedDigest = process.env.CHAOTANG_EXACT2_PROVENANCE_DIGEST ?? "";
  assert.ok(path.isAbsolute(provenancePath), "EXACT2_PROVENANCE_PATH_INVALID");
  assert.match(expectedDigest, /^sha256:[0-9a-f]{64}$/);
  const provenance = parseJsonStrict(readFileSync(provenancePath, "utf8"));
  assert.deepEqual(Object.keys(provenance).sort(), [
    "digest", "exact2Commit", "exact2Tree", "exact9Commit", "exact9Tree",
    "records", "schemaVersion",
  ]);
  assert.equal(provenance.schemaVersion, "chaotang-product-authority-installed-acceptance-provenance.v1");
  assert.equal(provenance.exact2Commit, commit);
  assert.equal(provenance.exact2Tree, tree);
  assert.equal(provenance.exact9Commit, installation.exact4Commit);
  assert.equal(provenance.exact9Tree, installation.exact4Tree);
  assert.deepEqual(provenance.records, records);
  const payload = { ...provenance };
  delete payload.digest;
  assert.equal(
    provenance.digest,
    domainDigest("chaotang-product-authority-installed-acceptance-provenance-v1\0", payload),
  );
  assert.equal(provenance.digest, expectedDigest);
  return provenance;
}

function dedicatedControllerManifestDigest(installation) {
  return domainDigest("chaotang-dedicated-controller-manifest-v1\0", {
    schemaVersion: "chaotang-dedicated-controller-manifest.v1",
    installationManifestDigest: installation.digest,
    controllerUid: installation.identities.controllerUid,
    controllerGid: installation.identities.controllerGid,
    socket: installation.socket,
  });
}

function receiptGatedManifest({ baseCommit, baseTree } = {}) {
  const controllerPayload = `
import crypto from "node:crypto";
import fs from "node:fs";
const buffer = Buffer.alloc(16385);
const count = fs.readSync(3, buffer, 0, buffer.length, null);
const challenge = buffer.subarray(0, count);
const sealedSource = fs.readFileSync(4, "utf8");
if (!sealedSource.startsWith("/*CONTROLLER_SEALED_SOURCE_MARKER*/")) process.exit(31);
const CONTROLLER_EXPECTED_INHERITED_FDS = new Set([0, 1, 2, 3, 4, 6]);
for (const fd of [...CONTROLLER_EXPECTED_INHERITED_FDS].filter((value) => value > 2)) fs.fstatSync(fd);
for (const fd of fs.readdirSync("/proc/self/fd")) {
  try {
    const target = fs.readlinkSync("/proc/self/fd/" + fd);
    if (target.endsWith("/ambient-secret")) process.exit(32);
    if (Number(fd) === 5 && [4, 6].some((sourceFd) => {
      const candidate = fs.fstatSync(5); const source = fs.fstatSync(sourceFd);
      return candidate.dev === source.dev && candidate.ino === source.ino;
    })) process.exit(33);
  } catch {}
}
const ack = JSON.stringify({challengeDigest:"sha256:"+crypto.createHash("sha256").update(challenge).digest("hex"),status:"CONTROLLER_EXECUTED"});
fs.writeSync(3, ack);
`.trim();
  const controllerSource = `/*CONTROLLER_SEALED_SOURCE_MARKER*/await import("data:text/javascript;base64,${Buffer.from(controllerPayload, "utf8").toString("base64")}");`;
  const verifierPayload = `
import hashlib, json, os, socket
def canonical(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
channel = socket.socket(fileno=3)
challenge_bytes = channel.recv(16385)
challenge = json.loads(challenge_bytes.decode("utf-8"))
sealed_source = os.read(4, 1 << 20).decode("utf-8", "strict")
if not sealed_source.startswith('"VERIFIER_SEALED_SOURCE_MARKER";'):
    raise SystemExit(31)
VERIFIER_EXPECTED_INHERITED_FDS = {0, 1, 2, 3, 4, 6}
for fd in sorted(VERIFIER_EXPECTED_INHERITED_FDS - {0, 1, 2}):
    os.fstat(fd)
for fd in os.listdir("/proc/self/fd"):
    try:
        target = os.readlink("/proc/self/fd/" + fd)
        if target.endswith("/ambient-secret"):
            raise SystemExit(32)
        if int(fd) == 5 and any(
            (os.fstat(5).st_dev, os.fstat(5).st_ino) ==
            (os.fstat(source_fd).st_dev, os.fstat(source_fd).st_ino)
            for source_fd in (4, 6)
        ):
            raise SystemExit(33)
    except OSError:
        pass
receipt = {
    "schemaVersion": "product-authority.m0.pre-authority-receipt.v2",
    "status": "PASS",
    "taskId": challenge["taskId"],
    "approvalCommit": challenge["approvalCommit"],
    "approvalTree": challenge["approvalTree"],
    "approvalCanonicalDigest": challenge["approvalCanonicalDigest"],
    "sourceObjectManifestDigest": challenge["sourceObjectManifestDigest"],
    "nonce": challenge["nonce"],
    "issuedMonotonicMs": challenge["issuedMonotonicMs"],
    "expiresMonotonicMs": challenge["expiresMonotonicMs"],
    "challengeDigest": "sha256:" + hashlib.sha256(challenge_bytes).hexdigest(),
    "controllerExecutionDigest": challenge["controllerExecutionDigest"],
    "controllerIdentity": challenge["controllerIdentity"],
    "verifierIdentity": challenge["verifierIdentity"],
    "approvalSourceRootIdentity": challenge["approvalSourceRootIdentity"],
    "pathBinding": {
        "orderedCaseResults": challenge["pathBindingResults"],
        "recordDigest": "sha256:7ba1eeb23769551d2be58f136c1038e8897f5141755f5a34ac2cf0c39fa0c572",
        "schemaDigest": "sha256:9afc472beb987bfe1c233e61f3247a5f509d52aa37d375f124cb451a3ccdf049",
    },
}
channel.send(canonical(receipt))
channel.close()
`.trim();
  const verifierSource = `"VERIFIER_SEALED_SOURCE_MARKER";import base64;exec(compile(base64.b64decode(b'${Buffer.from(verifierPayload, "utf8").toString("base64")}'),'<installed-preauthorization-verifier>','exec'))`;
  return {
    ...approvalManifest({ baseCommit, baseTree, verification: [
      { id: "candidate", tool: "node", args: ["-e", "process.exit(0)"], cwd: ".", timeoutMs: 5000 },
      { id: "preauth-controller", tool: "node", args: ["--input-type=module", "--eval", controllerSource], cwd: ".", timeoutMs: 5000 },
      { id: "preauth-verifier", tool: "python3", args: ["-I", "-c", verifierSource], cwd: ".", timeoutMs: 5000 },
    ] }),
    schemaVersion: APPROVAL_SCHEMA_VERSION_V2,
    preAuthorizationReceipt: {
      schemaVersion: "product-authority.m0.pre-authorization-policy.v2",
      controllerVerificationId: "preauth-controller",
      verifierVerificationId: "preauth-verifier",
      controllerIdentity: sourceIdentity(controllerSource),
      verifierIdentity: sourceIdentity(verifierSource),
      pathBinding: {
        schemaVersion: "chaotang.path-binding-self-test.attestation.v1",
        recordBytes: 4123,
        recordDigest: "sha256:7ba1eeb23769551d2be58f136c1038e8897f5141755f5a34ac2cf0c39fa0c572",
        schemaBytes: 8475,
        schemaDigest: "sha256:9afc472beb987bfe1c233e61f3247a5f509d52aa37d375f124cb451a3ccdf049",
        caseCount: 18,
        orderedCases: PATH_BINDING_CASE_RECORDS,
      },
      broker: {
        socketPath: PREAUTH_BROKER_SOCKET,
        runtimeProfileId: "node-preauthorization-v1",
        runtimeProfileDigest: `sha256:${"1".repeat(64)}`,
        installationManifestDigest: `sha256:${"2".repeat(64)}`,
        dedicatedControllerManifestDigest: `sha256:${"3".repeat(64)}`,
        executionProfileIdentity: sourceIdentity(PREAUTH_RUNNER_SOURCE),
      },
      ttlMs: 30000,
      maxChallengeBytes: 16384,
      maxReceiptBytes: 65536,
    },
  };
}

function innerReceiptForRequest(request, root = {
  device: "1", inode: "2", mode: 0o555, mountId: "3",
  sourceManifestDigest: request.sourceObjectManifestDigest,
}) {
  const pathBindingPolicy = {
    schemaVersion: "chaotang.path-binding-self-test.attestation.v1",
    recordBytes: 4123,
    recordDigest: request.pathBindingRecordDigest,
    schemaBytes: 8475,
    schemaDigest: request.pathBindingSchemaDigest,
    caseCount: 18,
    orderedCases: PATH_BINDING_CASE_RECORDS,
  };
  const controllerChallenge = {
    approvalCanonicalDigest: request.approvalCanonicalDigest,
    approvalCommit: request.approvalCommit,
    approvalSourceRootIdentity: root,
    approvalTree: request.approvalTree,
    controllerIdentity: request.controllerIdentity,
    expiresMonotonicMs: request.expiresMonotonicMs,
    issuedMonotonicMs: request.issuedMonotonicMs,
    nonce: request.nonce,
    pathBindingPolicyDigest: canonicalDigest(pathBindingPolicy),
    pathBindingResults: PATH_BINDING_ORDERED_CASES.map((id) => ({ id, status: "PASS" })),
    schemaVersion: "product-authority.m0.pre-authority-challenge.v2",
    sourceObjectManifestDigest: request.sourceObjectManifestDigest,
    taskId: request.taskId,
    verifierIdentity: request.verifierIdentity,
  };
  const controllerAck = {
    challengeDigest: `sha256:${createHash("sha256").update(Buffer.from(canonicalizeRfc8785(controllerChallenge))).digest("hex")}`,
    status: "CONTROLLER_EXECUTED",
  };
  const controllerExecutionDigest = `sha256:${createHash("sha256").update(Buffer.from(canonicalizeRfc8785(controllerAck))).digest("hex")}`;
  const challenge = { ...controllerChallenge, controllerExecutionDigest };
  return {
    schemaVersion: "product-authority.m0.pre-authority-receipt.v2",
    status: "PASS",
    taskId: request.taskId,
    approvalCommit: request.approvalCommit,
    approvalTree: request.approvalTree,
    approvalCanonicalDigest: request.approvalCanonicalDigest,
    sourceObjectManifestDigest: request.sourceObjectManifestDigest,
    nonce: request.nonce,
    issuedMonotonicMs: request.issuedMonotonicMs,
    expiresMonotonicMs: request.expiresMonotonicMs,
    challengeDigest: `sha256:${createHash("sha256").update(Buffer.from(canonicalizeRfc8785(challenge))).digest("hex")}`,
    controllerExecutionDigest,
    controllerIdentity: request.controllerIdentity,
    verifierIdentity: request.verifierIdentity,
    approvalSourceRootIdentity: root,
    pathBinding: {
      orderedCaseResults: PATH_BINDING_ORDERED_CASES.map((id) => ({ id, status: "PASS" })),
      recordDigest: request.pathBindingRecordDigest,
      schemaDigest: request.pathBindingSchemaDigest,
    },
  };
}

async function commitApproval(repository, manifest) {
  const approvalPath = approvalPathForTask(manifest.taskId);
  await mkdir(path.join(repository.root, path.dirname(approvalPath)), { recursive: true });
  await writeFile(path.join(repository.root, approvalPath), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  git(repository.root, ["add", "--", approvalPath]);
  git(repository.root, ["commit", "-m", "approve product task"]);
  return git(repository.root, ["rev-parse", "HEAD"]);
}

async function commitCandidate(repository, content = "implemented\n") {
  await mkdir(path.join(repository.root, "src"), { recursive: true });
  await writeFile(path.join(repository.root, "src", "feature.txt"), content, "utf8");
  git(repository.root, ["add", "src/feature.txt"]);
  git(repository.root, ["commit", "-m", "implement product task"]);
  return git(repository.root, ["rev-parse", "HEAD"]);
}

async function attachLocalRemote(t, repository) {
  const bare = await mkdtemp(path.join(tmpdir(), "chaotang-m0-remote-"));
  t.after(() => rm(bare, { recursive: true, force: true }));
  git(bare, ["init", "--bare"]);
  git(repository.root, [
    "config",
    `url.file://${bare}.insteadOf`,
    "git@gitee.com:msxn/chaotang-os.git",
  ]);
  return bare;
}

async function publishApproval(t, repository, manifest) {
  const bare = await attachLocalRemote(t, repository);
  const approvalCommit = await commitApproval(repository, manifest);
  git(repository.root, ["push", "origin", "HEAD:refs/heads/ext-dev"]);
  return { approvalCommit, bare };
}

test("strict parser and canonical digest reject ambiguous JSON", () => {
  assert.deepEqual(parseJsonStrict('{"state":"APPROVED_FOR_ONE_CHILD"}'), {
    state: "APPROVED_FOR_ONE_CHILD",
  });
  assert.throws(
    () => parseJsonStrict('{"state":"STOP","state":"APPROVED_FOR_ONE_CHILD"}'),
    /DUPLICATE_JSON_KEY/,
  );
  assert.equal(canonicalDigest({ b: 2, a: 1 }), canonicalDigest({ a: 1, b: 2 }));
});

test("approval manifest is closed, ordered and cannot authorize governance paths or shell tools", () => {
  const manifest = approvalManifest({ baseCommit: "a".repeat(40), baseTree: "b".repeat(40) });
  assert.deepEqual(validateApprovalManifest(manifest), manifest);

  const unknown = structuredClone(manifest);
  unknown.ready = true;
  assert.throws(() => validateApprovalManifest(unknown), /APPROVAL_SCHEMA_INVALID/);

  const wrongState = structuredClone(manifest);
  wrongState.state = "READY";
  assert.throws(() => validateApprovalManifest(wrongState), /APPROVAL_STATE_INVALID/);

  const expanded = structuredClone(manifest);
  expanded.request.productPaths = [".harness/manifest/project-harness.json"];
  assert.throws(() => validateApprovalManifest(expanded), /PRODUCT_PATH_PROTECTED/);

  const authorityContract = structuredClone(manifest);
  authorityContract.request.productPaths = ["docs/contracts/execution-authority-ext-grant.schema.json"];
  assert.throws(() => validateApprovalManifest(authorityContract), /PRODUCT_PATH_PROTECTED/);

  for (const unsafePath of ["src/line\nbreak.ts", "src/tab\tname.ts", "src/carriage\rreturn.ts"]) {
    const controlCharacterPath = structuredClone(manifest);
    controlCharacterPath.request.productPaths = [unsafePath];
    assert.throws(
      () => validateApprovalManifest(controlCharacterPath),
      /PRODUCT_PATH_SCOPE_INVALID/,
      JSON.stringify(unsafePath),
    );
  }

  const rootGovernancePaths = [
    ".superpowers/legacy-plan.md",
    "CLAUDE.md",
    "backend/AGENTS.md",
    "backend/CLAUDE.md",
    "docs/decisions/0044-six-ministry-evidence-spine.md",
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
  ];
  for (const protectedPath of rootGovernancePaths) {
    const rootGovernance = structuredClone(manifest);
    rootGovernance.request.productPaths = [protectedPath];
    assert.throws(
      () => validateApprovalManifest(rootGovernance),
      /PRODUCT_PATH_PROTECTED/,
      protectedPath,
    );
  }

  const shell = structuredClone(manifest);
  shell.verification[0].tool = "bash";
  assert.throws(() => validateApprovalManifest(shell), /VERIFICATION_MATRIX_INVALID/);
});

test("approval JSON schema is closed and pins the M0 identities and command tools", async () => {
  const schema = parseJsonStrict(await readFile(APPROVAL_SCHEMA_PATH, "utf8"));
  assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
  assert.equal(schema.$id, "https://chaotang-os.local/contracts/product-authority.m0.approval.v1-v2.schema.json");
  assert.equal(schema.additionalProperties, false);
  assert.deepEqual(schema.properties.schemaVersion.enum, [
    "product-authority.m0.approval.v1",
    "product-authority.m0.approval.v2",
  ]);
  assert.equal(schema.properties.authorityId.const, AUTHORITY_ID);
  assert.equal(schema.properties.state.const, "APPROVED_FOR_ONE_CHILD");
  for (const name of ["repository", "request", "verification"]) {
    const definition = schema.$defs[name];
    assert.equal(definition.type, "object");
    assert.equal(definition.additionalProperties, false);
    assert.deepEqual([...definition.required].sort(), Object.keys(definition.properties).sort());
  }
  assert.deepEqual(schema.$defs.verification.properties.tool.enum, ["node", "npm", "python3"]);
  assert.equal(schema.$defs.preAuthorizationReceipt.additionalProperties, false);
  assert.equal(schema.$defs.broker.additionalProperties, false);
});

test("receipt-gated v2 is opt-in, closed and binds the credential-separated broker", () => {
  const manifest = receiptGatedManifest({ baseCommit: "a".repeat(40), baseTree: "b".repeat(40) });
  assert.deepEqual(validateApprovalManifest(manifest), manifest);
  assert.equal(PREAUTH_BROKER_SOCKET, "/run/chaotang-product-verifier/verifier.sock");

  const unknown = structuredClone(manifest);
  unknown.preAuthorizationReceipt.broker.shell = true;
  assert.throws(() => validateApprovalManifest(unknown), /PRE_AUTHORIZATION_POLICY_INVALID/);

  const wrongSocket = structuredClone(manifest);
  wrongSocket.preAuthorizationReceipt.broker.socketPath = "/tmp/attacker.sock";
  assert.throws(() => validateApprovalManifest(wrongSocket), /PRE_AUTHORIZATION_POLICY_INVALID/);

  const wrongController = structuredClone(manifest);
  wrongController.verification[1].args[2] += "\n";
  assert.throws(() => validateApprovalManifest(wrongController), /PRE_AUTHORIZATION_IDENTITY_INVALID/);

  const legacy = approvalManifest({ baseCommit: "a".repeat(40), baseTree: "b".repeat(40) });
  legacy.preAuthorizationReceipt = manifest.preAuthorizationReceipt;
  assert.throws(() => validateApprovalManifest(legacy), /APPROVAL_SCHEMA_INVALID/);
});

test("preauthorization broker request is approval-source only and canonical-bound", () => {
  const manifest = receiptGatedManifest({ baseCommit: "a".repeat(40), baseTree: "b".repeat(40) });
  const approval = {
    commit: "c".repeat(40),
    tree: "d".repeat(40),
    manifest,
    manifestDigest: `sha256:${"e".repeat(64)}`,
  };
  const pack = Buffer.from("PACK");
  const request = buildPreAuthorizationBrokerRequest({
    approval,
    pack,
    sourceObjectManifestDigest: `sha256:${"f".repeat(64)}`,
    nonce: "1".repeat(64),
    issuedMonotonicMs: 1000,
  });
  assert.equal(request.schemaVersion, "chaotang-product-verifier-preauthorization-request.v1");
  assert.equal(request.sourceKind, "PRE_AUTHORIZATION_SOURCE");
  assert.equal(request.approvalCommit, approval.commit);
  assert.equal(request.directBaseCommit, manifest.request.baseCommit);
  assert.equal(request.remoteHead, approval.commit);
  assert.equal(request.workspaceMode, "READ_ONLY_APPROVAL_SOURCE");
  assert.ok(!Object.hasOwn(request, "candidateCommit"));
  assert.ok(!Object.hasOwn(request, "candidateTree"));
  assert.match(request.requestDigest, /^sha256:[0-9a-f]{64}$/);
});

test("the frozen broker execution profile compiles and embeds the closed 18-case matrix", () => {
  const compiled = spawnSync("/usr/bin/python3", [
    "-I", "-B", "-c", "import sys;compile(sys.stdin.read(),'<preauth-runner>','exec')",
  ], {
    input: PREAUTH_RUNNER_SOURCE,
    encoding: "utf8",
    env: { PATH: TEST_PATH, LANG: "C.UTF-8", LC_ALL: "C.UTF-8" },
    timeout: 5000,
    shell: false,
  });
  assert.equal(compiled.status, 0, compiled.stderr);
  for (const id of PATH_BINDING_ORDERED_CASES) assert.match(PREAUTH_RUNNER_SOURCE, new RegExp(id));
  assert.match(PREAUTH_RUNNER_SOURCE, /socket\.SOCK_SEQPACKET/);
  assert.match(PREAUTH_RUNNER_SOURCE, /\(3, 4, 6\)/);
  assert.match(PREAUTH_RUNNER_SOURCE, /\(verifier_fd, root_fd\)/);
  assert.doesNotMatch(PREAUTH_RUNNER_SOURCE, /os\.dup2\([^,]+,\s*5/);
});

test("the frozen runner executes controller and verifier with their distinct sealed FD4 sources", async (t) => {
  if (process.platform === "win32") {
    t.skip("sealed FD runner requires POSIX descriptor passing");
    return;
  }
  const manifest = receiptGatedManifest({ baseCommit: "a".repeat(40), baseTree: "b".repeat(40) });
  const approval = {
    commit: "c".repeat(40), tree: "d".repeat(40), manifest,
    manifestDigest: `sha256:${"e".repeat(64)}`,
  };
  const request = buildPreAuthorizationBrokerRequest({
    approval, pack: Buffer.from("PACK"),
    sourceObjectManifestDigest: `sha256:${"f".repeat(64)}`,
    nonce: "1".repeat(64), issuedMonotonicMs: 1000,
  });
  const root = await mkdtemp(path.join(tmpdir(), "chaotang-preauth-runner-"));
  t.after(async () => {
    await chmod(root, 0o700);
    await rm(root, { recursive: true, force: true });
  });
  const ambientPath = path.join(root, "ambient-secret");
  await writeFile(ambientPath, "must-not-reach-controller-or-verifier", "utf8");
  const ambient = await open(ambientPath, "r");
  await chmod(root, 0o555);
  const runnerConfig = parseJsonStrict(Buffer.from(request.args.at(-1), "base64").toString("utf8"));
  assert.deepEqual(sourceIdentity(runnerConfig.controllerSource), runnerConfig.controllerIdentity);
  assert.deepEqual(sourceIdentity(runnerConfig.verifierSource), runnerConfig.verifierIdentity);
  assert.ok(!/[\u0000-\u001f\u007f]/u.test(runnerConfig.controllerSource));
  assert.ok(!/[\u0000-\u001f\u007f]/u.test(runnerConfig.verifierSource));
  const hostRunner = PREAUTH_RUNNER_SOURCE
    .replaceAll("/runtime/bin/node", process.execPath)
    .replaceAll("/runtime/bin/python3", "/usr/bin/python3");
  let completed;
  try {
    completed = spawnSync("/usr/bin/python3", [
      "-I", "-B", "-c", hostRunner, request.args.at(-1),
    ], {
      cwd: root,
      encoding: "utf8",
      env: { PATH: TEST_PATH, LANG: "C.UTF-8", LC_ALL: "C.UTF-8", TMPDIR: "/tmp", TEMP: "/tmp", TMP: "/tmp" },
      stdio: ["ignore", "pipe", "pipe", "ignore", "ignore", "ignore", "ignore", ambient.fd],
      timeout: 20_000,
      shell: false,
    });
  } finally {
    await ambient.close();
  }
  assert.equal(completed.status, 0, completed.stderr);
  const receipt = parseJsonStrict(completed.stdout);
  assert.deepEqual(receipt.controllerIdentity, manifest.preAuthorizationReceipt.controllerIdentity);
  assert.deepEqual(receipt.verifierIdentity, manifest.preAuthorizationReceipt.verifierIdentity);
  assert.equal(receipt.status, "PASS");
});

test("outer broker receipt is closed and binds kernel peer, service cgroup and inner receipt", () => {
  const manifest = receiptGatedManifest({ baseCommit: "a".repeat(40), baseTree: "b".repeat(40) });
  const approval = {
    commit: "c".repeat(40), tree: "d".repeat(40), manifest,
    manifestDigest: `sha256:${"e".repeat(64)}`,
  };
  const request = buildPreAuthorizationBrokerRequest({
    approval, pack: Buffer.from("PACK"),
    sourceObjectManifestDigest: `sha256:${"f".repeat(64)}`,
    nonce: "1".repeat(64), issuedMonotonicMs: 1000,
  });
  const innerValue = innerReceiptForRequest(request);
  const inner = Buffer.from(canonicalizeRfc8785(innerValue), "utf8");
  const output = {
    encoding: "base64", bytes: inner.length,
    sha256: `sha256:${createHash("sha256").update(inner).digest("hex")}`,
    data: inner.toString("base64"),
  };
  const receipt = {
    schemaVersion: "chaotang-product-verifier-preauthorization-receipt.v1",
    nonce: request.nonce, requestDigest: request.requestDigest, taskId: request.taskId,
    approvalCommit: request.approvalCommit, approvalTree: request.approvalTree,
    directBaseCommit: request.directBaseCommit,
    approvalCanonicalDigest: request.approvalCanonicalDigest, remoteHead: request.remoteHead,
    sourceObjectManifestDigest: request.sourceObjectManifestDigest,
    runtimeProfileId: request.runtimeProfileId, runtimeProfileDigest: request.runtimeProfileDigest,
    installationManifestDigest: request.installationManifestDigest,
    dedicatedControllerManifestDigest: request.dedicatedControllerManifestDigest,
    controllerIdentity: request.controllerIdentity, verifierIdentity: request.verifierIdentity,
    executionProfileIdentity: request.executionProfileIdentity,
    pathBindingRecordDigest: request.pathBindingRecordDigest,
    pathBindingSchemaDigest: request.pathBindingSchemaDigest,
    issuedMonotonicMs: request.issuedMonotonicMs, expiresMonotonicMs: request.expiresMonotonicMs,
    innerPreauthorizationReceiptDigest: output.sha256, innerReceipt: output,
    peerPrimaryUid: 1001, peerPrimaryGid: 1002, peerKernelPid: 4321,
    peerProcStarttime: "88", peerUserNamespaceDeviceInode: "1:2",
    peerCgroupPath: "/user.slice/controller.scope", workerUid: 2001, workerGid: 2002,
    socketUnitName: "chaotang-product-verifier.socket",
    workerServiceUnitName: "chaotang-product-verifier@9.service",
    systemdInvocationId: "a".repeat(32),
    serviceCgroupPath: "/system.slice/chaotang-product-verifier@9.service",
    serviceCgroupInode: "123", serviceCgroupOnlyBrokerBeforeReceipt: true,
    startedMonotonicNs: 10, finishedMonotonicNs: 20,
    exitKind: "EXITED", exitCode: 0, signal: null, timedOut: false,
    infrastructureCode: "NONE",
  };
  const validated = validatePreAuthorizationBrokerReceipt({ receipt, request, nowMonotonicMs: 2000 });
  assert.deepEqual(validated.innerReceiptBytes, inner);
  assert.throws(
    () => validatePreAuthorizationBrokerReceipt({
      receipt, request, nowMonotonicMs: request.expiresMonotonicMs + 1,
    }),
    /PREAUTH_BROKER_RECEIPT_INVALID/,
  );
  const reboundRequest = buildPreAuthorizationBrokerRequest({
    approval, pack: Buffer.from("PACK"),
    sourceObjectManifestDigest: request.sourceObjectManifestDigest,
    nonce: "2".repeat(64), issuedMonotonicMs: 1000,
  });
  assert.throws(
    () => validatePreAuthorizationBrokerReceipt({
      receipt, request: reboundRequest, nowMonotonicMs: 2000,
    }),
    /PREAUTH_BROKER_RECEIPT_INVALID/,
  );
  for (const field of [
    "approvalCommit", "remoteHead", "sourceObjectManifestDigest",
    "runtimeProfileDigest", "installationManifestDigest",
    "dedicatedControllerManifestDigest", "pathBindingRecordDigest",
    "pathBindingSchemaDigest",
  ]) {
    const changed = structuredClone(receipt);
    changed[field] = field.endsWith("Commit") || field === "remoteHead"
      ? "0".repeat(40) : `sha256:${"0".repeat(64)}`;
    assert.throws(
      () => validatePreAuthorizationBrokerReceipt({
        receipt: changed, request, nowMonotonicMs: 2000,
      }),
      /PREAUTH_BROKER_RECEIPT_INVALID/,
      field,
    );
  }
  for (const field of ["decision", "canExecuteProductWork", "approvalState"]) {
    const changed = structuredClone(receipt);
    changed[field] = "GO";
    assert.throws(
      () => validatePreAuthorizationBrokerReceipt({ receipt: changed, request, nowMonotonicMs: 2000 }),
      /PREAUTH_BROKER_RECEIPT_INVALID/,
    );
  }
  for (const mutate of [
    (value) => { value.sourceObjectManifestDigest = `sha256:${"0".repeat(64)}`; },
    (value) => { value.pathBinding.orderedCaseResults.pop(); },
    (value) => { value.controllerExecutionDigest = `sha256:${"0".repeat(64)}`; },
  ]) {
    const changed = structuredClone(receipt);
    const changedInner = structuredClone(innerValue);
    mutate(changedInner);
    const changedBytes = Buffer.from(canonicalizeRfc8785(changedInner), "utf8");
    changed.innerReceipt = {
      encoding: "base64", bytes: changedBytes.length,
      sha256: `sha256:${createHash("sha256").update(changedBytes).digest("hex")}`,
      data: changedBytes.toString("base64"),
    };
    changed.innerPreauthorizationReceiptDigest = changed.innerReceipt.sha256;
    assert.throws(
      () => validatePreAuthorizationBrokerReceipt({ receipt: changed, request, nowMonotonicMs: 2000 }),
      /PREAUTH_BROKER_RECEIPT_INVALID/,
    );
  }
});

test("installed preauthorization acceptance reaches the real CLI and broker", {
  skip: !INSTALLED_ACCEPTANCE_ENABLED,
}, async (t) => {
  const installationPath = process.env.CHAOTANG_INSTALLATION_MANIFEST
    ?? "/run/chaotang-installation/config/installation.json";
  const installation = parseJsonStrict(await readFile(installationPath, "utf8"));
  verifyReadonlyExact2Tree(installation);
  const controller = installation.identities?.controllerUid;
  const controllerGroup = installation.identities?.controllerGid;
  assert.equal(process.getuid?.(), controller);
  assert.equal(process.getgid?.(), controllerGroup);
  assert.deepEqual([...new Set(process.getgroups?.() ?? [])], [controllerGroup]);
  const profiles = installation.gateProfiles.filter(
    (profile) => profile.profileId === "node-preauthorization-v1",
  );
  assert.equal(profiles.length, 1);

  const repository = await initializeRepository(t);
  const manifest = receiptGatedManifest(repository);
  manifest.preAuthorizationReceipt.broker.runtimeProfileDigest = profiles[0].profileDigest;
  manifest.preAuthorizationReceipt.broker.installationManifestDigest = installation.digest;
  manifest.preAuthorizationReceipt.broker.dedicatedControllerManifestDigest = (
    dedicatedControllerManifestDigest(installation)
  );
  await publishApproval(t, repository, manifest);
  const completed = spawnSync(process.execPath, [
    AUTHORITY_PATH, "--authorize", "--task", TASK_ID,
  ], {
    cwd: repository.root,
    encoding: "utf8",
    env: {
      HOME: "/nonexistent", PATH: TEST_PATH, LANG: "C.UTF-8", LC_ALL: "C.UTF-8",
      TMPDIR: "/tmp", TEMP: "/tmp", TMP: "/tmp",
      GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null",
      GIT_CONFIG_SYSTEM: "/dev/null", GIT_TERMINAL_PROMPT: "0",
      GIT_NO_REPLACE_OBJECTS: "1", GIT_OPTIONAL_LOCKS: "0",
    },
    timeout: 120_000,
    shell: false,
  });
  assert.equal(completed.status, 0, completed.stderr);
  const result = parseJsonStrict(completed.stdout.trim());
  assert.equal(result.decision, "GO");
  assert.equal(result.canExecuteProductWork, true);
  assert.equal(result.reason, "APPROVED_FOR_ONE_CHILD");
  assert.match(result.evidenceDigest, /^sha256:[0-9a-f]{64}$/);
});

test("v2 direct authorization has no same-uid helper fallback", async (t) => {
  const repository = await initializeRepository(t);
  const manifest = receiptGatedManifest(repository);
  await publishApproval(t, repository, manifest);
  await assert.rejects(
    authorizeProductWork({ cwd: repository.root, taskId: TASK_ID }),
    /PREAUTH_(?:BROKER_(UNAVAILABLE|IDENTITY_INVALID)|CONTROLLER_IDENTITY_UNVERIFIED)/,
  );
  const source = await readFile(AUTHORITY_PATH, "utf8");
  assert.ok(!source.includes("PRE_AUTHORIZATION_HELPER_SOURCE"));
  assert.ok(!source.includes('spawnSync("/usr/bin/python3", ["-I", "-c"'));
});

test("approval commit is a clean exact single child of the bound base", async (t) => {
  const repository = await initializeRepository(t);
  const manifest = approvalManifest(repository);
  const approvalCommit = await commitApproval(repository, manifest);
  const inspected = inspectApprovalCommit({ cwd: repository.root, taskId: TASK_ID, commit: approvalCommit });
  assert.equal(inspected.commit, approvalCommit);
  assert.equal(inspected.parent, repository.baseCommit);
  assert.equal(inspected.manifestDigest, canonicalDigest(manifest));

  const expandedRepository = await initializeRepository(t);
  const expandedManifest = approvalManifest(expandedRepository);
  await mkdir(path.join(expandedRepository.root, ".harness", "approvals"), { recursive: true });
  await writeFile(path.join(expandedRepository.root, "extra.txt"), "scope expansion\n", "utf8");
  await writeFile(
    path.join(expandedRepository.root, approvalPathForTask(TASK_ID)),
    `${JSON.stringify(expandedManifest, null, 2)}\n`,
    "utf8",
  );
  git(expandedRepository.root, ["add", ".harness", "extra.txt"]);
  git(expandedRepository.root, ["commit", "-m", "expanded approval"]);
  assert.throws(
    () => inspectApprovalCommit({ cwd: expandedRepository.root, taskId: TASK_ID }),
    /APPROVAL_COMMIT_SCOPE_INVALID/,
  );
});

test("work authorization requires the exact approval commit to remain the remote head", async (t) => {
  const repository = await initializeRepository(t);
  const manifest = approvalManifest(repository);
  const { approvalCommit, bare } = await publishApproval(t, repository, manifest);
  const authorized = await authorizeProductWork({
    cwd: repository.root,
    taskId: TASK_ID,
  });
  assert.equal(authorized.decision, "GO");
  assert.equal(authorized.canExecuteProductWork, true);
  assert.equal(authorized.approvalDigest, canonicalDigest(manifest));

  git(bare, ["update-ref", "refs/heads/ext-dev", repository.baseCommit]);
  await assert.rejects(
    authorizeProductWork({
      cwd: repository.root,
      taskId: TASK_ID,
    }),
    /REMOTE_HEAD_MOVED/,
  );

  git(bare, ["update-ref", "refs/heads/ext-dev", approvalCommit]);
  await writeFile(path.join(repository.root, "dirty.txt"), "dirty\n", "utf8");
  await assert.rejects(
    authorizeProductWork({
      cwd: repository.root,
      taskId: TASK_ID,
    }),
    /WORKTREE_DIRTY/,
  );
});

test("authority callers cannot replace the remote-head verifier", async (t) => {
  const repository = await initializeRepository(t);
  const manifest = approvalManifest(repository);
  const approvalCommit = await commitApproval(repository, manifest);
  await attachLocalRemote(t, repository);
  git(repository.root, ["push", "origin", `${repository.baseCommit}:refs/heads/ext-dev`]);

  await assert.rejects(
    authorizeProductWork({
      cwd: repository.root,
      taskId: TASK_ID,
      remoteHeadResolver: async () => approvalCommit,
    }),
    /REMOTE_HEAD_MOVED/,
  );
});

test("candidate verification accepts only the exact single child and emits deterministic evidence", async (t) => {
  const repository = await initializeRepository(t);
  const manifest = approvalManifest(repository);
  const { approvalCommit } = await publishApproval(t, repository, manifest);
  const candidateCommit = await commitCandidate(repository);
  const verified = await verifyProductCandidate({
    cwd: repository.root,
    taskId: TASK_ID,
  });
  assert.equal(verified.decision, "PASS");
  assert.equal(verified.canExecuteProductWork, false);
  assert.equal(verified.canAcceptProductCandidate, true);
  assert.equal(verified.candidateCommit, candidateCommit);
  assert.match(verified.evidenceDigest, /^sha256:[0-9a-f]{64}$/);

  assert.equal(approvalCommit, git(repository.root, ["rev-parse", "HEAD^"]));

  const remoteMovingRepository = await initializeRepository(t);
  const remoteMovingBare = await attachLocalRemote(t, remoteMovingRepository);
  const remoteMovingManifest = approvalManifest({
    ...remoteMovingRepository,
    verification: [{
      id: "moves-remote-head",
      tool: "node",
      args: [
        "-e",
        `require('node:child_process').execFileSync(${TEST_GIT_LITERAL},[` +
          `'--git-dir',${JSON.stringify(remoteMovingBare)},'update-ref','refs/heads/ext-dev',` +
          `${JSON.stringify(remoteMovingRepository.baseCommit)}])`,
      ],
      cwd: ".",
      timeoutMs: 5_000,
    }],
  });
  await commitApproval(remoteMovingRepository, remoteMovingManifest);
  git(remoteMovingRepository.root, ["push", "origin", "HEAD:refs/heads/ext-dev"]);
  await commitCandidate(remoteMovingRepository);
  await assert.rejects(
    verifyProductCandidate({
      cwd: remoteMovingRepository.root,
      taskId: TASK_ID,
    }),
    /REMOTE_HEAD_MOVED/,
  );

  const expandedRepository = await initializeRepository(t);
  const expandedManifest = approvalManifest(expandedRepository);
  await publishApproval(t, expandedRepository, expandedManifest);
  await mkdir(path.join(expandedRepository.root, "src"), { recursive: true });
  await writeFile(path.join(expandedRepository.root, "src", "feature.txt"), "ok\n", "utf8");
  await writeFile(path.join(expandedRepository.root, "src", "extra.txt"), "not approved\n", "utf8");
  git(expandedRepository.root, ["add", "src"]);
  git(expandedRepository.root, ["commit", "-m", "expanded product"]);
  await assert.rejects(
    verifyProductCandidate({
      cwd: expandedRepository.root,
      taskId: TASK_ID,
    }),
    /PRODUCT_COMMIT_SCOPE_INVALID/,
  );
});

test("verification commands run without a shell and fail closed on errors or repository writes", async (t) => {
  const failedRepository = await initializeRepository(t);
  const failedManifest = approvalManifest({
    ...failedRepository,
    verification: [{
      id: "fails",
      tool: "node",
      args: ["-e", "process.exit(7)"],
      cwd: ".",
      timeoutMs: 5_000,
    }],
  });
  await publishApproval(t, failedRepository, failedManifest);
  await commitCandidate(failedRepository);
  await assert.rejects(
    verifyProductCandidate({
      cwd: failedRepository.root,
      taskId: TASK_ID,
    }),
    /VERIFICATION_FAILED/,
  );

  const writingRepository = await initializeRepository(t);
  const writingManifest = approvalManifest({
    ...writingRepository,
    verification: [{
      id: "writes",
      tool: "node",
      args: ["-e", "require('node:fs').writeFileSync('unexpected.txt','x')"],
      cwd: ".",
      timeoutMs: 5_000,
    }],
  });
  await publishApproval(t, writingRepository, writingManifest);
  await commitCandidate(writingRepository);
  await assert.rejects(
    verifyProductCandidate({
      cwd: writingRepository.root,
      taskId: TASK_ID,
    }),
    /WORKTREE_DIRTY_AFTER_VERIFICATION/,
  );

  const movingRepository = await initializeRepository(t);
  const movingManifest = approvalManifest({
    ...movingRepository,
    verification: [{
      id: "moves-head",
      tool: "node",
      args: [
        "-e",
        `require('node:child_process').execFileSync(${TEST_GIT_LITERAL},['reset','--hard','HEAD^'])`,
      ],
      cwd: ".",
      timeoutMs: 5_000,
    }],
  });
  await publishApproval(t, movingRepository, movingManifest);
  await commitCandidate(movingRepository);
  await assert.rejects(
    verifyProductCandidate({
      cwd: movingRepository.root,
      taskId: TASK_ID,
    }),
    /PRODUCT_CANDIDATE_MOVED_DURING_VERIFICATION/,
  );

  const restoringRepository = await initializeRepository(t);
  const restoringManifest = approvalManifest({
    ...restoringRepository,
    verification: [
      {
        id: "moves-head-away",
        tool: "node",
        args: [
          "-e",
          `require('node:child_process').execFileSync(${TEST_GIT_LITERAL},['reset','--hard','HEAD^'])`,
        ],
        cwd: ".",
        timeoutMs: 5_000,
      },
      {
        id: "restores-head",
        tool: "node",
        args: [
          "-e",
          `require('node:child_process').execFileSync(${TEST_GIT_LITERAL},['reset','--hard','HEAD@{1}'])`,
        ],
        cwd: ".",
        timeoutMs: 5_000,
      },
    ],
  });
  await publishApproval(t, restoringRepository, restoringManifest);
  await commitCandidate(restoringRepository);
  await assert.rejects(
    verifyProductCandidate({
      cwd: restoringRepository.root,
      taskId: TASK_ID,
    }),
    /PRODUCT_CANDIDATE_MOVED_DURING_VERIFICATION/,
  );
});

test("candidate rejects deletion, mode drift and merge commits", async (t) => {
  const deletionRepository = await initializeRepository(t, { productFile: true });
  const deletionManifest = approvalManifest(deletionRepository);
  await publishApproval(t, deletionRepository, deletionManifest);
  git(deletionRepository.root, ["rm", "src/feature.txt"]);
  git(deletionRepository.root, ["commit", "-m", "delete product file"]);
  await assert.rejects(
    verifyProductCandidate({
      cwd: deletionRepository.root,
      taskId: TASK_ID,
    }),
    /UNSUPPORTED_GIT_CHANGE/,
  );

  const modeRepository = await initializeRepository(t, { productFile: true });
  const modeManifest = approvalManifest(modeRepository);
  await publishApproval(t, modeRepository, modeManifest);
  git(modeRepository.root, ["update-index", "--chmod=+x", "src/feature.txt"]);
  git(modeRepository.root, ["commit", "-m", "change product mode"]);
  await assert.rejects(
    verifyProductCandidate({
      cwd: modeRepository.root,
      taskId: TASK_ID,
    }),
    /UNSUPPORTED_GIT_ENTRY_MODE/,
  );

  const mergeRepository = await initializeRepository(t);
  const mergeManifest = approvalManifest(mergeRepository);
  const { approvalCommit: mergeApproval } = await publishApproval(t, mergeRepository, mergeManifest);
  git(mergeRepository.root, ["switch", "-c", "side"]);
  await writeFile(path.join(mergeRepository.root, "side.txt"), "side\n", "utf8");
  git(mergeRepository.root, ["add", "side.txt"]);
  git(mergeRepository.root, ["commit", "-m", "side"]);
  git(mergeRepository.root, ["switch", "-c", "candidate", mergeApproval]);
  await commitCandidate(mergeRepository);
  git(mergeRepository.root, ["merge", "--no-ff", "side", "-m", "merge side"]);
  await assert.rejects(
    verifyProductCandidate({
      cwd: mergeRepository.root,
      taskId: TASK_ID,
    }),
    /PRODUCT_CANDIDATE_PARENT_INVALID/,
  );
});

test("verification cwd cannot escape the repository through a symbolic link", async (t) => {
  const repository = await mkdtemp(path.join(tmpdir(), "chaotang-m0-cwd-"));
  const outside = await mkdtemp(path.join(tmpdir(), "chaotang-m0-outside-"));
  t.after(() => rm(repository, { recursive: true, force: true }));
  t.after(() => rm(outside, { recursive: true, force: true }));
  await symlink(outside, path.join(repository, "linked"));

  assert.throws(() => runVerificationMatrix({
    cwd: repository,
    verification: [{
      id: "linked-cwd",
      tool: "node",
      args: ["-e", "process.exit(0)"],
      cwd: "linked",
      timeoutMs: 5_000,
    }],
  }), /VERIFICATION_CWD_INVALID/);
});

test("CLI is closed and the landed M0 implementation remains non-authorizing", async (t) => {
  const cleanRepository = await initializeRepository(t);
  const invoke = (args) => spawnSync(process.execPath, [AUTHORITY_PATH, ...args], {
    cwd: cleanRepository.root,
    encoding: "utf8",
    env: { PATH: TEST_PATH, GIT_TERMINAL_PROMPT: "0" },
  });
  const status = invoke(["--status"]);
  assert.equal(status.status, 0, status.stderr);
  assert.deepEqual(JSON.parse(status.stdout), {
    schemaVersion: "product-authority.m0.result.v1",
    authorityId: AUTHORITY_ID,
    command: "status",
    taskId: null,
    decision: "STOP",
    canExecuteProductWork: false,
    canAcceptProductCandidate: false,
    approvalDigest: null,
    candidateCommit: null,
    candidateTree: null,
    evidenceDigest: null,
    reason: "APPROVAL_NOT_SELECTED",
  });

  const invalid = invoke(["--force"]);
  assert.equal(invalid.status, 64, invalid.stderr);
  assert.equal(JSON.parse(invalid.stdout).reason, "USAGE_INVALID");

  const absent = invoke(["--authorize", "--task", "MISSING-TASK"]);
  assert.equal(absent.status, 2, absent.stderr);
  assert.equal(JSON.parse(absent.stdout).reason, "APPROVAL_NOT_FOUND");
  assert.doesNotMatch(`${status.stdout}${invalid.stdout}${absent.stdout}`, /\/etc\/|\/run\/|PRIVATE KEY|token/i);

  await assert.rejects(
    Promise.reject(new ProductAuthorityError("EXPECTED")),
    /EXPECTED/,
  );
  await assert.doesNotReject(readFile(AUTHORITY_PATH, "utf8"));
});

test("CLI authorizes and verifies the full flow against a local immutable remote", async (t) => {
  const repository = await initializeRepository(t);
  await attachLocalRemote(t, repository);
  const manifest = approvalManifest(repository);
  const approvalCommit = await commitApproval(repository, manifest);
  git(repository.root, ["push", "origin", "HEAD:refs/heads/ext-dev"]);

  const invoke = (args) => spawnSync(process.execPath, [AUTHORITY_PATH, ...args], {
    cwd: repository.root,
    encoding: "utf8",
    env: { PATH: TEST_PATH, GIT_TERMINAL_PROMPT: "0" },
    timeout: 15_000,
  });
  const authorized = invoke(["--authorize", "--task", TASK_ID]);
  assert.equal(authorized.status, 0, authorized.stderr);
  assert.equal(JSON.parse(authorized.stdout).decision, "GO");
  assert.equal(JSON.parse(authorized.stdout).canExecuteProductWork, true);

  const candidateCommit = await commitCandidate(repository);
  const verified = invoke(["--verify-candidate", "--task", TASK_ID]);
  assert.equal(verified.status, 0, verified.stderr);
  const result = JSON.parse(verified.stdout);
  assert.equal(result.decision, "PASS");
  assert.equal(result.canExecuteProductWork, false);
  assert.equal(result.canAcceptProductCandidate, true);
  assert.equal(result.approvalDigest, canonicalDigest(manifest));
  assert.equal(result.candidateCommit, candidateCommit);
  assert.equal(approvalCommit, git(repository.root, ["rev-parse", "HEAD^"]));
});

test("verification commands disable optional Next telemetry in the fixed environment", async (t) => {
  const repository = await initializeRepository(t);
  const manifest = approvalManifest({
    ...repository,
    verification: [{
      id: "requires-next-telemetry-disabled",
      tool: "node",
      args: ["-e", "if (process.env.NEXT_TELEMETRY_DISABLED !== '1') process.exit(73)"],
      cwd: ".",
      timeoutMs: 5_000,
    }],
  });
  await publishApproval(t, repository, manifest);
  await commitCandidate(repository);

  const verified = await verifyProductCandidate({
    cwd: repository.root,
    taskId: TASK_ID,
  });
  assert.equal(verified.decision, "PASS");
});
