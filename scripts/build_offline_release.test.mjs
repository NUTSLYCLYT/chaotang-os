import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmod, mkdtemp, mkdir, readFile, readdir, rename, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  assertFinalReleaseMatchesProvisional,
  buildOfflineRelease,
  canonicalize,
  createProvisionalReceipt,
  parseBuildCli,
  readGitIdentity,
  resolveLiveGiteeExtDevHeadWithExecutor,
  runGovernedOfflineRelease,
  runReleasePhaseWithLiveAuthority,
  validateReleasePhase,
  validateCliStagingRoot,
  validateProvisionalReceipt,
} from "./build_offline_release.mjs";

function canonicalDigest(value) {
  return `sha256:${createHash("sha256").update(canonicalize(value)).digest("hex")}`;
}

const roots = new Set();
test.afterEach(async () => {
  await Promise.all([...roots].map((root) => rm(root, { recursive: true, force: true })));
  roots.clear();
});

async function root(name) {
  const path = await mkdtemp(join(tmpdir(), `${name}-`));
  roots.add(path);
  return path;
}

test("CLI accepts only an isolated private work staging root", async () => {
  const evidence = await root("rc1-evidence");
  const repository = await root("rc1-repository");
  const staging = join(evidence, "work-001");
  await mkdir(staging, { mode: 0o700 });
  const descriptor = join(staging, "release-input.json");
  await writeFile(descriptor, "{}");
  assert.equal(await validateCliStagingRoot(descriptor, repository), staging);
  await assert.rejects(validateCliStagingRoot(join(evidence, "release-input.json"), repository), /STAGING_ROOT_INVALID/);
  await chmod(staging, 0o755);
  await assert.rejects(validateCliStagingRoot(descriptor, repository), /STAGING_ROOT_INVALID/);
});

test("CLI rejects the legacy ungoverned build shape and requires phase plus expectation inputs", () => {
  assert.throws(
    () => parseBuildCli([
      "--descriptor", "/tmp/work-001/release-input.json",
      "--output", "/tmp/bundle",
      "--repository", "/repository",
    ]),
    /CLI_INVALID/,
  );
  assert.deepEqual(
    parseBuildCli([
      "--descriptor", "/tmp/work-001/release-input.json",
      "--output", "/tmp/bundle",
      "--phase", "/tmp/work-001/release-phase.json",
      "--repository", "/repository",
    ]),
    {
      descriptor: "/tmp/work-001/release-input.json",
      output: "/tmp/bundle",
      phase: "/tmp/work-001/release-phase.json",
      repository: "/repository",
    },
  );
});

