#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { parseJsonStrict } from "./product-authority.mjs";

export const SCHEMA_VERSION = "mingshuo.project-fact-pack.v1";
export const RESULT_SCHEMA_VERSION = "mingshuo.fact-pack.validation.v1";

const FACT_PACK_SCHEMA = parseJsonStrict(readFileSync(new URL(
  "../docs/contracts/mingshuo-project-fact-pack.schema.json", import.meta.url,
), "utf8"));

// Only the keywords used by this versioned contract are supported. A future
// schema cannot silently introduce an ignored validation constraint.
const SCHEMA_KEYS = new Set(["$schema", "$id", "title", "description", "type",
  "properties", "required", "additionalProperties", "const", "enum", "pattern",
  "minLength", "maxLength", "minItems", "maxItems", "uniqueItems", "items", "format"]);
function checkSchemaKeywords(rule) {
  for (const key of Object.keys(rule)) if (!SCHEMA_KEYS.has(key)) throw new Error(`Unsupported fact-pack schema keyword: ${key}`);
  if (rule.format !== undefined && rule.format !== "date") throw new Error("Unsupported fact-pack format");
  for (const child of Object.values(rule.properties ?? {})) checkSchemaKeywords(child);
  if (rule.items) checkSchemaKeywords(rule.items);
}
checkSchemaKeywords(FACT_PACK_SCHEMA);

function isJsonValue(value, parents = new Set(), depth = 0) {
  if (depth > 128) return false;
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (!Array.isArray(value) && !isPlainObject(value)) return false;
  if (parents.has(value)) return false;
  parents.add(value);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const valid = Reflect.ownKeys(descriptors).every((key) => {
    if (Array.isArray(value) && key === "length") return true;
    if (Array.isArray(value) && (typeof key !== "string" || !/^(0|[1-9]\d*)$/.test(key) || Number(key) >= value.length)) return false;
    const descriptor = descriptors[key];
    return typeof key === "string" && descriptor.enumerable && Object.hasOwn(descriptor, "value")
      && isJsonValue(descriptor.value, parents, depth + 1);
  }) && (!Array.isArray(value) || Object.keys(value).length === value.length);
  parents.delete(value);
  return valid;
}

function schemaErrors(rule, value, location = "$", errors = []) {
  // Bound diagnostics, never acceptance: any recorded violation still STOPs.
  if (errors.length >= 128) return errors;
  const fail = (keyword) => { if (errors.length < 128) errors.push(`SCHEMA:${location}:${keyword}`); };
  const types = rule.type === undefined ? [] : array(Array.isArray(rule.type) ? rule.type : [rule.type]);
  const actual = value === null ? "null" : Array.isArray(value) ? "array" : typeof value;
  if (types.length && !types.includes(actual)) { fail("type"); return errors; }
  if (Object.hasOwn(rule, "const") && !isDeepStrictEqual(value, rule.const)) fail("const");
  if (rule.enum && !rule.enum.some((item) => isDeepStrictEqual(value, item))) fail("enum");
  if (typeof value === "string") {
    const length = [...value].length;
    if (rule.minLength !== undefined && length < rule.minLength) fail("minLength");
    if (rule.maxLength !== undefined && length > rule.maxLength) fail("maxLength");
    if (rule.pattern !== undefined && !new RegExp(rule.pattern, "u").test(value)) fail("pattern");
    if (rule.format === "date" && !isoDate(value)) fail("format");
  }
  if (Array.isArray(value)) {
    if (rule.minItems !== undefined && value.length < rule.minItems) fail("minItems");
    if (rule.maxItems !== undefined && value.length > rule.maxItems) fail("maxItems");
    if (rule.uniqueItems && value.some((item, i) => value.slice(0, i).some((other) => isDeepStrictEqual(item, other)))) fail("uniqueItems");
    if (rule.items) value.forEach((item, i) => schemaErrors(rule.items, item, `${location}/${i}`, errors));
  }
  if (isPlainObject(value)) {
    for (const key of rule.required ?? []) if (!Object.hasOwn(value, key)) fail(`required:${key}`);
    for (const key of Object.keys(value)) {
      if (Object.hasOwn(rule.properties ?? {}, key)) schemaErrors(rule.properties[key], value[key], `${location}/${key}`, errors);
      else if (rule.additionalProperties === false) fail(`additionalProperties:${key}`);
    }
  }
  return errors;
}

