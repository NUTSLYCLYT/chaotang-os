import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmod, link, lstat, mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  assertFrozenTree,
  buildAcceptancePlan,
  boundedEgressTimeout,
  awaitNpmAuditCommand,
  defaultExecutor,
  defaultNpmAuditRunner,
  exportPinnedCaddyOci,
  extractFrozenPolicy,
  isolatedInvocation,
  parseDockerWriterEvent,
  prepareCandidatePhaseRoot,
  protectedTestSourceDigest,
  removeIsolationTree,
  runAcceptance,
  runnerPrivilegeModel,
  sameSocketIdentity,
  validateCleanupAbsence,
  validateNpmAuditBinding,
  validateOperatorInputsDocument,
  validateAcceptanceOptions,
  validateDockerSocketEndpoint,
  validateColdBackupResult,
  validatePublicRegistryAddresses,
  validateRegistryPeer,
  validateRegistryUrl,
} from "./run_rc1_release_acceptance.mjs";
import { createProvisionalReceipt } from "./build_offline_release.mjs";
import { canonicalize } from "./verify_offline_release.mjs";

test("COLD runner rejects eval/import wrappers before minting process identity", () => {
  const runnerUrl = new URL("./run_rc1_release_acceptance.mjs", import.meta.url).href;
  const runnerPath = new URL(runnerUrl).pathname;
  const source = [
    `import(${JSON.stringify(runnerUrl)})`,
    ".then(({currentRunnerProcessIdentity}) => currentRunnerProcessIdentity('1'.repeat(40), '2'.repeat(40)))",
    ".then(() => process.exit(0))",
    ".catch((error) => { process.stderr.write(String(error.code ?? error.message)); process.exit(1); })",
  ].join("");
  const completed = spawnSync(process.execPath, ["-e", source, runnerPath], {
    encoding: "utf8",
    env: { PATH: process.env.PATH },
  });
  assert.equal(completed.status, 1);
  assert.equal(completed.stdout, "");
  assert.match(completed.stderr, /RUNNER_PROCESS_IDENTITY_INVALID/);
});

test("COLD runner seals every transitively imported local module", async () => {
  const runnerSource = await readFile(new URL("./run_rc1_release_acceptance.mjs", import.meta.url), "utf8");
  const backupSource = await readFile(
    new URL("../backend/app/operations/sqlite_backup.py", import.meta.url),
    "utf8",
  );
  for (const modulePath of [
    "scripts/build_offline_release.mjs",
    "scripts/execution_authority_ext.mjs",
    "scripts/product-authority.mjs",
    "scripts/run_rc1_release_acceptance.mjs",
    "scripts/verify_offline_release.mjs",
  ]) {
    assert.match(runnerSource, new RegExp(`\\"${modulePath.replaceAll(".", "\\.")}\\"`));
    assert.match(backupSource, new RegExp(`\\"${modulePath.replaceAll(".", "\\.")}\\"`));
  }
  assert.match(runnerSource, /TRUSTED_ROOT_ORCHESTRATOR/);
  assert.match(runnerSource, /SEALED_NON_ROOT_RUNNER/);
  assert.match(backupSource, /TRUSTED_ROOT_ORCHESTRATOR/);
  assert.match(backupSource, /SEALED_NON_ROOT_RUNNER/);
});

test("default root orchestration and sealed non-root runners use explicit privilege models", () => {
  assert.equal(runnerPrivilegeModel(0), "TRUSTED_ROOT_ORCHESTRATOR");
  assert.equal(runnerPrivilegeModel(65_534), "SEALED_NON_ROOT_RUNNER");
  assert.throws(() => runnerPrivilegeModel(-1), /RUNNER_PROCESS_IDENTITY_INVALID/);
});

const AUDIT_LOCK = JSON.stringify({
  packages: {
    "": { name: "fixture-root", version: "1.0.0" },
    "node_modules/@scope/runtime": { version: "2.0.0" },
    "node_modules/dev-only": { dev: true, version: "3.0.0" },
    "node_modules/fixture": { version: "1.0.0" },
  },
});
const AUDIT_BODY = Buffer.from('{"@scope/runtime":["2.0.0"],"fixture":["1.0.0"]}', "utf8");
const AUDIT_BODY_SHA256 = `sha256:${createHash("sha256").update(AUDIT_BODY).digest("hex")}`;

const roots = new Set();

function operatorInputs(overrides = {}) {
  const value = {
    schemaVersion: "chaotang.p15-operator-inputs.v1",
    candidateCommit: "1".repeat(40),
    candidateTree: "2".repeat(40),
    releaseExpectationPath: "/tmp/p15/expectation.json",
    releaseExpectationDigest: `sha256:${"3".repeat(64)}`,
    verifierPath: "/tmp/p15/verify_offline_release.mjs",
    verifierDigest: `sha256:${"4".repeat(64)}`,
    bundlePath: "/tmp/p15/bundle",
    bundleDigest: `sha256:${"5".repeat(64)}`,
    immutableSnapshotPath: "/tmp/p15/immutable",
    immutableSnapshotDigest: `sha256:${"5".repeat(64)}`,
    dockerEndpoint: "unix:///tmp/p15-docker/daemon.sock",
    sourceRoot: "/tmp/p15/data",
    backupRoot: "/tmp/p15/backup",
    rehearsalRoot: "/tmp/p15/rehearsal",
    rolloutLockPath: "/tmp/p15-lock/release.lock",
    backupPythonPath: "/usr/bin/python3",
    backupToolDigest: `sha256:${"6".repeat(64)}`,
    operatorRef: "owner-approved-window-001",
    maintenanceWindowStart: "2026-08-22T00:00:00.000000Z",
    maintenanceWindowEnd: "2026-08-22T02:00:00.000000Z",
    inputsDigest: null,
    ...overrides,
  };
  const payload = { ...value };
  delete payload.inputsDigest;
  value.inputsDigest = `sha256:${createHash("sha256").update(canonicalize(payload)).digest("hex")}`;
  return value;
}

test("operator inputs are closed, canonical and cannot inject a writer session", () => {
  const value = operatorInputs();
  assert.deepEqual(validateOperatorInputsDocument(value), value);
  assert.throws(
    () => validateOperatorInputsDocument({ ...value, writerStopSession: "/tmp/forged" }),
    /OPERATOR_INPUTS_INVALID/,
  );
  assert.throws(
    () => validateOperatorInputsDocument({ ...value, inputsDigest: `sha256:${"0".repeat(64)}` }),
    /OPERATOR_INPUTS_DIGEST_MISMATCH/,
  );
  assert.throws(
    () => validateOperatorInputsDocument(operatorInputs({ backupRoot: "/tmp/p15/data/backup" })),
    /OPERATOR_INPUTS_ROOT_OVERLAP/,
  );
});
test.afterEach(async () => {
  await Promise.all([...roots].map((root) => rm(root, { recursive: true, force: true })));
  roots.clear();
});

async function root(name) {
  const path = await mkdtemp(join(tmpdir(), `${name}-`));
  roots.add(path);
  return path;
}

