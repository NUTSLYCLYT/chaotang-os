import { createHash } from "node:crypto";
import { inflateSync } from "node:zlib";
import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  openSync,
  readSync,
  readdirSync,
  realpathSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  canonicalizeRfc8785,
  digestBytes,
  parseJsonNoDuplicateKeys,
} from "./execution_authority_ext.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = path.resolve(SCRIPT_DIR, "..");
const SCHEMA_PATH = path.join(REPOSITORY_ROOT, "docs/contracts/release-evidence.v2.schema.json");
const REMOTE_URL = "git@gitee.com:msxn/chaotang-os.git";
const ARCHIVE_EXTENSIONS = new Set([".7z", ".bz2", ".gz", ".rar", ".tar", ".tgz", ".xz", ".zip"]);
const DIGEST_RE = /^sha256:[0-9a-f]{64}$/u;
const GIT_RE = /^[0-9a-f]{40}$/u;
const TIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/u;
const BATCH1_JOURNEY_ACTIONS = [
  "REGISTER_LOGIN",
  "DRAFT_DECREE",
  "ACCEPT_DECREE",
  "POLL_JOB",
  "VERIFY_SHIGUAN_REPLY",
  "VERIFY_XLSX_WORK_PRODUCT",
  "CONFIRM_WORK_PRODUCT",
  "DOWNLOAD_AND_HASH",
  "VERIFY_CROSS_OWNER_404",
];
const REQUIRED_REVIEW_ROLES = ["browser-ui", "code", "javascript", "release-operations", "security"];
const TEXT_ARTIFACT_KINDS = new Set(["COMMAND_OUTPUT", "REDACTION_RECEIPT", "RESULT_RECEIPT", "TEST_LOG", "BROWSER_TRACE", "BACKUP_MANIFEST", "RESTORE_RECEIPT", "RELEASE_MANIFEST", "BUNDLE_VERIFY_RECEIPT", "HARNESS_RESULT", "REVIEW_REPORT", "ROLLBACK_RECEIPT"]);
const TYPED_SUBJECT_KINDS = new Set(["BACKUP_MANIFEST", "RESTORE_RECEIPT", "RELEASE_MANIFEST", "BUNDLE_VERIFY_RECEIPT", "REVIEW_REPORT", "ROLLBACK_RECEIPT", "RESULT_RECEIPT"]);
const SECRET_PATTERNS = [
  /authorization\s*:\s*bearer\s+\S+/iu,
  /(?:^|[?&;\s])cookie\s*=/iu,
  /(?:api[_-]?key|api[_-]?token|access[_-]?token|token|password|private[_-]?key)\s*[:=]/iu,
  /(?:-----)?BEGIN [A-Z ]*PRIVATE KEY(?:-----)?/u,
  /(?:^|[\s"'])\/home\/[A-Za-z0-9._-]+\//u,
  /(?:^|[\s"'])[A-Za-z]:\\Users\\/u,
];

export class ReleaseEvidenceError extends Error {
  constructor(code, detail = undefined) {
    super(detail ? `${code}: ${detail}` : code);
    this.name = "ReleaseEvidenceError";
    this.code = code;
  }
}

function fail(code, detail) {
  throw new ReleaseEvidenceError(code, detail);
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

function clone(value) {
  return structuredClone(value);
}

function readBoundedFile(filePath, maximumBytes, code = "INPUT_FILE_INVALID") {
  const pathStat = lstatSync(filePath);
  if (!pathStat.isFile() || pathStat.isSymbolicLink() || pathStat.nlink !== 1 || pathStat.size > maximumBytes) fail(code);
  const descriptor = openSync(filePath, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const before = fstatSync(descriptor);
    if (!before.isFile() || before.dev !== pathStat.dev || before.ino !== pathStat.ino || before.size !== pathStat.size || before.size > maximumBytes) fail(code);
    const buffer = Buffer.alloc(before.size);
    let offset = 0;
    while (offset < buffer.length) {
      const count = readSync(descriptor, buffer, offset, buffer.length - offset, offset);
      if (count === 0) fail(code);
      offset += count;
    }
    const after = fstatSync(descriptor);
    if (after.dev !== before.dev || after.ino !== before.ino || after.size !== before.size || after.mtimeMs !== before.mtimeMs) fail(code);
    return buffer;
  } finally {
    closeSync(descriptor);
  }
}

function parseStrict(input, { enforceEnvelopeLimits = true } = {}) {
  let text;
  if (Buffer.isBuffer(input) || input instanceof Uint8Array) {
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(input);
    } catch {
      fail("INVALID_UTF8");
    }
  } else if (typeof input === "string") {
    text = input;
  } else {
    fail("INVALID_JSON", "input must be UTF-8 text or bytes");
  }
  if (enforceEnvelopeLimits && Buffer.byteLength(text, "utf8") > LIMITS.envelopeBytes) {
    fail("JSON_BUDGET_EXCEEDED", "envelopeBytes");
  }
  let value;
  try {
    value = parseJsonNoDuplicateKeys(text);
  } catch (error) {
    const code = error?.code === "DUPLICATE_JSON_KEY" || String(error?.message).includes("DUPLICATE_JSON_KEY")
      ? "DUPLICATE_JSON_KEY"
      : "INVALID_JSON";
    fail(code);
  }
  if (enforceEnvelopeLimits) assertJsonBudget(value);
  return value;
}

function assertJsonBudget(root) {
  const work = [{ value: root, depth: 1 }];
  let nodes = 0;
  while (work.length) {
    const current = work.pop();
    nodes += 1;
    if (nodes > LIMITS.jsonNodes || current.depth > LIMITS.jsonDepth) fail("JSON_BUDGET_EXCEEDED");
    if (Array.isArray(current.value)) {
      for (const value of current.value) work.push({ value, depth: current.depth + 1 });
    } else if (current.value && typeof current.value === "object") {
      for (const value of Object.values(current.value)) work.push({ value, depth: current.depth + 1 });
    }
  }
}

const SCHEMA_TEXT = readBoundedFile(SCHEMA_PATH, 1024 * 1024, "SCHEMA_FILE_INVALID").toString("utf8");
const SCHEMA = deepFreeze(parseStrict(SCHEMA_TEXT, { enforceEnvelopeLimits: false }));

export const SCHEMA_VERSION = "chaotang.release-evidence.v2";
export const REPOSITORY_ID = "gitee.com/msxn/chaotang-os";
export const TARGET_REF = "origin/ext-dev";
export const TARGET_REMOTE_URL_DIGEST = digestBytes(Buffer.from(REMOTE_URL, "utf8"));
export const TOP_LEVEL_FIELDS = deepFreeze([...SCHEMA.required]);
export const LIMITS = deepFreeze(clone(SCHEMA["x-chaotang-limits"]));
export const DIGEST_WRAPPERS = deepFreeze(clone(SCHEMA["x-chaotang-digestWrappers"]));
export const BLOCKED_SOURCE_IDS = deepFreeze([...SCHEMA["x-chaotang-blockedSourceIds"]]);
export const BLOCKED_SOURCE_ROOTS = deepFreeze([...SCHEMA["x-chaotang-blockedSourceRoots"]].map((item) => path.resolve(item)));
export const COMMAND_REGISTRY = deepFreeze(
  clone(SCHEMA["x-chaotang-commandRegistry"]).sort((left, right) => left.commandId < right.commandId ? -1 : left.commandId > right.commandId ? 1 : 0),
);
export const PRODUCT_PATHS = deepFreeze([
  "docs/contracts/release-evidence.v2.schema.json",
  "scripts/release-evidence.mjs",
  "scripts/release-evidence.test.mjs",
]);

export function parseReleaseEvidence(input, { envelope = true } = {}) {
  return parseStrict(input, { enforceEnvelopeLimits: envelope });
}

export function structuredDigest(schemaVersion, value, selfField = undefined) {
  const normalized = clone(value);
  if (selfField && normalized && typeof normalized === "object" && !Array.isArray(normalized)) delete normalized[selfField];
  return digestBytes(Buffer.from(canonicalizeRfc8785({ schemaVersion, value: normalized }), "utf8"));
}

export function contractDigest() {
  return digestBytes(Buffer.from(canonicalizeRfc8785(SCHEMA), "utf8"));
}

export function commandRegistryDigest() {
  return structuredDigest(DIGEST_WRAPPERS.commandRegistryDigest, COMMAND_REGISTRY);
}

function schemaAt(ref) {
  if (!ref.startsWith("#/$defs/")) fail("SCHEMA_INTERNAL_ERROR", ref);
  const result = SCHEMA.$defs[ref.slice("#/$defs/".length)];
  if (!result) fail("SCHEMA_INTERNAL_ERROR", ref);
  return result;
}

function typeMatches(value, type) {
  if (type === "null") return value === null;
  if (type === "array") return Array.isArray(value);
  if (type === "object") return value !== null && typeof value === "object" && !Array.isArray(value);
  if (type === "integer") return Number.isSafeInteger(value);
  if (type === "number") return typeof value === "number" && Number.isFinite(value);
  return typeof value === type;
}

function validateSchema(value, schema, pointer = "$") {
  if (schema.$ref) return validateSchema(value, schemaAt(schema.$ref), pointer);
  if (schema.oneOf) {
    const matched = schema.oneOf.filter((candidate) => {
      try { validateSchema(value, candidate, pointer); return true; } catch { return false; }
    });
    if (matched.length !== 1) fail("SCHEMA_TYPE_MISMATCH", pointer);
    return;
  }
  if (Object.hasOwn(schema, "const") && canonicalizeRfc8785(value) !== canonicalizeRfc8785(schema.const)) {
    fail("SCHEMA_CONST_MISMATCH", pointer);
  }
  if (schema.enum && !schema.enum.includes(value)) fail("SCHEMA_ENUM_MISMATCH", pointer);
  if (schema.type) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!types.some((type) => typeMatches(value, type))) fail("SCHEMA_TYPE_MISMATCH", pointer);
  }
  if (typeof value === "string") {
    if (schema.minLength !== undefined && value.length < schema.minLength) fail("SCHEMA_STRING_INVALID", pointer);
    if (schema.maxLength !== undefined && value.length > schema.maxLength) fail("SCHEMA_STRING_INVALID", pointer);
    if (schema.pattern && !(new RegExp(schema.pattern, "u")).test(value)) fail("SCHEMA_STRING_INVALID", pointer);
  }
  if (typeof value === "number") {
    if (schema.minimum !== undefined && value < schema.minimum) fail("SCHEMA_NUMBER_INVALID", pointer);
    if (schema.maximum !== undefined && value > schema.maximum) fail("SCHEMA_NUMBER_INVALID", pointer);
  }
  if (Array.isArray(value)) {
    if (schema.maxItems !== undefined && value.length > schema.maxItems) fail("SCHEMA_ARRAY_INVALID", pointer);
    if (schema.minItems !== undefined && value.length < schema.minItems) fail("SCHEMA_ARRAY_INVALID", pointer);
    if (schema.uniqueItems) {
      const keys = value.map((item) => canonicalizeRfc8785(item));
      if (new Set(keys).size !== keys.length) fail("SCHEMA_ARRAY_DUPLICATE", pointer);
    }
    if (schema.items) value.forEach((item, index) => validateSchema(item, schema.items, `${pointer}/${index}`));
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const properties = schema.properties ?? {};
    for (const required of schema.required ?? []) if (!Object.hasOwn(value, required)) fail("SCHEMA_MISSING_FIELD", `${pointer}/${required}`);
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) if (!Object.hasOwn(properties, key)) fail("SCHEMA_UNKNOWN_FIELD", `${pointer}/${key}`);
    }
    for (const [key, child] of Object.entries(value)) if (properties[key]) validateSchema(child, properties[key], `${pointer}/${key}`);
  }
}