async function inputFixture() {
  const source = await root("rc1-input");
  const files = {
    "deploy/README.md": "# Offline release verification\n",
    "deploy/compose.yaml": "services: {}\n",
    "deploy/Caddyfile": ":8080 { respond ok }\n",
    "deploy/images.env": [
      `BACKEND_IMAGE=backend@sha256:${"a".repeat(64)}`,
      `CADDY_IMAGE=caddy@sha256:${"b".repeat(64)}`,
      `FRONTEND_IMAGE=frontend@sha256:${"c".repeat(64)}`,
      "",
    ].join("\n"),
    "locks/frontend.package-lock.json": "{}\n",
    "locks/backend.requirements-runtime.lock": "pkg==1 --hash=sha256:abc\n",
  };
  for (const [relativePath, contents] of Object.entries(files)) {
    const path = join(source, relativePath);
    await mkdir(join(path, ".."), { recursive: true });
    await writeFile(path, contents);
  }
  for (const name of ["backend", "frontend", "caddy"]) {
    for (const suffix of ["oci.tar", "sbom.json"]) {
      const path = join(source, "images", `${name}.${suffix}`);
      await mkdir(join(path, ".."), { recursive: true });
      await writeFile(path, `${name}:${suffix}\n`);
    }
    const provenancePath = join(source, "provenance", `${name}.intoto.json`);
    await mkdir(join(provenancePath, ".."), { recursive: true });
    await writeFile(provenancePath, `${name}:provenance.json\n`);
  }
  await mkdir(join(source, "backend"), { recursive: true });
  await mkdir(join(source, "frontend"), { recursive: true });
  await writeFile(join(source, "backend/requirements-runtime.lock"), files["locks/backend.requirements-runtime.lock"]);
  await writeFile(join(source, "frontend/package-lock.json"), files["locks/frontend.package-lock.json"]);
  await writeFile(join(source, ".gitignore"), "images/\nlocks/\nprovenance/\ndeploy/images.env\n");
  const git = (...args) => execFileSync("/usr/bin/git", args, { cwd: source, stdio: "ignore" });
  git("init", "-q");
  git("config", "user.name", "RC1 Test");
  git("config", "user.email", "rc1-test@example.invalid");
  git("add", ".gitignore", "deploy/Caddyfile", "deploy/README.md", "deploy/compose.yaml", "backend/requirements-runtime.lock", "frontend/package-lock.json");
  git("commit", "-qm", "fixture");
  const gitIdentity = await readGitIdentity(source);
  const artifacts = Object.keys(files).map((bundlePath) => ({
    bundlePath,
    sourcePath: bundlePath === "locks/backend.requirements-runtime.lock"
      ? join(source, "backend/requirements-runtime.lock")
      : bundlePath === "locks/frontend.package-lock.json"
        ? join(source, "frontend/package-lock.json")
        : join(source, bundlePath),
    kind: bundlePath === "deploy/README.md" ? "documentation"
      : bundlePath.startsWith("locks/") ? "lock" : "deployment",
  }));
  for (const name of ["backend", "frontend", "caddy"]) {
    artifacts.push(
      { bundlePath: `images/${name}.oci.tar`, sourcePath: join(source, `images/${name}.oci.tar`), kind: "oci-archive" },
      { bundlePath: `images/${name}.sbom.json`, sourcePath: join(source, `images/${name}.sbom.json`), kind: "sbom" },
      { bundlePath: `images/${name}.provenance.json`, sourcePath: join(source, `provenance/${name}.intoto.json`), kind: "provenance" },
    );
  }
  return { source, artifacts, gitIdentity };
}

function descriptor(artifacts, gitIdentity) {
  const { commit, tree } = gitIdentity;
  const image = (name, digit) => ({
    name,
    reference: `${name}@sha256:${digit.repeat(64)}`,
    archivePath: `images/${name}.oci.tar`,
    sbomPath: `images/${name}.sbom.json`,
    provenancePath: `images/${name}.provenance.json`,
    sourceRevision: name === "caddy" ? null : commit,
    sourceTree: name === "caddy" ? null : tree,
  });
  return {
    schemaVersion: "chaotang-release-input.v2",
    platform: "linux/amd64",
    runtimeRegistryDigest: "sha256:014a4d2e5467b70cb2e12b7ab2954771040dc0f6c9f170ae20cf5759d9dcaf52",
    source: { commit, tree, sourceDateEpoch: 1_787_000_000 },
    tools: {
      docker: "29.6.1", buildx: "0.35.0", buildkit: "0.31.1", node: "24.19.0",
      python: "3.12.14", caddy: "2.11.4", syft: "1.51.0", grype: "0.117.0",
    },
    artifacts,
    locks: [
      { path: "locks/backend.requirements-runtime.lock" },
      { path: "locks/frontend.package-lock.json" },
    ],
    deployment: {
      composePath: "deploy/compose.yaml",
      caddyfilePath: "deploy/Caddyfile",
      imagesEnvPath: "deploy/images.env",
    },
    images: [image("backend", "a"), image("caddy", "b"), image("frontend", "c")],
  };
}