function options(evidenceDir, overrides = {}) {
  const base = {
    candidateCommit: "1".repeat(40),
    candidateTree: "2".repeat(40),
    dockerEndpoint: "unix:///tmp/chaotang-rc1-disposable/docker.sock",
    dockerContext: "rc1-disposable",
    dockerContextConfigDir: `${evidenceDir}-docker-context-config`,
    evidenceDir,
    rounds: 1,
    sourceDateEpoch: 1_788_000_000,
    egressEvidence: {
      ruleDigest: `sha256:${"a".repeat(64)}`,
      dockerDaemonIncluded: true,
      allowedOrigins: [
        "https://auth.docker.io",
        "https://files.pythonhosted.org",
        "https://production.cloudflare.docker.com",
        "https://pypi.org",
        "https://registry-1.docker.io",
        "https://registry.npmjs.org",
        "https://toolbox-data.anchore.io",
      ],
      allowProbePassed: true,
      denyProbePassed: true,
      preexistingOrUserCredentialsPresent: false,
      disposableHost: true,
      isolationId: "rc1-disposable-001",
      activatedAt: "2026-08-17T00:00:00Z",
      expiresAt: "2026-08-18T00:00:00Z",
      lifecycleCommandDigest: `sha256:${"b".repeat(64)}`,
      cleanupRequired: true,
      artifactPublishingAllowed: false,
      businessDataUploadsAllowed: false,
      remoteMutationAllowed: false,
      registryAuthMode: "ANONYMOUS_EPHEMERAL_BEARER_TOKEN_ONLY",
      enforcementAuthority: "EXTERNAL_HOST_FIREWALL_OR_PROXY",
      npmAuditRequest: {
        method: "POST",
        origin: "https://registry.npmjs.org",
        path: "/-/npm/v1/security/advisories/bulk",
        bodyDerivedFromExactLock: true,
        bodySha256: AUDIT_BODY_SHA256,
        bodyBytes: AUDIT_BODY.length,
      },
    },
  };
  const releaseExpectation = {
    candidateCommit: base.candidateCommit,
    candidateTree: base.candidateTree,
    approvalDigest: `sha256:${"1".repeat(64)}`,
    p09ContractDigest: "sha256:27728301f51c7fe7bd929d99b45de86c76807b4c9c5eba22e7e42b0e18e8acc5",
    p09VerifierDigest: "sha256:f001d50ef4c03bb16aaf51f91531b78651121147cb2ee9e78af9a8a24f8f1e99",
    runtimeRegistryDigest: "sha256:d65cfd339ef9ed352760c25f5291e914ec0bc31d190a45baa9068bd1fc57732e",
    releaseManifestDigest: `sha256:${"2".repeat(64)}`,
    previousReleaseId: null,
    previousBundleDigest: null,
    coldBackupManifestDigest: `sha256:${"3".repeat(64)}`,
    provisionalReceiptDigest: null,
    acceptanceReferenceDigest: `sha256:${"5".repeat(64)}`,
    expectationDigest: null,
  };
  const provisionalReceipt = createProvisionalReceipt({
    candidateCommit: base.candidateCommit,
    candidateTree: base.candidateTree,
    approvalDigest: releaseExpectation.approvalDigest,
    tools: { node: "24.19.0" },
    sourceDateEpoch: base.sourceDateEpoch,
    locks: [{ path: "lock", sha256: `sha256:${"6".repeat(64)}` }],
    deployment: { composeSha256: `sha256:${"7".repeat(64)}` },
    bundleDigest: releaseExpectation.releaseManifestDigest,
    verificationDigest: `sha256:${"8".repeat(64)}`,
    createdAt: "2026-08-21T10:00:00.000000Z",
  });
  releaseExpectation.provisionalReceiptDigest = provisionalReceipt.receiptDigest;
  const payload = { ...releaseExpectation };
  delete payload.expectationDigest;
  releaseExpectation.expectationDigest = `sha256:${createHash("sha256").update(canonicalize(payload)).digest("hex")}`;
  const releasePhase = {
    schemaVersion: "chaotang.p15-release-phase-input.v1",
    mode: "POST_ACCEPTANCE_FINAL",
    taskId: "PACKET-15-OFFLINE-RELEASE-RECOVERY-V2-20260821",
    approvalCommit: "0".repeat(40),
    approvalDigest: releaseExpectation.approvalDigest,
    candidateCommit: base.candidateCommit,
    candidateTree: base.candidateTree,
    parentCommit: "0".repeat(40),
    createdAt: "2026-08-21T10:00:00.000000Z",
    provisionalReceipt,
    acceptanceReferenceDigest: releaseExpectation.acceptanceReferenceDigest,
  };
  return { ...base, releaseExpectation, releasePhase, ...overrides };
}

async function contextConfig() {
  const path = await root("rc1-context-config");
  const metadata = join(path, "contexts", "meta", "a".repeat(64));
  await mkdir(metadata, { recursive: true });
  await writeFile(join(metadata, "meta.json"), "{}");
  return path;
}

test("rejects default daemon, default context, production paths and nonempty evidence", async () => {
  const evidence = await root("rc1-evidence");
  assert.throws(() => validateAcceptanceOptions(options(evidence, { dockerEndpoint: "unix:///var/run/docker.sock" })), /DEFAULT_DOCKER_ENDPOINT/);
  assert.throws(() => validateAcceptanceOptions(options(evidence, { dockerEndpoint: "tcp://127.0.0.1:23760" })), /DOCKER_ENDPOINT_INVALID/);
  assert.throws(() => validateAcceptanceOptions(options(evidence, { dockerEndpoint: "ssh://builder.example" })), /DOCKER_ENDPOINT_INVALID/);
  assert.throws(() => validateAcceptanceOptions(options(evidence, { dockerContext: "default" })), /DEFAULT_DOCKER_CONTEXT/);
  assert.throws(() => validateAcceptanceOptions(options("/srv/chaotang-os/evidence")), /PRODUCTION_PATH_FORBIDDEN/);
  assert.throws(() => validateAcceptanceOptions(options(evidence, { sourceDateEpoch: 0 })), /SOURCE_DATE_EPOCH_INVALID/);
  assert.throws(() => validateAcceptanceOptions(options(evidence, { rounds: 2 })), /ROUNDS_INVALID/);
  await writeFile(join(evidence, "existing"), "x");
  await assert.rejects(runAcceptance(options(evidence), { executor: async () => ({ code: 0, stdout: "", stderr: "" }) }), /EVIDENCE_DIR_NOT_EMPTY/);
});

test("every authorized side effect is capped by the egress expiry", () => {
  assert.equal(boundedEgressTimeout(10_000, 10_250, 30 * 60 * 1000), 250);
  assert.throws(() => boundedEgressTimeout(10_250, 10_250), /EGRESS_LIFECYCLE_INACTIVE/);
});

test("preserves Docker event nanoseconds losslessly and closes cold evidence", () => {
  const timeNano = "1787241600000000001";
  assert.deepEqual(parseDockerWriterEvent(JSON.stringify({
    Type: "container",
    Action: "die",
    id: "a".repeat(64),
    timeNano: Number(timeNano),
  }).replace(/"timeNano":\d+/, `"timeNano":${timeNano}`)), {
    action: "die",
    containerId: "a".repeat(64),
    timeNano,
  });
  assert.throws(
    () => parseDockerWriterEvent(`{"Type":"container","Action":"die","id":"${"a".repeat(64)}","timeNano":1e9}`),
    /WRITER_EVENT_INVALID/,
  );
  const valid = {
    schemaVersion: "chaotang.rc1-cold-backup-result.v1",
    manifestSha256: `sha256:${"1".repeat(64)}`,
    sourceSnapshotIdentity: `sha256:${"2".repeat(64)}`,
    restoredSnapshotIdentity: `sha256:${"2".repeat(64)}`,
    writerStopEvidenceDigest: `sha256:${"3".repeat(64)}`,
    retentionProbeDigest: `sha256:${"4".repeat(64)}`,
    backendRestarted: true,
    networkRequests: 0,
  };
  assert.deepEqual(validateColdBackupResult(valid), valid);
  assert.throws(
    () => validateColdBackupResult({ ...valid, restoredSnapshotIdentity: `sha256:${"4".repeat(64)}` }),
    /COLD_BACKUP_RESULT_INVALID/,
  );
});

test("rejects a symlinked Docker socket and detects endpoint identity drift", async () => {
  const socketRoot = await root("rc1-docker-socket");
  const socketPath = join(socketRoot, "daemon.sock");
  const linkPath = join(socketRoot, "approved.sock");
  await writeFile(socketPath, "not a socket");
  await symlink(socketPath, linkPath);
  await assert.rejects(validateDockerSocketEndpoint(`unix://${linkPath}`), /DOCKER_ENDPOINT_UNSAFE/);

  assert.equal(
    sameSocketIdentity(
      { dev: 1, ino: 2, path: "/tmp/chaotang-rc1-disposable/docker.sock" },
      { dev: 1, ino: 1, path: "/tmp/chaotang-rc1-disposable/docker.sock" },
    ),
    false,
  );
});

