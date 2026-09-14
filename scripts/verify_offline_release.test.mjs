import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { link, mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { gzipSync } from "node:zlib";

import { buildOfflineRelease, readGitIdentity } from "./build_offline_release.mjs";
import {
  canonicalize,
  inspectOciArchive,
  inventoryBundle,
  parseJsonStrict,
  terminalBundleAudit,
  validateReleaseExpectation,
  verifyOfflineRelease as verifyOfflineReleaseRaw,
} from "./verify_offline_release.mjs";

const roots = new Set();
const POLICY_DIGEST = "sha256:75054d6dc6737ff20eab02ad0a6b67ff7b64250676e9ad5087187548d50fe268";
const BASE_IMAGES = {
  backend: "docker.io/library/python@sha256:356b0d18f9385f4bdcc673af60e1e64c9d1504952e4ec36ee32044c722a6bc4e",
  caddy: "docker.io/library/caddy@sha256:98eb57d882ccd5213d1688764db10c1ca2c58a1ca3a6717a3411ad798f7a423a",
  frontend: "docker.io/library/node@sha256:2a49bdf71e9fd965a58c1703fd9ddd205b34e5782b692a72dd1d248abb0beb43",
};
test.afterEach(async () => {
  await Promise.all([...roots].map((root) => rm(root, { recursive: true, force: true })));
  roots.clear();
});

async function root(name) {
  const path = await mkdtemp(join(tmpdir(), `${name}-`));
  roots.add(path);
  return path;
}

function tarEntry({ name, contents = "", type = "0" }) {
  const body = Buffer.from(contents);
  const header = Buffer.alloc(512);
  header.write(name, 0, 100, "utf8");
  header.write("0000644\0", 100, 8, "ascii");
  header.write("0000000\0", 108, 8, "ascii");
  header.write("0000000\0", 116, 8, "ascii");
  header.write(`${body.length.toString(8).padStart(11, "0")}\0`, 124, 12, "ascii");
  header.write("00000000000\0", 136, 12, "ascii");
  header.fill(0x20, 148, 156);
  header.write(type, 156, 1, "ascii");
  header.write("ustar\0", 257, 6, "ascii");
  let checksum = 0;
  for (const byte of header) checksum += byte;
  header.write(`${checksum.toString(8).padStart(6, "0")}\0 `, 148, 8, "ascii");
  const padding = Buffer.alloc((512 - (body.length % 512)) % 512);
  return Buffer.concat([header, body, padding]);
}

function tarArchive(entries) {
  return Buffer.concat([...entries.map(tarEntry), Buffer.alloc(1024)]);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function ociArchive({ name, source, layerBytes = null, layerMediaType = "application/vnd.oci.image.layer.v1.tar", layerCopies = 1, createdOverride = null, extraEntries = [] }) {
  const labels = name === "caddy" ? {} : {
    "org.opencontainers.image.revision": source.commit,
    "io.chaotang.source.tree": source.tree,
    "org.opencontainers.image.created": createdOverride ?? new Date(source.sourceDateEpoch * 1000).toISOString(),
  };
  const config = Buffer.from(JSON.stringify({ architecture: "amd64", os: "linux", config: { Labels: labels } }));
  const layer = layerBytes ?? tarArchive([{ name: `app/${name}.txt`, contents: `layer:${name}` }]);
  const configDigest = sha256(config);
  const layerDigest = sha256(layer);
  const manifest = Buffer.from(JSON.stringify({
    schemaVersion: 2,
    mediaType: "application/vnd.oci.image.manifest.v1+json",
    config: { mediaType: "application/vnd.oci.image.config.v1+json", digest: `sha256:${configDigest}`, size: config.length },
    layers: Array.from({ length: layerCopies }, () => ({ mediaType: layerMediaType, digest: `sha256:${layerDigest}`, size: layer.length })),
  }));
  const manifestDigest = sha256(manifest);
  const index = JSON.stringify({
    schemaVersion: 2,
    mediaType: "application/vnd.oci.image.index.v1+json",
    manifests: [{
      mediaType: "application/vnd.oci.image.manifest.v1+json",
      digest: `sha256:${manifestDigest}`,
      size: manifest.length,
      platform: { architecture: "amd64", os: "linux" },
    }],
  });
  return {
    digest: manifestDigest,
    bytes: tarArchive([
      { name: "oci-layout", contents: JSON.stringify({ imageLayoutVersion: "1.0.0" }) },
      { name: "index.json", contents: index },
      { name: `blobs/sha256/${configDigest}`, contents: config },
      { name: `blobs/sha256/${layerDigest}`, contents: layer },
      { name: `blobs/sha256/${manifestDigest}`, contents: manifest },
      ...extraEntries,
    ]),
  };
}

async function createReleaseFixture(source) {
  const sourceDateEpoch = 1_787_000_000;
  const trustedContents = new Map([
    ["deploy/README.md", "# Offline release verification\n"],
    ["deploy/compose.yaml", "services: {}\n"],
    ["deploy/Caddyfile", ":8080 { respond ok }\n"],
    ["backend/requirements-runtime.lock", "pkg==1 --hash=sha256:abc\n"],
    ["frontend/package-lock.json", "{}\n"],
  ]);
  for (const [relativePath, value] of trustedContents) {
    const path = join(source, relativePath);
    await mkdir(join(path, ".."), { recursive: true });
    await writeFile(path, value);
  }
  await writeFile(join(source, ".gitignore"), "images/\nlocks/\nprovenance/\ndeploy/images.env\n");
  const git = (...args) => execFileSync("/usr/bin/git", args, { cwd: source, stdio: "ignore" });
  git("init", "-q");
  git("config", "user.name", "RC1 Test");
  git("config", "user.email", "rc1-test@example.invalid");
  git("add", ".gitignore", "deploy/Caddyfile", "deploy/README.md", "deploy/compose.yaml", "backend/requirements-runtime.lock", "frontend/package-lock.json");
  git("commit", "-qm", "fixture");
  const gitIdentity = await readGitIdentity(source);
  const { commit, tree } = gitIdentity;
  const sourceIdentity = { commit, tree, sourceDateEpoch };
  const contents = new Map([
    ["deploy/README.md", trustedContents.get("deploy/README.md")],
    ["deploy/compose.yaml", trustedContents.get("deploy/compose.yaml")],
    ["deploy/Caddyfile", trustedContents.get("deploy/Caddyfile")],
    ["deploy/images.env", ""],
    ["locks/backend.requirements-runtime.lock", trustedContents.get("backend/requirements-runtime.lock")],
    ["locks/frontend.package-lock.json", trustedContents.get("frontend/package-lock.json")],
  ]);
  const imageDigests = new Map();
  for (const name of ["backend", "caddy", "frontend"]) {
    const archive = ociArchive({ name, source: sourceIdentity });
    imageDigests.set(name, archive.digest);
    contents.set(`images/${name}.oci.tar`, archive.bytes);
    const reference = name === "caddy"
      ? BASE_IMAGES.caddy
      : `chaotang-${name}@sha256:${archive.digest}`;
    contents.set(`images/${name}.sbom.json`, JSON.stringify({
      bomFormat: "CycloneDX",
      specVersion: "1.6",
      version: 1,
      metadata: {
        tools: { components: [{ type: "application", name: "syft", version: "1.51.0" }] },
        component: {
          type: "container",
          name: reference,
          version: reference.slice(reference.lastIndexOf("@") + 1),
          properties: [{ name: "io.chaotang.image.reference", value: reference }],
        },
      },
      components: [{ type: "container", name }],
    }));
    const base = BASE_IMAGES[name];
    const resolvedDependencies = [{
      uri: base.slice(0, base.lastIndexOf("@")),
      digest: { sha256: base.slice(base.lastIndexOf("sha256:") + 7) },
    }];
    resolvedDependencies.push({
      uri: `git+https://gitee.com/msxn/chaotang-os@${commit}`,
      digest: { gitTree: tree },
    });
    resolvedDependencies.push({
      uri: "file://docs/product/tasks/2026-08-17-rc1-release-blocker-remediation-v1.md#approved-toolchain-policy",
      digest: { sha256: POLICY_DIGEST.slice(7) },
    });
    const rawBuildkitProvenance = name === "caddy" ? null : {
      _type: "https://in-toto.io/Statement/v0.1",
      subject: [{ name: "fixture", digest: { sha256: reference.slice(reference.lastIndexOf("sha256:") + 7) } }],
      predicateType: "https://slsa.dev/provenance/v0.2",
      predicate: {
        buildType: "https://mobyproject.org/buildkit@v1",
        builder: { id: "https://mobyproject.org/buildkit/v0.31.1" },
        materials: [{
          uri: base.slice(0, base.lastIndexOf("@")),
          digest: { sha256: base.slice(base.lastIndexOf("sha256:") + 7) },
        }],
        metadata: { completeness: { environment: true, parameters: true, materials: true } },
        invocation: { parameters: { provenance: "mode=max" } },
      },
    };
    contents.set(`images/${name}.provenance.json`, JSON.stringify({
      _type: "https://in-toto.io/Statement/v1",
      predicateType: "https://slsa.dev/provenance/v1",
      subject: [{ name: reference.slice(0, reference.lastIndexOf("@")), digest: { sha256: reference.slice(reference.lastIndexOf("sha256:") + 7) } }],
      predicate: {
        buildDefinition: {
          buildType: name === "caddy"
            ? "https://chaotang.local/buildtypes/upstream-pinned-image-adoption/v1"
            : "https://mobyproject.org/buildkit@v1",
          externalParameters: { chaotang: {
            imageReference: reference,
            baseImageReference: base,
            policyDigest: POLICY_DIGEST,
            sourceDateEpoch,
            sourceCommit: name === "caddy" ? null : commit,
            sourceTree: name === "caddy" ? null : tree,
          } },
          internalParameters: name === "caddy"
            ? { adoptionMode: "pinned-upstream" }
            : {
                buildkitMode: "max",
                rawProvenanceDigest: `sha256:${sha256(Buffer.from(canonicalize(rawBuildkitProvenance)))}`,
                rawBuildkitProvenance,
              },
          resolvedDependencies,
        },
        runDetails: {
          builder: { id: name === "caddy" ? "https://github.com/docker/buildx" : "https://mobyproject.org/buildkit@v1" },
          metadata: {
            invocationId: `sha256:${"b".repeat(64)}`,
            startedOn: new Date(sourceDateEpoch * 1000).toISOString(),
            finishedOn: new Date(sourceDateEpoch * 1000).toISOString(),
          },
        },
      },
    }));
  }
  contents.set("deploy/images.env", [
    `BACKEND_IMAGE=chaotang-backend@sha256:${imageDigests.get("backend")}`,
    `CADDY_IMAGE=${BASE_IMAGES.caddy}`,
    `FRONTEND_IMAGE=chaotang-frontend@sha256:${imageDigests.get("frontend")}`,
    "",
  ].join("\n"));
  const artifacts = [];
  for (const [bundlePath, value] of contents) {
    const sourcePath = bundlePath === "locks/backend.requirements-runtime.lock"
      ? join(source, "backend/requirements-runtime.lock")
      : bundlePath === "locks/frontend.package-lock.json"
        ? join(source, "frontend/package-lock.json")
        : bundlePath.endsWith(".provenance.json")
          ? join(source, "provenance", `${bundlePath.split("/").at(-1).replace(".provenance.json", "")}.intoto.json`)
        : join(source, bundlePath);
    await mkdir(join(sourcePath, ".."), { recursive: true });
    await writeFile(sourcePath, value);
    const kind = bundlePath.endsWith(".oci.tar") ? "oci-archive"
      : bundlePath.endsWith(".sbom.json") ? "sbom"
        : bundlePath.endsWith(".provenance.json") ? "provenance"
          : bundlePath.startsWith("locks/") ? "lock"
            : bundlePath === "deploy/README.md" ? "documentation" : "deployment";
    artifacts.push({ bundlePath, sourcePath, kind });
  }
  const image = (name) => ({
    name,
    reference: name === "caddy"
      ? BASE_IMAGES.caddy
      : `chaotang-${name}@sha256:${imageDigests.get(name)}`,
    archivePath: `images/${name}.oci.tar`,
    sbomPath: `images/${name}.sbom.json`,
    provenancePath: `images/${name}.provenance.json`,
    sourceRevision: name === "caddy" ? null : commit,
    sourceTree: name === "caddy" ? null : tree,
  });
  return {
    repositoryRoot: source,
    gitIdentity,
    descriptor: {
      schemaVersion: "chaotang-release-input.v2",
      platform: "linux/amd64",
      runtimeRegistryDigest: "sha256:7caed69599c964b7fc908229d86795008a0956fdae90628a904f8e4ec87dcabe",
      source: { commit, tree, sourceDateEpoch },
      tools: { docker: "29.6.1+8900f1d", buildx: "v0.35.0+a319e5b15052cf6557ceb666eb8ff6e32380b782", buildkit: "v0.31.1", node: "24.19.0", python: "3.12.14", caddy: "2.11.4", syft: "1.51.0", grype: "0.117.0" },
      artifacts,
      locks: [{ path: "locks/backend.requirements-runtime.lock" }, { path: "locks/frontend.package-lock.json" }],
      deployment: { composePath: "deploy/compose.yaml", caddyfilePath: "deploy/Caddyfile", imagesEnvPath: "deploy/images.env" },
      images: [image("backend"), image("caddy"), image("frontend")],
    },
  };
}

async function builtBundle() {
  const fixture = await createReleaseFixture(await root("verify-input"));
  const output = await root("verify-bundle");
  await buildOfflineRelease({ descriptor: fixture.descriptor, outputDir: output, gitIdentity: fixture.gitIdentity, repositoryRoot: fixture.repositoryRoot });
  return output;
}

async function verifyOfflineRelease(bundle, dependencies = {}) {
  const manifest = parseJsonStrict(await readFile(join(bundle, "manifest.json"), "utf8"));
  const expectation = {
    candidateCommit: manifest.source.commit,
    candidateTree: manifest.source.tree,
    approvalDigest: `sha256:${"3".repeat(64)}`,
    p09ContractDigest: "sha256:27728301f51c7fe7bd929d99b45de86c76807b4c9c5eba22e7e42b0e18e8acc5",
    p09VerifierDigest: "sha256:f001d50ef4c03bb16aaf51f91531b78651121147cb2ee9e78af9a8a24f8f1e99",
    runtimeRegistryDigest: manifest.runtimeRegistryDigest,
    releaseManifestDigest: `sha256:${sha256(Buffer.from(canonicalize(manifest)))}`,
    previousReleaseId: null,
    previousBundleDigest: null,
    coldBackupManifestDigest: `sha256:${"6".repeat(64)}`,
    provisionalReceiptDigest: `sha256:${"7".repeat(64)}`,
    acceptanceReferenceDigest: `sha256:${"8".repeat(64)}`,
    expectationDigest: null,
  };
  const { expectationDigest: _expectationDigest, ...payload } = expectation;
  expectation.expectationDigest = `sha256:${sha256(Buffer.from(canonicalize(payload)))}`;
  return verifyOfflineReleaseRaw(bundle, { ...dependencies, expectation });
}

test("strict parser rejects duplicate keys", () => {
  assert.throws(() => parseJsonStrict('{"a":1,"a":2}'), /DUPLICATE_JSON_KEY/);
  assert.throws(() => parseJsonStrict('"\\ud800"'), /MANIFEST_JSON_INVALID/);
});

test("validates the package-external release expectation as a closed digest-bound object", () => {
  const expectation = {
    candidateCommit: "1".repeat(40),
    candidateTree: "2".repeat(40),
    approvalDigest: `sha256:${"3".repeat(64)}`,
    p09ContractDigest: "sha256:27728301f51c7fe7bd929d99b45de86c76807b4c9c5eba22e7e42b0e18e8acc5",
    p09VerifierDigest: "sha256:f001d50ef4c03bb16aaf51f91531b78651121147cb2ee9e78af9a8a24f8f1e99",
    runtimeRegistryDigest: `sha256:${"4".repeat(64)}`,
    releaseManifestDigest: `sha256:${"5".repeat(64)}`,
    previousReleaseId: null,
    previousBundleDigest: null,
    coldBackupManifestDigest: `sha256:${"6".repeat(64)}`,
    provisionalReceiptDigest: `sha256:${"7".repeat(64)}`,
    acceptanceReferenceDigest: `sha256:${"8".repeat(64)}`,
    expectationDigest: null,
  };
  const { expectationDigest: _expectationDigest, ...expectationPayload } = expectation;
  expectation.expectationDigest = `sha256:${sha256(Buffer.from(canonicalize(expectationPayload)))}`;
  assert.deepEqual(validateReleaseExpectation(expectation), expectation);
  assert.throws(
    () => validateReleaseExpectation({ ...expectation, candidateTree: "9".repeat(40) }),
    /RELEASE_EXPECTATION_DIGEST_MISMATCH/,
  );
  assert.throws(
    () => validateReleaseExpectation({ ...expectation, unknown: true }),
    /RELEASE_EXPECTATION_INVALID/,
  );
});

test("refuses bundle verification when the package-external expectation is absent", async () => {
  const bundle = await builtBundle();
  await assert.rejects(
    verifyOfflineReleaseRaw(bundle),
    /RELEASE_EXPECTATION_INVALID/,
  );
});

test("fails closed when the frozen Caddy reference does not match its OCI manifest", async () => {
  const bundle = await builtBundle();
  await assert.rejects(verifyOfflineRelease(bundle), /OCI_ARCHIVE_DIGEST_MISMATCH/);
});

test("accepts a valid application OCI archive and binds source identity", async () => {
  const source = { commit: "1".repeat(40), tree: "2".repeat(40), sourceDateEpoch: 1_787_000_000 };
  const archive = ociArchive({ name: "backend", source });
  const path = join(await root("valid-oci"), "backend.oci.tar");
  await writeFile(path, archive.bytes);
  const result = await inspectOciArchive(path, {
    name: "backend",
    reference: `chaotang-backend@sha256:${archive.digest}`,
  }, source);
  assert.equal(result.manifestDigest, `sha256:${archive.digest}`);
});

test("rejects an application OCI archive with a stale created timestamp", async () => {
  const source = { commit: "1".repeat(40), tree: "2".repeat(40), sourceDateEpoch: 1_787_000_000 };
  const archive = ociArchive({ name: "backend", source, createdOverride: "2026-01-01T00:00:00Z" });
  const path = join(await root("stale-created"), "backend.oci.tar");
  await writeFile(path, archive.bytes);
  await assert.rejects(
    inspectOciArchive(path, { name: "backend", reference: `chaotang-backend@sha256:${archive.digest}` }, source),
    /OCI_ARCHIVE_SOURCE_MISMATCH/,
  );
});

test("rejects compressed OCI layers above the frozen expansion ratio", async () => {
  const source = { commit: "1".repeat(40), tree: "2".repeat(40), sourceDateEpoch: 1_787_000_000 };
  const archive = ociArchive({
    name: "backend",
    source,
    layerBytes: gzipSync(tarArchive([{ name: "app/bomb.bin", contents: Buffer.alloc(1024 * 1024, 0x41) }])),
    layerMediaType: "application/vnd.oci.image.layer.v1.tar+gzip",
  });
  const path = join(await root("compression-bomb"), "backend.oci.tar");
  await writeFile(path, archive.bytes);
  await assert.rejects(
    inspectOciArchive(path, { name: "backend", reference: `chaotang-backend@sha256:${archive.digest}` }, source),
    /OCI_LAYER_COMPRESSION_RATIO_EXCEEDED/,
  );
});

test("rejects tampering, extra files and unknown manifest fields", async (t) => {
  await t.test("tamper", async () => {
    const bundle = await builtBundle();
    await writeFile(join(bundle, "deploy/compose.yaml"), "tampered\n");
    await assert.rejects(verifyOfflineRelease(bundle), /FILE_(?:SIZE|DIGEST)_MISMATCH/);
  });
  await t.test("extra", async () => {
    const bundle = await builtBundle();
    await writeFile(join(bundle, "extra.txt"), "extra\n");
    await assert.rejects(verifyOfflineRelease(bundle), /UNEXPECTED_BUNDLE_ENTRY/);
  });
  await t.test("unknown", async () => {
    const bundle = await builtBundle();
    const path = join(bundle, "manifest.json");
    const manifest = JSON.parse(await readFile(path, "utf8"));
    manifest.unknown = true;
    await writeFile(path, `${JSON.stringify(manifest)}\n`);
    await assert.rejects(verifyOfflineRelease(bundle), /MANIFEST_SCHEMA_INVALID/);
  });
});

test("rejects symlink and hardlink entries before reading their contents", async (t) => {
  await t.test("symlink", async () => {
    const bundle = await builtBundle();
    const target = join(bundle, "deploy/compose.yaml");
    await rm(target);
    await symlink("../Caddyfile", target);
    await assert.rejects(verifyOfflineRelease(bundle), /UNSAFE_BUNDLE_ENTRY/);
  });
  await t.test("hardlink", async () => {
    const bundle = await builtBundle();
    const source = join(bundle, "deploy/compose.yaml");
    const extra = join(bundle, "hardlink");
    await link(source, extra);
    await assert.rejects(verifyOfflineRelease(bundle), /UNSAFE_BUNDLE_ENTRY|UNEXPECTED_BUNDLE_ENTRY/);
  });
});

test("rejects traversal paths before reconciling files", async () => {
  const bundle = await builtBundle();
  const path = join(bundle, "manifest.json");
  const manifest = JSON.parse(await readFile(path, "utf8"));
  manifest.files[0].path = "../escape";
  await writeFile(path, `${JSON.stringify(manifest)}\n`);
  await assert.rejects(verifyOfflineRelease(bundle), /UNSAFE_BUNDLE_PATH/);
});

test("OCI archive inspection rejects link entries without extracting", async () => {
  const path = join(await root("unsafe-oci"), "image.oci.tar");
  await writeFile(path, tarArchive([{ name: "escape", contents: "target", type: "2" }]));
  await assert.rejects(inspectOciArchive(path), /OCI_ARCHIVE_UNSAFE/);
});

test("OCI layer inspection rejects traversal paths before Docker sees them", async () => {
  const source = { commit: "1".repeat(40), tree: "2".repeat(40), sourceDateEpoch: 1_787_000_000 };
  const archive = ociArchive({ name: "backend", source, layerBytes: tarArchive([{ name: "../escape", contents: "x" }]) });
  const path = join(await root("unsafe-layer"), "backend.oci.tar");
  await writeFile(path, archive.bytes);
  await assert.rejects(
    inspectOciArchive(path, { name: "backend", reference: `chaotang-backend@sha256:${archive.digest}` }, source),
    /UNSAFE_BUNDLE_PATH/,
  );
});

test("OCI inspection rejects unreachable blobs before Docker sees them", async () => {
  const source = { commit: "1".repeat(40), tree: "2".repeat(40), sourceDateEpoch: 1_787_000_000 };
  const hidden = gzipSync(Buffer.alloc(1024 * 1024, 0x41));
  const archive = ociArchive({
    name: "backend",
    source,
    extraEntries: [{ name: `blobs/sha256/${sha256(hidden)}`, contents: hidden }],
  });
  const path = join(await root("unreachable-oci"), "backend.oci.tar");
  await writeFile(path, archive.bytes);
  await assert.rejects(
    inspectOciArchive(path, { name: "backend", reference: `chaotang-backend@sha256:${archive.digest}` }, source),
    /OCI_ARCHIVE_UNREACHABLE_ENTRY/,
  );
});

test("OCI inspection rejects repeated descriptors before repeated parsing or expansion", async () => {
  const source = { commit: "1".repeat(40), tree: "2".repeat(40), sourceDateEpoch: 1_787_000_000 };
  const archive = ociArchive({ name: "backend", source, layerCopies: 2 });
  const path = join(await root("duplicate-oci-descriptor"), "backend.oci.tar");
  await writeFile(path, archive.bytes);
  await assert.rejects(
    inspectOciArchive(path, { name: "backend", reference: `chaotang-backend@sha256:${archive.digest}` }, source),
    /OCI_ARCHIVE_DUPLICATE_DESCRIPTOR/,
  );
});

test("rejects evidence files that only have the right extension", async () => {
  const fixture = await createReleaseFixture(await root("bad-evidence-input"));
  const sbom = fixture.descriptor.artifacts.find((item) => item.bundlePath === "images/backend.sbom.json");
  await writeFile(sbom.sourcePath, JSON.stringify({ status: "PASS" }));
  const output = await root("bad-evidence-bundle");
  await buildOfflineRelease({ descriptor: fixture.descriptor, outputDir: output, gitIdentity: fixture.gitIdentity, repositoryRoot: fixture.repositoryRoot });
  await assert.rejects(verifyOfflineRelease(output), /SBOM_INVALID/);
});

test("rejects provenance with a mismatched source tree", async () => {
  const fixture = await createReleaseFixture(await root("bad-provenance-input"));
  const provenance = fixture.descriptor.artifacts.find((item) => item.bundlePath === "images/backend.provenance.json");
  const document = JSON.parse(await readFile(provenance.sourcePath, "utf8"));
  document.predicate.buildDefinition.externalParameters.chaotang.sourceTree = "0".repeat(40);
  await writeFile(provenance.sourcePath, JSON.stringify(document));
  const output = await root("bad-provenance-bundle");
  await buildOfflineRelease({ descriptor: fixture.descriptor, outputDir: output, gitIdentity: fixture.gitIdentity, repositoryRoot: fixture.repositoryRoot });
  await assert.rejects(verifyOfflineRelease(output), /PROVENANCE_INVALID/);
});

test("rejects provenance whose retained BuildKit subject is not the final image", async () => {
  const fixture = await createReleaseFixture(await root("bad-raw-provenance-input"));
  const provenance = fixture.descriptor.artifacts.find((item) => item.bundlePath === "images/backend.provenance.json");
  const document = JSON.parse(await readFile(provenance.sourcePath, "utf8"));
  const internal = document.predicate.buildDefinition.internalParameters;
  internal.rawBuildkitProvenance.subject[0].digest.sha256 = "0".repeat(64);
  internal.rawProvenanceDigest = `sha256:${sha256(Buffer.from(canonicalize(internal.rawBuildkitProvenance)))}`;
  await writeFile(provenance.sourcePath, JSON.stringify(document));
  const output = await root("bad-raw-provenance-bundle");
  await buildOfflineRelease({ descriptor: fixture.descriptor, outputDir: output, gitIdentity: fixture.gitIdentity, repositoryRoot: fixture.repositoryRoot });
  await assert.rejects(verifyOfflineRelease(output), /PROVENANCE_INVALID/);
});

test("terminal audit rejects a concurrent bundle replacement", async () => {
  const bundle = await root("terminal-audit");
  const canonical = canonicalize({ schemaVersion: "fixture.v1" });
  const manifestDigest = `sha256:${sha256(Buffer.from(canonical))}`;
  const payload = Buffer.from("payload");
  await writeFile(join(bundle, "manifest.json"), canonical);
  await writeFile(join(bundle, "manifest.sha256"), `${manifestDigest}\n`);
  await writeFile(join(bundle, "payload.bin"), payload);
  const initial = await inventoryBundle(bundle);
  const expectedEntries = new Set(initial.keys());
  const fileMap = new Map([["payload.bin", {
    path: "payload.bin",
    bytes: payload.length,
    sha256: `sha256:${sha256(payload)}`,
  }]]);
  await writeFile(join(bundle, "manifest.sha256"), `sha256:${"0".repeat(64)}\n`);
  await assert.rejects(
    terminalBundleAudit(bundle, initial, expectedEntries, fileMap, canonical, manifestDigest),
    /FILE_CHANGED_DURING_VERIFICATION/,
  );
});

test("rejects manifest tool identity drift and invalid UTF-8", async (t) => {
  await t.test("tool drift", async () => {
    const bundle = await builtBundle();
    const path = join(bundle, "manifest.json");
    const manifest = JSON.parse(await readFile(path, "utf8"));
    manifest.tools.syft = "1.50.0";
    await writeFile(path, JSON.stringify(manifest));
    await assert.rejects(verifyOfflineRelease(bundle), /TOOL_IDENTITY_MISMATCH/);
  });
  await t.test("invalid utf8", async () => {
    const bundle = await builtBundle();
    await writeFile(join(bundle, "manifest.json"), Buffer.from([0x7b, 0xff, 0x7d]));
    await assert.rejects(verifyOfflineRelease(bundle), /MANIFEST_JSON_INVALID/);
  });
});

test("builder rejects an images.env that does not match final image references", async () => {
  const fixture = await createReleaseFixture(await root("bad-images-env-input"));
  const imagesEnv = fixture.descriptor.artifacts.find((item) => item.bundlePath === "deploy/images.env");
  await writeFile(imagesEnv.sourcePath, `BACKEND_IMAGE=backend@sha256:${"0".repeat(64)}\n`);
  await assert.rejects(
    buildOfflineRelease({
      descriptor: fixture.descriptor,
      outputDir: await root("bad-images-env-output"),
      gitIdentity: fixture.gitIdentity,
      repositoryRoot: fixture.repositoryRoot,
    }),
    /IMAGE_REFERENCE_MISMATCH/,
  );
});