test("builds deterministic closed release metadata from explicit regular files", async () => {
  const { source, artifacts, gitIdentity } = await inputFixture();
  const outputA = await root("rc1-output-a");
  const outputB = await root("rc1-output-b");
  const options = {
    descriptor: descriptor(artifacts, gitIdentity),
    gitIdentity,
    repositoryRoot: source,
  };

  const first = await buildOfflineRelease({ ...options, outputDir: outputA });
  const second = await buildOfflineRelease({ ...options, outputDir: outputB });

  assert.equal(first.manifestDigest, second.manifestDigest);
  assert.deepEqual(
    await readFile(join(outputA, "manifest.json"), "utf8"),
    await readFile(join(outputB, "manifest.json"), "utf8"),
  );
  assert.match(await readFile(join(outputA, "manifest.sha256"), "utf8"), /^sha256:[0-9a-f]{64}\n$/);
});

test("binds provisional acceptance to the exact reproducible release identity", async () => {
  const { artifacts, gitIdentity } = await inputFixture();
  const value = descriptor(artifacts, gitIdentity);
  const release = {
    candidateCommit: gitIdentity.commit,
    candidateTree: gitIdentity.tree,
    approvalDigest: `sha256:${"1".repeat(64)}`,
    tools: value.tools,
    sourceDateEpoch: value.source.sourceDateEpoch,
    locks: [
      { path: value.locks[0].path, sha256: `sha256:${"2".repeat(64)}` },
      { path: value.locks[1].path, sha256: `sha256:${"3".repeat(64)}` },
    ],
    deployment: {
      composeSha256: `sha256:${"4".repeat(64)}`,
      caddyfileSha256: `sha256:${"5".repeat(64)}`,
      imagesEnvSha256: `sha256:${"6".repeat(64)}`,
    },
    bundleDigest: `sha256:${"7".repeat(64)}`,
    verificationDigest: `sha256:${"8".repeat(64)}`,
    createdAt: "2026-08-21T10:00:00.000000Z",
  };
  const receipt = createProvisionalReceipt(release);
  assert.equal(validateProvisionalReceipt(receipt).receiptDigest, receipt.receiptDigest);
  assert.doesNotThrow(() => assertFinalReleaseMatchesProvisional(receipt, release));
  assert.throws(
    () => assertFinalReleaseMatchesProvisional(receipt, {
      ...release,
      bundleDigest: `sha256:${"9".repeat(64)}`,
    }),
    /FINAL_RELEASE_IDENTITY_MISMATCH/,
  );
  assert.throws(
    () => validateProvisionalReceipt({ ...receipt, unknown: true }),
    /PROVISIONAL_RECEIPT_INVALID/,
  );
  assert.deepEqual(
    validateReleasePhase({
      mode: "PRE_ACCEPTANCE_PROVISIONAL",
      approvalCommit: "a".repeat(40),
      candidateCommit: release.candidateCommit,
      parentCommit: "a".repeat(40),
      liveRemoteBefore: "a".repeat(40),
      liveRemoteAfter: "a".repeat(40),
      candidateVerificationStatus: "VERIFIED_EXACT_SINGLE_CHILD",
    }),
    { mode: "PRE_ACCEPTANCE_PROVISIONAL", nonAuthorizing: true },
  );
  assert.deepEqual(
    validateReleasePhase({
      mode: "POST_ACCEPTANCE_FINAL",
      approvalCommit: "a".repeat(40),
      candidateCommit: release.candidateCommit,
      parentCommit: "a".repeat(40),
      liveRemoteBefore: release.candidateCommit,
      liveRemoteAfter: release.candidateCommit,
      provisionalReceipt: receipt,
      finalRelease: release,
      acceptanceReferenceDigest: `sha256:${"b".repeat(64)}`,
    }),
    { mode: "POST_ACCEPTANCE_FINAL", nonAuthorizing: true },
  );
  assert.throws(
    () => validateReleasePhase({
      mode: "POST_ACCEPTANCE_FINAL",
      approvalCommit: "a".repeat(40),
      candidateCommit: release.candidateCommit,
      parentCommit: "a".repeat(40),
      liveRemoteBefore: "a".repeat(40),
      liveRemoteAfter: release.candidateCommit,
      provisionalReceipt: receipt,
      finalRelease: release,
      acceptanceReferenceDigest: `sha256:${"b".repeat(64)}`,
    }),
    /RELEASE_PHASE_INVALID/,
  );
});

