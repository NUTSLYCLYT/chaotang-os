#!/usr/bin/env node

import { readFileSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const CONTRACT_PATH = resolve(
  SCRIPT_DIR,
  "../docs/contracts/decision-quality-gate.schema.json",
);
const CONTRACT = JSON.parse(readFileSync(CONTRACT_PATH, "utf8"));
const MAX_INPUT_BYTES = 1024 * 1024;
const MIN_HONEST_CASES = 20;
const MIN_ADVERSARIAL_CASES = 20;
const SCHEMA_ANNOTATION_KEYS = new Set(["$id", "$schema", "title", "description", "$defs"]);
const SUPPORTED_SCHEMA_KEYS = new Set([
  "$ref",
  "additionalProperties",
  "const",
  "enum",
  "items",
  "maxItems",
  "maxLength",
  "minItems",
  "minLength",
  "pattern",
  "properties",
  "required",
  "type",
  "uniqueItems",
]);

function nonblank(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function sameJsonValue(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function resolveSchemaRef(reference) {
  if (!reference.startsWith("#/$defs/")) return null;
  return CONTRACT.$defs?.[reference.slice("#/$defs/".length)] ?? null;
}

function assertSupportedSchema(schema, seen = new Set()) {
  if (!isPlainObject(schema) || seen.has(schema)) return;
  seen.add(schema);
  for (const key of Object.keys(schema)) {
    if (!SUPPORTED_SCHEMA_KEYS.has(key) && !SCHEMA_ANNOTATION_KEYS.has(key)) {
      throw new Error(`unsupported_schema_keyword:${key}`);
    }
  }
  for (const child of Object.values(schema.properties ?? {})) assertSupportedSchema(child, seen);
  if (isPlainObject(schema.items)) assertSupportedSchema(schema.items, seen);
  for (const child of Object.values(schema.$defs ?? {})) assertSupportedSchema(child, seen);
}

assertSupportedSchema(CONTRACT);

function validateSchema(value, schema) {
  if (schema.$ref) {
    const resolved = resolveSchemaRef(schema.$ref);
    return resolved !== null && validateSchema(value, resolved);
  }
  if (Object.hasOwn(schema, "const") && !sameJsonValue(value, schema.const)) return false;
  if (schema.enum && !schema.enum.some((entry) => sameJsonValue(value, entry))) return false;

  if (schema.type !== undefined) {
    const accepted = Array.isArray(schema.type) ? schema.type : [schema.type];
    const typeMatches = accepted.some((type) => {
      if (type === "null") return value === null;
      if (type === "array") return Array.isArray(value);
      if (type === "object") return isPlainObject(value);
      return typeof value === type;
    });
    if (!typeMatches) return false;
  }

  if (typeof value === "string") {
    if (schema.minLength !== undefined && value.trim().length < schema.minLength) return false;
    if (schema.maxLength !== undefined && value.length > schema.maxLength) return false;
    if (schema.pattern !== undefined && !new RegExp(schema.pattern, "u").test(value)) return false;
  }

  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) return false;
    if (schema.maxItems !== undefined && value.length > schema.maxItems) return false;
    if (schema.uniqueItems) {
      const serialized = value.map((item) => JSON.stringify(item));
      if (new Set(serialized).size !== serialized.length) return false;
    }
    if (schema.items && value.some((item) => !validateSchema(item, schema.items))) return false;
  }

  if (isPlainObject(value)) {
    const properties = schema.properties ?? {};
    if (schema.additionalProperties === false) {
      if (Object.keys(value).some((key) => !Object.hasOwn(properties, key))) return false;
    }
    if ((schema.required ?? []).some((key) => !Object.hasOwn(value, key))) return false;
    for (const [key, childSchema] of Object.entries(properties)) {
      if (Object.hasOwn(value, key) && !validateSchema(value[key], childSchema)) return false;
    }
  }
  return true;
}

function sortedUnique(values) {
  return [...new Set(values)].sort();
}

function exactErrors(left, right) {
  return sameJsonValue(sortedUnique(left), sortedUnique(right));
}

function safeTopLevelPatch(base, patch) {
  if (!isPlainObject(base) || !isPlainObject(patch)) {
    throw new Error("fixture_patch_invalid");
  }
  const allowed = new Set(Object.keys(base));
  if (Object.keys(patch).some((key) => !allowed.has(key))) {
    throw new Error("fixture_patch_unknown_field");
  }
  return { ...structuredClone(base), ...structuredClone(patch) };
}

export function materializeFixtureCase(basePacket, fixtureCase, baseTrustedContext) {
  if (!isPlainObject(baseTrustedContext) || Object.hasOwn(fixtureCase, "patch")) {
    throw new Error("fixture_trusted_context_required");
  }
  const packet = safeTopLevelPatch(basePacket, fixtureCase.packet_patch ?? {});
  const trustedBase = structuredClone(baseTrustedContext);
  const trustedPatch = fixtureCase.trusted_context_patch ?? {};
  const trustedContext = safeTopLevelPatch(trustedBase, trustedPatch);
  if (!Object.hasOwn(trustedPatch, "decision_id")) trustedContext.decision_id = packet.decision_id;
  if (!Object.hasOwn(trustedPatch, "action_digest")) trustedContext.action_digest = packet.action_digest;
  return { packet, trustedContext };
}

export function evaluateDecisionPacket(packet, trustedContext) {
  if (trustedContext === undefined) {
    return { pass: false, errors: ["trusted_context_required"] };
  }
  const envelope = { packet, trusted_context: trustedContext };
  if (!validateSchema(envelope, CONTRACT)) {
    return { pass: false, errors: ["packet_shape_invalid"] };
  }

  const errors = new Set();
  const evidenceById = new Set(packet.evidence.map((item) => item.evidence_id));
  const verifiedEvidence = new Set(trustedContext.verified_evidence_ids);
  const claimIds = packet.claims.map((claim) => claim.claim_id);
  const evidenceIds = packet.evidence.map((item) => item.evidence_id);
  if (new Set(claimIds).size !== claimIds.length) errors.add("claim_id_duplicate");
  if (new Set(evidenceIds).size !== evidenceIds.length) errors.add("evidence_id_duplicate");

  for (const claim of packet.claims) {
    if (packet.status === "completed" && claim.evidence_refs.length === 0) {
      errors.add("completed_claim_evidence_required");
    }
    if (claim.critical && claim.evidence_refs.length === 0) {
      errors.add("critical_claim_evidence_required");
    }
    for (const ref of claim.evidence_refs) {
      if (!evidenceById.has(ref)) errors.add("claim_evidence_ref_unknown");
      if (claim.critical && evidenceById.has(ref) && !verifiedEvidence.has(ref)) {
        errors.add("critical_claim_evidence_unverified");
      }
    }
  }

  for (const [name, state, values] of [
    ["conflict", packet.conflict_state, packet.conflicts],
    ["blocker", packet.blocker_state, packet.blockers],
    ["risk", packet.risk_state, packet.risks],
  ]) {
    if ((state === "none" && values.length > 0) || (state === "present" && values.length === 0)) {
      errors.add(`${name}_state_mismatch`);
    }
  }

  if (packet.status === "completed" && packet.data_gaps.length > 0) {
    errors.add("completed_with_data_gaps");
  }
  if (packet.status === "completed" && packet.conflicts.length > 0) {
    errors.add("completed_with_conflicts");
  }
  if (packet.status === "completed" && packet.blockers.length > 0) {
    errors.add("completed_with_blockers");
  }
  if (packet.status === "completed" && ["DEMO", "FALLBACK"].includes(packet.source.mode)) {
    errors.add("non_live_source_completed");
  }

  if (
    trustedContext.decision_id !== packet.decision_id ||
    trustedContext.action_digest !== packet.action_digest
  ) {
    errors.add("trusted_context_binding_mismatch");
  }
  const confirmation = trustedContext.human_confirmation;
  const confirmationStateValid =
    (confirmation.status === "not_required" &&
      confirmation.required === false &&
      confirmation.approval_ref === null) ||
    (confirmation.status === "pending" &&
      confirmation.required === true &&
      confirmation.approval_ref === null) ||
    (confirmation.status === "approved" &&
      confirmation.required === true &&
      nonblank(confirmation.approval_ref)) ||
    (confirmation.status === "rejected" && confirmation.required === true);
  if (!confirmationStateValid) errors.add("human_confirmation_state_invalid");
  if (trustedContext.high_risk) {
    if (!confirmation.required) errors.add("high_risk_confirmation_required");
    if (packet.status === "completed" && confirmation.status !== "approved") {
      errors.add("completed_without_human_approval");
    }
    if (confirmation.status === "approved" && !nonblank(confirmation.approval_ref)) {
      errors.add("human_approval_ref_required");
    }
  } else if (confirmation.status !== "not_required") {
    errors.add("human_confirmation_state_invalid");
  }

  const ordered = [...errors].sort();
  return { pass: ordered.length === 0, errors: ordered };
}

function fixtureSuiteShapeErrors(suite) {
  const errors = [];
  if (!isPlainObject(suite)) return ["fixture_suite_invalid"];
  const expectedKeys = new Set(["schema_version", "base_packet", "base_trusted_context", "cases"]);
  if (
    Object.keys(suite).length !== expectedKeys.size ||
    Object.keys(suite).some((key) => !expectedKeys.has(key)) ||
    suite.schema_version !== "1.0.0" ||
    !isPlainObject(suite.base_packet) ||
    !isPlainObject(suite.base_trusted_context) ||
    !Array.isArray(suite.cases) ||
    suite.cases.length > 100
  ) {
    errors.push("fixture_suite_invalid");
    return errors;
  }
  const honest = suite.cases.filter((entry) => entry?.expected_pass === true).length;
  const adversarial = suite.cases.filter((entry) => entry?.expected_pass === false).length;
  if (honest < MIN_HONEST_CASES || adversarial < MIN_ADVERSARIAL_CASES) {
    errors.push("fixture_coverage_insufficient");
  }
  const ids = [];
  for (const entry of suite.cases) {
    if (!isPlainObject(entry) || !nonblank(entry.case_id) || typeof entry.expected_pass !== "boolean") {
      errors.push("fixture_case_invalid");
      continue;
    }
    ids.push(entry.case_id);
    if (!entry.expected_pass && (!Array.isArray(entry.expected_errors) || entry.expected_errors.length === 0)) {
      errors.push("fixture_expected_errors_required");
    }
  }
  if (new Set(ids).size !== ids.length) errors.push("fixture_case_id_duplicate");
  return sortedUnique(errors);
}

export function evaluateFixtureSuite(suite) {
  const suiteErrors = fixtureSuiteShapeErrors(suite);
  if (suiteErrors.length > 0) {
    return { pass: false, total: 0, passed: 0, errors: suiteErrors, failures: [] };
  }
  const failures = [];
  for (const fixtureCase of suite.cases) {
    try {
      const { packet, trustedContext } = materializeFixtureCase(
        suite.base_packet,
        fixtureCase,
        suite.base_trusted_context,
      );
      const result = evaluateDecisionPacket(packet, trustedContext);
      const expectedErrors = fixtureCase.expected_errors ?? [];
      const matches =
        result.pass === fixtureCase.expected_pass && exactErrors(result.errors, expectedErrors);
      if (!matches) {
        failures.push({
          case_id: fixtureCase.case_id,
          expected_pass: fixtureCase.expected_pass,
          expected_errors: expectedErrors,
          actual: result,
        });
      }
    } catch (error) {
      failures.push({
        case_id: fixtureCase.case_id,
        expected_pass: fixtureCase.expected_pass,
        expected_errors: fixtureCase.expected_errors ?? [],
        actual: { pass: false, errors: [error instanceof Error ? error.message : String(error)] },
      });
    }
  }
  return {
    pass: failures.length === 0,
    total: suite.cases.length,
    passed: suite.cases.length - failures.length,
    failures,
  };
}

export function main(argv = process.argv.slice(2)) {
  if (argv.length !== 1) {
    throw new Error("usage: node scripts/decision_quality_gate.mjs <packet-or-suite.json>");
  }
  const inputPath = resolve(argv[0]);
  if (statSync(inputPath).size > MAX_INPUT_BYTES) throw new Error("input_too_large");
  const input = JSON.parse(readFileSync(inputPath, "utf8"));
  const result = Object.hasOwn(input, "cases")
    ? evaluateFixtureSuite(input)
    : evaluateDecisionPacket(input.packet, input.trusted_context);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  return result.pass ? 0 : 1;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    process.exitCode = main();
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 2;
  }
}