function assertDigest(value, code = "DIGEST_INVALID") {
  if (!DIGEST_RE.test(value)) fail(code);
}

function assertGit(value) {
  if (!GIT_RE.test(value)) fail("GIT_IDENTITY_INVALID");
}

function assertTimestamp(value, code = "TIMESTAMP_INVALID") {
  if (!TIME_RE.test(value) || !Number.isFinite(Date.parse(value))) fail(code);
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\.(\d{6})Z$/u.exec(value);
  const parts = match.slice(1, 7).map(Number);
  const instant = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], parts[3], parts[4], parts[5], Number(match[7].slice(0, 3))));
  if (instant.getUTCFullYear() !== parts[0] || instant.getUTCMonth() + 1 !== parts[1] || instant.getUTCDate() !== parts[2] || instant.getUTCHours() !== parts[3] || instant.getUTCMinutes() !== parts[4] || instant.getUTCSeconds() !== parts[5]) fail(code);
}

function assertSortedUnique(values, code = "ORDER_OR_DUPLICATE_INVALID") {
  if (!Array.isArray(values)) fail(code);
  const sorted = [...values].sort();
  if (new Set(values).size !== values.length || values.some((value, index) => value !== sorted[index])) fail(code, JSON.stringify(values));
}

function assertExactDigest(value, wrapper, selfField, code) {
  const expected = structuredDigest(wrapper, value, selfField);
  if (value[selfField] !== expected) fail(code ?? "DIGEST_MISMATCH", selfField);
}

function mapUnique(values, key, code) {
  const result = new Map();
  for (const value of values) {
    const id = value[key];
    if (result.has(id)) fail(code);
    result.set(id, value);
  }
  return result;
}

function normalizeSet(values) {
  values.sort();
}

function sealSelf(value, field, wrapper) {
  value[field] = structuredDigest(wrapper, value, field);
}

export function sealReleaseEvidence(input) {
  const value = clone(input);
  for (const environment of value.environmentSet ?? []) sealSelf(environment, "environmentDigest", DIGEST_WRAPPERS.environmentDigest);
  for (const artifact of value.artifacts ?? []) sealSelf(artifact, "artifactDigest", DIGEST_WRAPPERS.artifactDigest);
  for (const check of value.checks ?? []) {
    if (check.resultProjection) sealSelf(check.resultProjection, "projectionDigest", DIGEST_WRAPPERS.projectionDigest);
    sealSelf(check, "checkDigest", DIGEST_WRAPPERS.checkDigest);
  }
  for (const journey of value.browserJourneys ?? []) sealSelf(journey, "journeyDigest", DIGEST_WRAPPERS.journeyDigest);
  for (const review of value.reviews ?? []) {
    review.findings?.sort((left, right) => left.findingId.localeCompare(right.findingId));
    sealSelf(review, "reviewDigest", DIGEST_WRAPPERS.reviewDigest);
  }
  sealSelf(value.rollback, "rollbackDigest", DIGEST_WRAPPERS.rollbackDigest);
  sealSelf(value.conclusion, "conclusionDigest", DIGEST_WRAPPERS.conclusionDigest);
  sealSelf(value, "evidenceDigest", DIGEST_WRAPPERS.evidenceDigest);
  return value;
}

export function isSafeRelativePath(value) {
  if (typeof value !== "string" || value.length === 0 || Buffer.byteLength(value, "utf8") > LIMITS.pathBytes) return false;
  if (value.includes("\\") || value.includes("\0") || /[\u0000-\u001f\u007f]/u.test(value)) return false;
  if (path.posix.isAbsolute(value) || /^[A-Za-z]:/u.test(value) || value.includes("//")) return false;
  const segments = value.split("/");
  return segments.length <= LIMITS.pathSegments && segments.every((segment) => segment !== "" && segment !== "." && segment !== "..");
}

export function assertPrivacySafe(value) {
  const work = [value];
  while (work.length) {
    const current = work.pop();
    if (typeof current === "string") {
      if (SECRET_PATTERNS.some((pattern) => pattern.test(current))) fail("PRIVACY_CANARY_FORBIDDEN");
    } else if (Array.isArray(current)) {
      work.push(...current);
    } else if (current && typeof current === "object") {
      work.push(...Object.values(current));
    }
  }
  return true;
}

