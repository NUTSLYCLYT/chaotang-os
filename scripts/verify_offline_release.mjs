#!/usr/bin/env node

import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { lstat, mkdir, mkdtemp, open, readFile, readdir, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createGunzip } from "node:zlib";

const MAX_ENTRIES = 4096;
const MAX_BUNDLE_BYTES = 32 * 1024 * 1024 * 1024;
const MAX_ENTRY_BYTES = 8 * 1024 * 1024 * 1024;
const MAX_JSON_BYTES = 16 * 1024 * 1024;
const MAX_JSON_DEPTH = 32;
const MAX_OCI_INDEX_MANIFESTS = 16;
const MAX_OCI_DESCRIPTORS = 4096;
const MAX_ATTESTATION_LAYERS = 128;
const MAX_OCI_JSON_WORK_BYTES = 64 * 1024 * 1024;
const SHA_PATTERN = /^[0-9a-f]{40}$/;
const DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/;
const RUNTIME_REGISTRY_DIGEST = "sha256:7caed69599c964b7fc908229d86795008a0956fdae90628a904f8e4ec87dcabe";
const REFERENCE_PATTERN = /^[^\s@]+@sha256:[0-9a-f]{64}$/;
const RFC3339_UTC_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/;
const OCI_INDEX_MEDIA_TYPE = "application/vnd.oci.image.index.v1+json";
const OCI_MANIFEST_MEDIA_TYPE = "application/vnd.oci.image.manifest.v1+json";
const OCI_CONFIG_MEDIA_TYPE = "application/vnd.oci.image.config.v1+json";
const OCI_LAYER_MEDIA_TYPE = "application/vnd.oci.image.layer.v1.tar";
const OCI_GZIP_LAYER_MEDIA_TYPE = "application/vnd.oci.image.layer.v1.tar+gzip";
const IN_TOTO_LAYER_MEDIA_TYPE = "application/vnd.in-toto+json";
const MAX_COMPRESSION_RATIO = 200;
const SYFT_VERSION = "1.51.0";
const POLICY_DIGEST = "sha256:75054d6dc6737ff20eab02ad0a6b67ff7b64250676e9ad5087187548d50fe268";
const SOURCE_REPOSITORY = "git+https://gitee.com/msxn/chaotang-os";
const POLICY_URI = "file://docs/product/tasks/2026-08-17-rc1-release-blocker-remediation-v1.md#approved-toolchain-policy";
const BASE_IMAGES = Object.freeze({
  backend: "docker.io/library/python@sha256:356b0d18f9385f4bdcc673af60e1e64c9d1504952e4ec36ee32044c722a6bc4e",
  caddy: "docker.io/library/caddy@sha256:98eb57d882ccd5213d1688764db10c1ca2c58a1ca3a6717a3411ad798f7a423a",
  frontend: "docker.io/library/node@sha256:2a49bdf71e9fd965a58c1703fd9ddd205b34e5782b692a72dd1d248abb0beb43",
});
const EXPECTED_TOOLS = Object.freeze({
  docker: "29.6.1+8900f1d",
  buildx: "v0.35.0+a319e5b15052cf6557ceb666eb8ff6e32380b782",
  buildkit: "v0.31.1",
  node: "24.19.0",
  python: "3.12.14",
  caddy: "2.11.4",
  syft: "1.51.0",
  grype: "0.117.0",
});
const UTF8_DECODER = new TextDecoder("utf-8", { fatal: true });
const FILE_KINDS = new Set(["deployment", "documentation", "lock", "oci-archive", "provenance", "sbom"]);
const REQUIRED_FILE_KINDS = new Map([
  ["deploy/Caddyfile", "deployment"],
  ["deploy/README.md", "documentation"],
  ["deploy/compose.yaml", "deployment"],
  ["deploy/images.env", "deployment"],
  ["locks/backend.requirements-runtime.lock", "lock"],
  ["locks/frontend.package-lock.json", "lock"],
  ...["backend", "caddy", "frontend"].flatMap((name) => [
    [`images/${name}.oci.tar`, "oci-archive"],
    [`images/${name}.provenance.json`, "provenance"],
    [`images/${name}.sbom.json`, "sbom"],
  ]),
]);

export class ReleaseVerificationError extends Error {
  constructor(code) {
    super(code);
    this.name = "ReleaseVerificationError";
    this.code = code;
  }
}

function fail(code) {
  throw new ReleaseVerificationError(code);
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function assertClosed(value, keys, code = "MANIFEST_SCHEMA_INVALID") {
  if (!isPlainObject(value)) fail(code);
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) fail(code);
}

function assertString(value, pattern = null, code = "MANIFEST_SCHEMA_INVALID") {
  if (typeof value !== "string" || value.length === 0 || value.length > 16_384) fail(code);
  assertUnicodeScalarString(value, code);
  if (pattern && !pattern.test(value)) fail(code);
}

function assertUnicodeScalarString(value, code = "MANIFEST_JSON_INVALID") {
  for (let index = 0; index < value.length; index += 1) {
    const unit = value.charCodeAt(index);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) fail(code);
      index += 1;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) {
      fail(code);
    }
  }
}

export function assertSafeBundlePath(value) {
  assertString(value, null, "UNSAFE_BUNDLE_PATH");
  if (
    isAbsolute(value) ||
    value.includes("\\") ||
    value.includes("\0") ||
    Buffer.byteLength(value, "utf8") > 512
  ) fail("UNSAFE_BUNDLE_PATH");
  const segments = value.split("/");
  if (segments.length > 16 || segments.some((part) => !part || part === "." || part === "..")) {
    fail("UNSAFE_BUNDLE_PATH");
  }
  return value;
}

export function parseJsonStrict(text) {
  if (typeof text !== "string" || Buffer.byteLength(text, "utf8") > MAX_JSON_BYTES) fail("MANIFEST_JSON_INVALID");
  let index = 0;
  let depth = 0;
  const whitespace = /[\u0009\u000a\u000d\u0020]/;
  const skip = () => { while (index < text.length && whitespace.test(text[index])) index += 1; };
  const parseString = () => {
    if (text[index] !== '"') fail("MANIFEST_JSON_INVALID");
    const start = index++;
    while (index < text.length) {
      const code = text.charCodeAt(index);
      if (code === 0x22) {
        index += 1;
        try {
          const value = JSON.parse(text.slice(start, index));
          assertUnicodeScalarString(value);
          return value;
        } catch (error) {
          if (error instanceof ReleaseVerificationError) throw error;
          fail("MANIFEST_JSON_INVALID");
        }
      }
      if (code < 0x20) fail("MANIFEST_JSON_INVALID");
      if (code === 0x5c) {
        index += 1;
        if (index >= text.length || !'"\\/bfnrtu'.includes(text[index])) fail("MANIFEST_JSON_INVALID");
        if (text[index] === "u") {
          if (!/^[0-9a-fA-F]{4}$/.test(text.slice(index + 1, index + 5))) fail("MANIFEST_JSON_INVALID");
          index += 4;
        }
      }
      index += 1;
    }
    fail("MANIFEST_JSON_INVALID");
  };
  const parseValue = () => {
    skip();
    if (index >= text.length || depth > MAX_JSON_DEPTH) fail("MANIFEST_JSON_INVALID");
    if (text[index] === '"') return parseString();
    if (text.startsWith("true", index)) { index += 4; return true; }
    if (text.startsWith("false", index)) { index += 5; return false; }
    if (text.startsWith("null", index)) { index += 4; return null; }
    if (text[index] === "[") {
      if (depth >= MAX_JSON_DEPTH) fail("MANIFEST_JSON_INVALID");
      depth += 1; index += 1; skip();
      const result = [];
      if (text[index] === "]") { index += 1; depth -= 1; return result; }
      while (true) {
        result.push(parseValue()); skip();
        if (text[index] === "]") { index += 1; depth -= 1; return result; }
        if (text[index] !== ",") fail("MANIFEST_JSON_INVALID");
        index += 1;
      }
    }
    if (text[index] === "{") {
      if (depth >= MAX_JSON_DEPTH) fail("MANIFEST_JSON_INVALID");
      depth += 1; index += 1; skip();
      const result = {};
      const keys = new Set();
      if (text[index] === "}") { index += 1; depth -= 1; return result; }
      while (true) {
        skip();
        const key = parseString();
        if (keys.has(key)) fail("DUPLICATE_JSON_KEY");
        keys.add(key); skip();
        if (text[index] !== ":") fail("MANIFEST_JSON_INVALID");
        index += 1;
        Object.defineProperty(result, key, { value: parseValue(), enumerable: true, writable: true });
        skip();
        if (text[index] === "}") { index += 1; depth -= 1; return result; }
        if (text[index] !== ",") fail("MANIFEST_JSON_INVALID");
        index += 1;
      }
    }
    const match = text.slice(index).match(/^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/);
    if (!match) fail("MANIFEST_JSON_INVALID");
    index += match[0].length;
    const value = Number(match[0]);
    if (!Number.isFinite(value)) fail("MANIFEST_JSON_INVALID");
    return value;
  };
  const value = parseValue();
  skip();
  if (index !== text.length || depth !== 0) fail("MANIFEST_JSON_INVALID");
  return value;
}