test("resolves ext-dev from the fixed Gitee SSH trust root without repository config", () => {
  let invocation;
  const head = resolveLiveGiteeExtDevHeadWithExecutor((tool, args, options) => {
    invocation = { tool, args, options };
    return `${"a".repeat(40)}\trefs/heads/ext-dev\n`;
  });

  assert.equal(head, "a".repeat(40));
  assert.equal(invocation.tool, "/usr/bin/git");
  assert.ok(invocation.args.includes("git@gitee.com:msxn/chaotang-os.git"));
  assert.ok(invocation.args.some((value) => value.includes("StrictHostKeyChecking=yes")));
  assert.equal(invocation.options.cwd, "/tmp");
  assert.equal(invocation.options.env.GIT_CONFIG_GLOBAL, "/dev/null");
  assert.equal(invocation.options.env.GIT_OPTIONAL_LOCKS, "0");
  assert.ok(!invocation.args.includes("origin"));
});

test("PRE phase brackets candidate verification and build with fixed remote double-read", async () => {
  const approvalCommit = "a".repeat(40);
  const approvalDigest = `sha256:${"1".repeat(64)}`;
  const candidateCommit = "b".repeat(40);
  const candidateTree = "c".repeat(40);
  const order = [];
  const result = await runReleasePhaseWithLiveAuthority(
    {
      mode: "PRE_ACCEPTANCE_PROVISIONAL",
      approvalCommit,
      approvalDigest,
      candidateCommit,
      candidateTree,
      parentCommit: approvalCommit,
      repositoryRoot: "/repository",
      taskId: "PACKET-15-OFFLINE-RELEASE-RECOVERY-V2-20260821",
    },
    async () => {
      order.push("build");
      return { provisional: true };
    },
    {
      remoteHeadResolver: async () => {
        order.push("remote");
        return approvalCommit;
      },
      candidateInspector: async () => {
        order.push("inspect");
        return { approvalDigest, commit: candidateCommit, tree: candidateTree, parent: approvalCommit };
      },
      candidateVerifier: async () => {
        order.push("verify");
        return {
          decision: "PASS",
          canAcceptProductCandidate: true,
          candidateCommit,
          candidateTree,
        };
      },
    },
  );

  assert.deepEqual(order, ["inspect", "remote", "verify", "build", "remote", "inspect"]);
  assert.deepEqual(result.phase, { mode: "PRE_ACCEPTANCE_PROVISIONAL", nonAuthorizing: true });
  assert.deepEqual(result.output, { provisional: true });
});