const TOP_LEVEL_KEYS = Object.freeze([
  "businessSuccessMeasured",
  "channels",
  "claims",
  "commercial",
  "evidence",
  "facts",
  "knowledgeWriteBack",
  "productionPromotionAuthorized",
  "project",
  "safety",
  "schemaVersion",
  "skuCandidates",
  "sourcePolicy",
  "tenant",
]);

const SOURCE_CLASSES = new Set([
  "PUBLIC_CANDIDATE",
  "SUPPLIER_ASSERTED",
  "INTERNAL_MEASURED",
  "THIRD_PARTY_VERIFIED",
  "FROZEN_RELEASED",
]);

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    && [Object.prototype, null].includes(Object.getPrototypeOf(value));
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function isoDate(value) {
  if (typeof value !== "string" || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value) || value.length !== 10) return false;
  const [year, month, day] = value.split("-").map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return year >= 1 && month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1];
}

function clockDay(options) {
  if (!isPlainObject(options)) return null;
  const now = Object.hasOwn(options, "now") ? options.now : new Date().toISOString();
  if (typeof now !== "string") return null;
  if (isoDate(now)) return now;
  const match = /^(\d{4}-\d{2}-\d{2})T([01]\d|2[0-3]):([0-5]\d):([0-5]\d)(?:\.\d{1,9})?Z$/.exec(now);
  return match && match[0] === now && isoDate(match[1]) ? match[1] : null;
}

function eligibleEvidenceIds(pack, today) {
  return new Set(array(pack.evidence).filter((item) => item?.adoptionStatus === "ADOPTED"
    && isoDate(item.validUntil) && item.validUntil >= today).map((item) => item.id));
}

function digest(value) {
  return typeof value === "string" && /^sha256:[0-9a-f]{64}$/.test(value);
}

function idList(items) {
  return array(items).map((item) => item?.id).filter((id) => typeof id === "string");
}

function duplicateIds(items) {
  const seen = new Set();
  const duplicates = new Set();
  for (const id of idList(items)) {
    if (seen.has(id)) duplicates.add(id);
    seen.add(id);
  }
  return [...duplicates].sort();
}