export function canonicalize(value) {
  if (value === null) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "string") {
    assertUnicodeScalarString(value);
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) fail("MANIFEST_JSON_INVALID");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (!isPlainObject(value)) fail("MANIFEST_JSON_INVALID");
  return `{${Object.keys(value).sort().map((key) => {
    assertUnicodeScalarString(key);
    return `${JSON.stringify(key)}:${canonicalize(value[key])}`;
  }).join(",")}}`;
}

function digestBytes(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

const RELEASE_EXPECTATION_KEYS = [
  "candidateCommit",
  "candidateTree",
  "approvalDigest",
  "p09ContractDigest",
  "p09VerifierDigest",
  "runtimeRegistryDigest",
  "releaseManifestDigest",
  "previousReleaseId",
  "previousBundleDigest",
  "coldBackupManifestDigest",
  "provisionalReceiptDigest",
  "acceptanceReferenceDigest",
  "expectationDigest",
];
const P09_CONTRACT_DIGEST = "sha256:27728301f51c7fe7bd929d99b45de86c76807b4c9c5eba22e7e42b0e18e8acc5";
const P09_VERIFIER_DIGEST = "sha256:f001d50ef4c03bb16aaf51f91531b78651121147cb2ee9e78af9a8a24f8f1e99";

export function validateReleaseExpectation(expectation) {
  assertClosed(expectation, RELEASE_EXPECTATION_KEYS, "RELEASE_EXPECTATION_INVALID");
  assertString(expectation.candidateCommit, SHA_PATTERN, "RELEASE_EXPECTATION_INVALID");
  assertString(expectation.candidateTree, SHA_PATTERN, "RELEASE_EXPECTATION_INVALID");
  for (const key of [
    "approvalDigest", "p09ContractDigest", "p09VerifierDigest", "runtimeRegistryDigest",
    "releaseManifestDigest", "coldBackupManifestDigest", "provisionalReceiptDigest",
    "acceptanceReferenceDigest", "expectationDigest",
  ]) assertString(expectation[key], DIGEST_PATTERN, "RELEASE_EXPECTATION_INVALID");
  if (expectation.p09ContractDigest !== P09_CONTRACT_DIGEST || expectation.p09VerifierDigest !== P09_VERIFIER_DIGEST) {
    fail("RELEASE_EXPECTATION_P09_MISMATCH");
  }
  const bootstrap = expectation.previousReleaseId === null && expectation.previousBundleDigest === null;
  const upgrade = typeof expectation.previousReleaseId === "string" &&
    expectation.previousReleaseId.length > 0 && expectation.previousReleaseId.length <= 128 &&
    DIGEST_PATTERN.test(expectation.previousBundleDigest ?? "");
  if (!bootstrap && !upgrade) fail("RELEASE_EXPECTATION_INVALID");
  const { expectationDigest, ...payload } = expectation;
  if (expectationDigest !== digestBytes(Buffer.from(canonicalize(payload), "utf8"))) {
    fail("RELEASE_EXPECTATION_DIGEST_MISMATCH");
  }
  return expectation;
}

function decodeUtf8(bytes, code = "MANIFEST_JSON_INVALID") {
  try {
    return UTF8_DECODER.decode(bytes);
  } catch {
    fail(code);
  }
}

async function openBundleEntry(entry) {
  if (await realpath(entry.path) !== entry.path) fail("UNSAFE_BUNDLE_ENTRY");
  const handle = await open(entry.path, constants.O_RDONLY | constants.O_NOFOLLOW);
  const info = await handle.stat();
  if (
    !info.isFile() ||
    info.nlink !== 1 ||
    info.size !== entry.bytes ||
    info.dev !== entry.dev ||
    info.ino !== entry.ino
  ) {
    await handle.close();
    fail("UNSAFE_BUNDLE_ENTRY");
  }
  return handle;
}

async function digestEntry(entry) {
  const hash = createHash("sha256");
  const handle = await openBundleEntry(entry);
  try {
    const buffer = Buffer.alloc(Math.min(1024 * 1024, Math.max(entry.bytes, 1)));
    let offset = 0;
    while (offset < entry.bytes) {
      const length = Math.min(buffer.length, entry.bytes - offset);
      const result = await handle.read(buffer, 0, length, offset);
      if (result.bytesRead !== length) fail("UNSAFE_BUNDLE_ENTRY");
      hash.update(buffer.subarray(0, length));
      offset += length;
    }
    return `sha256:${hash.digest("hex")}`;
  } finally {
    await handle.close();
  }
}

async function readEntryText(entry, maximum = MAX_JSON_BYTES) {
  if (entry.bytes > maximum) fail("BUNDLE_LIMIT_EXCEEDED");
  const handle = await openBundleEntry(entry);
  try {
    const buffer = Buffer.alloc(entry.bytes);
    const result = await handle.read(buffer, 0, buffer.length, 0);
    if (result.bytesRead !== buffer.length) fail("UNSAFE_BUNDLE_ENTRY");
    return decodeUtf8(buffer);
  } finally {
    await handle.close();
  }
}

function parseTarOctal(field) {
  const text = field.toString("ascii").replace(/\0.*$/, "").trim();
  if (!/^[0-7]+$/.test(text)) fail("OCI_ARCHIVE_INVALID");
  const value = Number.parseInt(text, 8);
  if (!Number.isSafeInteger(value)) fail("OCI_ARCHIVE_INVALID");
  return value;
}

function tarText(field) {
  const end = field.indexOf(0);
  return decodeUtf8(field.subarray(0, end === -1 ? field.length : end), "OCI_ARCHIVE_INVALID");
}

function assertTarChecksum(header) {
  const expected = parseTarOctal(header.subarray(148, 156));
  let actual = 0;
  for (let index = 0; index < header.length; index += 1) {
    actual += index >= 148 && index < 156 ? 0x20 : header[index];
  }
  if (actual !== expected) fail("OCI_ARCHIVE_INVALID");
}

async function hashFileRange(handle, offset, size) {
  const hash = createHash("sha256");
  const buffer = Buffer.alloc(Math.min(1024 * 1024, Math.max(size, 1)));
  let cursor = 0;
  while (cursor < size) {
    const length = Math.min(buffer.length, size - cursor);
    const result = await handle.read(buffer, 0, length, offset + cursor);
    if (result.bytesRead !== length) fail("OCI_ARCHIVE_INVALID");
    hash.update(buffer.subarray(0, length));
    cursor += length;
  }
  return hash.digest("hex");
}

async function readOciJson(handle, entries, name) {
  const entry = entries.get(name);
  if (!entry || entry.type !== 0x30 || entry.size > MAX_JSON_BYTES) fail("OCI_ARCHIVE_INVALID");
  const bytes = Buffer.alloc(entry.size);
  const result = await handle.read(bytes, 0, bytes.length, entry.offset);
  if (result.bytesRead !== bytes.length) fail("OCI_ARCHIVE_INVALID");
  return parseJsonStrict(decodeUtf8(bytes, "OCI_ARCHIVE_INVALID"));
}

function assertOciDescriptor(descriptor, code = "OCI_ARCHIVE_INVALID") {
  if (
    !isPlainObject(descriptor) ||
    typeof descriptor.mediaType !== "string" ||
    !DIGEST_PATTERN.test(descriptor.digest ?? "") ||
    !Number.isSafeInteger(descriptor.size) ||
    descriptor.size < 0 ||
    descriptor.size > MAX_ENTRY_BYTES
  ) fail(code);
}

function layerTarValidator() {
  let header = Buffer.alloc(0);
  let skip = 0;
  let zeroBlocks = 0;
  let finished = false;
  let entries = 0;
  const names = new Set();
  const folded = new Set();
  const write = (input) => {
    let chunk = input;
    while (chunk.length > 0) {
      if (finished) {
        if (chunk.some((byte) => byte !== 0)) fail("OCI_LAYER_TAR_INVALID");
        return;
      }
      if (skip > 0) {
        const consumed = Math.min(skip, chunk.length);
        skip -= consumed;
        chunk = chunk.subarray(consumed);
        continue;
      }
      const needed = 512 - header.length;
      const consumed = Math.min(needed, chunk.length);
      header = Buffer.concat([header, chunk.subarray(0, consumed)]);
      chunk = chunk.subarray(consumed);
      if (header.length !== 512) continue;
      if (header.every((byte) => byte === 0)) {
        zeroBlocks += 1;
        if (zeroBlocks === 2) finished = true;
        header = Buffer.alloc(0);
        continue;
      }
      if (zeroBlocks !== 0) fail("OCI_LAYER_TAR_INVALID");
      assertTarChecksum(header);
      const type = header[156] === 0 ? 0x30 : header[156];
      if (![0x30, 0x31, 0x32, 0x35].includes(type)) fail("OCI_LAYER_TAR_UNSUPPORTED");
      const name = tarText(header.subarray(0, 100));
      const prefix = tarText(header.subarray(345, 500));
      const path = (prefix ? `${prefix}/${name}` : name).replace(/\/$/, "");
      assertSafeBundlePath(path);
      const caseKey = path.toLocaleLowerCase("en-US");
      if (names.has(path) || folded.has(caseKey)) fail("OCI_LAYER_TAR_INVALID");
      names.add(path);
      folded.add(caseKey);
      entries += 1;
      if (entries > MAX_ENTRIES) fail("BUNDLE_LIMIT_EXCEEDED");
      const size = parseTarOctal(header.subarray(124, 136));
      if (size > MAX_ENTRY_BYTES || (type === 0x35 && size !== 0)) fail("BUNDLE_LIMIT_EXCEEDED");
      if (type === 0x31) assertSafeBundlePath(tarText(header.subarray(157, 257)).replace(/\/$/, ""));
      if (type === 0x32) {
        const target = tarText(header.subarray(157, 257));
        if (!target || target.includes("\0") || Buffer.byteLength(target, "utf8") > 512) {
          fail("OCI_LAYER_TAR_INVALID");
        }
      }
      skip = Math.ceil(size / 512) * 512;
      header = Buffer.alloc(0);
    }
  };
  const finish = () => {
    if (!finished || header.length !== 0 || skip !== 0) fail("OCI_LAYER_TAR_INVALID");
  };
  return { write, finish };
}

async function validateLayer(handle, entry, mediaType) {
  if (entry.size <= 0) fail("OCI_LAYER_INVALID");
  const compressed = mediaType === OCI_GZIP_LAYER_MEDIA_TYPE;
  const maximum = compressed
    ? Math.min(MAX_ENTRY_BYTES, entry.size * MAX_COMPRESSION_RATIO)
    : Math.min(MAX_ENTRY_BYTES, entry.size);
  const input = handle.createReadStream({
    autoClose: false,
    start: entry.offset,
    end: entry.offset + entry.size - 1,
  });
  const output = compressed ? input.pipe(createGunzip()) : input;
  const tar = layerTarValidator();
  let expanded = 0;
  try {
    for await (const chunk of output) {
      expanded += chunk.length;
      if (expanded > maximum) {
        output.destroy();
        fail("OCI_LAYER_COMPRESSION_RATIO_EXCEEDED");
      }
      tar.write(Buffer.from(chunk));
    }
  } catch (error) {
    if (error instanceof ReleaseVerificationError) throw error;
    fail("OCI_LAYER_INVALID");
  }
  if (expanded === 0) fail("OCI_LAYER_INVALID");
  tar.finish();
  return expanded;
}

export async function inspectOciArchive(path, expectedImage = null, source = null, expectedEntry = null) {
  const info = await lstat(path);
  if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1 || info.size > MAX_ENTRY_BYTES) {
    fail("OCI_ARCHIVE_UNSAFE");
  }
  if (info.size < 1536 || info.size % 512 !== 0) fail("OCI_ARCHIVE_INVALID");
  const entry = expectedEntry ?? { path: resolve(path), bytes: info.size, dev: info.dev, ino: info.ino };
  const handle = await openBundleEntry(entry);
  const names = new Set();
  const folded = new Set();
  const entriesByName = new Map();
  let entries = 0;
  let offset = 0;
  let zeroBlocks = 0;
  try {
    const header = Buffer.alloc(512);
    while (offset < info.size) {
      const { bytesRead } = await handle.read(header, 0, header.length, offset);
      if (bytesRead !== 512) fail("OCI_ARCHIVE_INVALID");
      offset += 512;
      if (header.every((byte) => byte === 0)) {
        zeroBlocks += 1;
        if (zeroBlocks >= 2) {
          const remaining = info.size - offset;
          if (remaining > 0) {
            const tail = Buffer.alloc(Math.min(64 * 1024, remaining));
            let cursor = offset;
            while (cursor < info.size) {
              const length = Math.min(tail.length, info.size - cursor);
              const result = await handle.read(tail, 0, length, cursor);
              if (result.bytesRead !== length || tail.subarray(0, length).some((byte) => byte !== 0)) {
                fail("OCI_ARCHIVE_INVALID");
              }
              cursor += length;
            }
          }
          break;
        }
        continue;
      }
      if (zeroBlocks !== 0) fail("OCI_ARCHIVE_INVALID");
      assertTarChecksum(header);
      const type = header[156];
      if (![0, 0x30, 0x35].includes(type)) fail("OCI_ARCHIVE_UNSAFE");
      const name = tarText(header.subarray(0, 100));
      const prefix = tarText(header.subarray(345, 500));
      const fullName = prefix ? `${prefix}/${name}` : name;
      const normalizedName = fullName.replace(/\/$/, "");
      assertSafeBundlePath(normalizedName);
      const caseKey = normalizedName.toLocaleLowerCase("en-US");
      if (names.has(normalizedName) || folded.has(caseKey)) fail("OCI_ARCHIVE_UNSAFE");
      names.add(normalizedName);
      folded.add(caseKey);
      entries += 1;
      if (entries > MAX_ENTRIES) fail("BUNDLE_LIMIT_EXCEEDED");
      const size = parseTarOctal(header.subarray(124, 136));
      if (size > MAX_ENTRY_BYTES || (type === 0x35 && size !== 0)) fail("BUNDLE_LIMIT_EXCEEDED");
      const padded = Math.ceil(size / 512) * 512;
      if (padded > info.size - offset) fail("OCI_ARCHIVE_INVALID");
      entriesByName.set(normalizedName, { offset, size, type: type === 0 ? 0x30 : type });
      if (type !== 0x35 && normalizedName.startsWith("blobs/sha256/")) {
        const expectedDigest = normalizedName.slice("blobs/sha256/".length);
        if (!/^[0-9a-f]{64}$/.test(expectedDigest)) fail("OCI_ARCHIVE_INVALID");
        if (await hashFileRange(handle, offset, size) !== expectedDigest) fail("OCI_ARCHIVE_DIGEST_MISMATCH");
      }
      offset += padded;
    }
    if (zeroBlocks < 2) fail("OCI_ARCHIVE_INVALID");
    const layout = await readOciJson(handle, entriesByName, "oci-layout");
    if (!isPlainObject(layout) || layout.imageLayoutVersion !== "1.0.0") fail("OCI_ARCHIVE_INVALID");
    const index = await readOciJson(handle, entriesByName, "index.json");
    if (
      !isPlainObject(index) ||
      index.schemaVersion !== 2 ||
      index.mediaType !== OCI_INDEX_MEDIA_TYPE ||
      !Array.isArray(index.manifests) ||
      index.manifests.length === 0 ||
      index.manifests.length > MAX_OCI_INDEX_MANIFESTS
    ) {
      fail("OCI_ARCHIVE_INVALID");
    }
    const reachable = new Set(["oci-layout", "index.json"]);
    const indexDigests = new Set();
    let descriptorWork = 0;
    let jsonWorkBytes = 0;
    for (const descriptor of index.manifests) {
      assertOciDescriptor(descriptor);
      if (indexDigests.has(descriptor.digest)) fail("OCI_ARCHIVE_DUPLICATE_DESCRIPTOR");
      indexDigests.add(descriptor.digest);
      if (descriptor.mediaType !== OCI_MANIFEST_MEDIA_TYPE) fail("OCI_ARCHIVE_INVALID");
      const manifestName = `blobs/sha256/${descriptor.digest.slice(7)}`;
      const manifestEntry = entriesByName.get(manifestName);
      if (!manifestEntry || manifestEntry.type !== 0x30 || manifestEntry.size !== descriptor.size) {
        fail("OCI_ARCHIVE_INVALID");
      }
      reachable.add(manifestName);
      jsonWorkBytes += manifestEntry.size;
      if (jsonWorkBytes > MAX_OCI_JSON_WORK_BYTES) fail("BUNDLE_LIMIT_EXCEEDED");
      const document = await readOciJson(handle, entriesByName, manifestName);
      if (
        !isPlainObject(document) || document.schemaVersion !== 2 ||
        document.mediaType !== OCI_MANIFEST_MEDIA_TYPE || !isPlainObject(document.config) ||
        !Array.isArray(document.layers) || document.layers.length === 0 ||
        document.layers.length > MAX_OCI_DESCRIPTORS
      ) fail("OCI_ARCHIVE_INVALID");
      descriptorWork += 1 + document.layers.length;
      if (descriptorWork > MAX_OCI_DESCRIPTORS) fail("BUNDLE_LIMIT_EXCEEDED");
      assertOciDescriptor(document.config);
      const childDigests = new Set();
      for (const child of [document.config, ...document.layers]) {
        assertOciDescriptor(child);
        if (childDigests.has(child.digest)) fail("OCI_ARCHIVE_DUPLICATE_DESCRIPTOR");
        childDigests.add(child.digest);
        const blobName = `blobs/sha256/${child.digest.slice(7)}`;
        const blob = entriesByName.get(blobName);
        if (!blob || blob.type !== 0x30 || blob.size !== child.size) fail("OCI_ARCHIVE_INVALID");
        reachable.add(blobName);
      }
      const isRunnable = descriptor.platform?.os === "linux" && descriptor.platform?.architecture === "amd64";
      if (!isRunnable) {
        if (
          descriptor.platform?.os !== "unknown" || descriptor.platform?.architecture !== "unknown" ||
          descriptor.annotations?.["vnd.docker.reference.type"] !== "attestation-manifest" ||
          !DIGEST_PATTERN.test(descriptor.annotations?.["vnd.docker.reference.digest"] ?? "") ||
          document.config.mediaType !== OCI_CONFIG_MEDIA_TYPE ||
          document.layers.length > MAX_ATTESTATION_LAYERS ||
          document.layers.some((layer) => layer.mediaType !== IN_TOTO_LAYER_MEDIA_TYPE || layer.size > MAX_JSON_BYTES)
        ) fail("OCI_ARCHIVE_INVALID");
        jsonWorkBytes += document.config.size + document.layers.reduce((sum, layer) => sum + layer.size, 0);
        if (jsonWorkBytes > MAX_OCI_JSON_WORK_BYTES) fail("BUNDLE_LIMIT_EXCEEDED");
        await readOciJson(handle, entriesByName, `blobs/sha256/${document.config.digest.slice(7)}`);
        for (const layer of document.layers) {
          await readOciJson(handle, entriesByName, `blobs/sha256/${layer.digest.slice(7)}`);
        }
      }
    }
    const runnable = index.manifests.filter((descriptor) => (
      isPlainObject(descriptor) &&
      descriptor.platform?.os === "linux" &&
      descriptor.platform?.architecture === "amd64"
    ));
    if (runnable.length !== 1) fail("OCI_ARCHIVE_PLATFORM_MISMATCH");
    const imageDescriptor = runnable[0];
    assertOciDescriptor(imageDescriptor);
    if (imageDescriptor.mediaType !== OCI_MANIFEST_MEDIA_TYPE) fail("OCI_ARCHIVE_INVALID");
    const expectedReferenceDigest = expectedImage
      ? `sha256:${expectedImage.reference.slice(expectedImage.reference.lastIndexOf(":") + 1)}`
      : null;
    const indexEntry = entriesByName.get("index.json");
    const indexDigest = `sha256:${await hashFileRange(handle, indexEntry.offset, indexEntry.size)}`;
    if (expectedReferenceDigest && ![imageDescriptor.digest, indexDigest].includes(expectedReferenceDigest)) {
      fail("OCI_ARCHIVE_DIGEST_MISMATCH");
    }
    const manifestName = `blobs/sha256/${imageDescriptor.digest.slice(7)}`;
    const manifestEntry = entriesByName.get(manifestName);
    if (!manifestEntry || manifestEntry.size !== imageDescriptor.size) fail("OCI_ARCHIVE_INVALID");
    const manifest = await readOciJson(handle, entriesByName, manifestName);
    if (
      !isPlainObject(manifest) ||
      manifest.schemaVersion !== 2 ||
      manifest.mediaType !== OCI_MANIFEST_MEDIA_TYPE ||
      !isPlainObject(manifest.config) ||
      !Array.isArray(manifest.layers) ||
      manifest.layers.length === 0
    ) fail("OCI_ARCHIVE_INVALID");
    assertOciDescriptor(manifest.config);
    if (manifest.config.mediaType !== OCI_CONFIG_MEDIA_TYPE) fail("OCI_ARCHIVE_INVALID");
    for (const layer of manifest.layers) assertOciDescriptor(layer);
    for (const descriptor of [manifest.config, ...manifest.layers]) {
      const blob = entriesByName.get(`blobs/sha256/${descriptor.digest.slice(7)}`);
      if (!blob || blob.type !== 0x30 || blob.size !== descriptor.size) fail("OCI_ARCHIVE_INVALID");
    }
    let expandedLayerBytes = 0;
    for (const layer of manifest.layers) {
      const blob = entriesByName.get(`blobs/sha256/${layer.digest.slice(7)}`);
      if (![OCI_LAYER_MEDIA_TYPE, OCI_GZIP_LAYER_MEDIA_TYPE].includes(layer.mediaType)) {
        fail("OCI_LAYER_MEDIA_TYPE_UNSUPPORTED");
      }
      expandedLayerBytes += await validateLayer(handle, blob, layer.mediaType);
      if (expandedLayerBytes > MAX_BUNDLE_BYTES) fail("BUNDLE_LIMIT_EXCEEDED");
    }
    const config = await readOciJson(
      handle,
      entriesByName,
      `blobs/sha256/${manifest.config.digest.slice(7)}`,
    );
    if (!isPlainObject(config) || config.os !== "linux" || config.architecture !== "amd64") {
      fail("OCI_ARCHIVE_PLATFORM_MISMATCH");
    }
    if (expectedImage?.name !== "caddy") {
      const labels = config.config?.Labels;
      const created = labels?.["org.opencontainers.image.created"];
      if (
        !isPlainObject(labels) ||
        labels["org.opencontainers.image.revision"] !== source?.commit ||
        labels["io.chaotang.source.tree"] !== source?.tree ||
        typeof created !== "string" ||
        !RFC3339_UTC_PATTERN.test(created) ||
        Date.parse(created) !== source?.sourceDateEpoch * 1000
      ) fail("OCI_ARCHIVE_SOURCE_MISMATCH");
    }
    for (const [name, record] of entriesByName) {
      if (record.type === 0x35) {
        if (!["blobs", "blobs/sha256"].includes(name)) fail("OCI_ARCHIVE_UNSAFE");
      } else if (!reachable.has(name)) {
        fail("OCI_ARCHIVE_UNREACHABLE_ENTRY");
      }
    }
    return { entries, manifestDigest: expectedReferenceDigest ?? imageDescriptor.digest, platform: "linux/amd64" };
  } finally {
    await handle.close();
  }
}