test("governed PRE entry builds and emits a bound provisional receipt without circular final expectation", async () => {
  const approvalCommit = "a".repeat(40);
  const candidateCommit = "b".repeat(40);
  const candidateTree = "c".repeat(40);
  const approvalDigest = `sha256:${"1".repeat(64)}`;
  const manifestDigest = `sha256:${"2".repeat(64)}`;
  const value = {
    descriptor: {
      source: { commit: candidateCommit, tree: candidateTree, sourceDateEpoch: 1_787_000_000 },
      tools: { node: "24.19.0" },
    },
    expectation: null,
    outputDir: "/bundle",
    repositoryRoot: "/repository",
    snapshotOutput: null,
    stagingRoot: "/staging",
    gitIdentity: { clean: true, commit: candidateCommit, tree: candidateTree },
    phase: {
      schemaVersion: "chaotang.p15-release-phase-input.v1",
      mode: "PRE_ACCEPTANCE_PROVISIONAL",
      taskId: "PACKET-15-OFFLINE-RELEASE-RECOVERY-V2-20260821",
      approvalCommit,
      approvalDigest,
      candidateCommit,
      candidateTree,
      parentCommit: approvalCommit,
      createdAt: "2026-08-21T10:00:00.000000Z",
      provisionalReceipt: null,
      acceptanceReferenceDigest: null,
    },
  };
  const order = [];
  const result = await runGovernedOfflineRelease(value, {
    builder: async () => {
      order.push("build");
      return {
        manifestDigest,
        manifest: {
          locks: [{ path: "lock", sha256: `sha256:${"3".repeat(64)}` }],
          deployment: { composeSha256: `sha256:${"4".repeat(64)}` },
        },
        filesWritten: 15,
      };
    },
    phaseDependencies: {
      remoteHeadResolver: async () => approvalCommit,
      candidateInspector: async () => ({
        commit: candidateCommit,
        tree: candidateTree,
        parent: approvalCommit,
        approvalDigest,
      }),
      candidateVerifier: async () => ({
        decision: "PASS",
        canAcceptProductCandidate: true,
        candidateCommit,
        candidateTree,
      }),
    },
  });

  assert.deepEqual(order, ["build"]);
  assert.deepEqual(result.phase, { mode: "PRE_ACCEPTANCE_PROVISIONAL", nonAuthorizing: true });
  assert.equal(result.provisionalReceipt.candidateCommit, candidateCommit);
  assert.equal(result.provisionalReceipt.bundleDigest, manifestDigest);
  assert.equal(validateProvisionalReceipt(result.provisionalReceipt).receiptDigest, result.provisionalReceipt.receiptDigest);
});

test("POST phase rejects live head movement and final release identity drift", async () => {
  const approvalCommit = "a".repeat(40);
  const approvalDigest = `sha256:${"1".repeat(64)}`;
  const candidateCommit = "b".repeat(40);
  const candidateTree = "c".repeat(40);
  const finalRelease = {
    candidateCommit,
    candidateTree,
    approvalDigest: `sha256:${"1".repeat(64)}`,
    tools: { node: "24.19.0" },
    sourceDateEpoch: 1_787_000_000,
    locks: [{ path: "lock", sha256: `sha256:${"2".repeat(64)}` }],
    deployment: { composeSha256: `sha256:${"3".repeat(64)}` },
    bundleDigest: `sha256:${"4".repeat(64)}`,
    verificationDigest: `sha256:${"5".repeat(64)}`,
    createdAt: "2026-08-21T10:00:00.000000Z",
  };
  const provisionalReceipt = createProvisionalReceipt(finalRelease);
  let remoteReads = 0;
  await assert.rejects(
    runReleasePhaseWithLiveAuthority(
      {
        mode: "POST_ACCEPTANCE_FINAL",
        approvalCommit,
        approvalDigest,
        candidateCommit,
        candidateTree,
        parentCommit: approvalCommit,
        repositoryRoot: "/repository",
        taskId: "PACKET-15-OFFLINE-RELEASE-RECOVERY-V2-20260821",
        provisionalReceipt,
        acceptanceReferenceDigest: `sha256:${"6".repeat(64)}`,
      },
      async () => finalRelease,
      {
        remoteHeadResolver: async () => {
          remoteReads += 1;
          return remoteReads === 1 ? candidateCommit : approvalCommit;
        },
        candidateInspector: async () => ({
          approvalDigest,
          commit: candidateCommit,
          tree: candidateTree,
          parent: approvalCommit,
        }),
      },
    ),
    /RELEASE_PHASE_INVALID/,
  );
  assert.equal(remoteReads, 2);
});

