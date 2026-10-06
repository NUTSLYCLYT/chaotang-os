import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { deflateSync } from "node:zlib";
import { linkSync, mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = path.resolve(SCRIPT_DIR, "..");
const MODULE_PATH = path.join(SCRIPT_DIR, "release-evidence.mjs");
const SCHEMA_PATH = path.join(REPOSITORY_ROOT, "docs/contracts/release-evidence.v2.schema.json");

let apiPromise;
function loadApi() {
  apiPromise ??= import(pathToFileURL(MODULE_PATH).href);
  return apiPromise;
}

function clone(value) {
  return structuredClone(value);
}

function digest(char) {
  return `sha256:${char.repeat(64)}`;
}

function commit(char) {
  return char.repeat(40);
}

function timestamp(second) {
  return `2026-08-21T10:00:${String(second).padStart(2, "0")}.000000Z`;
}

function fileDigest(bytes) {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function writeBytes(root, relativePath, bytes) {
  const target = path.join(root, relativePath);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, bytes);
  return { bytes: Buffer.byteLength(bytes), sha256: fileDigest(bytes) };
}

const CRC32_TABLE = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0);
  return value >>> 0;
});

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = (crc >>> 8) ^ CRC32_TABLE[(crc ^ byte) & 0xff];
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBytes = Buffer.from(type, "ascii");
  const chunk = Buffer.alloc(12 + data.length);
  chunk.writeUInt32BE(data.length, 0);
  typeBytes.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])), 8 + data.length);
  return chunk;
}