function hasProperty(properties, name, value) {
  return Array.isArray(properties) && properties.some((property) => (
    isPlainObject(property) && property.name === name && property.value === value
  ));
}

function hasResolvedDependency(dependencies, uri, digestKey, digestValue) {
  return Array.isArray(dependencies) && dependencies.some((dependency) => (
    isPlainObject(dependency) &&
    dependency.uri === uri &&
    isPlainObject(dependency.digest) &&
    dependency.digest[digestKey] === digestValue
  ));
}

function validateRawBuildkitProvenance(raw, imageReference, baseReference, expectedDigest) {
  if (!isPlainObject(raw) || digestBytes(Buffer.from(canonicalize(raw))) !== expectedDigest) {
    fail("PROVENANCE_INVALID");
  }
  const predicate = isPlainObject(raw.predicate) ? raw.predicate : raw;
  const definition = isPlainObject(predicate.buildDefinition) ? predicate.buildDefinition : null;
  const buildType = definition?.buildType ?? predicate.buildType;
  const builderId = predicate.runDetails?.builder?.id ?? predicate.builder?.id;
  const materials = definition?.resolvedDependencies ?? predicate.materials;
  const completeness = predicate.runDetails?.metadata?.completeness ?? predicate.metadata?.completeness;
  const expectedImageDigest = imageReference.slice(imageReference.lastIndexOf("sha256:") + 7);
  const expectedBaseDigest = baseReference.slice(baseReference.lastIndexOf("sha256:") + 7);
  const subjects = Array.isArray(raw.subject) ? raw.subject : Array.isArray(predicate.subject) ? predicate.subject : [];
  if (
    buildType !== "https://mobyproject.org/buildkit@v1" ||
    typeof builderId !== "string" ||
    !/^https:\/\/mobyproject\.org\/buildkit\/v0\.31\.1(?:$|\/)/.test(builderId) ||
    completeness?.parameters !== true ||
    completeness?.materials !== true ||
    completeness?.environment !== true ||
    !subjects.some((subject) => isPlainObject(subject?.digest) && subject.digest.sha256 === expectedImageDigest) ||
    !Array.isArray(materials) ||
    !materials.some((material) => isPlainObject(material?.digest) && material.digest.sha256 === expectedBaseDigest)
  ) fail("PROVENANCE_INVALID");
}