function stableDigest(value) {
  return `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
}

export function buildExampleFactPack() {
  return {
    schemaVersion: SCHEMA_VERSION,
    tenant: {
      id: "mingshuo-demo-tenant",
      ownerUserId: "owner-demo",
    },
    project: {
      id: "mingshuo-demo-project",
      name: "铭硕非生产方案样例",
      productLines: ["CELL", "PACK_POWER"],
      markets: ["EU", "US"],
      languages: ["zh-CN", "en"],
      status: "READY_FOR_REVIEW",
    },
    skuCandidates: [
      { id: "sku-slot-1", label: "候选电芯", status: "EVIDENCE_BOUND", parameterStatus: "EVIDENCE_BOUND" },
      { id: "sku-slot-2", label: "候选PACK", status: "EVIDENCE_BOUND", parameterStatus: "PARTIAL" },
      { id: "sku-slot-3", label: "候选方案", status: "RESERVED", parameterStatus: "MISSING" },
    ],
    sourcePolicy: {
      finalTruthSource: "COURTOS_SERVER_EVIDENCE_BINDING",
      imaMode: "READ_ONLY",
      externalModelMode: "DRAFT_ASSIST_ONLY",
      knowledgePromotion: "CANDIDATE_ONLY",
    },
    evidence: [
      {
        id: "ev-cell-spec",
        sourceClass: "INTERNAL_MEASURED",
        digest: "sha256:1111111111111111111111111111111111111111111111111111111111111111",
        validUntil: "2027-12-31",
        adoptionStatus: "ADOPTED",
      },
      {
        id: "ev-cert-scope",
        sourceClass: "THIRD_PARTY_VERIFIED",
        digest: "sha256:2222222222222222222222222222222222222222222222222222222222222222",
        validUntil: "2027-06-30",
        adoptionStatus: "ADOPTED",
      },
      {
        id: "ev-price-owner",
        sourceClass: "SUPPLIER_ASSERTED",
        digest: "sha256:3333333333333333333333333333333333333333333333333333333333333333",
        validUntil: "2027-01-31",
        adoptionStatus: "ADOPTED",
      },
    ],
    facts: [
      {
        id: "fact-capacity",
        kind: "PARAMETER",
        subject: "sku-slot-1",
        value: "capacity evidence is present; public value withheld in non-production sample",
        evidenceRefs: ["ev-cell-spec"],
      },
      {
        id: "fact-certification",
        kind: "CERTIFICATION",
        subject: "sku-slot-1",
        value: "certification scope requires market review before external claim",
        evidenceRefs: ["ev-cert-scope"],
      },
    ],
    claims: [
      {
        id: "claim-cell-evidence",
        text: "候选电芯资料已绑定内部量测证据，仍需人工确认对外口径。",
        evidenceRefs: ["ev-cell-spec"],
        approvalStatus: "DRAFT",
      },
      {
        id: "claim-cert-scope",
        text: "认证资料存在，但对外适用范围必须按市场逐项复核。",
        evidenceRefs: ["ev-cert-scope"],
        approvalStatus: "DRAFT",
      },
    ],
    commercial: {
      priceAuthority: {
        status: "APPROVED",
        approver: "commercial-owner-demo",
      },
      quoteStatus: "DRAFT",
    },
    channels: [
      { id: "ALIBABA_INTL", state: "DRAFT", publicationAuthorized: false },
      { id: "WEBSITE", state: "DRAFT", publicationAuthorized: false },
      { id: "MINIPROGRAM", state: "DRAFT", publicationAuthorized: false },
      { id: "CUSTOMER_COACH", state: "DRAFT", publicationAuthorized: false },
    ],
    safety: {
      dangerousOperationalInstructionsPresent: false,
    },
    knowledgeWriteBack: {
      status: "CANDIDATE_ONLY",
    },
    businessSuccessMeasured: false,
    productionPromotionAuthorized: false,
  };
}

export function validateMingshuoFactPack(pack, options = {}) {
  const errors = [];
  const holdReasons = [];
  const blockReasons = [];
  const add = (bucket, condition, code) => {
    if (condition && !bucket.includes(code)) bucket.push(code);
  };

  if (!isPlainObject(pack) || !isJsonValue(pack)) {
    return {
      schemaVersion: RESULT_SCHEMA_VERSION,
      decision: "STOP",
      nonAuthorizing: true,
      errors: ["PACKET_NOT_JSON_OBJECT"],
      holdReasons,
      blockReasons,
      businessSuccessMeasured: false,
      productionPromotionAuthorized: false,
    };
  }

  const today = clockDay(options);
  add(errors, today === null, "VALIDATION_CLOCK_INVALID");
  for (const error of schemaErrors(FACT_PACK_SCHEMA, pack)) errors.push(error);

  const keys = Object.keys(pack).sort();
  add(errors, JSON.stringify(keys) !== JSON.stringify(TOP_LEVEL_KEYS), "UNKNOWN_TOP_LEVEL_FIELD");
  add(errors, pack.schemaVersion !== SCHEMA_VERSION, "SCHEMA_VERSION_INVALID");

  add(errors, !isPlainObject(pack.tenant) || typeof pack.tenant.id !== "string" || typeof pack.tenant.ownerUserId !== "string", "TENANT_INVALID");
  add(errors, !isPlainObject(pack.project) || !Array.isArray(pack.project.productLines) || pack.project.productLines.length === 0, "PROJECT_INVALID");
  add(errors, !Array.isArray(pack.skuCandidates) || pack.skuCandidates.length < 3 || pack.skuCandidates.length > 5, "SKU_CANDIDATE_COUNT_INVALID");
  add(errors, duplicateIds(pack.skuCandidates).length > 0, "SKU_CANDIDATE_ID_DUPLICATE");
  add(errors, duplicateIds(pack.evidence).length > 0, "EVIDENCE_ID_DUPLICATE");
  add(errors, duplicateIds(pack.facts).length > 0, "FACT_ID_DUPLICATE");
  add(errors, duplicateIds(pack.claims).length > 0, "CLAIM_ID_DUPLICATE");

  for (const evidence of array(pack.evidence)) {
    add(errors, !SOURCE_CLASSES.has(evidence?.sourceClass), "EVIDENCE_SOURCE_CLASS_INVALID");
    add(errors, !digest(evidence?.digest), "EVIDENCE_DIGEST_INVALID");
    add(errors, !isoDate(evidence?.validUntil), "EVIDENCE_VALIDITY_INVALID");
    if (today !== null && isoDate(evidence?.validUntil)) {
      add(holdReasons, evidence.validUntil < today, "EVIDENCE_EXPIRED");
    }
  }

  const evidenceIds = new Set(idList(pack.evidence));
  const eligibleIds = today === null ? new Set() : eligibleEvidenceIds(pack, today);
  const factIds = idList(pack.facts);
  const claimIds = idList(pack.claims);
  add(holdReasons, factIds.length === 0, "FACTS_MISSING");
  add(holdReasons, claimIds.length === 0, "CLAIMS_MISSING");

  for (const fact of array(pack.facts)) {
    const refs = array(fact?.evidenceRefs);
    add(holdReasons, refs.length === 0, "FACT_EVIDENCE_MISSING");
    add(holdReasons, refs.some((ref) => !evidenceIds.has(ref)), "FACT_EVIDENCE_UNRESOLVED");
    add(holdReasons, refs.some((ref) => evidenceIds.has(ref) && !eligibleIds.has(ref)), "FACT_EVIDENCE_INELIGIBLE");
  }
  for (const claim of array(pack.claims)) {
    const refs = array(claim?.evidenceRefs);
    add(holdReasons, refs.length === 0, "CLAIM_EVIDENCE_MISSING");
    add(holdReasons, refs.some((ref) => !evidenceIds.has(ref)), "CLAIM_EVIDENCE_UNRESOLVED");
    add(holdReasons, refs.some((ref) => evidenceIds.has(ref) && !eligibleIds.has(ref)), "CLAIM_EVIDENCE_INELIGIBLE");
  }

  add(
    blockReasons,
    pack?.sourcePolicy?.finalTruthSource !== "COURTOS_SERVER_EVIDENCE_BINDING",
    "SECOND_TRUTH_SOURCE_FORBIDDEN",
  );
  add(blockReasons, pack?.knowledgeWriteBack?.status === "ACTIVE", "KNOWLEDGE_AUTO_PROMOTION_FORBIDDEN");
  const needsPriceAuthority = array(pack.facts).some((fact) => fact?.kind === "PRICE") || pack?.commercial?.quoteStatus !== "NOT_REQUESTED";
  const authority = pack?.commercial?.priceAuthority;
  const priceApproved = authority?.status === "APPROVED" && typeof authority.approver === "string" && authority.approver.trim().length > 0;
  add(blockReasons, needsPriceAuthority && !priceApproved, "PRICE_AUTHORITY_MISSING");
  add(blockReasons, array(pack.channels).some((channel) => channel?.publicationAuthorized === true || channel?.state === "PUBLISHED"), "EXTERNAL_PUBLICATION_NOT_AUTHORIZED");
  add(blockReasons, pack?.safety?.dangerousOperationalInstructionsPresent === true, "DANGEROUS_OPERATIONAL_INSTRUCTIONS_FORBIDDEN");
  add(blockReasons, pack.businessSuccessMeasured !== false, "BUSINESS_SUCCESS_CLAIM_FORBIDDEN");
  add(blockReasons, pack.productionPromotionAuthorized !== false, "PRODUCTION_PROMOTION_FORBIDDEN");

  const decision = errors.length > 0
    ? "STOP"
    : blockReasons.length > 0
      ? "BLOCK"
      : holdReasons.length > 0
        ? "HOLD"
        : "PASS";

  return {
    schemaVersion: RESULT_SCHEMA_VERSION,
    decision,
    nonAuthorizing: true,
    errors: errors.sort(),
    holdReasons: holdReasons.sort(),
    blockReasons: blockReasons.sort(),
    evidenceDigest: errors.length ? null : stableDigest(array(pack.evidence)),
    factDigest: errors.length ? null : stableDigest(array(pack.facts)),
    claimDigest: errors.length ? null : stableDigest(array(pack.claims)),
    businessSuccessMeasured: false,
    productionPromotionAuthorized: false,
  };
}

export function summarizeMingshuoFactPack(pack, options = {}) {
  // Resolve the clock once so expiry validation and coverage cannot disagree
  // across midnight. Invalid input yields an empty, explicitly STOP summary.
  const today = clockDay(options);
  const validation = validateMingshuoFactPack(pack, { now: today });
  if (validation.decision === "STOP") return {
    schemaVersion: "mingshuo.fact-pack.summary.v1", decision: "STOP", nonAuthorizing: true,
    productLines: [], skuCandidateCount: 0, evidenceCount: 0, factCount: 0, claimCount: 0,
    claimEvidenceCoverage: "0/0", errors: validation.errors,
    holdReasons: validation.holdReasons, blockReasons: validation.blockReasons,
    businessSuccessMeasured: false, productionPromotionAuthorized: false,
  };
  const productLines = [...new Set(array(pack?.project?.productLines))].sort();
  const claimCount = array(pack?.claims).length;
  const evidenceCount = array(pack?.evidence).length;
  const evidenceIds = eligibleEvidenceIds(pack, today);
  const coveredClaims = array(pack?.claims).filter((claim) => array(claim?.evidenceRefs).length > 0 && array(claim.evidenceRefs).every((ref) => evidenceIds.has(ref))).length;
  return {
    schemaVersion: "mingshuo.fact-pack.summary.v1",
    decision: validation.decision,
    nonAuthorizing: true,
    productLines,
    skuCandidateCount: array(pack?.skuCandidates).length,
    evidenceCount,
    factCount: array(pack?.facts).length,
    claimCount,
    claimEvidenceCoverage: `${coveredClaims}/${claimCount}`,
    errors: validation.errors,
    holdReasons: validation.holdReasons,
    blockReasons: validation.blockReasons,
    businessSuccessMeasured: false,
    productionPromotionAuthorized: false,
  };
}

function runCli() {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args.length === 1 && args[0] !== "--check")) {
    process.stderr.write("usage: node scripts/mingshuo-fact-pack.mjs [--check]\n");
    process.exitCode = 2;
    return;
  }
  const pack = buildExampleFactPack();
  const result = validateMingshuoFactPack(pack, { now: "2026-09-04T12:00:00Z" });
  const summary = summarizeMingshuoFactPack(pack, { now: "2026-09-04T12:00:00Z" });
  const output = {
    schemaVersion: "mingshuo.fact-pack.check.v1",
    decision: result.decision,
    nonAuthorizing: true,
    summary,
    validation: result,
    businessSuccessMeasured: false,
    productionPromotionAuthorized: false,
  };
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  if (args[0] === "--check" && result.decision !== "PASS") process.exitCode = 1;
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === currentFile) {
  runCli();
}