test("builds a closed plan without push, deploy or production mounts", async () => {
  const evidence = await root("rc1-evidence");
  const plan = buildAcceptancePlan(options(evidence));
  const text = JSON.stringify(plan);
  assert.doesNotMatch(text, /(?:docker\s+(?:push|stack|service)|kubectl|\/srv\/chaotang-os|\/var\/run\/docker\.sock)/);
  assert.match(text, /buildx/);
  assert.match(text, /sbom|syft/i);
  assert.match(text, /grype/i);
  for (const id of ["sqlite-backup", "sqlite-smoke-seed", "integration", "accounting", "health-edge", "host-listeners-before", "host-listeners-after"]) {
    assert.ok(plan.some((entry) => entry.id === id), `${id} must be part of every real round`);
  }
  for (const id of ["backend-builder-venv", "backend-builder-lock-prepare", "backend-builder-lock-install", "backend-runtime-wheel", "backend-test-venv", "backend-test-lock-prepare", "backend-test-lock-install", "backend-test-app-install", "backend-tests", "backend-ruff", "backend-runtime-venv", "backend-runtime-lock-prepare", "backend-runtime-lock-install", "backend-runtime-app-install", "backend-runtime-contract"]) {
    assert.ok(plan.some((entry) => entry.id === id), `${id} must prove the exact backend lock in a clean environment`);
  }
  assert.ok(plan.find((entry) => entry.id === "backend-test-venv").args.includes("--copies"));
  assert.ok(plan.find((entry) => entry.id === "backend-builder-venv").args.includes("--copies"));
  assert.ok(plan.find((entry) => entry.id === "backend-runtime-venv").args.includes("--copies"));
  assert.ok(plan.find((entry) => entry.id === "backend-test-app-install").args.includes("--no-index"));
  const backendPhaseOrder = [
    "backend-builder-venv",
    "backend-builder-lock-prepare",
    "backend-builder-lock-install",
    "backend-runtime-wheel",
    "backend-test-venv",
    "backend-test-lock-prepare",
    "backend-test-lock-install",
    "backend-test-app-install",
    "backend-tests",
    "backend-ruff",
    "backend-runtime-venv",
    "backend-runtime-lock-prepare",
    "backend-runtime-lock-install",
    "backend-runtime-app-install",
    "backend-runtime-contract",
  ].map((id) => plan.findIndex((entry) => entry.id === id));
  assert.deepEqual(backendPhaseOrder, [...backendPhaseOrder].sort((left, right) => left - right));
  assert.equal(new Set(backendPhaseOrder).size, backendPhaseOrder.length);
  const backendTests = plan.find((entry) => entry.id === "backend-tests");
  assert.match(backendTests.tool, /\/test-runtime\/backend-test-venv\/bin\/python$/);
  assert.ok(backendTests.args.includes("-I"));
  assert.ok(backendTests.args.includes("-P"));
  assert.ok(backendTests.args.includes("--import-mode=importlib"));
  for (const id of ["backend-builder-lock-install", "backend-test-lock-install", "backend-runtime-lock-install"]) {
    const entry = plan.find((item) => item.id === id);
    assert.ok(entry.args.includes("--no-index"));
    assert.ok(entry.args.includes("--require-hashes"));
    assert.ok(entry.args.includes("/var/tmp/chaotang-m0-wheelhouse"));
  }
  const untrustedIds = [
    "frontend-clean-install", "frontend-audit", "frontend-lint", "frontend-typecheck", "frontend-test", "frontend-build",
    "backend-builder-venv", "backend-builder-lock-prepare", "backend-builder-lock-install", "backend-runtime-wheel", "backend-test-venv", "backend-test-lock-prepare", "backend-test-lock-install", "backend-test-app-install", "backend-tests", "backend-ruff", "backend-runtime-venv", "backend-runtime-lock-prepare", "backend-runtime-lock-install",
    "backend-runtime-app-install", "backend-runtime-contract", "sqlite-backup", "sqlite-smoke-seed", "integration", "accounting",
  ];
  for (const id of untrustedIds) {
    const entry = plan.find((item) => item.id === id);
    assert.equal(entry?.isolation, "LOW_PRIVILEGE_PID_MOUNT_NAMESPACE_V1", `${id} must run in the low-privilege namespace`);
    assert.match(entry?.cwd ?? "", /-untrusted-work-001\/(?:install-source|test-source|work)/, `${id} must not run from the trusted checkout or evidence tree`);
  }
  const install = plan.find((entry) => entry.id === "frontend-clean-install");
  assert.match(install.cwd, /-untrusted-work-001\/install-source\/frontend$/);
  assert.ok(install.args.includes("--ignore-scripts"));
  assert.ok(plan.some((entry) => entry.id === "extract-install-source"));
  for (const id of untrustedIds.filter((value) => value !== "frontend-clean-install")) {
    assert.doesNotMatch(plan.find((entry) => entry.id === id).cwd, /install-source/);
  }
  assert.ok(plan.some((entry) => entry.id === "git-archive-build-source"));
  assert.ok(plan.some((entry) => entry.id === "extract-build-source"));
  assert.equal(plan.filter((entry) => /^syft-(?:backend|caddy|frontend|base-node|base-python)$/.test(entry.id)).length, 5);
  assert.equal(plan.filter((entry) => /^grype-(?:backend|caddy|frontend|base-node|base-python)$/.test(entry.id)).length, 5);
  assert.match(plan.find((entry) => entry.id === "health-backend").args.join(" "), /\/health/);
  assert.doesNotMatch(plan.find((entry) => entry.id === "health-backend").args.join(" "), /\/readyz/);
  assert.equal(plan.flatMap((entry) => entry.args).filter((value) => value.startsWith("type=oci,dest=")).length, 2);
  for (const output of plan.flatMap((entry) => entry.args).filter((value) => value.startsWith("type=oci,dest="))) {
    assert.match(output, /compression=gzip,compression-level=6,force-compression=true$/);
  }
  assert.ok(!plan.some((entry) => entry.args.some((value, index) => value === "image" && entry.args[index + 1] === "save")), "Docker archives must never masquerade as OCI archives");
  assert.ok(!plan.some((entry) => entry.id === "export-caddy" || entry.args.some((value) => value.includes("caddy-export/Dockerfile"))), "Caddy must not be rebuilt by a no-op Dockerfile and mislabeled as the approved manifest");
  const dockerEntries = plan.filter((entry) => entry.tool === "/usr/bin/docker");
  assert.equal(dockerEntries.filter((entry) => entry.args.includes("--context")).length, 1);
  for (const entry of dockerEntries.filter((item) => item.id !== "docker-context")) {
    assert.equal(entry.isolation, null, `${entry.id} must stay outside the candidate namespace`);
    assert.ok(entry.args.includes("--host"), `${entry.id} must use the explicit daemon endpoint`);
    assert.ok(!entry.args.includes("--context"), `${entry.id} must not mix --host and --context`);
  }
  for (const id of ["build-backend", "build-frontend"]) {
    const entry = plan.find((item) => item.id === id);
    const args = entry.args.join(" ");
    assert.match(args, /SOURCE_REVISION=/);
    assert.match(args, /SOURCE_TREE=/);
    assert.match(args, /SOURCE_CREATED=/);
    assert.match(args, /--provenance=mode=max/);
    assert.match(args, /--metadata-file/);
    assert.match(entry.args.at(-1), /\/build-source\/(?:backend|frontend)$/);
    const name = id.slice("build-".length);
    assert.match(entry.args[entry.args.indexOf("--tag") + 1], new RegExp(`^chaotang-${name}:`));
  }
  for (const name of ["backend", "caddy", "frontend"]) {
    const removed = plan.findIndex((entry) => entry.id === `remove-prebundle-${name}`);
    const absent = plan.findIndex((entry) => entry.id === `assert-prebundle-absent-${name}`);
    const imported = plan.findIndex((entry) => entry.id === `import-bundle-${name}`);
    const inspected = plan.findIndex((entry) => entry.id === `inspect-imported-${name}`);
    assert.ok(removed >= 0 && removed < absent && absent < imported && imported < inspected, `${name} must prove the exact ref absent, import this round's OCI archive, then inspect it`);
    assert.ok(plan[removed].args.includes(`__BUNDLE_${name.toUpperCase()}_IMAGE__`));
    assert.ok(plan[absent].args.includes(`__BUNDLE_${name.toUpperCase()}_IMAGE__`));
    assert.ok(plan[inspected].args.includes(`__BUNDLE_${name.toUpperCase()}_IMAGE__`));
    const smoke = plan.find((entry) => entry.id === `smoke-${name}`);
    assert.ok(smoke.args.includes("--pull=never"), `${name} smoke must forbid registry pulls`);
    assert.ok(smoke.args.includes(`__BUNDLE_${name.toUpperCase()}_IMAGE__`), `${name} smoke must be rebound from bundle images.env`);
  }
  const backendSmoke = plan.find((entry) => entry.id === "smoke-backend");
  const backendSmokeArgs = backendSmoke.args.join(" ");
  assert.match(backendSmokeArgs, /type=bind,src=.*\/smoke-data,dst=\/app\/data/);
  assert.doesNotMatch(backendSmokeArgs, /\/app\/data:rw/);
  const backupIndex = plan.findIndex((entry) => entry.id === "sqlite-backup");
  const seedIndex = plan.findIndex((entry) => entry.id === "sqlite-smoke-seed");
  const smokeIndex = plan.findIndex((entry) => entry.id === "smoke-backend");
  assert.ok(backupIndex < seedIndex && seedIndex < smokeIndex);
  const seed = plan[seedIndex];
  assert.deepEqual(seed.args.slice(0, 3), ["-m", "app.operations.sqlite_backup", "rehearse"]);
  assert.match(seed.args[seed.args.indexOf("--backup") + 1], /\/sqlite-rehearsal\/backup$/);
  assert.match(seed.args[seed.args.indexOf("--destination") + 1], /-untrusted-work-001\/work\/smoke-stage\/data$/);
  const bundleBuild = plan.find((entry) => entry.id === "bundle-build");
  assert.deepEqual(bundleBuild.args.filter((arg) => arg.startsWith("--")), [
    "--descriptor", "--expectation", "--output", "--phase", "--repository", "--snapshot-output",
  ]);
  assert.ok(!plan.some((entry) => entry.id === "bundle-verify"));
  for (const entry of plan.filter((item) => item.tool === "/usr/bin/git")) {
    assert.deepEqual(entry.args.slice(0, 7), [
      "--no-replace-objects", "-c", "core.fsmonitor=false", "-c",
      "core.hooksPath=/dev/null", "-c", "core.preloadIndex=false",
    ]);
  }
});