async function validateEvidenceFile(entry, kind, image, source) {
  const document = parseJsonStrict(await readEntryText(entry));
  if (kind === "sbom") {
    const tools = document?.metadata?.tools?.components;
    const component = document?.metadata?.component;
    if (
      !isPlainObject(document) ||
      document.bomFormat !== "CycloneDX" ||
      document.specVersion !== "1.6" ||
      document.version !== 1 ||
      !Array.isArray(document.components) ||
      document.components.length === 0 ||
      !Array.isArray(tools) ||
      !tools.some((tool) => isPlainObject(tool) && tool.name === "syft" && tool.version === SYFT_VERSION) ||
      !isPlainObject(component) ||
      component.type !== "container" ||
      component.name !== image.reference ||
      component.version !== image.reference.slice(image.reference.lastIndexOf("@") + 1) ||
      !hasProperty(component.properties, "io.chaotang.image.reference", image.reference)
    ) fail("SBOM_INVALID");
    return;
  }
  const predicate = document?.predicate;
  const definition = predicate?.buildDefinition;
  const run = predicate?.runDetails;
  const parameters = definition?.externalParameters?.chaotang;
  const subjectName = image.reference.slice(0, image.reference.lastIndexOf("@"));
  const subjectDigest = image.reference.slice(image.reference.lastIndexOf("sha256:") + 7);
  const expectedBase = BASE_IMAGES[image.name];
  const expectedTime = new Date(source.sourceDateEpoch * 1000).getTime();
  const isCaddy = image.name === "caddy";
  if (
    !isPlainObject(document) ||
    document._type !== "https://in-toto.io/Statement/v1" ||
    document.predicateType !== "https://slsa.dev/provenance/v1" ||
    !Array.isArray(document.subject) ||
    document.subject.length !== 1 ||
    document.subject[0]?.name !== subjectName ||
    !isPlainObject(document.subject[0]?.digest) ||
    document.subject[0].digest.sha256 !== subjectDigest ||
    !isPlainObject(definition) ||
    typeof definition.buildType !== "string" ||
    definition.buildType.length === 0 ||
    !isPlainObject(definition.externalParameters) ||
    !isPlainObject(definition.internalParameters) ||
    !Array.isArray(definition.resolvedDependencies) ||
    !isPlainObject(run) ||
    typeof run.builder?.id !== "string" ||
    run.builder.id.length === 0 ||
    !isPlainObject(run.metadata) ||
    !DIGEST_PATTERN.test(run.metadata.invocationId ?? "") ||
    !RFC3339_UTC_PATTERN.test(run.metadata.startedOn ?? "") ||
    !RFC3339_UTC_PATTERN.test(run.metadata.finishedOn ?? "") ||
    Date.parse(run.metadata.startedOn) !== expectedTime ||
    Date.parse(run.metadata.finishedOn) !== expectedTime ||
    !isPlainObject(parameters) ||
    parameters.imageReference !== image.reference ||
    parameters.baseImageReference !== expectedBase ||
    parameters.policyDigest !== POLICY_DIGEST ||
    parameters.sourceDateEpoch !== source.sourceDateEpoch ||
    parameters.sourceCommit !== image.sourceRevision ||
    parameters.sourceTree !== image.sourceTree ||
    !hasResolvedDependency(
      definition.resolvedDependencies,
      expectedBase.slice(0, expectedBase.lastIndexOf("@")),
      "sha256",
      expectedBase.slice(expectedBase.lastIndexOf("sha256:") + 7),
    ) ||
    !hasResolvedDependency(
      definition.resolvedDependencies,
      POLICY_URI,
      "sha256",
      POLICY_DIGEST.slice(7),
    ) ||
    (isCaddy && (
      definition.buildType !== "https://chaotang.local/buildtypes/upstream-pinned-image-adoption/v1" ||
      run.builder.id !== "https://github.com/docker/buildx" ||
      definition.internalParameters.adoptionMode !== "pinned-upstream"
    )) ||
    (!isCaddy && (
      definition.buildType !== "https://mobyproject.org/buildkit@v1" ||
      !run.builder.id.startsWith("https://mobyproject.org/buildkit") ||
      definition.internalParameters.buildkitMode !== "max" ||
      !DIGEST_PATTERN.test(definition.internalParameters.rawProvenanceDigest ?? "")
    ))
  ) fail("PROVENANCE_INVALID");
  if (!hasResolvedDependency(
    definition.resolvedDependencies,
    `${SOURCE_REPOSITORY}@${source.commit}`,
    "gitTree",
    source.tree,
  )) fail("PROVENANCE_INVALID");
  if (!isCaddy) {
    validateRawBuildkitProvenance(
      definition.internalParameters.rawBuildkitProvenance,
      image.reference,
      expectedBase,
      definition.internalParameters.rawProvenanceDigest,
    );
  }
}