function scanTextArtifact(filePath, artifact) {
  const pathStat = lstatSync(filePath);
  if (!pathStat.isFile() || pathStat.isSymbolicLink() || pathStat.nlink !== 1 || pathStat.size !== artifact.bytes) fail("ARTIFACT_CONTENT_MISMATCH", artifact.artifactId);
  const descriptor = openSync(filePath, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  const hasher = createHash("sha256");
  const decoder = new TextDecoder("utf-8", { fatal: true });
  const buffer = Buffer.allocUnsafe(64 * 1024);
  let carry = "";
  let bytes = 0;
  try {
    const before = fstatSync(descriptor);
    if (before.dev !== pathStat.dev || before.ino !== pathStat.ino || before.size !== pathStat.size) fail("ARTIFACT_CONTENT_MISMATCH", artifact.artifactId);
    for (;;) {
      const count = readSync(descriptor, buffer, 0, buffer.length, null);
      if (count === 0) break;
      bytes += count;
      hasher.update(buffer.subarray(0, count));
      let decoded;
      try { decoded = decoder.decode(buffer.subarray(0, count), { stream: true }); } catch { fail("ARTIFACT_TEXT_INVALID_UTF8", artifact.artifactId); }
      const window = `${carry}${decoded}`;
      if (SECRET_PATTERNS.some((pattern) => pattern.test(window))) fail("PRIVACY_CANARY_FORBIDDEN", artifact.artifactId);
      carry = window.slice(-512);
    }
    try { carry += decoder.decode(); } catch { fail("ARTIFACT_TEXT_INVALID_UTF8", artifact.artifactId); }
    if (SECRET_PATTERNS.some((pattern) => pattern.test(carry))) fail("PRIVACY_CANARY_FORBIDDEN", artifact.artifactId);
    const after = fstatSync(descriptor);
    if (after.dev !== before.dev || after.ino !== before.ino || after.size !== before.size || after.mtimeMs !== before.mtimeMs) fail("ARTIFACT_CONTENT_MISMATCH", artifact.artifactId);
  } finally {
    closeSync(descriptor);
  }
  if (bytes !== artifact.bytes || `sha256:${hasher.digest("hex")}` !== artifact.sha256) fail("ARTIFACT_CONTENT_MISMATCH", artifact.artifactId);
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

function parsePngDimensions(bytes, artifactId) {
  const invalid = () => fail("BROWSER_SCREENSHOT_INVALID", artifactId);
  if (bytes.length < 57 || bytes.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") invalid();
  let offset = 8;
  let width;
  let height;
  let sawIhdr = false;
  let sawIdat = false;
  let sawIend = false;
  const compressed = [];
  while (offset < bytes.length) {
    if (offset + 12 > bytes.length) invalid();
    const length = bytes.readUInt32BE(offset);
    const typeBytes = bytes.subarray(offset + 4, offset + 8);
    const type = typeBytes.toString("ascii");
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (dataEnd + 4 > bytes.length) invalid();
    const data = bytes.subarray(dataStart, dataEnd);
    if (bytes.readUInt32BE(dataEnd) !== crc32(Buffer.concat([typeBytes, data]))) invalid();
    if (!sawIhdr) {
      if (type !== "IHDR" || length !== 13) invalid();
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      if (width === 0 || height === 0 || data[8] !== 8 || data[9] !== 6 || data[10] !== 0 || data[11] !== 0 || data[12] !== 0) invalid();
      sawIhdr = true;
    } else if (type === "IDAT") {
      if (sawIend || length === 0) invalid();
      sawIdat = true;
      compressed.push(data);
    } else if (type === "IEND") {
      if (!sawIdat || sawIend || length !== 0) invalid();
      sawIend = true;
      offset = dataEnd + 4;
      if (offset !== bytes.length) invalid();
      break;
    } else {
      // Release evidence screenshots deliberately admit no metadata or optional
      // chunks: this keeps the structural verifier from archiving hidden text.
      invalid();
    }
    offset = dataEnd + 4;
  }
  if (!sawIhdr || !sawIdat || !sawIend) invalid();
  const expectedBytes = (width * 4 + 1) * height;
  if (!Number.isSafeInteger(expectedBytes) || expectedBytes > 256 * 1024 * 1024) invalid();
  let inflated;
  try {
    const compressedBytes = Buffer.concat(compressed);
    inflated = inflateSync(compressedBytes, { maxOutputLength: expectedBytes, info: true });
    if (inflated.engine.bytesWritten !== compressedBytes.length) invalid();
  } catch {
    invalid();
  }
  const pixels = inflated.buffer;
  if (pixels.length !== expectedBytes) invalid();
  const stride = width * 4 + 1;
  for (let row = 0; row < height; row += 1) if (pixels[row * stride] > 4) invalid();
  return { width, height };
}

function readVerifiedArtifactBytes(filePath, artifact, maximumBytes, code) {
  const bytes = readBoundedFile(filePath, maximumBytes, code);
  if (bytes.length !== artifact.bytes || digestBytes(bytes) !== artifact.sha256) fail("ARTIFACT_CONTENT_MISMATCH", artifact.artifactId);
  return bytes;
}

function parseTypedArtifact(filePath, artifact) {
  if (artifact.kind === "BROWSER_SCREENSHOT") {
    if (artifact.mediaType !== "image/png") fail("ARTIFACT_MEDIA_TYPE_INVALID", artifact.artifactId);
    return { kind: artifact.kind, ...parsePngDimensions(readVerifiedArtifactBytes(filePath, artifact, 64 * 1024 * 1024, "BROWSER_SCREENSHOT_INVALID"), artifact.artifactId) };
  }
  const bytes = readVerifiedArtifactBytes(filePath, artifact, LIMITS.resultProjectionBytes, "TYPED_RECEIPT_FILE_INVALID");
  const value = parseStrict(bytes, { enforceEnvelopeLimits: false });
  assertJsonBudget(value);
  assertPrivacySafe(value);
  if (artifact.kind === "BROWSER_TRACE") {
    validateSchema(value, SCHEMA.$defs.browserTraceReceipt, "browserTraceReceipt");
    assertExactDigest(value, DIGEST_WRAPPERS.browserTraceReceiptDigest, "receiptDigest", "TYPED_RECEIPT_DIGEST_MISMATCH");
  } else {
    validateSchema(value, SCHEMA.$defs.typedSubjectReceipt, "typedSubjectReceipt");
    if (value.artifactKind !== artifact.kind) fail("TYPED_RECEIPT_KIND_MISMATCH", artifact.artifactId);
    assertExactDigest(value, DIGEST_WRAPPERS.typedSubjectReceiptDigest, "receiptDigest", "TYPED_RECEIPT_DIGEST_MISMATCH");
  }
  return { kind: artifact.kind, value };
}

function validateArtifact(artifact, { storageById, candidate, checksById }) {
  validateSchema(artifact, SCHEMA.$defs.artifact, "artifact");
  if (!isSafeRelativePath(artifact.relativePath)) fail("ARTIFACT_PATH_INVALID");
  if (!storageById.has(artifact.storageId)) fail("ARTIFACT_STORAGE_UNKNOWN");
  if (!checksById.has(artifact.producerCheckId)) fail("ARTIFACT_PRODUCER_UNKNOWN");
  if (["COMMAND_STDOUT", "COMMAND_STDERR"].includes(artifact.artifactRole) && artifact.bytes > LIMITS.commandStreamBytes) fail("ARTIFACT_BUDGET_EXCEEDED");
  if (artifact.kind === "BROWSER_SCREENSHOT" && artifact.mediaType !== "image/png") fail("ARTIFACT_MEDIA_TYPE_INVALID");
  if (["COMMAND_OUTPUT", "TEST_LOG"].includes(artifact.kind) && artifact.mediaType !== "text/plain") fail("ARTIFACT_MEDIA_TYPE_INVALID");
  if (TEXT_ARTIFACT_KINDS.has(artifact.kind) && !["COMMAND_OUTPUT", "TEST_LOG"].includes(artifact.kind) && artifact.mediaType !== "application/json") fail("ARTIFACT_MEDIA_TYPE_INVALID");
  if (artifact.candidateCommit !== candidate.commit || artifact.candidateTree !== candidate.tree) fail("ARTIFACT_CANDIDATE_MISMATCH");
  assertTimestamp(artifact.createdAt);
  assertExactDigest(artifact, DIGEST_WRAPPERS.artifactDigest, "artifactDigest", "ARTIFACT_DIGEST_MISMATCH");
}

function artifactRole(artifactsById, ref, role, code = "CHECK_STREAM_EVIDENCE_INVALID") {
  const artifact = artifactsById.get(ref);
  if (!artifact || artifact.artifactRole !== role) fail(code);
  return artifact;
}

function validateResultProjection(projection, registry, artifactsById, checkStatus) {
  validateSchema(projection, SCHEMA.$defs.resultProjection, "resultProjection");
  if (projection.projectionKind !== registry.projectionKind) fail("PROJECTION_KIND_MISMATCH");
  assertSortedUnique(projection.subjectArtifactRefs);
  const countFields = ["collectedCount", "passedCount", "failedCount", "blockedCount", "notRunCount"];
  if (projection.projectionKind === "TEST_RUN") {
    assertDigest(projection.inventoryDigest, "PROJECTION_INVENTORY_INVALID");
    if (countFields.some((field) => !Number.isSafeInteger(projection[field]) || projection[field] < 0)) fail("PROJECTION_COUNTS_INVALID");
    if (projection.collectedCount !== projection.passedCount + projection.failedCount + projection.blockedCount + projection.notRunCount || projection.subjectArtifactRefs.length !== 0) fail("PROJECTION_COUNTS_INVALID");
    if (checkStatus === "PASS" && (projection.collectedCount === 0 || projection.passedCount !== projection.collectedCount || projection.failedCount !== 0 || projection.blockedCount !== 0 || projection.notRunCount !== 0)) fail("PROJECTION_PASS_INVARIANT_INVALID");
  } else {
    if (projection.inventoryDigest !== null || countFields.some((field) => projection[field] !== null)) fail("PROJECTION_COUNTS_INVALID");
    if (projection.projectionKind === "COMMAND_ONLY" && projection.subjectArtifactRefs.length !== 0) fail("PROJECTION_SUBJECT_INVALID");
    if (projection.projectionKind === "TYPED_RECEIPT") {
      if (projection.subjectArtifactRefs.length === 0) fail("PROJECTION_SUBJECT_INVALID");
      const subjectKinds = new Set();
      for (const ref of projection.subjectArtifactRefs) {
        const artifact = artifactsById.get(ref);
        if (!artifact || !registry.requiredSubjectKinds.includes(artifact.kind)) fail("PROJECTION_SUBJECT_INVALID");
        subjectKinds.add(artifact.kind);
      }
      if (registry.requiredSubjectKinds.some((kind) => !subjectKinds.has(kind))) fail("PROJECTION_SUBJECT_INVALID");
    }
  }
  if (Buffer.byteLength(canonicalizeRfc8785(projection), "utf8") > LIMITS.resultProjectionBytes) fail("PROJECTION_BUDGET_EXCEEDED");
  assertExactDigest(projection, DIGEST_WRAPPERS.projectionDigest, "projectionDigest", "PROJECTION_DIGEST_MISMATCH");
}

function validateRedactionReceipt(receipt, { check, streamRole, outputArtifact }) {
  validateSchema(receipt, SCHEMA.$defs.redactionReceipt, "redactionReceipt");
  if (receipt.producerCheckId !== check.checkId || receipt.streamRole !== streamRole || receipt.outputArtifactId !== outputArtifact.artifactId) fail("CHECK_REDACTION_RECEIPTS_INVALID");
  const expectedDigest = streamRole === "COMMAND_STDOUT" ? check.stdoutDigest : check.stderrDigest;
  const expectedBytes = streamRole === "COMMAND_STDOUT" ? check.stdoutBytes : check.stderrBytes;
  if (receipt.outputDigest !== expectedDigest || receipt.outputBytes !== expectedBytes || outputArtifact.sha256 !== expectedDigest || outputArtifact.bytes !== expectedBytes) fail("CHECK_REDACTION_RECEIPTS_INVALID");
  assertExactDigest(receipt, DIGEST_WRAPPERS.receiptDigest, "receiptDigest", "REDACTION_RECEIPT_DIGEST_MISMATCH");
  return receipt;
}

export function validateCheck(check, { artifactsById = new Map(), environmentsById = new Map(), receiptsByArtifactId = new Map(), resultReceiptsByArtifactId = new Map() } = {}) {
  validateSchema(check, SCHEMA.$defs.check, "check");
  const registry = COMMAND_REGISTRY.find((row) => row.commandId === check.commandId);
  if (!registry) fail("COMMAND_NOT_REGISTERED");
  const environment = environmentsById.get(check.environmentId);
  if (!environment) fail("COMMAND_ENVIRONMENT_UNKNOWN");
  if (["PASS", "FAIL"].includes(check.status) && environment && environment.class !== registry.requiredEnvironmentClass) fail("COMMAND_ENVIRONMENT_MISMATCH");
  assertSortedUnique(check.artifactRefs);
  assertSortedUnique(check.limitationCodes);
  if (["NOT_RUN", "BLOCKED"].includes(check.status)) {
    const nullable = ["startedAt", "completedAt", "exitCode", "stdoutDigest", "stdoutBytes", "stdoutArtifactRef", "stderrDigest", "stderrBytes", "stderrArtifactRef", "resultProjection", "stdoutRedactionReceiptRef", "stderrRedactionReceiptRef"];
    if (nullable.some((key) => check[key] !== null) || check.artifactRefs.length !== 0 || check.limitationCodes.length === 0) fail("CHECK_NOT_RUN_SHAPE_INVALID");
  } else {
    if (!check.startedAt || !check.completedAt || check.stdoutDigest === null || check.stdoutBytes === null || check.stdoutArtifactRef === null || check.stderrDigest === null || check.stderrBytes === null || check.stderrArtifactRef === null || check.resultProjection === null || check.stdoutRedactionReceiptRef === null || check.stderrRedactionReceiptRef === null) fail("CHECK_STREAM_EVIDENCE_INVALID");
    assertTimestamp(check.startedAt);
    assertTimestamp(check.completedAt);
    if (!Number.isSafeInteger(check.exitCode)) fail("CHECK_EXIT_INVALID");
    if ((check.status === "PASS") !== (check.exitCode === 0)) fail("CHECK_EXIT_INVALID");
    if (check.status === "PASS" && check.limitationCodes.length !== 0) fail("CHECK_LIMITATION_INVALID");
    for (const key of ["stdoutDigest", "stderrDigest"]) assertDigest(check[key]);
    for (const key of ["stdoutBytes", "stderrBytes"]) if (!Number.isSafeInteger(check[key]) || check[key] < 0 || check[key] > LIMITS.commandStreamBytes) fail("CHECK_STREAM_EVIDENCE_INVALID");
    if (!check.resultProjection) fail("CHECK_STREAM_EVIDENCE_INVALID");
    validateResultProjection(check.resultProjection, registry, artifactsById, check.status);
    const stdout = artifactRole(artifactsById, check.stdoutArtifactRef, "COMMAND_STDOUT");
    const stderr = artifactRole(artifactsById, check.stderrArtifactRef, "COMMAND_STDERR");
    if (stdout.sha256 !== check.stdoutDigest || stdout.bytes !== check.stdoutBytes || stderr.sha256 !== check.stderrDigest || stderr.bytes !== check.stderrBytes) fail("CHECK_STREAM_EVIDENCE_INVALID");
    const outReceipt = artifactRole(artifactsById, check.stdoutRedactionReceiptRef, "REDACTION");
    const errReceipt = artifactRole(artifactsById, check.stderrRedactionReceiptRef, "REDACTION");
    if (outReceipt.artifactId === errReceipt.artifactId) fail("CHECK_REDACTION_RECEIPTS_INVALID");
    const requiredRefs = [check.stdoutArtifactRef, check.stderrArtifactRef, check.stdoutRedactionReceiptRef, check.stderrRedactionReceiptRef];
    if (requiredRefs.some((ref) => !check.artifactRefs.includes(ref))) fail("CHECK_ARTIFACT_SET_INVALID");
    const roleCounts = new Map();
    const projectionArtifacts = [];
    for (const ref of check.artifactRefs) {
      const artifact = artifactsById.get(ref);
      if (!artifact) fail("CHECK_ARTIFACT_UNKNOWN");
      if (artifact.producerCheckId !== check.checkId) fail("CHECK_ARTIFACT_PRODUCER_MISMATCH");
      roleCounts.set(artifact.artifactRole, (roleCounts.get(artifact.artifactRole) ?? 0) + 1);
      if (artifact.artifactRole === "RESULT_PROJECTION") projectionArtifacts.push(artifact);
    }
    const expectedRoleCount = (role) => role === "REDACTION" ? 2 : 1;
    if (registry.requiredArtifactRoles.some((role) => roleCounts.get(role) !== expectedRoleCount(role))) fail("CHECK_ARTIFACT_SET_INVALID");
    if (["COMMAND_STDOUT", "COMMAND_STDERR", "REDACTION", "RESULT_PROJECTION"].some((role) => !registry.requiredArtifactRoles.includes(role) && (roleCounts.get(role) ?? 0) !== 0)) fail("CHECK_ARTIFACT_SET_INVALID");
    if (projectionArtifacts.length !== 1) fail("CHECK_ARTIFACT_SET_INVALID");
    const outValue = receiptsByArtifactId.get(outReceipt.artifactId);
    const errValue = receiptsByArtifactId.get(errReceipt.artifactId);
    if (!outValue || !errValue) fail("CHECK_REDACTION_RECEIPTS_INVALID");
    validateRedactionReceipt(outValue, { check, streamRole: "COMMAND_STDOUT", outputArtifact: stdout });
    validateRedactionReceipt(errValue, { check, streamRole: "COMMAND_STDERR", outputArtifact: stderr });
    const resultReceipt = resultReceiptsByArtifactId.get(projectionArtifacts[0].artifactId);
    if (!resultReceipt || canonicalizeRfc8785(resultReceipt) !== canonicalizeRfc8785(check.resultProjection)) fail("RESULT_PROJECTION_RECEIPT_MISMATCH");
  }
  assertExactDigest(check, DIGEST_WRAPPERS.checkDigest, "checkDigest", "CHECK_DIGEST_MISMATCH");
  return check;
}

export function validateBrowserJourney(journey, { artifactsById = new Map(), environmentsById = undefined, checksById = undefined, candidate = undefined } = {}) {
  try {
    validateSchema(journey, SCHEMA.$defs.journey, "journey");
  } catch (error) {
    if (error?.code === "SCHEMA_ENUM_MISMATCH" && String(error.message).includes("action")) fail("JOURNEY_ACTION_INVALID");
    throw error;
  }
  if (environmentsById && environmentsById.get(journey.environmentId)?.class !== "REAL_BROWSER") fail("JOURNEY_ENVIRONMENT_INVALID");
  if (candidate && (journey.frontendCommit !== candidate.commit || journey.backendCommit !== candidate.commit)) fail("JOURNEY_CANDIDATE_MISMATCH");
  assertSortedUnique(journey.artifactRefs);
  assertSortedUnique(journey.networkAssertions.map((item) => item.assertionId));
  assertSortedUnique(journey.consoleAssertions.map((item) => item.assertionId));
  const journeyArtifacts = journey.artifactRefs.map((ref) => artifactsById.get(ref));
  if (journeyArtifacts.some((artifact) => !artifact)) fail("JOURNEY_ARTIFACT_UNKNOWN");
  if (journey.status === "PASS" && (!journeyArtifacts.some((artifact) => artifact.kind === "BROWSER_SCREENSHOT") || !journeyArtifacts.some((artifact) => artifact.kind === "BROWSER_TRACE"))) fail("JOURNEY_ARTIFACT_BINDING_INVALID");
  const producerCheckIds = new Set(journeyArtifacts.map((artifact) => artifact.producerCheckId));
  if (journeyArtifacts.length > 0 && producerCheckIds.size !== 1) fail("JOURNEY_ARTIFACT_BINDING_INVALID");
  if (checksById && producerCheckIds.size === 1 && checksById.get([...producerCheckIds][0])?.commandId !== "batch1-real-browser-journey") fail("JOURNEY_ARTIFACT_BINDING_INVALID");
  const stepArtifactRefs = new Set();
  journey.steps.forEach((step, index) => {
    if (step.ordinal !== index + 1) fail("JOURNEY_STEP_ORDER_INVALID");
    assertSortedUnique(step.artifactRefs);
    for (const ref of step.artifactRefs) {
      if (!artifactsById.has(ref) || !journey.artifactRefs.includes(ref)) fail("JOURNEY_ARTIFACT_UNKNOWN");
      stepArtifactRefs.add(ref);
    }
  });
  if (journey.status === "PASS" && journeyArtifacts.some((artifact) => artifact.kind === "BROWSER_SCREENSHOT" && !stepArtifactRefs.has(artifact.artifactId))) fail("JOURNEY_ARTIFACT_BINDING_INVALID");
  const assertions = [...journey.networkAssertions, ...journey.consoleAssertions];
  if (assertions.some((item) => item.status === "PASS" && item.expectedDigest !== item.observedDigest)) fail("JOURNEY_ASSERTION_INVALID");
  if (journey.status === "PASS" && (journey.steps.some((item) => item.status !== "PASS") || assertions.some((item) => item.status !== "PASS"))) fail("JOURNEY_STATUS_INVALID");
  assertExactDigest(journey, DIGEST_WRAPPERS.journeyDigest, "journeyDigest", "JOURNEY_DIGEST_MISMATCH");
  return journey;
}

export function validateReview(review, { artifactsById = new Map(), candidate } = {}) {
  if (review.reviewerClass !== "INDEPENDENT_AGENT" && review.reviewerClass !== "HUMAN_OWNER") fail("REVIEWER_CLASS_INVALID");
  validateSchema(review, SCHEMA.$defs.review, "review");
  if (candidate && (review.candidateCommit !== candidate.commit || review.candidateTree !== candidate.tree)) fail("REVIEW_CANDIDATE_MISMATCH");
  const report = artifactsById.get(review.reportArtifactRef);
  if (!report || report.kind !== "REVIEW_REPORT") fail("REVIEW_REPORT_INVALID");
  assertSortedUnique(review.findings.map((finding) => finding.findingId));
  for (const finding of review.findings) {
    assertDigest(finding.descriptionDigest);
    assertSortedUnique(finding.evidenceRefs);
    for (const ref of finding.evidenceRefs) if (!artifactsById.has(ref)) fail("REVIEW_FINDING_EVIDENCE_INVALID");
    if (["P0", "P1", "P2"].includes(finding.priority) && (finding.state !== "CLOSED" || finding.disposition === "DEFERRED_P3")) fail("REVIEW_FINDING_DISPOSITION_INVALID");
    if (finding.disposition === "NOT_APPLICABLE_WITH_EVIDENCE" && finding.evidenceRefs.length === 0) fail("REVIEW_FINDING_EVIDENCE_INVALID");
  }
  if (review.verdict === "GO" && review.findings.some((finding) => finding.state === "OPEN" && ["P0", "P1", "P2"].includes(finding.priority))) fail("REVIEW_OPEN_FINDING");
  assertExactDigest(review, DIGEST_WRAPPERS.reviewDigest, "reviewDigest", "REVIEW_DIGEST_MISMATCH");
  return review;
}

export function validateRollback(rollback, { releaseMode, previousRelease = null, verified, artifactsById = new Map() } = {}) {
  validateSchema(rollback, SCHEMA.$defs.rollback, "rollback");
  if (releaseMode === "BOOTSTRAP") {
    if (previousRelease !== null || rollback.strategy !== "REMOVE_NEW_STACK_PRESERVE_DATA_AND_EVIDENCE" || rollback.previousReleaseId !== null || rollback.previousBundleDigest !== null) fail("ROLLBACK_BOOTSTRAP_SHAPE_INVALID");
  } else {
    if (!previousRelease || rollback.strategy !== "RESTORE_PREVIOUS_RELEASE" || rollback.previousReleaseId !== previousRelease.releaseId || rollback.previousBundleDigest !== previousRelease.bundleDigest || rollback.coldBackupManifestDigest !== previousRelease.coldBackupManifestDigest) fail("ROLLBACK_PREVIOUS_RELEASE_REQUIRED");
  }
  if (verified) {
    if (rollback.rollbackTestStatus !== "PASS" || rollback.compatibilityDecision !== "COMPATIBLE" || !rollback.coldBackupManifestDigest || !rollback.restoreRehearsalDigest || !rollback.rollbackReceiptRef) fail("ROLLBACK_EVIDENCE_INCOMPLETE");
    const receipt = artifactsById.get(rollback.rollbackReceiptRef);
    if (!receipt || receipt.kind !== "ROLLBACK_RECEIPT") fail("ROLLBACK_EVIDENCE_INCOMPLETE");
  }
  assertExactDigest(rollback, DIGEST_WRAPPERS.rollbackDigest, "rollbackDigest", "ROLLBACK_DIGEST_MISMATCH");
  return rollback;
}

function reasonCodesFor({ failed, notRun, blocked, journeyFailed, openFindings, deferredP3, reviewNoGo, rollbackReady }) {
  const codes = [];
  if (failed.length) codes.push("MANDATORY_CHECKS_FAILED");
  if (notRun.length) codes.push("MANDATORY_CHECKS_NOT_RUN");
  if (blocked.length) codes.push("MANDATORY_CHECKS_BLOCKED");
  if (journeyFailed) codes.push("REQUIRED_JOURNEYS_INCOMPLETE");
  if (openFindings.length) codes.push("OPEN_REVIEW_FINDINGS");
  if (deferredP3.length) codes.push("DEFERRED_P3_FINDINGS");
  if (reviewNoGo) codes.push("REVIEW_NO_GO");
  if (!rollbackReady && failed.length === 0 && notRun.length === 0 && blocked.length === 0 && !journeyFailed && openFindings.length === 0 && !reviewNoGo) codes.push("ROLLBACK_NOT_VERIFIED");
  return codes.sort();
}

function batch1JourneyReady(document) {
  if (document.browserJourneys.length !== 1) return false;
  const journey = document.browserJourneys[0];
  if (journey.status !== "PASS" || canonicalizeRfc8785(journey.steps.map((step) => step.action)) !== canonicalizeRfc8785(BATCH1_JOURNEY_ACTIONS)) return false;
  const networkKinds = new Set(journey.networkAssertions.filter((item) => item.status === "PASS").map((item) => item.kind));
  const consoleKinds = new Set(journey.consoleAssertions.filter((item) => item.status === "PASS").map((item) => item.kind));
  return ["REAL_BACKEND", "NO_ROUTE_INTERCEPTION", "NO_HIDDEN_FALLBACK", "OWNER_SCOPED_404"].every((kind) => networkKinds.has(kind))
    && ["NO_CONSOLE_ERRORS", "NO_NETWORK_ERRORS"].every((kind) => consoleKinds.has(kind));
}

export function deriveConclusion(document) {
  const mandatoryCheckIds = COMMAND_REGISTRY.filter((row) => row.requiredForProfiles.includes("BATCH1")).map((row) => row.commandId).sort();
  const mandatoryChecks = document.checks.filter((check) => mandatoryCheckIds.includes(check.commandId));
  const byStatus = (status) => mandatoryChecks.filter((check) => check.status === status).map((check) => check.checkId).sort();
  const passedCheckIds = byStatus("PASS");
  const failedCheckIds = byStatus("FAIL");
  const notRunCheckIds = byStatus("NOT_RUN");
  const blockedCheckIds = byStatus("BLOCKED");
  const requiredJourneyIds = document.browserJourneys.map((journey) => journey.journeyId).sort();
  const passedJourneyIds = document.browserJourneys.filter((journey) => journey.status === "PASS" && requiredJourneyIds.includes(journey.journeyId)).map((journey) => journey.journeyId).sort();
  const unresolvedFindingIds = document.reviews.flatMap((review) => review.findings).filter((finding) => finding.state === "OPEN" && ["P0", "P1", "P2"].includes(finding.priority)).map((finding) => finding.findingId).sort();
  const deferredP3 = document.reviews.flatMap((review) => review.findings).filter((finding) => finding.priority === "P3" && finding.disposition === "DEFERRED_P3").map((finding) => finding.findingId).sort();
  const reviewNoGo = document.reviews.some((review) => review.verdict === "NO_GO");
  const commandCardinalityValid = mandatoryCheckIds.every((id) => mandatoryChecks.filter((check) => check.commandId === id).length === 1);
  const allCommandsPassed = commandCardinalityValid && mandatoryCheckIds.every((id) => mandatoryChecks.find((check) => check.commandId === id)?.status === "PASS");
  const journeysComplete = batch1JourneyReady(document);
  const reviewRoles = new Set(document.reviews.filter((review) => review.verdict === "GO").map((review) => review.role));
  const reviewsComplete = REQUIRED_REVIEW_ROLES.every((role) => reviewRoles.has(role));
  const rollbackReady = document.rollback.rollbackTestStatus === "PASS" && document.rollback.compatibilityDecision === "COMPATIBLE";
  const releaseEvidenceComplete = allCommandsPassed && journeysComplete && reviewsComplete && unresolvedFindingIds.length === 0 && !reviewNoGo && rollbackReady;
  const rejected = failedCheckIds.length > 0 || document.browserJourneys.some((journey) => requiredJourneyIds.includes(journey.journeyId) && journey.status === "FAIL") || unresolvedFindingIds.length > 0 || reviewNoGo;
  return {
    status: releaseEvidenceComplete ? "VERIFIED" : rejected ? "REJECTED" : "INCOMPLETE",
    mandatoryCheckIds,
    passedCheckIds,
    failedCheckIds,
    notRunCheckIds,
    blockedCheckIds,
    requiredJourneyIds,
    passedJourneyIds,
    unresolvedFindingIds,
    releaseEvidenceComplete,
    businessSuccessMeasured: false,
    reasonCodes: reasonCodesFor({
      failed: failedCheckIds,
      notRun: notRunCheckIds,
      blocked: blockedCheckIds,
      journeyFailed: allCommandsPassed && (!journeysComplete || !reviewsComplete),
      openFindings: unresolvedFindingIds,
      deferredP3,
      reviewNoGo,
      rollbackReady,
    }),
  };
}

function equalWithoutDigest(actual, expected, digestField) {
  const copy = clone(actual);
  delete copy[digestField];
  return canonicalizeRfc8785(copy) === canonicalizeRfc8785(expected);
}

function isWithinRoot(candidate, root) {
  return candidate === root || candidate.startsWith(`${root}${path.sep}`);
}

function assertStorageSourceLabelAndLexicalPath(mapping, storageId) {
  if (BLOCKED_SOURCE_IDS.includes(mapping.sourceId)) fail("BLOCKED_SOURCE_FORBIDDEN", mapping.sourceId);
  if (mapping.sourceId !== undefined && typeof mapping.sourceId !== "string") fail("STORAGE_MAPPING_INVALID", storageId);
  if (typeof mapping.path !== "string") fail("STORAGE_MAPPING_INVALID", storageId);
  const lexicalPath = path.resolve(mapping.path);
  if (BLOCKED_SOURCE_ROOTS.some((root) => isWithinRoot(lexicalPath, root))) fail("BLOCKED_SOURCE_FORBIDDEN", lexicalPath);
  return lexicalPath;
}

function assertStorageSourceAllowed(mapping, storageId) {
  assertStorageSourceLabelAndLexicalPath(mapping, storageId);
  const pathStat = lstatSync(mapping.path);
  if (pathStat.isSymbolicLink()) fail("STORAGE_MAPPING_INVALID", storageId);
  const canonicalPath = realpathSync(mapping.path);
  if (BLOCKED_SOURCE_ROOTS.some((root) => isWithinRoot(canonicalPath, root))) fail("BLOCKED_SOURCE_FORBIDDEN", canonicalPath);
  return { pathStat, canonicalPath };
}

function observeStorageMappings(document, storageById, artifactsById, options) {
  const roots = options.storageRoots ?? new Map();
  const receiptsByArtifactId = new Map();
  const resultReceiptsByArtifactId = new Map();
  const typedSubjectsByArtifactId = new Map();
  let evidenceArchiveCount = 0;
  const observedArtifactIds = new Set();
  for (const storage of document.storageSet) {
    const mapping = roots.get(storage.storageId);
    if (!mapping) {
      if (document.conclusion.status === "VERIFIED") fail("STORAGE_MAPPING_REQUIRED", storage.storageId);
      continue;
    }
    if (mapping.sourceId !== undefined && typeof mapping.sourceId !== "string") fail("STORAGE_MAPPING_INVALID", storage.storageId);
    if (options.observeDirectory && !options.testOnly) fail("OBSERVER_OVERRIDE_FORBIDDEN");
    const { pathStat, canonicalPath } = assertStorageSourceAllowed(mapping, storage.storageId);
    let observed;
    if (pathStat.isDirectory() && !pathStat.isSymbolicLink()) {
      const observer = options.observeDirectory ?? observeEvidenceArchive;
      observed = observer(mapping.path, { storageId: storage.storageId, allowContainers: storage.kind !== "EVIDENCE_ARCHIVE" });
    } else if (pathStat.isFile() && !pathStat.isSymbolicLink() && pathStat.nlink === 1) {
      const file = hashFile(mapping.path, pathStat, LIMITS.archiveEntryBytes);
      const entries = [{ relativePath: "payload", bytes: file.bytes, sha256: file.sha256 }];
      const base = { schemaVersion: "chaotang.evidence-archive-manifest.v1", storageId: storage.storageId, entries, totalBytes: file.bytes };
      observed = {
        ...base,
        manifestDigest: structuredDigest("chaotang.evidence-archive-manifest-digest.v1", base),
        contentDigest: structuredDigest("chaotang.evidence-archive-content-digest.v1", entries),
      };
    } else {
      fail("STORAGE_MAPPING_INVALID", storage.storageId);
    }
    if (observed.manifestDigest !== storage.manifestDigest || observed.contentDigest !== storage.contentDigest || observed.totalBytes !== storage.bytes) fail("STORAGE_DESCRIPTOR_MISMATCH", storage.storageId);
    if (storage.kind !== "EVIDENCE_ARCHIVE") continue;
    evidenceArchiveCount += 1;
    const entries = new Map(observed.entries.map((entry) => [entry.relativePath, entry]));
    const storageArtifacts = document.artifacts.filter((item) => item.storageId === storage.storageId);
    const declaredPaths = storageArtifacts.map((item) => item.relativePath).sort(compareUtf8);
    if (new Set(declaredPaths).size !== declaredPaths.length || canonicalizeRfc8785(declaredPaths) !== canonicalizeRfc8785(observed.entries.map((entry) => entry.relativePath))) fail("ARCHIVE_ENTRY_SET_MISMATCH", storage.storageId);
    for (const artifact of storageArtifacts) {
      const entry = entries.get(artifact.relativePath);
      if (!entry || entry.sha256 !== artifact.sha256 || entry.bytes !== artifact.bytes) fail("ARTIFACT_CONTENT_MISMATCH", artifact.artifactId);
      observedArtifactIds.add(artifact.artifactId);
      const artifactPath = path.join(canonicalPath, ...artifact.relativePath.split("/"));
      if (TEXT_ARTIFACT_KINDS.has(artifact.kind) || /^(?:text\/|application\/(?:json|xml|javascript))/u.test(artifact.mediaType)) scanTextArtifact(artifactPath, artifact);
      if (artifact.kind === "REDACTION_RECEIPT") {
        if (artifact.bytes > LIMITS.redactionReceiptBytes) fail("REDACTION_RECEIPT_BUDGET_EXCEEDED");
        const receiptPath = path.join(realpathSync(mapping.path), ...artifact.relativePath.split("/"));
        const receiptBytes = readBoundedFile(receiptPath, LIMITS.redactionReceiptBytes, "REDACTION_RECEIPT_FILE_INVALID");
        if (receiptBytes.length !== artifact.bytes || digestBytes(receiptBytes) !== artifact.sha256) fail("ARTIFACT_CONTENT_MISMATCH", artifact.artifactId);
        const receipt = parseStrict(receiptBytes, { enforceEnvelopeLimits: false });
        assertJsonBudget(receipt);
        assertPrivacySafe(receipt);
        receiptsByArtifactId.set(artifact.artifactId, receipt);
      }
      if (artifact.kind === "RESULT_RECEIPT" && artifact.artifactRole === "RESULT_PROJECTION") {
        if (artifact.bytes > LIMITS.resultProjectionBytes) fail("RESULT_RECEIPT_BUDGET_EXCEEDED");
        const resultPath = path.join(realpathSync(mapping.path), ...artifact.relativePath.split("/"));
        const resultBytes = readBoundedFile(resultPath, LIMITS.resultProjectionBytes, "RESULT_RECEIPT_FILE_INVALID");
        if (resultBytes.length !== artifact.bytes || digestBytes(resultBytes) !== artifact.sha256) fail("ARTIFACT_CONTENT_MISMATCH", artifact.artifactId);
        const receipt = parseStrict(resultBytes, { enforceEnvelopeLimits: false });
        assertJsonBudget(receipt);
        assertPrivacySafe(receipt);
        resultReceiptsByArtifactId.set(artifact.artifactId, receipt);
      }
      if (artifact.artifactRole === "SUPPORTING" && (artifact.kind === "BROWSER_SCREENSHOT" || artifact.kind === "BROWSER_TRACE" || TYPED_SUBJECT_KINDS.has(artifact.kind))) {
        typedSubjectsByArtifactId.set(artifact.artifactId, parseTypedArtifact(artifactPath, artifact));
      }
    }
  }
  if (document.conclusion.status === "VERIFIED" && evidenceArchiveCount === 0) fail("EVIDENCE_ARCHIVE_REQUIRED");
  if (document.conclusion.status === "VERIFIED") {
    const requiredKinds = ["TEST_LOG", "BROWSER_SCREENSHOT", "BROWSER_TRACE", "REVIEW_REPORT"];
    if (requiredKinds.some((kind) => !document.artifacts.some((artifact) => artifact.kind === kind && observedArtifactIds.has(artifact.artifactId)))) fail("EVIDENCE_KIND_COVERAGE_INCOMPLETE");
    if (document.artifacts.some((artifact) => storageById.get(artifact.storageId)?.kind === "EVIDENCE_ARCHIVE" && !observedArtifactIds.has(artifact.artifactId))) fail("ARTIFACT_NOT_OBSERVED");
  }
  for (const storageId of roots.keys()) if (!storageById.has(storageId)) fail("STORAGE_MAPPING_UNKNOWN", storageId);
  for (const artifactId of receiptsByArtifactId.keys()) if (!artifactsById.has(artifactId)) fail("ARTIFACT_ID_UNKNOWN", artifactId);
  return { receiptsByArtifactId, resultReceiptsByArtifactId, typedSubjectsByArtifactId };
}

function validateTypedSubjects(document, { artifactsById, storageById, typedSubjectsByArtifactId }) {
  const typedRefs = new Set(document.checks.flatMap((check) => check.resultProjection?.projectionKind === "TYPED_RECEIPT" ? check.resultProjection.subjectArtifactRefs : []));
  for (const ref of typedRefs) if (!typedSubjectsByArtifactId.has(ref)) fail("TYPED_RECEIPT_MISSING", ref);
  const commonReceipt = (artifactId) => {
    const artifact = artifactsById.get(artifactId);
    const observed = typedSubjectsByArtifactId.get(artifactId);
    if (!artifact || !observed?.value) fail("TYPED_RECEIPT_MISSING", artifactId);
    const value = observed.value;
    if (value.producerCheckId !== artifact.producerCheckId || value.releaseId !== document.releaseId || value.candidateCommit !== document.candidate.commit || value.candidateTree !== document.candidate.tree) fail("TYPED_RECEIPT_BINDING_MISMATCH", artifactId);
    assertSortedUnique(value.relatedArtifactRefs);
    for (const ref of value.relatedArtifactRefs) if (!artifactsById.has(ref)) fail("TYPED_RECEIPT_BINDING_MISMATCH", artifactId);
    return value;
  };

  for (const check of document.checks.filter((item) => item.resultProjection?.projectionKind === "TYPED_RECEIPT")) {
    for (const artifactId of check.resultProjection.subjectArtifactRefs) {
      const artifact = artifactsById.get(artifactId);
      if (!artifact || artifact.producerCheckId !== check.checkId) fail("TYPED_RECEIPT_BINDING_MISMATCH", artifactId);
    }
  }

  for (const journey of document.browserJourneys) {
    const screenshotRefs = journey.artifactRefs.filter((ref) => artifactsById.get(ref)?.kind === "BROWSER_SCREENSHOT").sort();
    const traceRefs = journey.artifactRefs.filter((ref) => artifactsById.get(ref)?.kind === "BROWSER_TRACE").sort();
    if (journey.status === "PASS" && (screenshotRefs.length === 0 || traceRefs.length !== 1)) fail("JOURNEY_ARTIFACT_BINDING_INVALID");
    if (traceRefs.length === 1) {
      const trace = typedSubjectsByArtifactId.get(traceRefs[0])?.value;
      if (!trace || trace.producerCheckId !== artifactsById.get(traceRefs[0]).producerCheckId || trace.releaseId !== document.releaseId || trace.candidateCommit !== document.candidate.commit || trace.candidateTree !== document.candidate.tree || trace.journeyId !== journey.journeyId || trace.journeyDigest !== journey.journeyDigest || canonicalizeRfc8785(trace.screenshotRefs) !== canonicalizeRfc8785(screenshotRefs)) fail("BROWSER_TRACE_BINDING_MISMATCH");
      const routeDigests = [...new Set(journey.steps.map((step) => step.routeDigest))].sort();
      if (canonicalizeRfc8785(trace.stepRouteDigests) !== canonicalizeRfc8785(routeDigests)) fail("BROWSER_TRACE_BINDING_MISMATCH");
      const networkDigest = structuredDigest("chaotang.browser-network-assertions-digest.v1", journey.networkAssertions);
      const consoleDigest = structuredDigest("chaotang.browser-console-assertions-digest.v1", journey.consoleAssertions);
      if (trace.networkAssertionDigest !== networkDigest || trace.consoleAssertionDigest !== consoleDigest) fail("BROWSER_TRACE_BINDING_MISMATCH");
      for (const screenshotRef of screenshotRefs) {
        const screenshot = typedSubjectsByArtifactId.get(screenshotRef);
        if (!screenshot || screenshot.width !== trace.viewport.width * trace.viewport.deviceScaleFactor || screenshot.height !== trace.viewport.height * trace.viewport.deviceScaleFactor) fail("BROWSER_SCREENSHOT_BINDING_MISMATCH");
      }
    }
  }

  const reviewReportRefs = document.reviews.map((review) => review.reportArtifactRef);
  if (new Set(reviewReportRefs).size !== reviewReportRefs.length) fail("REVIEW_REPORT_REUSED");
  for (const review of document.reviews) {
    const receipt = commonReceipt(review.reportArtifactRef);
    const evidenceRefs = [...new Set(review.findings.flatMap((finding) => finding.evidenceRefs))].sort();
    if (receipt.artifactKind !== "REVIEW_REPORT" || receipt.subjectId !== review.reviewId || receipt.subjectDigest !== review.reviewDigest || canonicalizeRfc8785(receipt.relatedArtifactRefs) !== canonicalizeRfc8785(evidenceRefs)) fail("REVIEW_REPORT_BINDING_MISMATCH");
  }

  if (document.rollback.rollbackReceiptRef !== null) {
    const rollbackReceipt = commonReceipt(document.rollback.rollbackReceiptRef);
    if (rollbackReceipt.artifactKind !== "ROLLBACK_RECEIPT" || rollbackReceipt.subjectId !== document.releaseId || rollbackReceipt.subjectDigest !== document.rollback.rollbackDigest || rollbackReceipt.relatedArtifactRefs.length !== 0) fail("ROLLBACK_RECEIPT_BINDING_MISMATCH");
  }

  const storageForKind = (kind) => {
    const matches = document.storageSet.filter((storage) => storage.kind === kind);
    if (matches.length !== 1) fail("P15_STORAGE_CARDINALITY_INVALID", kind);
    return matches[0];
  };
  const p15Artifacts = document.artifacts.filter((item) => typedRefs.has(item.artifactId) && ["BACKUP_MANIFEST", "RESTORE_RECEIPT", "RELEASE_MANIFEST", "BUNDLE_VERIFY_RECEIPT"].includes(item.kind));
  const backupStorage = p15Artifacts.some((artifact) => ["BACKUP_MANIFEST", "RESTORE_RECEIPT"].includes(artifact.kind)) ? storageForKind("P15_COLD_BACKUP") : null;
  const bundleStorage = p15Artifacts.some((artifact) => ["RELEASE_MANIFEST", "BUNDLE_VERIFY_RECEIPT"].includes(artifact.kind)) ? storageForKind("P15_RELEASE_BUNDLE") : null;
  const exactKind = (kind) => {
    const matches = p15Artifacts.filter((artifact) => artifact.kind === kind);
    if (matches.length !== 1) fail("P15_RECEIPT_CARDINALITY_INVALID", kind);
    return matches[0];
  };
  if (backupStorage) {
    const backupArtifact = exactKind("BACKUP_MANIFEST");
    const restoreArtifact = exactKind("RESTORE_RECEIPT");
    const backupReceipt = commonReceipt(backupArtifact.artifactId);
    const restoreReceipt = commonReceipt(restoreArtifact.artifactId);
    if (document.rollback.coldBackupManifestDigest !== backupStorage.manifestDigest
      || backupReceipt.artifactKind !== "BACKUP_MANIFEST"
      || backupReceipt.subjectId !== backupStorage.storageId
      || backupReceipt.subjectDigest !== backupStorage.manifestDigest
      || canonicalizeRfc8785(backupReceipt.relatedArtifactRefs) !== canonicalizeRfc8785([restoreArtifact.artifactId])
      || restoreReceipt.artifactKind !== "RESTORE_RECEIPT"
      || restoreReceipt.subjectId !== backupStorage.storageId
      || restoreReceipt.subjectDigest !== document.rollback.restoreRehearsalDigest
      || canonicalizeRfc8785(restoreReceipt.relatedArtifactRefs) !== canonicalizeRfc8785([backupArtifact.artifactId])) fail("P15_RECEIPT_BINDING_MISMATCH", backupStorage.storageId);
  }
  if (bundleStorage) {
    const manifestArtifact = exactKind("RELEASE_MANIFEST");
    const verifierArtifact = exactKind("BUNDLE_VERIFY_RECEIPT");
    const manifestReceipt = commonReceipt(manifestArtifact.artifactId);
    const verifierReceipt = commonReceipt(verifierArtifact.artifactId);
    if (manifestReceipt.artifactKind !== "RELEASE_MANIFEST"
      || verifierReceipt.artifactKind !== "BUNDLE_VERIFY_RECEIPT"
      || manifestReceipt.subjectId !== bundleStorage.storageId
      || verifierReceipt.subjectId !== bundleStorage.storageId
      || manifestReceipt.subjectDigest !== bundleStorage.manifestDigest
      || verifierReceipt.subjectDigest !== bundleStorage.manifestDigest
      || canonicalizeRfc8785(manifestReceipt.relatedArtifactRefs) !== canonicalizeRfc8785([verifierArtifact.artifactId])
      || canonicalizeRfc8785(verifierReceipt.relatedArtifactRefs) !== canonicalizeRfc8785([manifestArtifact.artifactId])) fail("P15_RECEIPT_BINDING_MISMATCH", bundleStorage.storageId);
  }
  for (const artifact of document.artifacts.filter((item) => typedRefs.has(item.artifactId) && item.kind === "RESULT_RECEIPT" && item.artifactRole === "SUPPORTING")) {
    const receipt = commonReceipt(artifact.artifactId);
    const expected = structuredDigest("chaotang.remote-head-observation-digest.v1", {
      commit: document.candidate.commit,
      remoteHeadBefore: document.candidate.remoteHeadBefore,
      remoteHeadAfter: document.candidate.remoteHeadAfter,
    });
    if (receipt.subjectId !== "remote-head-stability" || receipt.subjectDigest !== expected) fail("REMOTE_HEAD_RECEIPT_BINDING_MISMATCH");
  }
}

export function validateReleaseEvidence(document, options = {}) {
  for (const [storageId, source] of options.storageRoots?.entries?.() ?? []) assertStorageSourceLabelAndLexicalPath(source, storageId);
  assertPrivacySafe(document);
  validateSchema(document, SCHEMA, "$");
  if (document.contractDigest !== contractDigest()) fail("CONTRACT_DIGEST_MISMATCH");
  if (document.commandRegistryDigest !== commandRegistryDigest()) fail("COMMAND_REGISTRY_DIGEST_MISMATCH");
  if (document.repository.repositoryId !== REPOSITORY_ID || document.repository.targetRef !== TARGET_REF || document.repository.targetRemoteUrlDigest !== TARGET_REMOTE_URL_DIGEST) fail("REPOSITORY_IDENTITY_MISMATCH");
  for (const key of ["commit", "tree", "parentCommit", "remoteHeadBefore", "remoteHeadAfter"]) assertGit(document.candidate[key]);
  if (options.expectedCandidate) {
    const expected = options.expectedCandidate;
    if (document.candidate.commit !== expected.commit || document.candidate.tree !== expected.tree || document.candidate.parentCommit !== expected.parentCommit || canonicalizeRfc8785(document.candidate.approvalDigests) !== canonicalizeRfc8785([...expected.approvalDigests].sort())) fail("CANDIDATE_IDENTITY_MISMATCH");
  }
  if (document.candidate.remoteHeadBefore !== document.candidate.commit || document.candidate.remoteHeadAfter !== document.candidate.commit) fail("REMOTE_HEAD_MISMATCH");
  if (document.candidate.sourceDirty !== false) fail("CANDIDATE_DIRTY");
  assertSortedUnique(document.candidate.approvalDigests);
  if ((document.releaseMode === "BOOTSTRAP") !== (document.previousRelease === null)) fail("PREVIOUS_RELEASE_MODE_MISMATCH");
  assertTimestamp(document.startedAt);
  assertTimestamp(document.completedAt);
  const currentTime = new Date().toISOString().replace(/\.(\d{3})Z$/u, ".$1000Z");
  assertTimestamp(currentTime);
  if (document.startedAt > document.completedAt || document.completedAt > currentTime) fail("TIMESTAMP_ORDER_INVALID");

  const storageById = mapUnique(document.storageSet, "storageId", "STORAGE_ID_DUPLICATE");
  const checksById = mapUnique(document.checks, "checkId", "CHECK_ID_DUPLICATE");
  const artifactsById = mapUnique(document.artifacts, "artifactId", "ARTIFACT_ID_DUPLICATE");
  const environmentsById = mapUnique(document.environmentSet, "environmentId", "ENVIRONMENT_ID_DUPLICATE");
  mapUnique(document.packetSet, "packetId", "PACKET_ID_DUPLICATE");
  mapUnique(document.browserJourneys, "journeyId", "JOURNEY_ID_DUPLICATE");
  mapUnique(document.reviews, "reviewId", "REVIEW_ID_DUPLICATE");
  mapUnique(document.reviews.flatMap((review) => review.findings), "findingId", "FINDING_ID_DUPLICATE");
  for (const check of document.checks) if (!COMMAND_REGISTRY.some((row) => row.commandId === check.commandId)) fail("COMMAND_NOT_REGISTERED");
  for (const row of COMMAND_REGISTRY) if (document.checks.filter((check) => check.commandId === row.commandId).length > 1) fail("COMMAND_CARDINALITY_INVALID", row.commandId);
  const preliminaryConclusion = deriveConclusion(document);
  if (!equalWithoutDigest(document.conclusion, preliminaryConclusion, "conclusionDigest")) fail("CONCLUSION_MISMATCH");
  if (document.conclusion.status === "VERIFIED") {
    const acceptedPackets = document.packetSet.filter((packet) => packet.status === "ACCEPTED");
    const acceptedApprovals = acceptedPackets.map((packet) => packet.approvalDigest).sort();
    if (acceptedPackets.length === 0 || canonicalizeRfc8785(acceptedApprovals) !== canonicalizeRfc8785(document.candidate.approvalDigests)) fail("PACKET_ACCEPTANCE_BINDING_MISMATCH");
  }
  if (options.expectedRemoteHead && options.expectedRemoteHead !== document.candidate.commit) fail("REMOTE_HEAD_MISMATCH");
  if (options.expectedPacketSetDigest && options.expectedPacketSetDigest !== structuredDigest("chaotang.packet-set-digest.v1", document.packetSet)) fail("PACKET_SET_MISMATCH");
  for (const [collection, idField] of [
    [document.packetSet, "packetId"],
    [document.environmentSet, "environmentId"],
    [document.checks, "checkId"],
    [document.browserJourneys, "journeyId"],
    [document.storageSet, "storageId"],
    [document.artifacts, "artifactId"],
    [document.reviews, "reviewId"],
  ]) {
    assertSortedUnique(collection.map((item) => item[idField]));
  }
  for (const environment of document.environmentSet) {
    assertTimestamp(environment.startedAt);
    assertTimestamp(environment.completedAt);
    if (environment.startedAt > environment.completedAt || environment.startedAt < document.startedAt || environment.completedAt > document.completedAt) fail("TIMESTAMP_ORDER_INVALID");
    assertSortedUnique(environment.dependencyLockDigests);
    assertSortedUnique(environment.containerImageDigests);
    assertExactDigest(environment, DIGEST_WRAPPERS.environmentDigest, "environmentDigest", "ENVIRONMENT_DIGEST_MISMATCH");
  }
  for (const storage of document.storageSet) {
    assertDigest(storage.manifestDigest);
    assertDigest(storage.contentDigest);
    assertDigest(storage.retentionReceiptDigest);
  }
  if (document.previousRelease) {
    assertGit(document.previousRelease.commit);
    assertGit(document.previousRelease.tree);
    assertDigest(document.previousRelease.bundleDigest);
    assertDigest(document.previousRelease.coldBackupManifestDigest);
  }
  for (const packet of document.packetSet) {
    assertDigest(packet.contractDigest);
    assertDigest(packet.approvalDigest);
    assertDigest(packet.ownerAcceptanceDigest);
    assertGit(packet.candidateCommit);
    assertGit(packet.candidateTree);
  }
  for (const artifact of document.artifacts) validateArtifact(artifact, { storageById, candidate: document.candidate, checksById });
  const { receiptsByArtifactId, resultReceiptsByArtifactId, typedSubjectsByArtifactId } = observeStorageMappings(document, storageById, artifactsById, options);
  for (const check of document.checks) validateCheck(check, { artifactsById, environmentsById, receiptsByArtifactId, resultReceiptsByArtifactId });
  for (const check of document.checks) if (check.startedAt && (check.startedAt > check.completedAt || check.startedAt < document.startedAt || check.completedAt > document.completedAt)) fail("TIMESTAMP_ORDER_INVALID");
  for (const artifact of document.artifacts) if (artifact.createdAt < document.startedAt || artifact.createdAt > document.completedAt) fail("TIMESTAMP_ORDER_INVALID");
  for (const journey of document.browserJourneys) validateBrowserJourney(journey, { artifactsById, environmentsById, checksById, candidate: document.candidate });
  for (const review of document.reviews) validateReview(review, { artifactsById, candidate: document.candidate });
  for (const review of document.reviews) if (review.completedAt < document.startedAt || review.completedAt > document.completedAt) fail("TIMESTAMP_ORDER_INVALID");
  const tentative = deriveConclusion(document);
  validateRollback(document.rollback, { releaseMode: document.releaseMode, previousRelease: document.previousRelease, verified: tentative.status === "VERIFIED", artifactsById });
  validateTypedSubjects(document, { artifactsById, storageById, typedSubjectsByArtifactId });
  const derived = deriveConclusion(document);
  for (const field of ["mandatoryCheckIds", "passedCheckIds", "failedCheckIds", "notRunCheckIds", "blockedCheckIds", "requiredJourneyIds", "passedJourneyIds", "unresolvedFindingIds", "reasonCodes"]) assertSortedUnique(document.conclusion[field]);
  if (!equalWithoutDigest(document.conclusion, derived, "conclusionDigest")) fail("CONCLUSION_MISMATCH");
  assertExactDigest(document.conclusion, DIGEST_WRAPPERS.conclusionDigest, "conclusionDigest", "CONCLUSION_DIGEST_MISMATCH");
  assertExactDigest(document, DIGEST_WRAPPERS.evidenceDigest, "evidenceDigest", "EVIDENCE_DIGEST_MISMATCH");
  return {
    decision: "STRUCTURALLY_VALID_NONAUTHORIZING",
    claimedConclusion: document.conclusion.status,
    trusted: false,
    releaseReady: false,
    nonAuthorizing: true,
    productionDeploymentAuthorized: false,
    evidenceDigest: document.evidenceDigest,
  };
}

export function canonicalizeReleaseEvidence(document) {
  validateReleaseEvidence(document);
  return `${canonicalizeRfc8785(document)}\n`;
}

export function verifyReleaseEvidenceText(input, options = {}) {
  const document = parseReleaseEvidence(input);
  return validateReleaseEvidence(document, options);
}

function hashFile(filePath, expectedStat, expectedBytesLimit) {
  const descriptor = openSync(filePath, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  const hasher = createHash("sha256");
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  const header = Buffer.alloc(64 * 1024);
  let headerBytes = 0;
  let bytes = 0;
  try {
    const before = fstatSync(descriptor);
    if (!before.isFile() || before.nlink !== 1 || before.dev !== expectedStat.dev || before.ino !== expectedStat.ino || before.size !== expectedStat.size) fail("ARCHIVE_FILE_DRIFT");
    for (;;) {
      const count = readSync(descriptor, buffer, 0, buffer.length, null);
      if (count === 0) break;
      bytes += count;
      if (bytes > expectedBytesLimit) fail("ARCHIVE_BUDGET_EXCEEDED");
      hasher.update(buffer.subarray(0, count));
      if (headerBytes < header.length) {
        const copied = Math.min(count, header.length - headerBytes);
        buffer.copy(header, headerBytes, 0, copied);
        headerBytes += copied;
      }
    }
    const after = fstatSync(descriptor);
    if (after.dev !== before.dev || after.ino !== before.ino || after.size !== before.size || after.mtimeMs !== before.mtimeMs) fail("ARCHIVE_FILE_DRIFT");
  } finally {
    closeSync(descriptor);
  }
  return { bytes, sha256: `sha256:${hasher.digest("hex")}`, header: header.subarray(0, headerBytes) };
}

function hasContainerMagic(header) {
  const starts = (bytes) => header.length >= bytes.length && bytes.every((value, index) => header[index] === value);
  return starts([0x50, 0x4b, 0x03, 0x04])
    || starts([0x50, 0x4b, 0x05, 0x06])
    || starts([0x50, 0x4b, 0x07, 0x08])
    || starts([0x1f, 0x8b])
    || starts([0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c])
    || starts([0x52, 0x61, 0x72, 0x21, 0x1a, 0x07])
    || starts([0x42, 0x5a, 0x68])
    || starts([0xfd, 0x37, 0x7a, 0x58, 0x5a, 0x00])
    || starts([0x28, 0xb5, 0x2f, 0xfd])
    || starts([0x04, 0x22, 0x4d, 0x18])
    || starts([0x4d, 0x53, 0x43, 0x46])
    || starts([0x21, 0x3c, 0x61, 0x72, 0x63, 0x68, 0x3e, 0x0a])
    || starts([0x78, 0x61, 0x72, 0x21])
    || starts([0x71, 0xc7])
    || starts([0xc7, 0x71])
    || ["070701", "070702", "070707"].some((magic) => header.subarray(0, 6).toString("ascii") === magic)
    || (header.length >= 32774 && header.subarray(32769, 32774).toString("ascii") === "CD001")
    || (header.length >= 262 && header.subarray(257, 262).toString("ascii") === "ustar");
}

function validateEvidenceArchiveContent(bytes, relativePath) {
  if (bytes.subarray(0, 8).toString("hex") === "89504e470d0a1a0a") {
    parsePngDimensions(bytes, relativePath);
    return "STRICT_PNG";
  }
  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    fail("EVIDENCE_CONTENT_TYPE_FORBIDDEN", relativePath);
  }
  for (const character of text) {
    const codePoint = character.codePointAt(0);
    if (![0x09, 0x0a, 0x0d].includes(codePoint) && /[\p{Cc}\p{Cf}]/u.test(character)) fail("EVIDENCE_CONTENT_TYPE_FORBIDDEN", relativePath);
  }
  if (SECRET_PATTERNS.some((pattern) => pattern.test(text))) fail("PRIVACY_CANARY_FORBIDDEN", relativePath);
  return "UTF8_TEXT";
}

function unicodeCasefold(value) {
  return value.normalize("NFKC").toLowerCase().replaceAll("ς", "σ").replaceAll("ß", "ss");
}

function compareUtf8(left, right) {
  return Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
}

export function observeEvidenceArchive(root, { storageId, allowContainers = false } = {}) {
  if (typeof root !== "string" || !storageId) fail("ARCHIVE_INPUT_INVALID");
  const rootStat = lstatSync(root);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) fail("ARCHIVE_ROOT_INVALID");
  const canonicalRoot = realpathSync(root);
  const entries = [];
  const casefoldPaths = new Set();
  let totalBytes = 0;
  let visitedEntries = 0;
  const visit = (directory, relativeDirectory = "") => {
    const names = readdirSync(directory, { encoding: "buffer" }).sort(Buffer.compare);
    for (const nameBytes of names) {
      let name;
      try { name = new TextDecoder("utf-8", { fatal: true }).decode(nameBytes); } catch { fail("ARCHIVE_PATH_INVALID"); }
      const relativePath = relativeDirectory ? `${relativeDirectory}/${name}` : name;
      if (!isSafeRelativePath(relativePath)) fail("ARCHIVE_PATH_INVALID");
      if (relativePath !== relativePath.normalize("NFC")) fail("ARCHIVE_PATH_INVALID");
      const casefold = unicodeCasefold(relativePath);
      if (casefoldPaths.has(casefold)) fail("ARCHIVE_CASE_COLLISION");
      casefoldPaths.add(casefold);
      visitedEntries += 1;
      if (visitedEntries > LIMITS.archiveEntries) fail("ARCHIVE_BUDGET_EXCEEDED");
      const fullPath = path.join(directory, name);
      const stat = lstatSync(fullPath);
      if (stat.isSymbolicLink()) fail("ARCHIVE_SYMLINK_FORBIDDEN");
      const real = realpathSync(fullPath);
      if (real !== canonicalRoot && !real.startsWith(`${canonicalRoot}${path.sep}`)) fail("ARCHIVE_PATH_ESCAPE");
      if (stat.isDirectory()) {
        visit(fullPath, relativePath);
      } else if (stat.isFile()) {
        if (stat.nlink !== 1) fail("ARCHIVE_HARDLINK_FORBIDDEN");
        if (!allowContainers && ARCHIVE_EXTENSIONS.has(path.extname(name).toLowerCase())) fail("ARCHIVE_NESTED_ARCHIVE_FORBIDDEN");
        const evidenceBytes = allowContainers ? null : readBoundedFile(fullPath, LIMITS.evidenceArtifactBytes, "EVIDENCE_CONTENT_TYPE_FORBIDDEN");
        const observed = evidenceBytes
          ? { bytes: evidenceBytes.length, sha256: digestBytes(evidenceBytes), header: evidenceBytes.subarray(0, 64 * 1024) }
          : hashFile(fullPath, stat, LIMITS.archiveEntryBytes);
        if (!allowContainers && hasContainerMagic(observed.header)) fail("ARCHIVE_NESTED_ARCHIVE_FORBIDDEN");
        if (!allowContainers) validateEvidenceArchiveContent(evidenceBytes, relativePath);
        if (observed.bytes !== stat.size) fail("ARCHIVE_FILE_DRIFT");
        totalBytes += observed.bytes;
        if (totalBytes > LIMITS.archiveBytes) fail("ARCHIVE_BUDGET_EXCEEDED");
        entries.push({ relativePath, bytes: observed.bytes, sha256: observed.sha256 });
      } else {
        fail("ARCHIVE_SPECIAL_FILE_FORBIDDEN");
      }
    }
  };
  visit(canonicalRoot);
  entries.sort((left, right) => compareUtf8(left.relativePath, right.relativePath));
  const base = { schemaVersion: "chaotang.evidence-archive-manifest.v1", storageId, entries, totalBytes };
  return {
    ...base,
    manifestDigest: structuredDigest("chaotang.evidence-archive-manifest-digest.v1", base),
    contentDigest: structuredDigest("chaotang.evidence-archive-content-digest.v1", entries.map(({ relativePath, bytes, sha256 }) => ({ relativePath, bytes, sha256 }))),
  };
}

export function verifyEvidenceArchive(root, expected) {
  const observed = observeEvidenceArchive(root, { storageId: expected.storageId });
  if (canonicalizeRfc8785(observed) !== canonicalizeRfc8785(expected)) fail("ARCHIVE_ENTRY_SET_MISMATCH");
  return observed;
}

function emit(value) {
  process.stdout.write(`${canonicalizeRfc8785(value)}\n`);
}

function readStorageMap(filePath) {
  const value = parseStrict(readBoundedFile(filePath, 1024 * 1024, "STORAGE_MAP_FILE_INVALID"), { enforceEnvelopeLimits: false });
  if (!value || typeof value !== "object" || Array.isArray(value) || canonicalizeRfc8785(Object.keys(value).sort()) !== canonicalizeRfc8785(["schemaVersion", "storages"])) fail("STORAGE_MAP_INVALID");
  if (value.schemaVersion !== "chaotang.release-evidence-storage-map.v1" || !Array.isArray(value.storages) || value.storages.length > 256) fail("STORAGE_MAP_INVALID");
  const result = new Map();
  for (const item of value.storages) {
    const keys = Object.keys(item ?? {}).sort();
    if (canonicalizeRfc8785(keys) !== canonicalizeRfc8785(["path", "sourceId", "storageId"])) fail("STORAGE_MAP_INVALID");
    if (typeof item.storageId !== "string" || typeof item.path !== "string" || !(item.sourceId === null || typeof item.sourceId === "string") || result.has(item.storageId)) fail("STORAGE_MAP_INVALID");
    result.set(item.storageId, { path: item.path, sourceId: item.sourceId });
  }
  return result;
}

function cli(argv) {
  if (argv.length === 1 && argv[0] === "--status") {
    emit({
      schemaVersion: "chaotang.release-evidence.result.v1",
      command: "status",
      decision: "OBSERVE_ONLY",
      canExecuteCommands: false,
      nonAuthorizing: true,
      productionDeploymentAuthorized: false,
      contractDigest: contractDigest(),
      commandRegistryDigest: commandRegistryDigest(),
    });
    return 0;
  }
  if ((argv.length === 2 || (argv.length === 4 && argv[2] === "--storage-map")) && ["--check", "--canonicalize"].includes(argv[0])) {
    try {
      const document = parseReleaseEvidence(readBoundedFile(argv[1], LIMITS.envelopeBytes, "EVIDENCE_FILE_INVALID"));
      const options = argv.length === 4 ? { storageRoots: readStorageMap(argv[3]) } : {};
      const result = validateReleaseEvidence(document, options);
      if (argv[0] === "--canonicalize") process.stdout.write(`${canonicalizeRfc8785(document)}\n`);
      else emit({ schemaVersion: "chaotang.release-evidence.result.v1", command: "check", ...result, canExecuteCommands: false, productionDeploymentAuthorized: false });
      return 0;
    } catch (error) {
      emit({ schemaVersion: "chaotang.release-evidence.result.v1", command: argv[0].slice(2), decision: "STOP", reason: error?.code ?? "VALIDATION_FAILED", canExecuteCommands: false, productionDeploymentAuthorized: false });
      return 1;
    }
  }
  emit({ schemaVersion: "chaotang.release-evidence.result.v1", decision: "STOP", reason: "USAGE_INVALID", canExecuteCommands: false, productionDeploymentAuthorized: false });
  return 64;
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  process.exitCode = cli(process.argv.slice(2));
}