test("governed POST entry re-verifies the bundle and binds the exact PRE receipt", async () => {
  const approvalCommit = "a".repeat(40);
  const candidateCommit = "b".repeat(40);
  const candidateTree = "c".repeat(40);
  const approvalDigest = `sha256:${"1".repeat(64)}`;
  const manifestDigest = `sha256:${"2".repeat(64)}`;
  const acceptanceReferenceDigest = `sha256:${"5".repeat(64)}`;
  const locks = [{ path: "lock", sha256: `sha256:${"3".repeat(64)}` }];
  const deployment = { composeSha256: `sha256:${"4".repeat(64)}` };
  const buildVerificationDigest = canonicalDigest({
    schemaVersion: "chaotang.p15-build-verification.v1",
    manifestDigest,
    filesWritten: 15,
  });
  const provisionalReceipt = createProvisionalReceipt({
    candidateCommit,
    candidateTree,
    approvalDigest,
    tools: { node: "24.19.0" },
    sourceDateEpoch: 1_787_000_000,
    locks,
    deployment,
    bundleDigest: manifestDigest,
    verificationDigest: buildVerificationDigest,
    createdAt: "2026-08-21T10:00:00.000000Z",
  });
  const expectationPayload = {
    candidateCommit,
    candidateTree,
    approvalDigest,
    p09ContractDigest: "sha256:27728301f51c7fe7bd929d99b45de86c76807b4c9c5eba22e7e42b0e18e8acc5",
    p09VerifierDigest: "sha256:f001d50ef4c03bb16aaf51f91531b78651121147cb2ee9e78af9a8a24f8f1e99",
    runtimeRegistryDigest: "sha256:014a4d2e5467b70cb2e12b7ab2954771040dc0f6c9f170ae20cf5759d9dcaf52",
    releaseManifestDigest: manifestDigest,
    previousReleaseId: null,
    previousBundleDigest: null,
    coldBackupManifestDigest: `sha256:${"6".repeat(64)}`,
    provisionalReceiptDigest: provisionalReceipt.receiptDigest,
    acceptanceReferenceDigest,
  };
  const expectation = { ...expectationPayload, expectationDigest: canonicalDigest(expectationPayload) };
  const order = [];
  const result = await runGovernedOfflineRelease({
    descriptor: {
      source: { commit: candidateCommit, tree: candidateTree, sourceDateEpoch: 1_787_000_000 },
      tools: { node: "24.19.0" },
    },
    expectation,
    outputDir: "/bundle",
    repositoryRoot: "/repository",
    snapshotOutput: "/verified-bundle",
    stagingRoot: "/staging",
    gitIdentity: { clean: true, commit: candidateCommit, tree: candidateTree },
    phase: {
      schemaVersion: "chaotang.p15-release-phase-input.v1",
      mode: "POST_ACCEPTANCE_FINAL",
      taskId: "PACKET-15-OFFLINE-RELEASE-RECOVERY-V2-20260821",
      approvalCommit,
      approvalDigest,
      candidateCommit,
      candidateTree,
      parentCommit: approvalCommit,
      createdAt: "2026-08-21T10:00:00.000000Z",
      provisionalReceipt,
      acceptanceReferenceDigest,
    },
  }, {
    builder: async () => {
      order.push("build");
      return {
        manifestDigest,
        filesWritten: 15,
        manifest: {
          locks,
          deployment,
        },
      };
    },
    verifier: async () => {
      order.push("verify-bundle");
      return { ok: true, manifestDigest, snapshotRetained: true };
    },
    phaseDependencies: {
      remoteHeadResolver: async () => candidateCommit,
      candidateInspector: async () => ({
        approvalDigest,
        commit: candidateCommit,
        tree: candidateTree,
        parent: approvalCommit,
      }),
    },
  });

  assert.deepEqual(order, ["build", "verify-bundle"]);
  assert.deepEqual(result.phase, { mode: "POST_ACCEPTANCE_FINAL", nonAuthorizing: true });
  assert.equal(result.finalRelease.bundleDigest, provisionalReceipt.bundleDigest);
  assert.match(result.bundleVerificationDigest, /^sha256:[0-9a-f]{64}$/);
});

test("rejects dirty or mismatched source identity and nonempty output", async () => {
  const { source, artifacts, gitIdentity } = await inputFixture();
  const output = await root("rc1-output");
  const value = descriptor(artifacts, gitIdentity);

  await assert.rejects(buildOfflineRelease({ descriptor: value, outputDir: output, repositoryRoot: source, gitIdentity: { ...gitIdentity, clean: false } }), /SOURCE_IDENTITY_MISMATCH/);
  await writeFile(join(output, "existing"), "x");
  await assert.rejects(buildOfflineRelease({ descriptor: value, outputDir: output, repositoryRoot: source, gitIdentity }), /OUTPUT_NOT_EMPTY/);
});