function expectedImagesEnv(images) {
  const references = new Map(images.map((image) => [image.name, image.reference]));
  return [
    `BACKEND_IMAGE=${references.get("backend")}`,
    `CADDY_IMAGE=${references.get("caddy")}`,
    `FRONTEND_IMAGE=${references.get("frontend")}`,
    "",
  ].join("\n");
}

function validateManifest(manifest) {
  assertClosed(manifest, ["schemaVersion", "platform", "runtimeRegistryDigest", "source", "tools", "locks", "deployment", "images", "files"]);
  if (
    manifest.schemaVersion !== "chaotang-offline-release.v2" ||
    manifest.platform !== "linux/amd64" ||
    manifest.runtimeRegistryDigest !== RUNTIME_REGISTRY_DIGEST
  ) {
    fail("MANIFEST_SCHEMA_INVALID");
  }
  assertClosed(manifest.source, ["commit", "tree", "sourceDateEpoch"]);
  assertString(manifest.source.commit, SHA_PATTERN);
  assertString(manifest.source.tree, SHA_PATTERN);
  if (!Number.isSafeInteger(manifest.source.sourceDateEpoch) || manifest.source.sourceDateEpoch < 0) fail("MANIFEST_SCHEMA_INVALID");
  const toolKeys = ["docker", "buildx", "buildkit", "node", "python", "caddy", "syft", "grype"];
  assertClosed(manifest.tools, toolKeys);
  for (const key of toolKeys) {
    assertString(manifest.tools[key]);
    if (manifest.tools[key] !== EXPECTED_TOOLS[key]) fail("TOOL_IDENTITY_MISMATCH");
  }

  if (!Array.isArray(manifest.files) || manifest.files.length !== REQUIRED_FILE_KINDS.size) {
    fail("MANIFEST_SCHEMA_INVALID");
  }
  const fileMap = new Map();
  const casefold = new Set();
  let previous = "";
  for (const file of manifest.files) {
    assertClosed(file, ["path", "bytes", "sha256", "kind"]);
    assertSafeBundlePath(file.path);
    if (previous && file.path.localeCompare(previous, "en") <= 0) fail("MANIFEST_SCHEMA_INVALID");
    previous = file.path;
    const folded = file.path.toLocaleLowerCase("en-US");
    if (fileMap.has(file.path) || casefold.has(folded)) fail("MANIFEST_SCHEMA_INVALID");
    casefold.add(folded);
    if (!Number.isSafeInteger(file.bytes) || file.bytes < 0 || file.bytes > MAX_ENTRY_BYTES) fail("MANIFEST_SCHEMA_INVALID");
    assertString(file.sha256, DIGEST_PATTERN);
    if (!FILE_KINDS.has(file.kind)) fail("MANIFEST_SCHEMA_INVALID");
    if (file.kind === "oci-archive" && !file.path.endsWith(".oci.tar")) fail("MANIFEST_SCHEMA_INVALID");
    fileMap.set(file.path, file);
  }
  for (const [path, kind] of REQUIRED_FILE_KINDS) {
    if (fileMap.get(path)?.kind !== kind) fail("MANIFEST_SCHEMA_INVALID");
  }

  if (!Array.isArray(manifest.locks) || manifest.locks.length !== 2) fail("MANIFEST_SCHEMA_INVALID");
  const lockPaths = ["locks/backend.requirements-runtime.lock", "locks/frontend.package-lock.json"];
  for (const [index, lock] of manifest.locks.entries()) {
    assertClosed(lock, ["path", "sha256"]);
    assertSafeBundlePath(lock.path); assertString(lock.sha256, DIGEST_PATTERN);
    if (
      lock.path !== lockPaths[index] ||
      fileMap.get(lock.path)?.sha256 !== lock.sha256 ||
      fileMap.get(lock.path)?.kind !== "lock"
    ) fail("MANIFEST_SCHEMA_INVALID");
  }
  assertClosed(manifest.deployment, [
    "composePath", "composeSha256", "caddyfilePath", "caddyfileSha256", "imagesEnvPath", "imagesEnvSha256",
  ]);
  for (const [pathKey, digestKey] of [["composePath", "composeSha256"], ["caddyfilePath", "caddyfileSha256"], ["imagesEnvPath", "imagesEnvSha256"]]) {
    assertSafeBundlePath(manifest.deployment[pathKey]); assertString(manifest.deployment[digestKey], DIGEST_PATTERN);
    if (fileMap.get(manifest.deployment[pathKey])?.sha256 !== manifest.deployment[digestKey]) fail("MANIFEST_SCHEMA_INVALID");
  }
  if (
    manifest.deployment.composePath !== "deploy/compose.yaml" ||
    manifest.deployment.caddyfilePath !== "deploy/Caddyfile" ||
    manifest.deployment.imagesEnvPath !== "deploy/images.env"
  ) fail("MANIFEST_SCHEMA_INVALID");
  if (!Array.isArray(manifest.images) || manifest.images.length !== 3) fail("MANIFEST_SCHEMA_INVALID");
  const names = [];
  for (const image of manifest.images) {
    assertClosed(image, [
      "name", "reference", "archivePath", "archiveSha256", "sbomPath", "sbomSha256",
      "provenancePath", "provenanceSha256", "sourceRevision", "sourceTree",
    ]);
    assertString(image.name, /^(?:backend|caddy|frontend)$/); names.push(image.name);
    assertString(image.reference, REFERENCE_PATTERN);
    const expectedPrefix = image.name === "backend" ? "chaotang-backend@"
      : image.name === "frontend" ? "chaotang-frontend@" : null;
    if (
      (image.name === "caddy" && image.reference !== BASE_IMAGES.caddy) ||
      (expectedPrefix && !image.reference.startsWith(expectedPrefix))
    ) fail("IMAGE_REFERENCE_MISMATCH");
    if (
      image.archivePath !== `images/${image.name}.oci.tar` ||
      image.sbomPath !== `images/${image.name}.sbom.json` ||
      image.provenancePath !== `images/${image.name}.provenance.json`
    ) fail("MANIFEST_SCHEMA_INVALID");
    for (const [pathKey, digestKey, kind] of [["archivePath", "archiveSha256", "oci-archive"], ["sbomPath", "sbomSha256", "sbom"], ["provenancePath", "provenanceSha256", "provenance"]]) {
      assertSafeBundlePath(image[pathKey]); assertString(image[digestKey], DIGEST_PATTERN);
      const file = fileMap.get(image[pathKey]);
      if (!file || file.sha256 !== image[digestKey] || file.kind !== kind) fail("MANIFEST_SCHEMA_INVALID");
    }
    if (image.name === "caddy") {
      if (image.sourceRevision !== null || image.sourceTree !== null) fail("MANIFEST_SCHEMA_INVALID");
    } else {
      assertString(image.sourceRevision, SHA_PATTERN); assertString(image.sourceTree, SHA_PATTERN);
      if (image.sourceRevision !== manifest.source.commit || image.sourceTree !== manifest.source.tree) fail("MANIFEST_SCHEMA_INVALID");
    }
  }
  if (names.join(",") !== "backend,caddy,frontend") fail("MANIFEST_SCHEMA_INVALID");
  return fileMap;
}