test("arms network cleanup before the create command can time out", async () => {
  const source = await readFile("scripts/run_rc1_release_acceptance.mjs", "utf8");
  const loop = source.slice(source.indexOf("for (const entry of plan)"), source.indexOf("if (entry.id === \"policy-parent\")"));
  assert.ok(loop.indexOf('if (entry.id === "smoke-network") networkCreated = true;') >= 0);
  assert.ok(loop.indexOf('if (entry.id === "smoke-network") networkCreated = true;') < loop.indexOf('if (entry.id === "frontend-audit")'));
});

test("cleanup is limited to exact runner-owned resource names", async () => {
  const source = await readFile("scripts/run_rc1_release_acceptance.mjs", "utf8");
  assert.doesNotMatch(source, /cleanup-delta-|removeDeltas|!baseline\.has/);
  assert.match(source, /io\.chaotang\.acceptance\.owner/);
  assert.match(source, /CLEANUP_RESOURCE_NOT_OWNED/);
  assert.match(source, /"rm", "--force", identity\.Id/);
  assert.match(source, /"network", "rm", identity\.Id/);
  assert.match(source, /removeOwned\("container"/);
  assert.match(source, /removeOwned\("network"/);
});

test("rejects a symlinked evidence parent before creating any child", async () => {
  const parent = await root("rc1-evidence-parent");
  const link = join(parent, "production-alias");
  await symlink("/srv/chaotang-os", link, "dir");
  await assert.rejects(
    runAcceptance(options(join(link, "must-not-create")), { executor: async () => ({ code: 0, stdout: "", stderr: "" }) }),
    /EVIDENCE_DIR_UNSAFE/,
  );
});

test("strictly extracts the one approved closed policy JSON block", () => {
  const markdown = `# Task\n\n### Approved toolchain policy\n\n\`\`\`json\n{"schemaVersion":"rc1-toolchain-policy.v1"}\n\`\`\`\n`;
  assert.deepEqual(extractFrozenPolicy(markdown), { schemaVersion: "rc1-toolchain-policy.v1" });
  assert.throws(() => extractFrozenPolicy(`${markdown}\n\`\`\`json\n{}\n\`\`\``), /POLICY_BLOCK_INVALID/);
});

test("registry OCI exporter refuses any non-approved egress origin before network", async () => {
  let calls = 0;
  await assert.rejects(
    exportPinnedCaddyOci({
      reference: "docker.io/library/caddy@sha256:98eb57d882ccd5213d1688764db10c1ca2c58a1ca3a6717a3411ad798f7a423a",
      archivePath: "/tmp/not-created.oci.tar",
      layoutRoot: "/tmp/not-created-layout",
      sourceDateEpoch: 1_788_000_000,
      allowedOrigins: ["https://auth.docker.io"],
      fetcher: async () => { calls += 1; throw new Error("must not be reached"); },
    }),
    /REGISTRY_ORIGIN_FORBIDDEN/,
  );
  assert.equal(calls, 0);
});

test("registry boundary rejects metadata, private DNS, path escape and peer drift", () => {
  const origins = new Set([
    "https://registry-1.docker.io",
    "https://auth.docker.io",
    "https://production.cloudflare.docker.com",
    "https://registry.npmjs.org",
  ]);
  assert.equal(
    validateRegistryUrl(
      "https://registry-1.docker.io/v2/library/caddy/manifests/sha256:abc",
      origins,
    ).hostname,
    "registry-1.docker.io",
  );
  const cloudflareDigest = "a".repeat(64);
  assert.equal(
    validateRegistryUrl(
      `https://production.cloudflare.docker.com/registry-v2/docker/registry/v2/blobs/sha256/aa/${cloudflareDigest}/data?expires=1780000000&signature=${"b".repeat(64)}&version=2`,
      origins,
    ).hostname,
    "production.cloudflare.docker.com",
  );
  for (const url of [
    "https://169.254.169.254/latest/meta-data",
    "https://user@registry-1.docker.io/v2/library/caddy/manifests/x",
    "https://registry-1.docker.io/v2/library/other/manifests/x",
    "https://registry-1.docker.io/v2/library/caddy/%2e%2e/secrets",
    `https://production.cloudflare.docker.com/registry-v2/docker/registry/v2/blobs/sha256/aa/${cloudflareDigest}/data?expires=1780000000&signature=${"b".repeat(64)}&version=2&extra=1`,
    `https://production.cloudflare.docker.com/registry-v2/docker/registry/v2/blobs/sha256/aa/${cloudflareDigest}/other?expires=1780000000&signature=${"b".repeat(64)}&version=2`,
  ]) assert.throws(() => validateRegistryUrl(url, origins), /REGISTRY_(?:ORIGIN|PATH)_FORBIDDEN/);
  for (const address of ["127.0.0.1", "10.0.0.2", "169.254.169.254", "::1", "fe80::1"]) {
    assert.throws(
      () => validatePublicRegistryAddresses([{ address, family: address.includes(":") ? 6 : 4 }]),
      /REGISTRY_ADDRESS_FORBIDDEN/,
    );
  }
  const approved = validatePublicRegistryAddresses([{ address: "8.8.8.8", family: 4 }]);
  assert.throws(() => validateRegistryPeer("1.1.1.1", approved), /REGISTRY_PEER_MISMATCH/);
  assert.equal(validateRegistryPeer("8.8.8.8", approved), "8.8.8.8");
});

test("registry exporter enforces request and whole-export deadlines and removes partial state", async () => {
  const work = await root("rc1-registry-deadline");
  const archivePath = join(work, "caddy.oci.tar");
  const layoutRoot = join(work, "layout");
  const fetcher = async (_url, { signal }) => new Promise((resolvePromise, reject) => {
    signal.addEventListener("abort", () => reject(signal.reason), { once: true });
  });
  await assert.rejects(
    exportPinnedCaddyOci({
      reference: "docker.io/library/caddy@sha256:98eb57d882ccd5213d1688764db10c1ca2c58a1ca3a6717a3411ad798f7a423a",
      archivePath,
      layoutRoot,
      sourceDateEpoch: 1_788_000_000,
      allowedOrigins: ["https://registry-1.docker.io"],
      fetcher,
      deadlines: { requestMs: 500, bodyMs: 500, exportMs: 20 },
    }),
    /REGISTRY_EXPORT_TIMEOUT/,
  );
  await assert.rejects(readFile(`${archivePath}.partial`), { code: "ENOENT" });
  await assert.rejects(readFile(layoutRoot), { code: "ENOENT" });
});

test("registry token body has an independent fixed deadline", async () => {
  const work = await root("rc1-registry-body-deadline");
  let requests = 0;
  let cancelled = false;
  const fetcher = async () => {
    requests += 1;
    if (requests === 1) {
      return new Response("", {
        status: 401,
        headers: { "www-authenticate": 'Bearer realm="https://auth.docker.io/token",service="registry.docker.io",scope="repository:library/caddy:pull"' },
      });
    }
    return new Response(new ReadableStream({
      start(controller) { controller.enqueue(Buffer.from("{")); },
      cancel() { cancelled = true; },
    }), { status: 200 });
  };
  await assert.rejects(
    exportPinnedCaddyOci({
      reference: "docker.io/library/caddy@sha256:98eb57d882ccd5213d1688764db10c1ca2c58a1ca3a6717a3411ad798f7a423a",
      archivePath: join(work, "caddy.oci.tar"),
      layoutRoot: join(work, "layout"),
      sourceDateEpoch: 1_788_000_000,
      allowedOrigins: ["https://registry-1.docker.io", "https://auth.docker.io"],
      fetcher,
      deadlines: { requestMs: 500, bodyMs: 20, exportMs: 500 },
    }),
    /REGISTRY_BODY_TIMEOUT/,
  );
  assert.equal(cancelled, true);
});

test("cleanup absence proof distinguishes missing resources from daemon disconnection", () => {
  assert.doesNotThrow(() => validateCleanupAbsence("container", "ct-rc1-backend", {
    code: 1,
    stdout: "",
    stderr: "Error response from daemon: No such container: ct-rc1-backend\n",
  }));
  assert.throws(() => validateCleanupAbsence("container", "ct-rc1-backend", {
    code: 1,
    stdout: "",
    stderr: "Cannot connect to the Docker daemon at unix:///tmp/docker.sock",
  }), /CLEANUP_DAEMON_UNREACHABLE/);
});

test("npm audit binding is computed from the actual captured POST bytes", () => {
  const expected = options("/tmp/evidence").egressEvidence.npmAuditRequest;
  const binding = validateNpmAuditBinding({
    method: "POST",
    origin: "https://registry.npmjs.org",
    path: "/-/npm/v1/security/advisories/bulk",
    body: AUDIT_BODY,
  }, expected, AUDIT_LOCK);
  assert.equal(binding.bodySha256, AUDIT_BODY_SHA256);
  assert.equal(binding.bodyBytes, AUDIT_BODY.length);
  assert.throws(() => validateNpmAuditBinding({
    method: "POST",
    origin: "https://registry.npmjs.org",
    path: "/-/npm/v1/security/advisories/bulk",
    body: Buffer.from("different"),
  }, expected, AUDIT_LOCK), /NPM_AUDIT_NOT_DERIVED_FROM_LOCK|NPM_AUDIT_REQUEST_INVALID/);
});

test("npm proxy deadline aborts a command that never sends the audit request", async () => {
  let aborted = false;
  await assert.rejects(
    awaitNpmAuditCommand({
      entry: { id: "frontend-audit", tool: "/usr/bin/npm", args: ["audit", "--json"], cwd: "/tmp" },
      execute: async (_entry, { signal }) => new Promise((resolvePromise) => {
        signal.addEventListener("abort", () => {
          aborted = true;
          resolvePromise({ code: -1, stdout: "", stderr: "COMMAND_ABORTED" });
        }, { once: true });
      }),
      captured: new Promise(() => {}),
      timeoutMs: 20,
    }),
    /NPM_AUDIT_REQUEST_TIMEOUT/,
  );
  assert.equal(aborted, true);
});

test("default executor kills the complete detached process group", async () => {
  const result = await defaultExecutor(
    "/bin/sh",
    ["-c", "sleep 60 >/dev/null 2>&1 & echo $!; exit 0"],
    { cwd: "/tmp", env: { PATH: "/usr/bin:/bin" }, timeoutMs: 2_000 },
  );
  assert.equal(result.code, 0);
  const descendant = Number(result.stdout.trim());
  assert.ok(Number.isSafeInteger(descendant) && descendant > 1);
  let alive = true;
  for (let attempt = 0; attempt < 50 && alive; attempt += 1) {
    try {
      process.kill(descendant, 0);
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 10));
    } catch (error) {
      if (error?.code !== "ESRCH") throw error;
      alive = false;
    }
  }
  assert.equal(alive, false);
});