test("rejects unsafe bundle paths and symlink inputs", async () => {
  const { source, artifacts, gitIdentity } = await inputFixture();
  const output = await root("rc1-output");
  const unsafe = descriptor([{ ...artifacts[0], bundlePath: "../escape" }, ...artifacts.slice(1)], gitIdentity);
  await assert.rejects(buildOfflineRelease({ descriptor: unsafe, outputDir: output, repositoryRoot: source, gitIdentity }), /UNSAFE_BUNDLE_PATH/);

  const target = join(source, "real.txt");
  const link = join(source, "link.txt");
  await writeFile(target, "real");
  await symlink(target, link);
  const withLink = descriptor(artifacts.map((artifact) => (
    artifact.bundlePath === "deploy/README.md" ? { ...artifact, sourcePath: link } : artifact
  )), gitIdentity);
  await assert.rejects(buildOfflineRelease({ descriptor: withLink, outputDir: output, repositoryRoot: source, gitIdentity }), /REPOSITORY_ARTIFACT_SOURCE_MISMATCH|INPUT_NOT_REGULAR|SOURCE_IDENTITY_MISMATCH/);
});

test("rejects reserved metadata paths and symlinked source parents", async () => {
  const { source, artifacts, gitIdentity } = await inputFixture();
  const output = await root("rc1-output");
  const reserved = descriptor([{ ...artifacts[0], bundlePath: "manifest.json" }, ...artifacts.slice(1)], gitIdentity);
  await assert.rejects(
    buildOfflineRelease({ descriptor: reserved, outputDir: output, repositoryRoot: source, gitIdentity }),
    /INPUT_SCHEMA_INVALID/,
  );

  const linkParent = join(await root("rc1-link-parent"), "linked");
  await symlink(source, linkParent);
  const linkedArtifacts = artifacts.map((artifact) => ({
    ...artifact,
    sourcePath: artifact.sourcePath.replace(source, linkParent),
  }));
  const linked = descriptor(linkedArtifacts, gitIdentity);
  await assert.rejects(
    buildOfflineRelease({ descriptor: linked, outputDir: output, repositoryRoot: source, gitIdentity }),
    /REPOSITORY_ARTIFACT_SOURCE_MISMATCH|INPUT_NOT_REGULAR/,
  );
});

test("rejects repository artifacts supplied from an unrelated path", async () => {
  const { source, artifacts, gitIdentity } = await inputFixture();
  const outside = join(await root("rc1-untrusted"), "compose.yaml");
  await writeFile(outside, "services: {}\n");
  const value = descriptor(artifacts.map((artifact) => (
    artifact.bundlePath === "deploy/compose.yaml" ? { ...artifact, sourcePath: outside } : artifact
  )), gitIdentity);
  await assert.rejects(
    buildOfflineRelease({
      descriptor: value,
      outputDir: await root("rc1-output"),
      repositoryRoot: source,
      gitIdentity,
    }),
    /REPOSITORY_ARTIFACT_SOURCE_MISMATCH/,
  );
});

test("rejects a symlinked output parent before creating the leaf", async () => {
  const { source, artifacts, gitIdentity } = await inputFixture();
  const holder = await root("rc1-output-holder");
  const target = await root("rc1-output-target");
  const linkedParent = join(holder, "linked-parent");
  const output = join(linkedParent, "must-not-exist");
  await symlink(target, linkedParent, "dir");
  await assert.rejects(
    buildOfflineRelease({
      descriptor: descriptor(artifacts, gitIdentity),
      outputDir: output,
      repositoryRoot: source,
      gitIdentity,
    }),
    /OUTPUT_NOT_DIRECTORY/,
  );
  assert.deepEqual(await readdir(target), []);
});