export async function inventoryBundle(root) {
  const rootInfo = await lstat(root);
  const euid = typeof process.geteuid === "function" ? process.geteuid() : null;
  if (
    !rootInfo.isDirectory() ||
    rootInfo.isSymbolicLink() ||
    (euid !== null && rootInfo.uid !== euid) ||
    (rootInfo.mode & 0o022) !== 0
  ) fail("UNSAFE_BUNDLE_ENTRY");
  if (await realpath(root) !== root) fail("UNSAFE_BUNDLE_ENTRY");
  const entries = new Map();
  const folded = new Set();
  let totalBytes = 0;
  let entryCount = 0;
  async function visit(directory, prefix = "") {
    const names = await readdir(directory);
    for (const name of names.sort()) {
      const relativePath = prefix ? `${prefix}/${name}` : name;
      assertSafeBundlePath(relativePath);
      const path = resolve(directory, name);
      const info = await lstat(path);
      if (info.isSymbolicLink()) fail("UNSAFE_BUNDLE_ENTRY");
      entryCount += 1;
      if (entryCount > MAX_ENTRIES) fail("BUNDLE_LIMIT_EXCEEDED");
      const caseKey = relativePath.toLocaleLowerCase("en-US");
      if (folded.has(caseKey)) fail("UNSAFE_BUNDLE_ENTRY");
      folded.add(caseKey);
      if (info.isDirectory()) {
        if (
          await realpath(path) !== path ||
          (euid !== null && info.uid !== euid) ||
          (info.mode & 0o022) !== 0
        ) fail("UNSAFE_BUNDLE_ENTRY");
        await visit(path, relativePath);
        continue;
      }
      if (
        !info.isFile() ||
        info.nlink !== 1 ||
        (euid !== null && info.uid !== euid) ||
        (info.mode & 0o022) !== 0
      ) fail("UNSAFE_BUNDLE_ENTRY");
      if (info.size > MAX_ENTRY_BYTES) fail("BUNDLE_LIMIT_EXCEEDED");
      totalBytes += info.size;
      if (totalBytes > MAX_BUNDLE_BYTES) fail("BUNDLE_LIMIT_EXCEEDED");
      if (entries.has(relativePath)) fail("UNSAFE_BUNDLE_ENTRY");
      entries.set(relativePath, { path, bytes: info.size, dev: info.dev, ino: info.ino });
    }
  }
  await visit(root);
  return entries;
}