test("candidate commands are wrapped in a low-privilege kill-child namespace", () => {
  const invocation = isolatedInvocation("/usr/bin/npm", ["test"], {
    mode: "LOW_PRIVILEGE_PID_MOUNT_NAMESPACE_V1",
    uid: 65_534,
    gid: 65_534,
  });
  assert.equal(invocation.tool, "/usr/bin/unshare");
  assert.deepEqual(invocation.args.slice(0, 5), ["--pid", "--fork", "--kill-child=SIGKILL", "--mount", "--mount-proc"]);
  assert.ok(invocation.args.includes("--reuid=65534"));
  assert.ok(invocation.args.includes("--regid=65534"));
  assert.ok(invocation.args.includes("--no-new-privs"));
});

test("protected test sources are immutable while declared outputs remain writable", async () => {
  const directory = await root("immutable-test-source");
  const testSource = join(directory, "test-source");
  const dependencyRoot = join(directory, "install-source/frontend/node_modules");
  await mkdir(join(testSource, "frontend/.next"), { recursive: true, mode: 0o700 });
  await mkdir(join(dependencyRoot, "fixture"), { recursive: true, mode: 0o700 });
  const packagePath = join(testSource, "frontend/package.json");
  await writeFile(packagePath, '{"name":"fixture"}\n', { mode: 0o444 });
  await chmod(packagePath, 0o444);
  await writeFile(join(testSource, "frontend/tsconfig.tsbuildinfo"), "", { mode: 0o600 });
  await symlink(dependencyRoot, join(testSource, "frontend/node_modules"), "dir");
  await chmod(join(testSource, "frontend"), 0o555);
  await chmod(testSource, 0o555);
  const identity = { uid: process.geteuid(), gid: process.getegid() };
  const before = await protectedTestSourceDigest(testSource, dependencyRoot, identity, identity);
  await writeFile(join(testSource, "frontend/.next/BUILD_ID"), "allowed-output\n");
  const afterOutput = await protectedTestSourceDigest(testSource, dependencyRoot, identity, identity);
  assert.deepEqual(afterOutput, before);
  await chmod(packagePath, 0o644);
  await assert.rejects(
    protectedTestSourceDigest(testSource, dependencyRoot, identity, identity),
    /TEST_SOURCE_NOT_IMMUTABLE/,
  );
  assert.ok((await lstat(join(testSource, "frontend/node_modules"))).isSymbolicLink());
  await chmod(testSource, 0o700);
  await chmod(join(testSource, "frontend"), 0o700);
});

test("frozen runtime rejects symlinks into candidate-writable work", async () => {
  const directory = await root("frozen-runtime-link");
  const runtime = join(directory, "runtime");
  const work = join(directory, "work");
  await mkdir(runtime, { mode: 0o700 });
  await mkdir(work, { mode: 0o700 });
  await writeFile(join(work, "mutable.py"), "print('mutable')\n");
  await symlink(join(work, "mutable.py"), join(runtime, "escape.py"));
  await chmod(runtime, 0o555);
  await assert.rejects(
    assertFrozenTree(runtime, process.geteuid(), process.getegid()),
    /FROZEN_TREE_SYMLINK_ESCAPE/,
  );
  await chmod(runtime, 0o700);
});

test("candidate runtime and wheel phases reject any preseeded entry", async () => {
  const directory = await root("candidate-phase-root");
  const phaseRoot = join(directory, "runtime");
  await mkdir(phaseRoot, { mode: 0o700 });
  await writeFile(join(phaseRoot, "preseeded.pth"), "import attacker\n");
  const identity = { uid: process.geteuid(), gid: process.getegid() };
  await assert.rejects(
    prepareCandidatePhaseRoot(phaseRoot, { mode: "LOW_PRIVILEGE_PID_MOUNT_NAMESPACE_V1", ...identity }, identity),
    /CANDIDATE_PHASE_ROOT_NOT_EMPTY/,
  );
});

test("isolation cleanup removes candidate hardlinks without following symlinks", async () => {
  const directory = await root("isolation-cleanup-hardlink");
  const isolationRoot = join(directory, "isolation");
  const outputRoot = join(isolationRoot, "work/tmp");
  await mkdir(outputRoot, { recursive: true, mode: 0o700 });
  await writeFile(join(outputRoot, "first.bin"), "candidate-output");
  await link(join(outputRoot, "first.bin"), join(outputRoot, "second.bin"));
  await symlink("/srv/chaotang-os", join(outputRoot, "external-link"));
  await chmod(outputRoot, 0o555);
  await chmod(join(isolationRoot, "work"), 0o555);
  await chmod(isolationRoot, 0o555);
  await removeIsolationTree(isolationRoot);
  await assert.rejects(lstat(isolationRoot), { code: "ENOENT" });
});