test("holds the original output directory when its path is replaced", async () => {
  const { source, artifacts, gitIdentity } = await inputFixture();
  const output = await root("rc1-output-replaced");
  const original = `${output}-original`;
  roots.add(original);
  await assert.rejects(
    buildOfflineRelease({
      descriptor: descriptor(artifacts, gitIdentity),
      outputDir: output,
      repositoryRoot: source,
      gitIdentity,
      testHooks: {
        afterOutputOpened: async () => {
          await rename(output, original);
          await mkdir(output, { mode: 0o700 });
        },
      },
    }),
    /OUTPUT_REPLACED_DURING_BUILD/,
  );
  assert.deepEqual(await readdir(output), []);
  assert.ok((await readdir(original)).length > 0);
});

test("holds bundle subdirectories when an output child is replaced", async () => {
  const { source, artifacts, gitIdentity } = await inputFixture();
  const output = await root("rc1-output-child-replaced");
  const target = await root("rc1-output-child-target");
  await assert.rejects(
    buildOfflineRelease({
      descriptor: descriptor(artifacts, gitIdentity),
      outputDir: output,
      repositoryRoot: source,
      gitIdentity,
      testHooks: {
        afterDirectoriesOpened: async () => {
          await rename(join(output, "images"), join(output, "images-original"));
          await symlink(target, join(output, "images"), "dir");
        },
      },
    }),
    /OUTPUT_REPLACED_DURING_BUILD/,
  );
  assert.deepEqual(await readdir(target), []);
  assert.ok((await readdir(join(output, "images-original"))).length > 0);
});

test("ignores inherited Git pointer and configuration environment", async () => {
  const { source, gitIdentity } = await inputFixture();
  const unrelated = await root("rc1-unrelated-git");
  execFileSync("/usr/bin/git", ["init", "-q"], { cwd: unrelated, stdio: "ignore" });
  const previous = process.env.GIT_DIR;
  process.env.GIT_DIR = join(unrelated, ".git");
  try {
    assert.deepEqual(await readGitIdentity(source), gitIdentity);
  } finally {
    if (previous === undefined) delete process.env.GIT_DIR;
    else process.env.GIT_DIR = previous;
  }
});

test("rejects generated artifacts outside the explicit staging root", async () => {
  const { source, artifacts, gitIdentity } = await inputFixture();
  const outside = join(await root("rc1-secret-like"), "backend.oci.tar");
  await writeFile(outside, "must not be bundled");
  const value = descriptor(artifacts.map((artifact) => (
    artifact.bundlePath === "images/backend.oci.tar"
      ? { ...artifact, sourcePath: outside }
      : artifact
  )), gitIdentity);
  await assert.rejects(
    buildOfflineRelease({
      descriptor: value,
      outputDir: await root("rc1-output"),
      repositoryRoot: source,
      stagingRoot: source,
      gitIdentity,
    }),
    /GENERATED_ARTIFACT_OUTSIDE_STAGING/,
  );

  const secretLike = join(source, ".gitignore");
  const insideButWrongLayout = descriptor(artifacts.map((artifact) => (
    artifact.bundlePath === "images/backend.oci.tar"
      ? { ...artifact, sourcePath: secretLike }
      : artifact
  )), gitIdentity);
  await assert.rejects(
    buildOfflineRelease({
      descriptor: insideButWrongLayout,
      outputDir: await root("rc1-output"),
      repositoryRoot: source,
      stagingRoot: source,
      gitIdentity,
    }),
    /GENERATED_ARTIFACT_OUTSIDE_STAGING/,
  );
});

test("rejects production output roots before filesystem access", async () => {
  const { source, artifacts, gitIdentity } = await inputFixture();
  await assert.rejects(
    buildOfflineRelease({
      descriptor: descriptor(artifacts, gitIdentity),
      outputDir: "/srv/chaotang-os/rc1-must-not-exist",
      repositoryRoot: source,
      stagingRoot: source,
      gitIdentity,
    }),
    /OUTPUT_PATH_FORBIDDEN/,
  );
});