export async function terminalBundleAudit(root, initialEntries, expectedEntries, fileMap, canonical, expectedDigest) {
  const finalEntries = await inventoryBundle(root);
  if (finalEntries.size !== initialEntries.size) fail("FILE_CHANGED_DURING_VERIFICATION");
  for (const expected of expectedEntries) {
    const before = initialEntries.get(expected);
    const after = finalEntries.get(expected);
    if (
      !before || !after ||
      before.dev !== after.dev ||
      before.ino !== after.ino ||
      before.bytes !== after.bytes
    ) fail("FILE_CHANGED_DURING_VERIFICATION");
  }
  const manifestRaw = await readEntryText(finalEntries.get("manifest.json"));
  const digestRaw = await readEntryText(finalEntries.get("manifest.sha256"), 80);
  if (manifestRaw !== canonical || digestRaw !== `${expectedDigest}\n`) {
    fail("FILE_CHANGED_DURING_VERIFICATION");
  }
  for (const file of fileMap.values()) {
    if (await digestEntry(finalEntries.get(file.path)) !== file.sha256) {
      fail("FILE_CHANGED_DURING_VERIFICATION");
    }
  }
  return finalEntries;
}

async function createSnapshotRoot(outputDir = null) {
  if (outputDir === null) return mkdtemp(resolve(tmpdir(), "chaotang-release-verify-"));
  const root = resolve(outputDir);
  const parent = dirname(root);
  const parentInfo = await lstat(parent);
  const euid = typeof process.geteuid === "function" ? process.geteuid() : null;
  if (
    !parentInfo.isDirectory() || parentInfo.isSymbolicLink() || await realpath(parent) !== parent ||
    (euid !== null && parentInfo.uid !== euid) || (parentInfo.mode & 0o022) !== 0 ||
    !basename(root)
  ) fail("SNAPSHOT_OUTPUT_UNSAFE");
  try {
    await lstat(root);
    fail("SNAPSHOT_OUTPUT_EXISTS");
  } catch (error) {
    if (error instanceof ReleaseVerificationError) throw error;
    if (error?.code !== "ENOENT") fail("SNAPSHOT_OUTPUT_UNSAFE");
  }
  await mkdir(root, { recursive: false, mode: 0o700 });
  if (await realpath(root) !== root) fail("SNAPSHOT_OUTPUT_UNSAFE");
  return root;
}