test("default npm proxy binds the exact lock-derived request and closes locally", async (t) => {
  const directory = await root("npm-audit-proxy");
  await writeFile(join(directory, "package-lock.json"), AUDIT_LOCK);
  const expectedRequest = options("/tmp/evidence").egressEvidence.npmAuditRequest;
  const execute = async (entry, { signal }) => {
    const registry = entry.args.find((value) => value.startsWith("--registry="))?.slice("--registry=".length);
    assert.match(registry ?? "", /^http:\/\/127\.0\.0\.1:\d+$/);
    const response = await fetch(`${registry}/-/npm/v1/security/advisories/bulk`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: AUDIT_BODY,
      signal,
    });
    return { code: response.ok ? 0 : 1, stdout: await response.text(), stderr: "" };
  };
  try {
    const audit = await defaultNpmAuditRunner({
      entry: { id: "frontend-audit", tool: "/usr/bin/npm", args: ["audit", "--json"], cwd: directory },
      execute,
      expectedRequest,
      allowedOrigins: ["https://registry.npmjs.org"],
      fetcher: async () => new Response(JSON.stringify({ metadata: { vulnerabilities: { high: 0, critical: 0 } } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
      deadlines: { requestMs: 2_000, bodyMs: 2_000, exportMs: 2_000 },
    });
    assert.equal(audit.result.code, 0);
    assert.deepEqual(audit.binding, expectedRequest);
  } catch (error) {
    if (error?.code === "EPERM" || error?.cause?.code === "EPERM") {
      t.skip("sandbox forbids loopback listeners");
      return;
    }
    throw error;
  }
});

test("mock executor produces canonical per-round evidence and cleans temporary roots", async () => {
  const evidence = await root("rc1-evidence");
  const dockerContextConfigDir = await contextConfig();
  const calls = [];
  const approvalText = await readFile(".harness/approvals/RC1-RELEASE-BLOCKER-REMEDIATION-V1-20260817.json", "utf8");
  const approval = JSON.parse(approvalText);
  const policyText = await readFile("docs/product/tasks/2026-08-17-rc1-release-blocker-remediation-v1.md", "utf8");
  const frozenPolicy = extractFrozenPolicy(policyText);
  const candidate = "1".repeat(40);
  const tree = "2".repeat(40);
  const created = new Date(1_788_000_000 * 1000).toISOString().replace(".000Z", "Z");
  const imageInspect = (user, character) => JSON.stringify([{
    Id: `sha256:${character.repeat(64)}`,
    Os: "linux",
    Architecture: "amd64",
    Config: { User: user, Labels: {
      "org.opencontainers.image.revision": candidate,
      "io.chaotang.source.tree": tree,
      "org.opencontainers.image.created": created,
    } },
  }]);
  const executor = async (tool, args, context) => {
    assert.equal(context.env.DOCKER_HOST, undefined);
    assert.equal(context.env.DOCKER_CONTEXT, undefined);
    if (context.id === "docker-context") assert.equal(context.env.DOCKER_CONFIG, dockerContextConfigDir);
    else assert.notEqual(context.env.DOCKER_CONFIG, dockerContextConfigDir);
    calls.push([tool, ...args]);
    const id = context.id;
    let stdout = "ok";
    if (id === "git-status") stdout = "";
    else if (id === "git-status-after") stdout = "";
    else if (id === "git-head") stdout = `${candidate}\n`;
    else if (id === "git-head-after") stdout = `${candidate}\n`;
    else if (id === "git-tree") stdout = `${tree}\n`;
    else if (id === "git-tree-after") stdout = `${tree}\n`;
    else if (id === "git-parent-line") stdout = `${candidate} ${"3".repeat(40)}\n`;
    else if (id === "git-source-epoch") stdout = "1788000000\n";
    else if (id === "git-product-paths") stdout = `${approval.request.productPaths.join("\n")}\n`;
    else if (id === "approval-parent") stdout = approvalText;
    else if (id === "policy-parent") stdout = policyText;
    else if (id === "time-sync") stdout = "yes\n";
    else if (id === "docker-context") stdout = JSON.stringify([{ Name: "rc1-disposable", Endpoints: { docker: { Host: "unix:///tmp/chaotang-rc1-disposable/docker.sock" } } }]);
    else if (id === "docker-version") stdout = JSON.stringify({ Client: { Version: "29.6.1", GitCommit: "8900f1d" }, Server: { Version: "29.6.1", GitCommit: "8ec5ab3" } });
    else if (id === "buildx-version") stdout = "github.com/docker/buildx v0.35.0 a319e5b15052cf6557ceb666eb8ff6e32380b782";
    else if (id === "buildx-inspect") stdout = JSON.stringify({ Nodes: [{ Buildkit: "v0.31.1" }] });
    else if (id === "node-version") stdout = "v24.19.0\n";
    else if (id === "npm-version") stdout = "11.9.0\n";
    else if (id === "python-version") stdout = "Python 3.12.14\n";
    else if (id === "unshare-version") stdout = "unshare from util-linux 2.39.3\n";
    else if (id === "setpriv-version") stdout = "setpriv from util-linux 2.39.3\n";
    else if (id === "caddy-version") stdout = "v2.11.4\n";
    else if (id === "syft-version") stdout = "syft 1.51.0\n";
    else if (id === "grype-version") stdout = "grype 0.117.0\n";
    else if (id === "frontend-audit") stdout = JSON.stringify({ metadata: { vulnerabilities: { high: 0, critical: 0 } } });
    else if (id === "build-backend" || id === "build-frontend") {
      const path = args[args.indexOf("--metadata-file") + 1];
      const archive = args.find((value) => value.startsWith("type=oci,dest=")).slice("type=oci,dest=".length).split(",compression=")[0];
      const character = id === "build-backend" ? "4" : "5";
      const base = id === "build-backend" ? frozenPolicy.images.python.reference : frozenPolicy.images.node.reference;
      await writeFile(path, JSON.stringify({
        "containerimage.digest": `sha256:${character.repeat(64)}`,
        "containerimage.config.digest": `sha256:${character.repeat(64)}`,
        "buildx.build.provenance": {
          _type: "https://in-toto.io/Statement/v0.1",
          subject: [{ name: "fixture", digest: { sha256: character.repeat(64) } }],
          predicateType: "https://slsa.dev/provenance/v0.2",
          predicate: {
            buildType: "https://mobyproject.org/buildkit@v1",
            builder: { id: "https://mobyproject.org/buildkit/v0.31.1" },
            materials: [{ uri: base.split("@")[0], digest: { sha256: base.split("sha256:")[1] } }],
            metadata: { completeness: { environment: true, parameters: true, materials: true } },
            invocation: { parameters: { provenance: "mode=max" } },
          },
        },
      }));
      await writeFile(archive, `mock-${id}-oci`);
    } else if (id === "extract-build-source" || id === "extract-test-source" || id === "extract-install-source") {
      const source = args[args.indexOf("--directory") + 1];
      await writeFile(join(source, ".source-snapshot"), "git-archive-fixture");
      if (id !== "extract-build-source") {
        await mkdir(join(source, "frontend"), { recursive: true });
        await writeFile(join(source, "frontend/package.json"), await readFile("frontend/package.json"));
        await writeFile(join(source, "frontend/package-lock.json"), await readFile("frontend/package-lock.json"));
        await mkdir(join(source, "backend"), { recursive: true });
        await writeFile(join(source, "backend/requirements-runtime.lock"), await readFile("backend/requirements-runtime.lock"));
      }
    } else if (id === "frontend-clean-install") {
      assert.ok(args.includes("--ignore-scripts"));
      await mkdir(join(context.cwd, "node_modules/mock-package"), { recursive: true });
      await writeFile(join(context.cwd, "node_modules/mock-package/index.js"), "export default true;\n");
    } else if (id === "backend-runtime-wheel") {
      const wheelDir = args[args.indexOf("--wheel-dir") + 1];
      await mkdir(wheelDir, { recursive: true });
      await writeFile(join(wheelDir, "chaotang_os_backend-0.1.0-py3-none-any.whl"), "mock-wheel");
    } else if (id === "backend-runtime-venv") {
      const runtime = args.at(-1);
      await mkdir(join(runtime, "bin"), { recursive: true });
      await writeFile(join(runtime, "bin/python"), "#!/bin/sh\nexit 0\n");
      await chmod(join(runtime, "bin/python"), 0o700);
    } else if (id === "inspect-backend" || id === "inspect-imported-backend") stdout = imageInspect("10002:10002", "4");
    else if (id === "inspect-frontend" || id === "inspect-imported-frontend") stdout = imageInspect("10001:10001", "5");
    else if (id === "inspect-caddy" || id === "inspect-imported-caddy") stdout = JSON.stringify([{ Os: "linux", Architecture: "amd64", Config: { User: "10003:10003" }, RepoDigests: ["docker.io/library/caddy@sha256:98eb57d882ccd5213d1688764db10c1ca2c58a1ca3a6717a3411ad798f7a423a"] }]);
    else if (/^syft-(?:backend|caddy|frontend|base-node|base-python)$/.test(id)) {
      const name = id.slice(5);
      const mount = args[args.indexOf("-v") + 1].split(":/work:")[0];
      await writeFile(join(mount, `${name}.sbom.json`), JSON.stringify({ bomFormat: "CycloneDX", specVersion: "1.6", components: [{ type: "library", name: "fixture" }], metadata: { tools: { components: [{ type: "application", name: "syft", version: "1.51.0" }] } } }));
    } else if (/^grype-(?:backend|caddy|frontend|base-node|base-python)$/.test(id)) {
      const mounts = args.flatMap((value, index) => value === "-v" ? [args[index + 1]] : []);
      const cache = mounts.find((value) => value.includes(":/var/lib/grype:rw")).split(":/var/lib/grype:rw")[0];
      await writeFile(join(cache, "metadata.json"), "mock-grype-db");
      stdout = JSON.stringify({ matches: [], ignoredMatches: [] });
    } else if (id === "grype-db-status") stdout = JSON.stringify({ built: "2026-08-17T00:00:00Z", schemaVersion: "6", checksum: `sha256:${"9".repeat(64)}` });
    else if (id === "bundle-build") {
      const descriptorPath = args[args.indexOf("--descriptor") + 1];
      const descriptor = JSON.parse(await readFile(descriptorPath, "utf8"));
      assert.deepEqual(descriptor.locks.map((lock) => lock.path), ["locks/backend.requirements-runtime.lock", "locks/frontend.package-lock.json"]);
      const imagesEnvSource = descriptor.artifacts.find((artifact) => artifact.bundlePath === "deploy/images.env").sourcePath;
      const refsByName = new Map(descriptor.images.map((image) => [image.name, image.reference]));
      assert.equal(await readFile(imagesEnvSource, "utf8"), [
        `BACKEND_IMAGE=${refsByName.get("backend")}`,
        `CADDY_IMAGE=${refsByName.get("caddy")}`,
        `FRONTEND_IMAGE=${refsByName.get("frontend")}`,
        "",
      ].join("\n"));
      for (const image of descriptor.images) {
        assert.equal(image.sbomPath, `images/${image.name}.sbom.json`);
        assert.equal(image.provenancePath, `images/${image.name}.provenance.json`);
        const sbomSource = descriptor.artifacts.find((artifact) => artifact.bundlePath === image.sbomPath).sourcePath;
        const sbom = JSON.parse(await readFile(sbomSource, "utf8"));
        assert.equal(sbom.metadata.component.name, image.reference);
        assert.equal(sbom.metadata.component.version, image.reference.split("@")[1]);
        assert.ok(sbom.metadata.tools.components.some((tool) => tool.name === "syft" && tool.version === "1.51.0"));
        const provenanceSource = descriptor.artifacts.find((artifact) => artifact.bundlePath === image.provenancePath).sourcePath;
        const provenance = JSON.parse(await readFile(provenanceSource, "utf8"));
        assert.deepEqual(provenance.subject, [{ name: image.reference.split("@")[0], digest: { sha256: image.reference.split("sha256:")[1] } }]);
        const expectedBaseImage = image.name === "backend"
          ? frozenPolicy.images.python.reference
          : image.name === "frontend"
            ? frozenPolicy.images.node.reference
            : frozenPolicy.images.caddy.reference;
        assert.deepEqual(provenance.predicate.buildDefinition.externalParameters.chaotang, {
          baseImageReference: expectedBaseImage,
          imageReference: image.reference,
          policyDigest: "sha256:75054d6dc6737ff20eab02ad0a6b67ff7b64250676e9ad5087187548d50fe268",
          sourceCommit: image.name === "caddy" ? null : candidate,
          sourceDateEpoch: 1_788_000_000,
          sourceTree: image.name === "caddy" ? null : tree,
        });
        assert.deepEqual(provenance.predicate.runDetails.metadata.startedOn, created);
        assert.deepEqual(provenance.predicate.runDetails.metadata.finishedOn, created);
        assert.match(provenance.predicate.runDetails.metadata.invocationId, /^sha256:[0-9a-f]{64}$/);
        assert.ok(provenance.predicate.buildDefinition.resolvedDependencies.some((dependency) => (
          dependency.uri === `git+https://gitee.com/msxn/chaotang-os@${candidate}` &&
          dependency.digest?.gitCommit === candidate &&
          dependency.digest?.gitTree === tree
        )));
        assert.ok(provenance.predicate.buildDefinition.resolvedDependencies.some((dependency) => (
          dependency.uri === "file://docs/product/tasks/2026-08-17-rc1-release-blocker-remediation-v1.md#approved-toolchain-policy" &&
          dependency.digest?.sha256 === "75054d6dc6737ff20eab02ad0a6b67ff7b64250676e9ad5087187548d50fe268"
        )));
        if (image.name === "caddy") {
          assert.equal(provenance.predicate.buildDefinition.buildType, "https://chaotang.local/buildtypes/upstream-pinned-image-adoption/v1");
          assert.deepEqual(provenance.predicate.buildDefinition.internalParameters, { adoptionMode: "pinned-upstream" });
          assert.equal(provenance.predicate.runDetails.builder.id, "https://github.com/docker/buildx");
        } else {
          assert.equal(provenance.predicate.buildDefinition.buildType, "https://mobyproject.org/buildkit@v1");
          assert.equal(provenance.predicate.buildDefinition.internalParameters.buildkitMode, "max");
          assert.match(provenance.predicate.buildDefinition.internalParameters.rawProvenanceDigest, /^sha256:[0-9a-f]{64}$/);
          assert.equal(provenance.predicate.buildDefinition.internalParameters.rawBuildkitProvenance.predicate.metadata.completeness.materials, true);
          assert.equal(provenance.predicate.buildDefinition.internalParameters.rawBuildkitProvenance.predicate.metadata.completeness.environment, true);
          assert.ok(provenance.predicate.buildDefinition.internalParameters.rawBuildkitProvenance.subject.some((subject) => subject.digest.sha256 === image.reference.split("sha256:")[1]));
          assert.match(provenance.predicate.runDetails.builder.id, /^https:\/\/mobyproject\.org\/buildkit/);
        }
        assert.ok(provenance.predicate.buildDefinition.resolvedDependencies.length >= 3);
        assert.equal(typeof provenance.predicate.runDetails.builder.id, "string");
      }
      const output = args[args.indexOf("--output") + 1];
      const snapshot = args[args.indexOf("--snapshot-output") + 1];
      await mkdir(join(output, "deploy"), { recursive: true });
      await writeFile(join(output, "manifest.json"), "{}");
      await writeFile(join(output, "deploy/images.env"), await readFile(imagesEnvSource));
      await mkdir(join(snapshot, "deploy"), { recursive: true });
      await writeFile(join(snapshot, "deploy/images.env"), await readFile(join(output, "deploy/images.env")));
      stdout = JSON.stringify({
        phase: { mode: "POST_ACCEPTANCE_FINAL", nonAuthorizing: true },
        buildManifestDigest: `sha256:${"6".repeat(64)}`,
        verificationDigest: `sha256:${"7".repeat(64)}`,
        bundleVerificationDigest: `sha256:${"8".repeat(64)}`,
        finalRelease: { bundleDigest: `sha256:${"6".repeat(64)}` },
      });
    }
    else if (id === "sqlite-backup") stdout = JSON.stringify({ manifestSha256: "7".repeat(64), sourceSnapshotIdentity: `sha256:${"8".repeat(64)}` });
    else if (id === "sqlite-smoke-seed") {
      const destination = args[args.indexOf("--destination") + 1];
      await mkdir(destination, { recursive: true });
      await writeFile(join(destination, "seed.marker"), "synthetic-retention-seed");
      stdout = JSON.stringify({ sourceSnapshotIdentity: `sha256:${"8".repeat(64)}` });
    }
    else if (id === "inspect-smoke") stdout = JSON.stringify(["backend", "caddy", "frontend"].map((name, index) => ({ Name: `/${name}`, Config: { User: `${10001 + index}:${10001 + index}` }, HostConfig: { ReadonlyRootfs: true, CapDrop: ["ALL"], SecurityOpt: ["no-new-privileges"] }, NetworkSettings: { Ports: {} }, State: { Running: true } })));
    else if (id.startsWith("cleanup-inspect-")) {
      const label = calls.flat().find((value) => typeof value === "string" && value.startsWith("io.chaotang.acceptance.owner="));
      assert.ok(label);
      const owner = label.slice(label.indexOf("=") + 1);
      stdout = id.includes("-network-")
        ? JSON.stringify([{ Id: "d".repeat(64), Labels: { "io.chaotang.acceptance.owner": owner } }])
        : JSON.stringify([{ Id: "c".repeat(64), Config: { Labels: { "io.chaotang.acceptance.owner": owner } } }]);
    }
    else if (id.startsWith("assert-prebundle-absent-")) return { code: 1, stdout: "", stderr: `Error response from daemon: No such image: ${args.at(-1)}\n` };
    else if (id.startsWith("assert-container-absent-")) return { code: 1, stdout: "", stderr: `Error response from daemon: No such container: ${args.at(-1)}\n` };
    else if (id === "assert-network-absent") return { code: 1, stdout: "", stderr: `Error response from daemon: network ${args.at(-1)} not found\n` };
    return { code: 0, stdout, stderr: "" };
  };
  const registryExporter = async ({ archivePath }) => {
    const bytes = Buffer.from("mock-registry-caddy-oci");
    await writeFile(archivePath, bytes);
    return {
      manifestDigest: "sha256:98eb57d882ccd5213d1688764db10c1ca2c58a1ca3a6717a3411ad798f7a423a",
      platform: "linux/amd64",
      layerCount: 3,
      contentBytes: 1024,
      archiveSha256: `sha256:${createHash("sha256").update(bytes).digest("hex")}`,
      entryCount: 7,
    };
  };
  const npmAuditRunner = async ({ entry, execute, expectedRequest }) => ({
    result: await execute(entry),
    binding: validateNpmAuditBinding({
      method: expectedRequest.method,
      origin: expectedRequest.origin,
      path: expectedRequest.path,
      body: AUDIT_BODY,
    }, expectedRequest, AUDIT_LOCK),
  });
  let coldBackupCalls = 0;
  const coldBackupRunner = async ({ backendContainer, sourceRoot }) => {
    coldBackupCalls += 1;
    assert.match(backendContainer, /^ct-rc1-backend-/);
    assert.match(sourceRoot, /\/work-001\/smoke-data$/);
    return {
      schemaVersion: "chaotang.rc1-cold-backup-result.v1",
      manifestSha256: `sha256:${"9".repeat(64)}`,
      sourceSnapshotIdentity: `sha256:${"a".repeat(64)}`,
      restoredSnapshotIdentity: `sha256:${"a".repeat(64)}`,
      writerStopEvidenceDigest: `sha256:${"b".repeat(64)}`,
      retentionProbeDigest: `sha256:${"c".repeat(64)}`,
      backendRestarted: true,
      networkRequests: 0,
    };
  };
  const result = await runAcceptance(options(evidence, { dockerContextConfigDir }), {
    candidateIsolation: { mode: "LOW_PRIVILEGE_PID_MOUNT_NAMESPACE_V1", uid: process.geteuid(), gid: process.getegid() },
    dockerEndpointValidator: async () => ({ dev: 1, ino: 1, path: "/tmp/chaotang-rc1-disposable/docker.sock" }),
    executor,
    registryExporter,
    npmAuditRunner,
    coldBackupRunner,
    now: () => new Date("2026-08-17T01:00:00Z"),
  });
  assert.equal(result.roundsCompleted, 1);
  assert.match(result.evidenceDigest, /^sha256:[0-9a-f]{64}$/);
  assert.ok(calls.length > 5);
  assert.equal(coldBackupCalls, 1);
  const roundEvidence = JSON.parse(await readFile(join(evidence, "round-001.json"), "utf8"));
  assert.deepEqual(roundEvidence.coldBackup, {
    backendRestarted: true,
    manifestSha256: `sha256:${"9".repeat(64)}`,
    networkRequests: 0,
    restoredSnapshotIdentity: `sha256:${"a".repeat(64)}`,
    retentionProbeDigest: `sha256:${"c".repeat(64)}`,
    schemaVersion: "chaotang.rc1-cold-backup-result.v1",
    sourceSnapshotIdentity: `sha256:${"a".repeat(64)}`,
    writerStopEvidenceDigest: `sha256:${"b".repeat(64)}`,
  });
  assert.deepEqual(roundEvidence.tools, {
    buildkit: "v0.31.1",
    buildx: "v0.35.0+a319e5b15052cf6557ceb666eb8ff6e32380b782",
    caddy: "2.11.4",
    docker: "29.6.1+8900f1d",
    grype: "0.117.0",
    node: "24.19.0",
    python: "3.12.14",
    syft: "1.51.0",
  });
  assert.deepEqual(roundEvidence.toolVersions, {
    buildkit: { version: "v0.31.1" },
    buildx: { version: "v0.35.0", gitCommit: "a319e5b15052cf6557ceb666eb8ff6e32380b782" },
    caddy: { version: "2.11.4" },
    dockerClient: { version: "29.6.1", gitCommit: "8900f1d" },
    dockerServer: { version: "29.6.1", gitCommit: "8ec5ab3" },
    grype: { version: "0.117.0" },
    node: { version: "24.19.0" },
    npm: { version: "11.9.0" },
    python: { version: "3.12.14" },
    syft: { version: "1.51.0" },
    isolation: {
      mode: "LOW_PRIVILEGE_PID_MOUNT_NAMESPACE_V1",
      uid: process.geteuid(),
      gid: process.getegid(),
      setpriv: "2.39.3",
      unshare: "2.39.3",
    },
  });
  for (const command of roundEvidence.commands) {
    assert.equal(command.invocationSha256, `sha256:${createHash("sha256").update(JSON.stringify({ args: command.args, cwd: command.cwd, isolation: command.isolation, tool: command.tool })).digest("hex")}`);
  }
  assert.equal(roundEvidence.egress.npmAuditBodySha256, AUDIT_BODY_SHA256);
  assert.equal(roundEvidence.egress.npmAuditBodyBytes, AUDIT_BODY.length);
  assert.equal(roundEvidence.buildSource.sourceTree, tree);
  assert.match(roundEvidence.buildSource.digest, /^sha256:[0-9a-f]{64}$/);
  assert.equal(roundEvidence.testSource.sourceTree, tree);
  assert.equal(roundEvidence.testSource.immutable, true);
  assert.equal(roundEvidence.testSource.dependencyInstallScriptsDisabled, true);
  assert.match(roundEvidence.testSource.digest, /^sha256:[0-9a-f]{64}$/);
  assert.deepEqual(roundEvidence.backendTestEnvironment, {
    exactLockSha256: `sha256:${createHash("sha256").update(await readFile("backend/requirements-runtime.lock")).digest("hex")}`,
    frozenBeforeFullSuite: true,
  });
  assert.deepEqual(roundEvidence.backendWheel, {
    path: "chaotang_os_backend-0.1.0-py3-none-any.whl",
    bytes: 10,
    sha256: `sha256:${createHash("sha256").update("mock-wheel").digest("hex")}`,
  });
  assert.equal(roundEvidence.cleanup.isolationRootRemoved, true);
});

test("fails closed on missing egress proof or any command failure", async () => {
  const evidence = await root("rc1-evidence");
  const dockerContextConfigDir = await contextConfig();
  const missing = options(evidence, { egressEvidence: { dockerDaemonIncluded: false } });
  assert.throws(() => validateAcceptanceOptions(missing), /EGRESS_EVIDENCE_INVALID/);
  assert.throws(
    () => validateAcceptanceOptions(options(evidence, { egressEvidence: { ...options(evidence).egressEvidence, disposableHost: false } })),
    /EGRESS_EVIDENCE_INVALID/,
  );
  assert.throws(
    () => validateAcceptanceOptions(options(evidence, { egressEvidence: { ...options(evidence).egressEvidence, npmAuditRequest: undefined } })),
    /EGRESS_EVIDENCE_INVALID/,
  );
  await assert.rejects(
    runAcceptance(options(evidence, { dockerContextConfigDir }), {
      candidateIsolation: { mode: "LOW_PRIVILEGE_PID_MOUNT_NAMESPACE_V1", uid: process.geteuid(), gid: process.getegid() },
      dockerEndpointValidator: async () => ({ dev: 1, ino: 1, path: "/tmp/chaotang-rc1-disposable/docker.sock" }),
      executor: async () => ({ code: 7, stdout: "", stderr: "failed" }),
      now: () => new Date("2026-08-17T01:00:00Z"),
    }),
    /ACCEPTANCE_COMMAND_FAILED/,
  );
});