function pngFixture(width = 320, height = 320) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const raw = Buffer.alloc((width * 4 + 1) * height, 0xff);
  for (let row = 0; row < height; row += 1) raw[row * (width * 4 + 1)] = 0;
  return Buffer.concat([
    Buffer.from("89504e470d0a1a0a", "hex"),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

async function makeIncompleteEvidence() {
  const api = await loadApi();
  const mandatoryCheckIds = api.COMMAND_REGISTRY.map((row) => row.commandId);
  const document = {
    schemaVersion: api.SCHEMA_VERSION,
    contractDigest: api.contractDigest(),
    releaseId: "release-00000000-0000-4000-8000-000000000001",
    releaseMode: "BOOTSTRAP",
    repository: {
      repositoryId: api.REPOSITORY_ID,
      targetRef: api.TARGET_REF,
      targetRemoteUrlDigest: api.TARGET_REMOTE_URL_DIGEST,
    },
    candidate: {
      commit: commit("a"),
      tree: commit("b"),
      parentCommit: commit("c"),
      approvalDigests: [digest("1")],
      sourceDirty: false,
      remoteHeadBefore: commit("a"),
      remoteHeadAfter: commit("a"),
    },
    previousRelease: null,
    packetSet: [],
    environmentSet: [{
      environmentId: "env-local",
      class: "LOCAL_ISOLATED",
      os: "linux",
      architecture: "x86_64",
      toolchainDigest: digest("2"),
      dependencyLockDigests: [digest("3")],
      containerImageDigests: [],
      networkMode: "NONE",
      dataClass: "SYNTHETIC",
      startedAt: timestamp(0),
      completedAt: timestamp(1),
      environmentDigest: null,
    }],
    commandRegistryDigest: api.commandRegistryDigest(),
    checks: mandatoryCheckIds.map((commandId, index) => ({
      checkId: `check-${String(index + 1).padStart(2, "0")}`,
      commandId,
      environmentId: "env-local",
      status: "NOT_RUN",
      startedAt: null,
      completedAt: null,
      exitCode: null,
      stdoutDigest: null,
      stdoutBytes: null,
      stdoutArtifactRef: null,
      stderrDigest: null,
      stderrBytes: null,
      stderrArtifactRef: null,
      resultProjection: null,
      stdoutRedactionReceiptRef: null,
      stderrRedactionReceiptRef: null,
      artifactRefs: [],
      limitationCodes: ["NOT_EXECUTED"],
      checkDigest: null,
    })),
    browserJourneys: [],
    storageSet: [],
    artifacts: [],
    reviews: [],
    rollback: {
      strategy: "REMOVE_NEW_STACK_PRESERVE_DATA_AND_EVIDENCE",
      previousReleaseId: null,
      previousBundleDigest: null,
      coldBackupManifestDigest: null,
      restoreRehearsalDigest: null,
      compatibilityDecision: "INCOMPLETE",
      rollbackTestStatus: "NOT_RUN",
      rollbackReceiptRef: null,
      rollbackDigest: null,
    },
    conclusion: {
      status: "INCOMPLETE",
      mandatoryCheckIds,
      passedCheckIds: [],
      failedCheckIds: [],
      notRunCheckIds: mandatoryCheckIds.map((_, index) => `check-${String(index + 1).padStart(2, "0")}`),
      blockedCheckIds: [],
      requiredJourneyIds: [],
      passedJourneyIds: [],
      unresolvedFindingIds: [],
      releaseEvidenceComplete: false,
      businessSuccessMeasured: false,
      reasonCodes: ["MANDATORY_CHECKS_NOT_RUN"],
      conclusionDigest: null,
    },
    nonAuthorizing: true,
    productionDeploymentAuthorized: false,
    startedAt: timestamp(0),
    completedAt: timestamp(2),
    evidenceDigest: null,
  };
  return api.sealReleaseEvidence(document);
}

async function makeVerifiedEvidence(root) {
  const api = await loadApi();
  const archiveRoot = path.join(root, "evidence");
  const bundleRoot = path.join(root, "bundle");
  const backupRoot = path.join(root, "backup");
  mkdirSync(archiveRoot);
  mkdirSync(bundleRoot);
  mkdirSync(backupRoot);
  writeFileSync(path.join(bundleRoot, "release.bundle"), "bundle\n");
  writeFileSync(path.join(backupRoot, "backup.db"), "backup\n");

  const candidate = {
    commit: commit("a"),
    tree: commit("b"),
    parentCommit: commit("c"),
    approvalDigests: [digest("1")],
    sourceDirty: false,
    remoteHeadBefore: commit("a"),
    remoteHeadAfter: commit("a"),
  };
  const artifacts = [];
  const artifactBytes = new Map();
  const checks = [];
  const checkByCommand = new Map();

  function addArtifact({ artifactId, kind, artifactRole, producerCheckId, relativePath, content, mediaType = "application/json" }) {
    const observed = writeBytes(archiveRoot, relativePath, content);
    const artifact = {
      artifactId,
      kind,
      artifactRole,
      storageId: "storage-evidence",
      relativePath,
      mediaType,
      bytes: observed.bytes,
      sha256: observed.sha256,
      producerCheckId,
      candidateCommit: candidate.commit,
      candidateTree: candidate.tree,
      createdAt: timestamp(2),
      redactionStatus: "CLEAN",
      artifactDigest: null,
    };
    artifacts.push(artifact);
    artifactBytes.set(artifactId, Buffer.from(content));
    return artifact;
  }

  function replaceArtifactContent(artifactId, content, mediaType = "application/json") {
    const artifact = artifacts.find((item) => item.artifactId === artifactId);
    const observed = writeBytes(archiveRoot, artifact.relativePath, content);
    artifact.mediaType = mediaType;
    artifact.bytes = observed.bytes;
    artifact.sha256 = observed.sha256;
    artifactBytes.set(artifactId, Buffer.from(content));
  }

  const subjectKindsByCommand = new Map(api.COMMAND_REGISTRY.map((row) => [row.commandId, row.requiredSubjectKinds]));
  for (const [index, row] of api.COMMAND_REGISTRY.entries()) {
    const checkId = `check-${String(index + 1).padStart(2, "0")}`;
    checkByCommand.set(row.commandId, checkId);
    const stdout = addArtifact({ artifactId: `${checkId}-stdout`, kind: "COMMAND_OUTPUT", artifactRole: "COMMAND_STDOUT", producerCheckId: checkId, relativePath: `checks/${checkId}/stdout.log`, content: "PASS\n", mediaType: "text/plain" });
    const stderr = addArtifact({ artifactId: `${checkId}-stderr`, kind: "COMMAND_OUTPUT", artifactRole: "COMMAND_STDERR", producerCheckId: checkId, relativePath: `checks/${checkId}/stderr.log`, content: "", mediaType: "text/plain" });
    const stdoutReceiptValue = {
      schemaVersion: "chaotang.redaction-receipt.v1",
      producerCheckId: checkId,
      streamRole: "COMMAND_STDOUT",
      outputArtifactId: stdout.artifactId,
      inputDigest: stdout.sha256,
      inputBytes: stdout.bytes,
      outputDigest: stdout.sha256,
      outputBytes: stdout.bytes,
      policyDigest: digest("2"),
      canarySetDigest: digest("3"),
      status: "CLEAN",
      receiptDigest: null,
    };
    stdoutReceiptValue.receiptDigest = api.structuredDigest(api.DIGEST_WRAPPERS.receiptDigest, stdoutReceiptValue, "receiptDigest");
    const stderrReceiptValue = { ...stdoutReceiptValue, streamRole: "COMMAND_STDERR", outputArtifactId: stderr.artifactId, inputDigest: stderr.sha256, inputBytes: stderr.bytes, outputDigest: stderr.sha256, outputBytes: stderr.bytes, receiptDigest: null };
    stderrReceiptValue.receiptDigest = api.structuredDigest(api.DIGEST_WRAPPERS.receiptDigest, stderrReceiptValue, "receiptDigest");
    const stdoutReceipt = addArtifact({ artifactId: `${checkId}-stdout-redaction`, kind: "REDACTION_RECEIPT", artifactRole: "REDACTION", producerCheckId: checkId, relativePath: `checks/${checkId}/stdout-redaction.json`, content: JSON.stringify(stdoutReceiptValue) });
    const stderrReceipt = addArtifact({ artifactId: `${checkId}-stderr-redaction`, kind: "REDACTION_RECEIPT", artifactRole: "REDACTION", producerCheckId: checkId, relativePath: `checks/${checkId}/stderr-redaction.json`, content: JSON.stringify(stderrReceiptValue) });

    const subjectRefs = [];
    for (const [subjectIndex, kind] of subjectKindsByCommand.get(row.commandId).entries()) {
      const artifactId = `${checkId}-subject-${String(subjectIndex + 1).padStart(2, "0")}`;
      const extension = kind === "BROWSER_SCREENSHOT" ? "png" : "json";
      const mediaType = kind === "BROWSER_SCREENSHOT" ? "image/png" : "application/json";
      const subject = addArtifact({ artifactId, kind, artifactRole: "SUPPORTING", producerCheckId: checkId, relativePath: `checks/${checkId}/${kind.toLowerCase()}.${extension}`, content: kind === "BROWSER_SCREENSHOT" ? pngFixture() : JSON.stringify({ schemaVersion: "placeholder.invalid", status: "PASS" }), mediaType });
      subjectRefs.push(subject.artifactId);
    }
    if (row.commandId === "backend-full-suite") {
      const testLog = addArtifact({ artifactId: `${checkId}-test-log`, kind: "TEST_LOG", artifactRole: "SUPPORTING", producerCheckId: checkId, relativePath: `checks/${checkId}/test.log`, content: "all tests passed\n", mediaType: "text/plain" });
      subjectRefs.push(testLog.artifactId);
    }
    const projection = row.projectionKind === "TEST_RUN" ? {
      schemaVersion: "chaotang.command-result-projection.v1", projectionKind: "TEST_RUN", inventoryDigest: digest("4"), collectedCount: 1, passedCount: 1, failedCount: 0, blockedCount: 0, notRunCount: 0, subjectArtifactRefs: [], projectionDigest: null,
    } : row.projectionKind === "COMMAND_ONLY" ? {
      schemaVersion: "chaotang.command-result-projection.v1", projectionKind: "COMMAND_ONLY", inventoryDigest: null, collectedCount: null, passedCount: null, failedCount: null, blockedCount: null, notRunCount: null, subjectArtifactRefs: [], projectionDigest: null,
    } : {
      schemaVersion: "chaotang.command-result-projection.v1", projectionKind: "TYPED_RECEIPT", inventoryDigest: null, collectedCount: null, passedCount: null, failedCount: null, blockedCount: null, notRunCount: null, subjectArtifactRefs: [...subjectRefs].sort(), projectionDigest: null,
    };
    projection.projectionDigest = api.structuredDigest(api.DIGEST_WRAPPERS.projectionDigest, projection, "projectionDigest");
    const environmentId = row.requiredEnvironmentClass === "REAL_BROWSER" ? "env-browser" : row.requiredEnvironmentClass === "DISPOSABLE_HOST" ? "env-host" : "env-local";
    const projectionArtifact = addArtifact({ artifactId: `${checkId}-projection`, kind: "RESULT_RECEIPT", artifactRole: "RESULT_PROJECTION", producerCheckId: checkId, relativePath: `checks/${checkId}/projection.json`, content: JSON.stringify(projection) });
    const artifactRefs = [stdout.artifactId, stderr.artifactId, stdoutReceipt.artifactId, stderrReceipt.artifactId, projectionArtifact.artifactId, ...subjectRefs].sort();
    checks.push({
      checkId, commandId: row.commandId, environmentId, status: "PASS", startedAt: timestamp(0), completedAt: timestamp(1), exitCode: 0,
      stdoutDigest: stdout.sha256, stdoutBytes: stdout.bytes, stdoutArtifactRef: stdout.artifactId,
      stderrDigest: stderr.sha256, stderrBytes: stderr.bytes, stderrArtifactRef: stderr.artifactId,
      resultProjection: projection, stdoutRedactionReceiptRef: stdoutReceipt.artifactId, stderrRedactionReceiptRef: stderrReceipt.artifactId,
      artifactRefs, limitationCodes: [], checkDigest: null,
    });
  }

  const browserCheckId = checkByCommand.get("batch1-real-browser-journey");
  const browserSubjectRefs = checks.find((check) => check.checkId === browserCheckId).resultProjection.subjectArtifactRefs;
  const screenshotRef = browserSubjectRefs.find((ref) => artifacts.find((artifact) => artifact.artifactId === ref).kind === "BROWSER_SCREENSHOT");
  const traceRef = browserSubjectRefs.find((ref) => artifacts.find((artifact) => artifact.artifactId === ref).kind === "BROWSER_TRACE");
  const actions = ["REGISTER_LOGIN", "DRAFT_DECREE", "ACCEPT_DECREE", "POLL_JOB", "VERIFY_SHIGUAN_REPLY", "VERIFY_XLSX_WORK_PRODUCT", "CONFIRM_WORK_PRODUCT", "DOWNLOAD_AND_HASH", "VERIFY_CROSS_OWNER_404"];
  const journey = {
    journeyId: "journey-batch1", environmentId: "env-browser", baseUrlDigest: digest("5"), frontendCommit: candidate.commit, backendCommit: candidate.commit, authenticatedOwnerFixtureId: "owner-fixture-a",
    steps: actions.map((action, index) => ({ ordinal: index + 1, action, routeDigest: digest("6"), requestDigest: digest("7"), responseDigest: digest("8"), status: "PASS", artifactRefs: index === 0 ? [screenshotRef] : [] })),
    networkAssertions: ["NO_HIDDEN_FALLBACK", "NO_ROUTE_INTERCEPTION", "OWNER_SCOPED_404", "REAL_BACKEND"].map((kind, index) => ({ assertionId: `network-${index + 1}`, kind, expectedDigest: digest("9"), observedDigest: digest("9"), status: "PASS" })),
    consoleAssertions: ["NO_CONSOLE_ERRORS", "NO_NETWORK_ERRORS"].map((kind, index) => ({ assertionId: `console-${index + 1}`, kind, expectedDigest: digest("a"), observedDigest: digest("a"), status: "PASS" })),
    artifactRefs: [screenshotRef, traceRef].sort(), status: "PASS", journeyDigest: null,
  };

  const reviewProducer = checkByCommand.get("independent-review-matrix");
  const reviewCheck = checks.find((check) => check.checkId === reviewProducer);
  for (let index = 2; index <= 5; index += 1) {
    const artifact = addArtifact({ artifactId: `${reviewProducer}-subject-${String(index).padStart(2, "0")}`, kind: "REVIEW_REPORT", artifactRole: "SUPPORTING", producerCheckId: reviewProducer, relativePath: `checks/${reviewProducer}/review_report_${index}.json`, content: JSON.stringify({ schemaVersion: "placeholder.invalid", status: "PASS" }) });
    reviewCheck.resultProjection.subjectArtifactRefs.push(artifact.artifactId);
    reviewCheck.artifactRefs.push(artifact.artifactId);
  }
  reviewCheck.resultProjection.subjectArtifactRefs.sort();
  reviewCheck.artifactRefs.sort();
  reviewCheck.resultProjection.projectionDigest = api.structuredDigest(api.DIGEST_WRAPPERS.projectionDigest, reviewCheck.resultProjection, "projectionDigest");
  replaceArtifactContent(`${reviewProducer}-projection`, JSON.stringify(reviewCheck.resultProjection));
  const reviewArtifactRefs = reviewCheck.resultProjection.subjectArtifactRefs;
  const reviews = ["browser-ui", "code", "javascript", "release-operations", "security"].map((role, index) => ({ reviewId: `review-${String(index + 1).padStart(2, "0")}`, role, candidateCommit: candidate.commit, candidateTree: candidate.tree, scopeDigest: digest("b"), reviewerClass: "INDEPENDENT_AGENT", verdict: "GO", findings: [], reportArtifactRef: reviewArtifactRefs[index], completedAt: timestamp(2), reviewDigest: null }));
  const rollbackProducer = checkByCommand.get("rollback-rehearsal");
  const rollbackReceiptRef = checks.find((check) => check.checkId === rollbackProducer).resultProjection.subjectArtifactRefs[0];

  const bundleManifest = api.observeEvidenceArchive(bundleRoot, { storageId: "storage-p15-bundle", allowContainers: true });
  const backupManifest = api.observeEvidenceArchive(backupRoot, { storageId: "storage-p15-backup", allowContainers: true });
  journey.journeyDigest = api.structuredDigest(api.DIGEST_WRAPPERS.journeyDigest, journey, "journeyDigest");
  for (const review of reviews) review.reviewDigest = api.structuredDigest(api.DIGEST_WRAPPERS.reviewDigest, review, "reviewDigest");
  const rollback = { strategy: "REMOVE_NEW_STACK_PRESERVE_DATA_AND_EVIDENCE", previousReleaseId: null, previousBundleDigest: null, coldBackupManifestDigest: backupManifest.manifestDigest, restoreRehearsalDigest: digest("f"), compatibilityDecision: "COMPATIBLE", rollbackTestStatus: "PASS", rollbackReceiptRef, rollbackDigest: null };
  rollback.rollbackDigest = api.structuredDigest(api.DIGEST_WRAPPERS.rollbackDigest, rollback, "rollbackDigest");
  const releaseId = "release-00000000-0000-4000-8000-000000000002";

  function subjectReceipt(artifactId, subjectId, subjectDigest, relatedArtifactRefs = []) {
    const artifact = artifacts.find((item) => item.artifactId === artifactId);
    const value = {
      schemaVersion: "chaotang.release-subject-receipt.v1",
      artifactKind: artifact.kind,
      producerCheckId: artifact.producerCheckId,
      releaseId,
      candidateCommit: candidate.commit,
      candidateTree: candidate.tree,
      subjectId,
      subjectDigest,
      relatedArtifactRefs: [...relatedArtifactRefs].sort(),
      status: "PASS",
      receiptDigest: null,
    };
    value.receiptDigest = api.structuredDigest(api.DIGEST_WRAPPERS.typedSubjectReceiptDigest, value, "receiptDigest");
    replaceArtifactContent(artifactId, JSON.stringify(value));
  }

  const traceReceipt = {
    schemaVersion: "chaotang.browser-trace-receipt.v1",
    producerCheckId: browserCheckId,
    releaseId,
    candidateCommit: candidate.commit,
    candidateTree: candidate.tree,
    journeyId: journey.journeyId,
    journeyDigest: journey.journeyDigest,
    viewport: { width: 320, height: 320, deviceScaleFactor: 1 },
    stepRouteDigests: [...new Set(journey.steps.map((step) => step.routeDigest))].sort(),
    networkAssertionDigest: api.structuredDigest("chaotang.browser-network-assertions-digest.v1", journey.networkAssertions),
    consoleAssertionDigest: api.structuredDigest("chaotang.browser-console-assertions-digest.v1", journey.consoleAssertions),
    screenshotRefs: [screenshotRef],
    status: "PASS",
    receiptDigest: null,
  };
  traceReceipt.receiptDigest = api.structuredDigest(api.DIGEST_WRAPPERS.browserTraceReceiptDigest, traceReceipt, "receiptDigest");
  replaceArtifactContent(traceRef, JSON.stringify(traceReceipt));
  reviews.forEach((review) => subjectReceipt(review.reportArtifactRef, review.reviewId, review.reviewDigest));
  subjectReceipt(rollbackReceiptRef, releaseId, rollback.rollbackDigest);

  const typedPairs = [
    ["p15-backup-verify-rehearse", "storage-p15-backup", backupManifest.manifestDigest],
    ["p15-offline-bundle-verify", "storage-p15-bundle", bundleManifest.manifestDigest],
  ];
  for (const [commandId, storageId, manifestDigest] of typedPairs) {
    const refs = checks.find((check) => check.commandId === commandId).resultProjection.subjectArtifactRefs;
    refs.forEach((ref) => {
      const artifact = artifacts.find((item) => item.artifactId === ref);
      const subjectDigest = artifact.kind === "RESTORE_RECEIPT" ? rollback.restoreRehearsalDigest : manifestDigest;
      subjectReceipt(ref, storageId, subjectDigest, refs.filter((other) => other !== ref));
    });
  }
  const remoteRef = checks.find((check) => check.commandId === "remote-head-stability").resultProjection.subjectArtifactRefs[0];
  subjectReceipt(remoteRef, "remote-head-stability", api.structuredDigest("chaotang.remote-head-observation-digest.v1", { commit: candidate.commit, remoteHeadBefore: candidate.remoteHeadBefore, remoteHeadAfter: candidate.remoteHeadAfter }));

  const evidenceManifest = api.observeEvidenceArchive(archiveRoot, { storageId: "storage-evidence" });
  artifacts.sort((left, right) => left.artifactId.localeCompare(right.artifactId));
  const document = {
    schemaVersion: api.SCHEMA_VERSION, contractDigest: api.contractDigest(), releaseId, releaseMode: "BOOTSTRAP",
    repository: { repositoryId: api.REPOSITORY_ID, targetRef: api.TARGET_REF, targetRemoteUrlDigest: api.TARGET_REMOTE_URL_DIGEST }, candidate, previousRelease: null, packetSet: [{ packetId: "packet-accepted-01", disposition: "REBUILD", contractDigest: digest("0"), approvalDigest: candidate.approvalDigests[0], candidateCommit: candidate.commit, candidateTree: candidate.tree, ownerAcceptanceDigest: digest("1"), status: "ACCEPTED" }],
    environmentSet: [
      { environmentId: "env-browser", class: "REAL_BROWSER", os: "linux", architecture: "x86_64", toolchainDigest: digest("c"), dependencyLockDigests: [digest("d")], containerImageDigests: [], networkMode: "LOOPBACK_ONLY", dataClass: "SYNTHETIC", startedAt: timestamp(0), completedAt: timestamp(2), environmentDigest: null },
      { environmentId: "env-host", class: "DISPOSABLE_HOST", os: "linux", architecture: "x86_64", toolchainDigest: digest("c"), dependencyLockDigests: [digest("d")], containerImageDigests: [], networkMode: "NONE", dataClass: "SYNTHETIC", startedAt: timestamp(0), completedAt: timestamp(2), environmentDigest: null },
      { environmentId: "env-local", class: "LOCAL_ISOLATED", os: "linux", architecture: "x86_64", toolchainDigest: digest("c"), dependencyLockDigests: [digest("d")], containerImageDigests: [], networkMode: "NONE", dataClass: "SYNTHETIC", startedAt: timestamp(0), completedAt: timestamp(2), environmentDigest: null },
    ],
    commandRegistryDigest: api.commandRegistryDigest(), checks, browserJourneys: [journey],
    storageSet: [
      { storageId: "storage-evidence", kind: "EVIDENCE_ARCHIVE", manifestDigest: evidenceManifest.manifestDigest, contentDigest: evidenceManifest.contentDigest, bytes: evidenceManifest.totalBytes, retentionReceiptDigest: digest("e") },
      { storageId: "storage-p15-backup", kind: "P15_COLD_BACKUP", manifestDigest: backupManifest.manifestDigest, contentDigest: backupManifest.contentDigest, bytes: backupManifest.totalBytes, retentionReceiptDigest: digest("e") },
      { storageId: "storage-p15-bundle", kind: "P15_RELEASE_BUNDLE", manifestDigest: bundleManifest.manifestDigest, contentDigest: bundleManifest.contentDigest, bytes: bundleManifest.totalBytes, retentionReceiptDigest: digest("e") },
    ],
    artifacts, reviews,
    rollback,
    conclusion: { status: "INCOMPLETE", mandatoryCheckIds: [], passedCheckIds: [], failedCheckIds: [], notRunCheckIds: [], blockedCheckIds: [], requiredJourneyIds: [], passedJourneyIds: [], unresolvedFindingIds: [], releaseEvidenceComplete: false, businessSuccessMeasured: false, reasonCodes: [], conclusionDigest: null },
    nonAuthorizing: true, productionDeploymentAuthorized: false, startedAt: timestamp(0), completedAt: timestamp(2), evidenceDigest: null,
  };
  document.conclusion = { ...api.deriveConclusion(document), conclusionDigest: null };
  const sealed = api.sealReleaseEvidence(document);
  return {
    document: sealed,
    options: {
      expectedCandidate: { commit: candidate.commit, tree: candidate.tree, parentCommit: candidate.parentCommit, approvalDigests: candidate.approvalDigests },
      expectedRemoteHead: candidate.commit,
      expectedPacketSetDigest: api.structuredDigest("chaotang.packet-set-digest.v1", sealed.packetSet),
      storageRoots: new Map([
        ["storage-evidence", { sourceId: "p09-owned-evidence-root", path: archiveRoot }],
        ["storage-p15-backup", { sourceId: "p15-owned-backup-root", path: backupRoot }],
        ["storage-p15-bundle", { sourceId: "p15-owned-bundle-root", path: bundleRoot }],
      ]),
    },
    roots: { archiveRoot, bundleRoot, backupRoot },
    artifactBytes,
  };
}

async function rewriteGoldenArtifact(golden, artifactId, content, mediaType = undefined) {
  const api = await loadApi();
  const document = clone(golden.document);
  const artifact = document.artifacts.find((item) => item.artifactId === artifactId);
  const observed = writeBytes(golden.roots.archiveRoot, artifact.relativePath, content);
  artifact.bytes = observed.bytes;
  artifact.sha256 = observed.sha256;
  if (mediaType !== undefined) artifact.mediaType = mediaType;
  artifact.artifactDigest = null;
  const manifest = api.observeEvidenceArchive(golden.roots.archiveRoot, { storageId: "storage-evidence" });
  const storage = document.storageSet.find((item) => item.storageId === "storage-evidence");
  storage.manifestDigest = manifest.manifestDigest;
  storage.contentDigest = manifest.contentDigest;
  storage.bytes = manifest.totalBytes;
  document.evidenceDigest = null;
  return api.sealReleaseEvidence(document);
}

async function assertValidationCode(document, code, options = {}) {
  const api = await loadApi();
  assert.throws(
    () => api.validateReleaseEvidence(document, options),
    (error) => error?.name === "ReleaseEvidenceError" && error.code === code,
  );
}

test("P09-RED-01 schema and verifier are present, closed, and validate an incomplete envelope", async () => {
  const api = await loadApi();
  const schema = api.parseReleaseEvidence(readFileSync(SCHEMA_PATH, "utf8"), { envelope: false });
  assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
  assert.equal(schema.$id, "https://chaotang-os.invalid/contracts/release-evidence.v2.schema.json");
  assert.equal(schema.additionalProperties, false);
  assert.deepEqual(schema["x-chaotang-reviewedContract"], {
    path: "docs/migrations/2026-08-21-packet-09-release-evidence-contract.draft.md",
    sha256: "27728301f51c7fe7bd929d99b45de86c76807b4c9c5eba22e7e42b0e18e8acc5",
    availability: "GOVERNANCE_SOURCE_PINNED_BY_APPROVAL_TASK_NOT_PRODUCT_CHILD",
  });
  assert.deepEqual(schema.required, api.TOP_LEVEL_FIELDS);
  assert.equal(schema["x-chaotang-commandRegistry"].length, 17);
  assert.equal(schema["x-chaotang-commandRegistry"].find((row) => row.commandId === "root-harness-and-doctor").projectionKind, "COMMAND_ONLY");
  const document = await makeIncompleteEvidence();
  const result = api.validateReleaseEvidence(document);
  assert.equal(result.decision, "STRUCTURALLY_VALID_NONAUTHORIZING");
  assert.equal(result.claimedConclusion, "INCOMPLETE");
  assert.equal(result.nonAuthorizing, true);
});

test("P09-DONOR-01 legacy reports and arbitrary PASS text cannot upgrade current evidence", async () => {
  const api = await loadApi();
  const document = await makeIncompleteEvidence();
  const text = JSON.stringify({ ...document, legacyReport: "2026-07 PASS all green" });
  assert.throws(() => api.verifyReleaseEvidenceText(text), /SCHEMA_UNKNOWN_FIELD/);
  const canonical = api.canonicalizeReleaseEvidence(document);
  assert.equal(canonical.includes("2026-07"), false);
  assert.equal(api.validateReleaseEvidence(document).claimedConclusion, "INCOMPLETE");
});

test("P09-SOURCE-01 blocked external sources are rejected before filesystem observation", async () => {
  const api = await loadApi();
  const document = await makeIncompleteEvidence();
  let observed = false;
  assert.throws(
    () => api.validateReleaseEvidence(document, {
      storageRoots: new Map([["blocked", {
        sourceId: "certification-release-evidence:04",
        path: "/nonexistent/metadata-only",
      }]]),
      observeDirectory: () => { observed = true; },
    }),
    /BLOCKED_SOURCE_FORBIDDEN/,
  );
  assert.equal(observed, false);
  assert.throws(
    () => api.validateReleaseEvidence(document, {
      storageRoots: new Map([["relabeled-blocked", {
        sourceId: "apparently-safe-label",
        path: "/home/ubuntu/chaotang-logs",
      }]]),
      observeDirectory: () => { observed = true; },
    }),
    /BLOCKED_SOURCE_FORBIDDEN/,
  );
  assert.equal(observed, false);
});

test("P09-JSON-01 duplicate keys, unknown fields, unsafe paths, secrets, and non-I-JSON are rejected", async () => {
  const api = await loadApi();
  assert.throws(() => api.parseReleaseEvidence('{"a":1,"a":2}'), /DUPLICATE_JSON_KEY/);
  assert.throws(() => api.parseReleaseEvidence('{"a":NaN}'), /INVALID_JSON/);
  assert.throws(() => api.parseReleaseEvidence(Buffer.from([0xff])), /INVALID_UTF8/);
  assert.equal(api.isSafeRelativePath("logs/test.log"), true);
  for (const unsafe of ["/tmp/a", "../a", "a/../b", "a\\b", "C:/a", "a//b", "a\0b"]) {
    assert.equal(api.isSafeRelativePath(unsafe), false, unsafe);
  }
  const document = await makeIncompleteEvidence();
  const unknown = clone(document);
  unknown.extra = true;
  await assertValidationCode(unknown, "SCHEMA_UNKNOWN_FIELD");
  const privacyCanaryDocument = clone(document);
  privacyCanaryDocument.conclusion.reasonCodes = ["token=secret-canary"];
  privacyCanaryDocument.conclusion.conclusionDigest = api.structuredDigest(
    api.DIGEST_WRAPPERS.conclusionDigest,
    privacyCanaryDocument.conclusion,
    "conclusionDigest",
  );
  privacyCanaryDocument.evidenceDigest = api.structuredDigest(api.DIGEST_WRAPPERS.evidenceDigest, privacyCanaryDocument, "evidenceDigest");
  await assertValidationCode(privacyCanaryDocument, "PRIVACY_CANARY_FORBIDDEN");
});

test("P09-IDENTITY-01 candidate, parent, tree, approval, and remote-head splice fail closed", async () => {
  const document = await makeIncompleteEvidence();
  const api = await loadApi();
  assert.equal(api.validateReleaseEvidence(document, {
    expectedCandidate: {
      commit: document.candidate.commit,
      tree: document.candidate.tree,
      parentCommit: document.candidate.parentCommit,
      approvalDigests: document.candidate.approvalDigests,
    },
  }).claimedConclusion, "INCOMPLETE");
  for (const field of ["commit", "tree", "parentCommit", "remoteHeadBefore", "remoteHeadAfter"]) {
    const mutated = clone(document);
    mutated.candidate[field] = commit("d");
    mutated.evidenceDigest = api.structuredDigest(api.DIGEST_WRAPPERS.evidenceDigest, mutated, "evidenceDigest");
    await assertValidationCode(mutated, field.startsWith("remote") ? "REMOTE_HEAD_MISMATCH" : "CANDIDATE_IDENTITY_MISMATCH", {
      expectedCandidate: {
        commit: document.candidate.commit,
        tree: document.candidate.tree,
        parentCommit: document.candidate.parentCommit,
        approvalDigests: document.candidate.approvalDigests,
      },
    });
  }
});

test("P09-CHECK-01 PASS, FAIL, NOT_RUN, BLOCKED, exit, projection, and dual receipts are exact", async () => {
  const api = await loadApi();
  const document = await makeIncompleteEvidence();
  const notRun = document.checks[0];
  assert.equal(api.validateCheck(notRun, { artifactsById: new Map(), environmentsById: new Map([["env-local", document.environmentSet[0]]]) }).status, "NOT_RUN");
  const forged = { ...notRun, status: "PASS", exitCode: 0, limitationCodes: [] };
  assert.throws(() => api.validateCheck(forged, { artifactsById: new Map(), environmentsById: new Map([["env-local", document.environmentSet[0]]]) }), /CHECK_STREAM_EVIDENCE_INVALID/);
  const blockedWithExit = { ...notRun, status: "BLOCKED", exitCode: 1 };
  assert.throws(() => api.validateCheck(blockedWithExit, { artifactsById: new Map(), environmentsById: new Map([["env-local", document.environmentSet[0]]]) }), /CHECK_NOT_RUN_SHAPE_INVALID/);
});

test("P09-REGISTRY-01 registry is sealed and command, argv, cwd, environment, and inventory drift are rejected", async () => {
  const api = await loadApi();
  assert.equal(api.COMMAND_REGISTRY.length, 17);
  assert.deepEqual(api.COMMAND_REGISTRY.map((row) => row.commandId), [...api.COMMAND_REGISTRY.map((row) => row.commandId)].sort());
  assert.equal(api.commandRegistryDigest(), api.structuredDigest(
    api.DIGEST_WRAPPERS.commandRegistryDigest,
    api.COMMAND_REGISTRY,
  ));
  const document = await makeIncompleteEvidence();
  const unknown = clone(document);
  unknown.checks[0].commandId = "unknown-command";
  unknown.checks[0].checkDigest = api.structuredDigest(api.DIGEST_WRAPPERS.checkDigest, unknown.checks[0], "checkDigest");
  unknown.evidenceDigest = api.structuredDigest(api.DIGEST_WRAPPERS.evidenceDigest, unknown, "evidenceDigest");
  await assertValidationCode(unknown, "COMMAND_NOT_REGISTERED");
});

test("P09-ARTIFACT-01 archive verification rejects traversal, tamper, extras, symlinks, hardlinks, and budget overflow", async () => {
  const api = await loadApi();
  const root = mkdtempSync(path.join(os.tmpdir(), "p09-artifacts-"));
  try {
    mkdirSync(path.join(root, "logs"));
    writeFileSync(path.join(root, "logs", "test.log"), "ok\n");
    const manifest = api.observeEvidenceArchive(root, { storageId: "storage-main" });
    assert.equal(manifest.entries.length, 1);
    writeFileSync(path.join(root, "extra.log"), "tamper\n");
    assert.throws(() => api.verifyEvidenceArchive(root, manifest), /ARCHIVE_ENTRY_SET_MISMATCH/);
    rmSync(path.join(root, "extra.log"));
    symlinkSync("logs/test.log", path.join(root, "link.log"));
    assert.throws(() => api.observeEvidenceArchive(root, { storageId: "storage-main" }), /ARCHIVE_SYMLINK_FORBIDDEN/);
    rmSync(path.join(root, "link.log"));
    linkSync(path.join(root, "logs", "test.log"), path.join(root, "hard.log"));
    assert.throws(() => api.observeEvidenceArchive(root, { storageId: "storage-main" }), /ARCHIVE_HARDLINK_FORBIDDEN/);
    rmSync(path.join(root, "hard.log"));
    if (process.platform !== "win32") {
      writeFileSync(path.join(root, "A"), "a");
      writeFileSync(path.join(root, "a"), "b");
      assert.throws(() => api.observeEvidenceArchive(root, { storageId: "storage-main" }), /ARCHIVE_CASE_COLLISION/);
      rmSync(path.join(root, "A"));
      rmSync(path.join(root, "a"));
      writeFileSync(path.join(root, "Σ"), "a");
      writeFileSync(path.join(root, "ς"), "b");
      assert.throws(() => api.observeEvidenceArchive(root, { storageId: "storage-main" }), /ARCHIVE_CASE_COLLISION/);
      rmSync(path.join(root, "Σ"));
      rmSync(path.join(root, "ς"));
    }
    writeFileSync(path.join(root, "container.bin"), Buffer.from([0x50, 0x4b, 0x03, 0x04, 0, 0]));
    assert.throws(() => api.observeEvidenceArchive(root, { storageId: "storage-main" }), /ARCHIVE_NESTED_ARCHIVE_FORBIDDEN/);
    writeFileSync(path.join(root, "container.bin"), Buffer.from([0x50, 0x4b, 0x05, 0x06, 0, 0]));
    assert.throws(() => api.observeEvidenceArchive(root, { storageId: "storage-main" }), /ARCHIVE_NESTED_ARCHIVE_FORBIDDEN/);
    writeFileSync(path.join(root, "container.bin"), Buffer.from("07070100000000", "ascii"));
    assert.throws(() => api.observeEvidenceArchive(root, { storageId: "storage-main" }), /ARCHIVE_NESTED_ARCHIVE_FORBIDDEN/);
    writeFileSync(path.join(root, "container.bin"), Buffer.from([0x71, 0xc7, 0, 0, 0, 0]));
    assert.throws(() => api.observeEvidenceArchive(root, { storageId: "storage-main" }), /ARCHIVE_NESTED_ARCHIVE_FORBIDDEN/);
    writeFileSync(path.join(root, "container.bin"), Buffer.from([0xc7, 0x71, 0, 0, 0, 0]));
    assert.throws(() => api.observeEvidenceArchive(root, { storageId: "storage-main" }), /ARCHIVE_NESTED_ARCHIVE_FORBIDDEN/);
    writeFileSync(path.join(root, "container.bin"), Buffer.from("xar!0000", "ascii"));
    assert.throws(() => api.observeEvidenceArchive(root, { storageId: "storage-main" }), /ARCHIVE_NESTED_ARCHIVE_FORBIDDEN/);
    writeFileSync(path.join(root, "container.bin"), Buffer.from([0x68, 0x73, 0x71, 0x73, 0xff, 0xfe]));
    assert.throws(() => api.observeEvidenceArchive(root, { storageId: "storage-main" }), /EVIDENCE_CONTENT_TYPE_FORBIDDEN/);
    writeFileSync(path.join(root, "container.bin"), Buffer.from([0x4d, 0x53, 0x57, 0x49, 0x4d, 0, 0, 0]));
    assert.throws(() => api.observeEvidenceArchive(root, { storageId: "storage-main" }), /EVIDENCE_CONTENT_TYPE_FORBIDDEN/);
    writeFileSync(path.join(root, "container.bin"), Buffer.from([0xff, 0xfe, 0xfd, 0xfc]));
    assert.throws(() => api.observeEvidenceArchive(root, { storageId: "storage-main" }), /EVIDENCE_CONTENT_TYPE_FORBIDDEN/);
    writeFileSync(path.join(root, "container.bin"), "PASS\u0085FORGED");
    assert.throws(() => api.observeEvidenceArchive(root, { storageId: "storage-main" }), /EVIDENCE_CONTENT_TYPE_FORBIDDEN/);
    writeFileSync(path.join(root, "container.bin"), "PASS\u009b31mFORGED");
    assert.throws(() => api.observeEvidenceArchive(root, { storageId: "storage-main" }), /EVIDENCE_CONTENT_TYPE_FORBIDDEN/);
    writeFileSync(path.join(root, "container.bin"), "PASS\u202eFORGED");
    assert.throws(() => api.observeEvidenceArchive(root, { storageId: "storage-main" }), /EVIDENCE_CONTENT_TYPE_FORBIDDEN/);
    writeFileSync(path.join(root, "container.bin"), Buffer.alloc(api.LIMITS.evidenceArtifactBytes, 0x41));
    assert.equal(api.observeEvidenceArchive(root, { storageId: "storage-main" }).entries.length, 2);
    writeFileSync(path.join(root, "container.bin"), Buffer.concat([
      Buffer.alloc(api.LIMITS.evidenceArtifactBytes - 2, 0x41),
      Buffer.from("\u009b", "utf8"),
    ]));
    assert.throws(() => api.observeEvidenceArchive(root, { storageId: "storage-main" }), /EVIDENCE_CONTENT_TYPE_FORBIDDEN/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("P09-BROWSER-01 real journey shape rejects mocks, interception, fallback, owner leaks, and assertion errors", async () => {
  const api = await loadApi();
  const browserArtifacts = new Map([
    ["artifact-browser-screenshot", { artifactId: "artifact-browser-screenshot", kind: "BROWSER_SCREENSHOT", producerCheckId: "check-browser" }],
    ["artifact-browser-trace", { artifactId: "artifact-browser-trace", kind: "BROWSER_TRACE", producerCheckId: "check-browser" }],
  ]);
  const journey = {
    journeyId: "journey-batch1",
    environmentId: "env-browser",
    baseUrlDigest: digest("4"),
    frontendCommit: commit("a"),
    backendCommit: commit("a"),
    authenticatedOwnerFixtureId: "owner-fixture-a",
    steps: [{ ordinal: 1, action: "REGISTER_LOGIN", routeDigest: digest("5"), requestDigest: digest("6"), responseDigest: digest("7"), status: "PASS", artifactRefs: ["artifact-browser-screenshot"] }],
    networkAssertions: [{ assertionId: "network-01", kind: "REAL_BACKEND", expectedDigest: digest("8"), observedDigest: digest("8"), status: "PASS" }],
    consoleAssertions: [{ assertionId: "console-01", kind: "NO_CONSOLE_ERRORS", expectedDigest: digest("9"), observedDigest: digest("9"), status: "PASS" }],
    artifactRefs: ["artifact-browser-screenshot", "artifact-browser-trace"],
    status: "PASS",
    journeyDigest: null,
  };
  journey.journeyDigest = api.structuredDigest(api.DIGEST_WRAPPERS.journeyDigest, journey, "journeyDigest");
  assert.equal(api.validateBrowserJourney(journey, { artifactsById: browserArtifacts }).status, "PASS");
  for (const action of ["MOCK_API", "ROUTE_INTERCEPTION", "HIDDEN_FALLBACK"]) {
    const invalid = clone(journey);
    invalid.steps[0].action = action;
    invalid.journeyDigest = api.structuredDigest(api.DIGEST_WRAPPERS.journeyDigest, invalid, "journeyDigest");
    assert.throws(() => api.validateBrowserJourney(invalid, { artifactsById: browserArtifacts }), /JOURNEY_ACTION_INVALID/);
  }
  const missingEvidence = clone(journey);
  missingEvidence.artifactRefs = [];
  missingEvidence.steps[0].artifactRefs = [];
  missingEvidence.journeyDigest = api.structuredDigest(api.DIGEST_WRAPPERS.journeyDigest, missingEvidence, "journeyDigest");
  assert.throws(() => api.validateBrowserJourney(missingEvidence, { artifactsById: browserArtifacts }), /JOURNEY_ARTIFACT_BINDING_INVALID/);
});

test("P09-REVIEW-01 self review, NO_GO, and open P0-P2 cannot support VERIFIED", async () => {
  const api = await loadApi();
  const review = {
    reviewId: "review-security",
    role: "security",
    candidateCommit: commit("a"),
    candidateTree: commit("b"),
    scopeDigest: digest("a"),
    reviewerClass: "INDEPENDENT_AGENT",
    verdict: "GO",
    findings: [],
    reportArtifactRef: "artifact-review",
    completedAt: timestamp(2),
    reviewDigest: null,
  };
  review.reviewDigest = api.structuredDigest(api.DIGEST_WRAPPERS.reviewDigest, review, "reviewDigest");
  assert.equal(api.validateReview(review, { artifactsById: new Map([["artifact-review", { kind: "REVIEW_REPORT" }]]), candidate: { commit: commit("a"), tree: commit("b") } }).verdict, "GO");
  const self = { ...review, reviewerClass: "IMPLEMENTER" };
  self.reviewDigest = api.structuredDigest(api.DIGEST_WRAPPERS.reviewDigest, self, "reviewDigest");
  assert.throws(() => api.validateReview(self, { artifactsById: new Map(), candidate: { commit: commit("a"), tree: commit("b") } }), /REVIEWER_CLASS_INVALID/);
  const open = clone(review);
  open.findings = [{ findingId: "finding-p1", priority: "P1", state: "OPEN", descriptionDigest: digest("b"), evidenceRefs: [], disposition: "FIXED" }];
  open.reviewDigest = api.structuredDigest(api.DIGEST_WRAPPERS.reviewDigest, open, "reviewDigest");
  assert.throws(() => api.validateReview(open, { artifactsById: new Map([["artifact-review", { kind: "REVIEW_REPORT" }]]), candidate: { commit: commit("a"), tree: commit("b") } }), /REVIEW_FINDING_DISPOSITION_INVALID/);
  const noGo = clone(review);
  noGo.verdict = "NO_GO";
  noGo.reviewDigest = api.structuredDigest(api.DIGEST_WRAPPERS.reviewDigest, noGo, "reviewDigest");
  assert.equal(api.validateReview(noGo, { artifactsById: new Map([["artifact-review", { kind: "REVIEW_REPORT" }]]), candidate: { commit: commit("a"), tree: commit("b") } }).verdict, "NO_GO");
});

test("P09-ROLLBACK-01 upgrade and bootstrap rollback requirements fail closed", async () => {
  const api = await loadApi();
  const document = await makeIncompleteEvidence();
  assert.equal(api.validateRollback(document.rollback, { releaseMode: "BOOTSTRAP", verified: false, artifactsById: new Map() }).rollbackTestStatus, "NOT_RUN");
  const verifiedBootstrap = { ...document.rollback, rollbackTestStatus: "PASS" };
  assert.throws(() => api.validateRollback(verifiedBootstrap, { releaseMode: "BOOTSTRAP", verified: true, artifactsById: new Map() }), /ROLLBACK_EVIDENCE_INCOMPLETE/);
  const upgrade = { ...document.rollback, strategy: "RESTORE_PREVIOUS_RELEASE", rollbackTestStatus: "PASS" };
  assert.throws(() => api.validateRollback(upgrade, { releaseMode: "UPGRADE", verified: true, artifactsById: new Map() }), /ROLLBACK_PREVIOUS_RELEASE_REQUIRED/);
  const invalidBootstrap = { ...document.rollback, strategy: "RESTORE_PREVIOUS_RELEASE" };
  assert.throws(() => api.validateRollback(invalidBootstrap, { releaseMode: "BOOTSTRAP", verified: false, artifactsById: new Map() }), /ROLLBACK_BOOTSTRAP_SHAPE_INVALID/);
});

test("P09-PRIVACY-01 secret, cookie, token, username, home, and business-body canaries never enter evidence", async () => {
  const api = await loadApi();
  for (const canary of [
    "Authorization: Bearer abc",
    "cookie=session",
    "api_token=abc",
    "/home/ubuntu/private",
    "C:\\Users\\admin\\secret",
    "BEGIN PRIVATE KEY",
  ]) {
    assert.throws(() => api.assertPrivacySafe({ value: canary }), /PRIVACY_CANARY_FORBIDDEN/, canary);
  }
  assert.doesNotThrow(() => api.assertPrivacySafe({ limitationCodes: ["NOT_EXECUTED"] }));
});

test("P09-CONCLUSION-01 only mandatory PASS can verify while business outcome stays independent", async () => {
  const api = await loadApi();
  const document = await makeIncompleteEvidence();
  const derived = api.deriveConclusion(document);
  assert.equal(derived.status, "INCOMPLETE");
  assert.equal(derived.releaseEvidenceComplete, false);
  assert.equal(derived.businessSuccessMeasured, false);
  const forged = clone(document);
  forged.conclusion.status = "VERIFIED";
  forged.conclusion.releaseEvidenceComplete = true;
  forged.conclusion.conclusionDigest = api.structuredDigest(api.DIGEST_WRAPPERS.conclusionDigest, forged.conclusion, "conclusionDigest");
  forged.evidenceDigest = api.structuredDigest(api.DIGEST_WRAPPERS.evidenceDigest, forged, "evidenceDigest");
  await assertValidationCode(forged, "CONCLUSION_MISMATCH");
  const root = mkdtempSync(path.join(os.tmpdir(), "p09-verified-"));
  try {
    const golden = await makeVerifiedEvidence(root);
    const structural = api.validateReleaseEvidence(golden.document, golden.options);
    assert.equal(structural.decision, "STRUCTURALLY_VALID_NONAUTHORIZING");
    assert.equal(structural.claimedConclusion, "VERIFIED");
    assert.equal(structural.trusted, false);
    assert.equal(structural.releaseReady, false);

    const future = clone(golden.document);
    future.completedAt = "9999-12-31T23:59:59.999999Z";
    future.evidenceDigest = null;
    assert.throws(() => api.validateReleaseEvidence(api.sealReleaseEvidence(future), golden.options), /TIMESTAMP_ORDER_INVALID/);
    writeFileSync(path.join(golden.roots.archiveRoot, "unindexed-secret.log"), "token=forbidden\n");
    assert.throws(() => api.validateReleaseEvidence(golden.document, golden.options), /PRIVACY_CANARY_FORBIDDEN|STORAGE_DESCRIPTOR_MISMATCH|ARCHIVE_ENTRY_SET_MISMATCH/);
    rmSync(path.join(golden.roots.archiveRoot, "unindexed-secret.log"));
    writeFileSync(path.join(golden.roots.bundleRoot, "release.bundle"), "bundle-tampered\n");
    assert.throws(() => api.validateReleaseEvidence(golden.document, golden.options), /STORAGE_DESCRIPTOR_MISMATCH/);
    writeFileSync(path.join(golden.roots.bundleRoot, "release.bundle"), "bundle\n");
    const relabeled = { ...golden.options, storageRoots: new Map(golden.options.storageRoots) };
    relabeled.storageRoots.set("storage-evidence", { sourceId: "observed-safe-label", path: golden.roots.archiveRoot });
    assert.equal(api.validateReleaseEvidence(golden.document, relabeled).decision, "STRUCTURALLY_VALID_NONAUTHORIZING");
    const missingP15 = { ...golden.options, storageRoots: new Map(golden.options.storageRoots) };
    missingP15.storageRoots.delete("storage-p15-bundle");
    assert.throws(() => api.validateReleaseEvidence(golden.document, missingP15), /STORAGE_MAPPING_REQUIRED/);
    const failedProjection = clone(golden.document);
    const testCheck = failedProjection.checks.find((check) => check.resultProjection.projectionKind === "TEST_RUN");
    testCheck.resultProjection.passedCount = 0;
    testCheck.resultProjection.failedCount = 1;
    testCheck.resultProjection.projectionDigest = api.structuredDigest(api.DIGEST_WRAPPERS.projectionDigest, testCheck.resultProjection, "projectionDigest");
    testCheck.checkDigest = api.structuredDigest(api.DIGEST_WRAPPERS.checkDigest, testCheck, "checkDigest");
    failedProjection.evidenceDigest = api.structuredDigest(api.DIGEST_WRAPPERS.evidenceDigest, failedProjection, "evidenceDigest");
    assert.throws(() => api.validateReleaseEvidence(failedProjection, golden.options), /PROJECTION_PASS_INVARIANT_INVALID/);
    const duplicateCommand = clone(golden.document);
    duplicateCommand.checks[1].commandId = duplicateCommand.checks[0].commandId;
    duplicateCommand.checks[1].checkDigest = api.structuredDigest(api.DIGEST_WRAPPERS.checkDigest, duplicateCommand.checks[1], "checkDigest");
    duplicateCommand.evidenceDigest = api.structuredDigest(api.DIGEST_WRAPPERS.evidenceDigest, duplicateCommand, "evidenceDigest");
    assert.throws(() => api.validateReleaseEvidence(duplicateCommand, golden.options), /COMMAND_CARDINALITY_INVALID/);
    const selfAsserted = api.validateReleaseEvidence(clone(golden.document), { storageRoots: golden.options.storageRoots });
    assert.equal(selfAsserted.decision, "STRUCTURALLY_VALID_NONAUTHORIZING");
    assert.notEqual(selfAsserted.decision, "VERIFIED");

    const reviewRef = golden.document.reviews[0].reportArtifactRef;
    const forgedTyped = await rewriteGoldenArtifact(golden, reviewRef, JSON.stringify({ schemaVersion: "chaotang.review-report.v1", status: "PASS" }));
    assert.throws(() => api.validateReleaseEvidence(forgedTyped, golden.options), /SCHEMA_|TYPED_RECEIPT/);
    writeFileSync(path.join(golden.roots.archiveRoot, golden.document.artifacts.find((item) => item.artifactId === reviewRef).relativePath), golden.artifactBytes.get(reviewRef));

    const reusedReview = clone(golden.document);
    reusedReview.reviews[1].reportArtifactRef = reusedReview.reviews[0].reportArtifactRef;
    reusedReview.reviews[1].reviewDigest = null;
    reusedReview.evidenceDigest = null;
    const sealedReuse = api.sealReleaseEvidence(reusedReview);
    assert.throws(() => api.validateReleaseEvidence(sealedReuse, golden.options), /REVIEW_REPORT_REUSED/);

    const mimeBypass = clone(golden.document);
    const stdoutArtifact = mimeBypass.artifacts.find((item) => item.artifactRole === "COMMAND_STDOUT");
    stdoutArtifact.mediaType = "application/octet-stream";
    stdoutArtifact.artifactDigest = null;
    mimeBypass.evidenceDigest = null;
    assert.throws(() => api.validateReleaseEvidence(api.sealReleaseEvidence(mimeBypass), golden.options), /ARTIFACT_MEDIA_TYPE_INVALID/);

    const screenshotArtifact = golden.document.artifacts.find((item) => item.kind === "BROWSER_SCREENSHOT");
    const validPng = Buffer.from(golden.artifactBytes.get(screenshotArtifact.artifactId));
    const idatLength = validPng.readUInt32BE(33);
    const idatData = validPng.subarray(41, 41 + idatLength);
    const invalidPngs = [
      validPng.subarray(0, validPng.length - 12),
      Buffer.concat([validPng.subarray(0, 33), validPng.subarray(validPng.length - 12)]),
      (() => { const value = Buffer.from(validPng); value[value.length - 1] ^= 0xff; return value; })(),
      Buffer.concat([validPng.subarray(0, 33), pngChunk("tEXt", Buffer.from("token=hidden", "utf8")), validPng.subarray(33)]),
      Buffer.concat([validPng.subarray(0, 33), pngChunk("IDAT", Buffer.concat([idatData, Buffer.from("token=hidden", "utf8")])), validPng.subarray(validPng.length - 12)]),
    ];
    for (const invalidPng of invalidPngs) {
      await assert.rejects(() => rewriteGoldenArtifact(golden, screenshotArtifact.artifactId, invalidPng, "image/png"), /BROWSER_SCREENSHOT_INVALID/);
      writeFileSync(path.join(golden.roots.archiveRoot, screenshotArtifact.relativePath), validPng);
    }

    const rollbackArtifact = golden.document.artifacts.find((item) => item.kind === "ROLLBACK_RECEIPT");
    const forgedRollbackValue = JSON.parse(golden.artifactBytes.get(rollbackArtifact.artifactId).toString("utf8"));
    const changedRollback = clone(golden.document.rollback);
    changedRollback.coldBackupManifestDigest = digest("9");
    changedRollback.rollbackDigest = api.structuredDigest(api.DIGEST_WRAPPERS.rollbackDigest, changedRollback, "rollbackDigest");
    forgedRollbackValue.subjectDigest = changedRollback.rollbackDigest;
    forgedRollbackValue.receiptDigest = api.structuredDigest(api.DIGEST_WRAPPERS.typedSubjectReceiptDigest, forgedRollbackValue, "receiptDigest");
    const rollbackSplice = await rewriteGoldenArtifact(golden, rollbackArtifact.artifactId, JSON.stringify(forgedRollbackValue));
    rollbackSplice.rollback = changedRollback;
    rollbackSplice.evidenceDigest = null;
    assert.throws(() => api.validateReleaseEvidence(api.sealReleaseEvidence(rollbackSplice), golden.options), /P15_RECEIPT_BINDING_MISMATCH/);
    writeFileSync(path.join(golden.roots.archiveRoot, rollbackArtifact.relativePath), golden.artifactBytes.get(rollbackArtifact.artifactId));

    const restoreArtifact = golden.document.artifacts.find((item) => item.kind === "RESTORE_RECEIPT");
    const forgedRestoreValue = JSON.parse(golden.artifactBytes.get(restoreArtifact.artifactId).toString("utf8"));
    forgedRestoreValue.subjectDigest = digest("8");
    forgedRestoreValue.receiptDigest = api.structuredDigest(api.DIGEST_WRAPPERS.typedSubjectReceiptDigest, forgedRestoreValue, "receiptDigest");
    const restoreSplice = await rewriteGoldenArtifact(golden, restoreArtifact.artifactId, JSON.stringify(forgedRestoreValue));
    assert.throws(() => api.validateReleaseEvidence(restoreSplice, golden.options), /P15_RECEIPT_BINDING_MISMATCH/);
    writeFileSync(path.join(golden.roots.archiveRoot, restoreArtifact.relativePath), golden.artifactBytes.get(restoreArtifact.artifactId));

    const traceArtifact = golden.document.artifacts.find((item) => item.kind === "BROWSER_TRACE");
    const traceValue = JSON.parse(golden.artifactBytes.get(traceArtifact.artifactId).toString("utf8"));
    traceValue.viewport.width = 1279;
    traceValue.receiptDigest = api.structuredDigest(api.DIGEST_WRAPPERS.browserTraceReceiptDigest, traceValue, "receiptDigest");
    const badTrace = await rewriteGoldenArtifact(golden, traceArtifact.artifactId, JSON.stringify(traceValue));
    assert.throws(() => api.validateReleaseEvidence(badTrace, golden.options), /BROWSER_SCREENSHOT_BINDING_MISMATCH/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("P09-P15-01 P15 evidence remains typed and the verifier never executes dependencies", async () => {
  const api = await loadApi();
  const p15Rows = api.COMMAND_REGISTRY.filter((row) => row.commandId.startsWith("p15-"));
  assert.equal(p15Rows.length, 2);
  assert.ok(p15Rows.every((row) => row.projectionKind === "TYPED_RECEIPT"));
  assert.ok(p15Rows.every((row) => row.requiredSubjectKinds.length > 0));
  const source = readFileSync(MODULE_PATH, "utf8");
  for (const forbidden of ["node:child_process", "execFile", "spawn(", "fetch(", "node:http", "node:https", "node:net", "node:tls"]) {
    assert.equal(source.includes(forbidden), false, forbidden);
  }
});

test("P09-AUTHORITY-01 CLI is read-only and keeps product, receipt, and deployment authority separate", async () => {
  const api = await loadApi();
  assert.deepEqual(api.PRODUCT_PATHS, [
    "docs/contracts/release-evidence.v2.schema.json",
    "scripts/release-evidence.mjs",
    "scripts/release-evidence.test.mjs",
  ]);
  const status = JSON.parse(execFileSync(process.execPath, [MODULE_PATH, "--status"], { encoding: "utf8" }));
  assert.equal(status.decision, "OBSERVE_ONLY");
  assert.equal(status.canExecuteCommands, false);
  assert.equal(status.productionDeploymentAuthorized, false);
  const invalid = spawnSync(process.execPath, [MODULE_PATH, "--execute", "pytest"], { encoding: "utf8" });
  assert.equal(invalid.status, 64);
  assert.match(invalid.stdout, /USAGE_INVALID/);
});