async function copyBundleSnapshot(entries, outputDir = null) {
  const root = await createSnapshotRoot(outputDir);
  try {
    for (const [name, entry] of entries) {
      const destination = resolve(root, name);
      await mkdir(dirname(destination), { recursive: true, mode: 0o700 });
      const source = await openBundleEntry(entry);
      const output = await open(destination, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL, 0o600);
      try {
        const buffer = Buffer.alloc(Math.min(1024 * 1024, Math.max(entry.bytes, 1)));
        let offset = 0;
        while (offset < entry.bytes) {
          const length = Math.min(buffer.length, entry.bytes - offset);
          const result = await source.read(buffer, 0, length, offset);
          if (result.bytesRead !== length) fail("FILE_CHANGED_DURING_VERIFICATION");
          let written = 0;
          while (written < length) {
            const write = await output.write(buffer, written, length - written, offset + written);
            if (write.bytesWritten <= 0) fail("FILE_CHANGED_DURING_VERIFICATION");
            written += write.bytesWritten;
          }
          offset += length;
        }
        const after = await source.stat();
        if (
          after.dev !== entry.dev || after.ino !== entry.ino || after.size !== entry.bytes ||
          !after.isFile() || after.nlink !== 1
        ) fail("FILE_CHANGED_DURING_VERIFICATION");
        await output.sync();
      } finally {
        await Promise.allSettled([source.close(), output.close()]);
      }
    }
    return root;
  } catch (error) {
    await rm(root, { recursive: true, force: true });
    throw error;
  }
}

async function compareSourceToSnapshot(sourceRoot, initialEntries, snapshotEntries) {
  const finalEntries = await inventoryBundle(sourceRoot);
  if (finalEntries.size !== initialEntries.size || finalEntries.size !== snapshotEntries.size) {
    fail("FILE_CHANGED_DURING_VERIFICATION");
  }
  for (const [name, before] of initialEntries) {
    const after = finalEntries.get(name);
    const snapshot = snapshotEntries.get(name);
    if (
      !after || !snapshot || after.dev !== before.dev || after.ino !== before.ino ||
      after.bytes !== before.bytes || await digestEntry(after) !== await digestEntry(snapshot)
    ) fail("FILE_CHANGED_DURING_VERIFICATION");
  }
}

async function verifyOfflineReleaseSnapshot(root, expectation) {
  const entries = await inventoryBundle(root);
  const manifestEntry = entries.get("manifest.json");
  const manifestDigestEntry = entries.get("manifest.sha256");
  if (!manifestEntry || !manifestDigestEntry || manifestEntry.bytes > MAX_JSON_BYTES || manifestDigestEntry.bytes > 80) {
    fail("REQUIRED_MANIFEST_MISSING");
  }
  const manifestRaw = await readEntryText(manifestEntry);
  const manifest = parseJsonStrict(manifestRaw);
  const fileMap = validateManifest(manifest);
  const evidenceImages = new Map();
  const archiveImages = new Map();
  for (const image of manifest.images) {
    archiveImages.set(image.archivePath, image);
    evidenceImages.set(image.sbomPath, image);
    evidenceImages.set(image.provenancePath, image);
  }
  const canonical = canonicalize(manifest);
  if (manifestRaw !== canonical) fail("MANIFEST_NOT_CANONICAL");
  const expectedDigest = digestBytes(Buffer.from(canonical, "utf8"));
  const digestRaw = await readEntryText(manifestDigestEntry, 80);
  if (digestRaw !== `${expectedDigest}\n`) fail("MANIFEST_DIGEST_MISMATCH");
  if (
    expectation.candidateCommit !== manifest.source.commit ||
    expectation.candidateTree !== manifest.source.tree ||
    expectation.runtimeRegistryDigest !== manifest.runtimeRegistryDigest ||
    expectation.releaseManifestDigest !== expectedDigest
  ) fail("RELEASE_EXPECTATION_MISMATCH");

  const expectedEntries = new Set(["manifest.json", "manifest.sha256", ...fileMap.keys()]);
  for (const entry of entries.keys()) if (!expectedEntries.has(entry)) fail("UNEXPECTED_BUNDLE_ENTRY");
  for (const expected of expectedEntries) if (!entries.has(expected)) fail("BUNDLE_FILE_MISSING");
  for (const file of manifest.files) {
    const entry = entries.get(file.path);
    if (entry.bytes !== file.bytes) fail("FILE_SIZE_MISMATCH");
    if (await digestEntry(entry) !== file.sha256) fail("FILE_DIGEST_MISMATCH");
    if (file.kind === "oci-archive") {
      const image = archiveImages.get(file.path);
      if (!image) fail("MANIFEST_SCHEMA_INVALID");
      await inspectOciArchive(entry.path, image, manifest.source, entry);
    }
    if (file.kind === "sbom" || file.kind === "provenance") {
      const image = evidenceImages.get(file.path);
      if (!image) fail("MANIFEST_SCHEMA_INVALID");
      await validateEvidenceFile(entry, file.kind, image, manifest.source);
    }
  }
  const imagesEnvEntry = entries.get("deploy/images.env");
  if (
    imagesEnvEntry.bytes > MAX_JSON_BYTES ||
    await readEntryText(imagesEnvEntry) !== expectedImagesEnv(manifest.images)
  ) fail("IMAGE_REFERENCE_MISMATCH");
  const finalEntries = await terminalBundleAudit(
    root, entries, expectedEntries, fileMap, canonical, expectedDigest,
  );
  if (await readEntryText(finalEntries.get("deploy/images.env")) !== expectedImagesEnv(manifest.images)) {
    fail("FILE_CHANGED_DURING_VERIFICATION");
  }
  return { ok: true, manifestDigest: expectedDigest, filesVerified: manifest.files.length };
}

export async function verifyOfflineRelease(bundleDir, dependencies = {}) {
  const expectation = validateReleaseExpectation(dependencies.expectation);
  const sourceRoot = resolve(bundleDir);
  const sourceEntries = await inventoryBundle(sourceRoot);
  const snapshotRoot = await copyBundleSnapshot(sourceEntries, dependencies.snapshotOutput ?? null);
  const retainSnapshot = dependencies.snapshotOutput !== undefined;
  try {
    const result = await verifyOfflineReleaseSnapshot(snapshotRoot, expectation);
    if (dependencies.beforeTerminalAudit) await dependencies.beforeTerminalAudit();
    await compareSourceToSnapshot(sourceRoot, sourceEntries, await inventoryBundle(snapshotRoot));
    return { ...result, expectationDigest: expectation.expectationDigest, snapshotRetained: retainSnapshot };
  } finally {
    if (!retainSnapshot) await rm(snapshotRoot, { recursive: true, force: true });
  }
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    const values = {};
    const argv = process.argv.slice(2);
    if (argv.length % 2 !== 0) fail("CLI_INVALID");
    for (let index = 0; index < argv.length; index += 2) {
      const key = argv[index];
      const value = argv[index + 1];
      if (!["--bundle", "--expectation", "--snapshot-output"].includes(key) || !value || values[key]) fail("CLI_INVALID");
      values[key] = value;
    }
    if (!values["--bundle"] || !values["--expectation"]) fail("CLI_INVALID");
    const expectationPath = resolve(values["--expectation"]);
    const expectationInfo = await lstat(expectationPath);
    if (!expectationInfo.isFile() || expectationInfo.isSymbolicLink() || expectationInfo.nlink !== 1 || expectationInfo.size > MAX_JSON_BYTES) {
      fail("RELEASE_EXPECTATION_INVALID");
    }
    const expectationRaw = await readFile(expectationPath, "utf8");
    const expectation = validateReleaseExpectation(parseJsonStrict(expectationRaw));
    if (expectationRaw !== `${canonicalize(expectation)}\n`) fail("RELEASE_EXPECTATION_INVALID");
    const dependencies = { expectation };
    if (values["--snapshot-output"]) dependencies.snapshotOutput = values["--snapshot-output"];
    const result = await verifyOfflineRelease(values["--bundle"], dependencies);
    process.stdout.write(`${canonicalize(result)}\n`);
  } catch (error) {
    process.stderr.write(`${error?.code ?? error?.message ?? "RELEASE_VERIFY_FAILED"}\n`);
    process.exitCode = 1;
  }
}
