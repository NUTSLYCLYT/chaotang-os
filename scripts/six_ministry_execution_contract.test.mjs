import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { canonicalDigest, resolveTrustedAuthority, validateCapabilityCapsule, verifyCapabilityLockfile } from "./capability_capsule.mjs";
import { parseJsonNoDuplicateKeys } from "./execution_authority_ext.mjs";

const root = process.cwd();
const schemaPath = join(root, "docs/contracts/six-ministry-capability-execution.schema.json");
const mappingPath = join(root, "docs/contracts/six-ministry-capability-execution.md");
const fixturePath = join(root, "scripts/fixtures/six-ministry-execution/security-cases.json");

const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const exact = (value, keys) => object(value) && Object.keys(value).length === keys.length && Object.keys(value).every((key) => keys.includes(key));
const strings = (value) => Array.isArray(value) && value.every((item) => typeof item === "string" && item.length > 0) && new Set(value).size === value.length;
const CAPSULE_TYPES = new Set(["Tool", "Skill", "Agent", "Workflow", "Swarm", "Expert", "Pack"]);
const CAPSULE_REASON_CODES = ["candidate_only", "exact_zero_grant", "mapping_unresolved"];
const EXPECTED_CAPSULE_IDS = [
  "decision-quality-gate",
  "hubu-financial-grounding",
  "hubu-payment-three-gates",
  "libu-responsibility-authority-chain",
  "rites-message-quality-gate",
  "rites-war-truthfulness",
];
const MAX_PROTOCOL_BYTES = 256 * 1024;

function assertCheckedInCapabilityLayout(ids, standardIds, legacyIds) {
  assert.deepEqual(ids, EXPECTED_CAPSULE_IDS);
  assert.equal(ids.length, 6);
  assert.equal(standardIds.length, 5);
  assert.equal(legacyIds.length, 1);
  assert.deepEqual([...standardIds, ...legacyIds].sort(), ids);
  assert.deepEqual(legacyIds, ["rites-message-quality-gate"]);
  assert.deepEqual(standardIds, EXPECTED_CAPSULE_IDS.filter((id) => id !== "rites-message-quality-gate"));
}

function parseProtocolJson(text) {
  if (typeof text !== "string" || Buffer.byteLength(text, "utf8") > MAX_PROTOCOL_BYTES) throw new Error("PROTOCOL_JSON_BUDGET_EXCEEDED");
  return parseJsonNoDuplicateKeys(text);
}

const capabilityRef = (capabilities, id) => ({
  capability_id: id,
  version: capabilities[id].version,
  capsule_digest: capabilities[id].capsule_digest,
});

function materializePatch(value, capabilities, ids) {
  if (value === "REF:0") return capabilityRef(capabilities, ids[0]);
  if (value === "REF:1") return capabilityRef(capabilities, ids[1]);
  if (value === "ID:0") return ids[0];
  if (value === "ID:1") return ids[1];
  if (Array.isArray(value)) return value.map((item) => materializePatch(item, capabilities, ids));
  if (!object(value)) return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, materializePatch(item, capabilities, ids)]));
}

function validateCapsuleEnvelope(envelope, trusted = {}) {
  const errors = new Set();
  if (!exact(envelope, ["schema_version", "contract_role", "capability_binding", "principal_binding", "capability_view", "security_projection", "outcome"])) return ["capsule_envelope_shape_invalid"];
  if (envelope.schema_version !== "1.0.0" || envelope.contract_role !== "capability-capsule-binding-candidate-not-authority") errors.add("capsule_contract_identity_invalid");
  const binding = envelope.capability_binding;
  if (!exact(binding, ["capability_id", "version", "capsule_digest", "lock_digest", "projection_digest", "mapping_status"]) || binding?.mapping_status !== "UNRESOLVED") errors.add("capsule_binding_invalid");
  const resolved = trusted.capabilities?.[binding?.capability_id];
  if (!object(resolved) || resolved.version !== binding?.version || resolved.capsule_digest !== binding?.capsule_digest || resolved.lock_digest !== binding?.lock_digest || resolved.projection_digest !== binding?.projection_digest) errors.add("capsule_binding_invalid");
  const principals = envelope.principal_binding;
  if (!exact(principals, ["status", "tenant_principal_ref", "owner_membership_ref", "run_ref"]) || principals?.status !== "UNRESOLVED" || principals?.tenant_principal_ref !== null || principals?.owner_membership_ref !== null || principals?.run_ref !== null) errors.add("capsule_principal_invalid");
  const security = envelope.security_projection;
  if (!exact(security, ["lifecycle", "execution_authority", "external_effects", "publisher_status", "sbom_status", "qualified_use", "activation", "durable_receipt", "revocation_epoch_status", "mcp_status", "mcp_decision", "mcp_refs", "a2a_status", "a2a_decision"]) || security?.lifecycle !== "CANDIDATE_ONLY" || security?.execution_authority !== "NONE" || security?.external_effects !== false || security?.publisher_status !== "UNVERIFIED" || security?.sbom_status !== "UNVERIFIED" || security?.qualified_use !== "NOT_MEASURED" || security?.activation !== "DENY" || security?.durable_receipt !== "ABSENT" || security?.revocation_epoch_status !== "UNAVAILABLE") errors.add("capsule_non_authority_boundary_invalid");
  if (security?.mcp_status !== "UNAVAILABLE" || security?.mcp_decision !== "DENY" || !Array.isArray(security?.mcp_refs) || security.mcp_refs.length !== 0) errors.add("capsule_mcp_forbidden");
  if (security?.a2a_status !== "UNSUPPORTED" || security?.a2a_decision !== "DENY") errors.add("capsule_a2a_forbidden");
  const view = envelope.capability_view;
  const validRef = (ref) => exact(ref, ["capability_id", "version", "capsule_digest"]) && object(trusted.capabilities?.[ref.capability_id]) && trusted.capabilities[ref.capability_id].version === ref.version && trusted.capabilities[ref.capability_id].capsule_digest === ref.capsule_digest;
  const refsValid = Array.isArray(view?.refs) && view.refs.length <= 32 && view.refs.every(validRef) && new Set(view.refs.map((ref) => JSON.stringify(ref))).size === view.refs.length;
  const validViewShape = exact(view, ["type", "resolution_status", "decision", "refs", "edges", "budget"]) && CAPSULE_TYPES.has(view.type) && view.decision === "DENY" && refsValid && Array.isArray(view.edges) && Number.isInteger(view.budget) && view.budget >= 1 && view.budget <= 32;
  if (!validViewShape) errors.add("capability_view_invalid");
  const refIds = validViewShape ? view.refs.map((ref) => ref.capability_id) : [];
  if (view?.type === "Pack" && (!validViewShape || view.resolution_status !== "CAPSULE_REFS_ONLY" || view.refs.length === 0 || view.refs.length > view.budget || view.edges.length !== 0 || refIds.some((ref, index) => index > 0 && ref <= refIds[index - 1]))) errors.add("pack_invalid");
  if (view?.type !== "Pack") errors.add("capability_view_unresolved");
  if (view?.type === "Swarm") errors.add("swarm_invalid");
  const outcome = envelope.outcome;
  if (!exact(outcome, ["status", "reason_codes"]) || outcome?.status !== "NO_EXECUTION_AUTHORITY" || JSON.stringify(outcome?.reason_codes) !== JSON.stringify(CAPSULE_REASON_CODES)) errors.add("capsule_outcome_invalid");
  return [...errors].sort();
}

function draft202012Errors(schema, instance) {
  const program = "import json,sys;from jsonschema import Draft202012Validator;p=json.load(open(sys.argv[1],encoding='utf-8'));e=sorted(x.message for x in Draft202012Validator(p['schema']).iter_errors(p['instance']));print(json.dumps(e))";
  const tempRoot = mkdtempSync("/tmp/chaotang-draft202012-");
  const payloadPath = join(tempRoot, "payload.json");
  try {
    writeFileSync(payloadPath, JSON.stringify({ schema, instance }), { encoding: "utf8", mode: 0o600 });
    const result = spawnSync("python3", ["-I", "-c", program, payloadPath], { encoding: "utf8", timeout: 10_000, maxBuffer: 1024 * 1024 });
    assert.equal(result.error, undefined, result.error?.message);
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(result.stdout);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

function checkedInCapabilities() {
  const candidatesRoot = join(root, "backend", "harness", "capability_candidates");
  const manifest = parseProtocolJson(readFileSync(join(candidatesRoot, "authority-manifest.json"), "utf8"));
  const standardRoot = join(candidatesRoot, "candidates");
  const standardIds = readdirSync(standardRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  const legacyIds = readdirSync(candidatesRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory() && entry.name !== "candidates").map((entry) => entry.name).sort();
  const ids = Object.keys(manifest.projections).sort();
  assertCheckedInCapabilityLayout(ids, standardIds, legacyIds);
  const capabilities = {};
  for (const id of ids) {
    const candidateRoot = legacyIds.includes(id) ? join(candidatesRoot, id) : join(standardRoot, id);
    const capsuleBytes = readFileSync(join(candidateRoot, "capsule.json"));
    const lockBytes = readFileSync(join(candidateRoot, "capsule.lock.json"));
    const capsule = parseProtocolJson(capsuleBytes.toString("utf8"));
    const lock = parseProtocolJson(lockBytes.toString("utf8"));
    const projection = resolveTrustedAuthority(manifest, id);
    assert.deepEqual(projection.errors, [], id);
    assert.deepEqual(validateCapabilityCapsule(capsule, { root: candidateRoot, environment: "production", trustedAuthority: projection.authority }), { ok: true, errors: [] }, id);
    assert.deepEqual(verifyCapabilityLockfile(capsule, lock, { root: candidateRoot }), { ok: true, errors: [] }, id);
    assert.deepEqual(projection.authority.grants, { approved_tools: [], approved_data_domains: [], may_write_external: false, human_confirmation_required: true }, id);
    for (const switchName of ["capability_enabled", "tenant_enabled", "tools_enabled"]) {
      assert.equal(capsule.controls.kill_switches[switchName], true, `${id}:${switchName}:baseline`);
      const killed = structuredClone(capsule);
      killed.controls.kill_switches[switchName] = false;
      assert.equal(validateCapabilityCapsule(killed, { root: candidateRoot, environment: "production", trustedAuthority: projection.authority }).ok, false, `${id}:${switchName}:killed`);
    }
    capabilities[id] = { version: capsule.version, capsule_digest: canonicalDigest(capsuleBytes), lock_digest: canonicalDigest(lockBytes), projection_digest: projection.authority.digest };
  }
  return { capabilities, ids };
}

function validate(envelope, trusted = {}) {
  const errors = new Set();
  if (!exact(envelope, ["schema_version", "contract_role", "runtime_skill_binding", "identity", "routing", "evidence", "responsibility", "execution", "tool_policy", "outcome"])) return ["envelope_shape_invalid"];
  if (envelope.schema_version !== "1.0.0" || envelope.contract_role !== "runtime-skill-compatibility-overlay-not-authority") errors.add("contract_identity_invalid");
  const binding = envelope.runtime_skill_binding;
  if (!exact(binding, ["skill_id", "definition_version", "authority_source", "registry_source", "definition_digest"]) || binding.authority_source !== "backend/app/agents/runtime_skills/models.py" || binding.registry_source !== "backend/app/agents/runtime_skills/registry.py" || !/^sha256:[0-9a-f]{64}$/.test(binding.definition_digest)) errors.add("runtime_skill_binding_invalid");
  const runtimeSkill = trusted.runtime_skills?.[binding.skill_id];
  if (!object(runtimeSkill) || runtimeSkill.version !== binding.definition_version || runtimeSkill.definition_digest !== binding.definition_digest || runtimeSkill.enabled !== true) errors.add("runtime_skill_binding_invalid");
  const identity = envelope.identity;
  if (!exact(identity, ["tenant_id", "owner_user_id", "run_id"]) || ![identity.tenant_id, identity.owner_user_id, identity.run_id].every((item) => typeof item === "string" && item.length > 0)) errors.add("identity_invalid");
  const evidence = envelope.evidence;
  const resolves = (group, ref) => { const value = trusted[group]?.[ref]; return object(value) && value.tenant_id === identity.tenant_id && value.owner_user_id === identity.owner_user_id && value.run_id === identity.run_id; };
  if (!exact(evidence, ["snapshot_ref", "status", "adopted_evidence_ids", "missing_evidence"]) || !resolves("evidence_snapshots", evidence.snapshot_ref) || !["RESOLVED", "PARTIAL", "BLOCKED", "UNAVAILABLE"].includes(evidence.status) || trusted.evidence_snapshots?.[evidence.snapshot_ref]?.status !== evidence.status || !strings(evidence.adopted_evidence_ids) || !strings(evidence.missing_evidence)) errors.add("evidence_invalid");
  if (evidence.status === "RESOLVED" && evidence.missing_evidence.length) errors.add("resolved_with_missing_evidence");
  const trustedEvidence = trusted.evidence_snapshots?.[evidence.snapshot_ref];
  if (trustedEvidence && (JSON.stringify(trustedEvidence.adopted_evidence_ids) !== JSON.stringify(evidence.adopted_evidence_ids) || JSON.stringify(trustedEvidence.missing_evidence) !== JSON.stringify(evidence.missing_evidence))) errors.add("evidence_invalid");
  const route = envelope.routing;
  if (!exact(route, ["mode", "ministries", "joint_review"]) || !["single", "multi"].includes(route.mode) || !strings(route.ministries) || route.ministries.length === 0 || !exact(route.joint_review, ["required", "status", "reviewer", "receipt_ref"])) errors.add("routing_invalid");
  const jointReceipt = trusted.joint_review_receipts?.[route.joint_review.receipt_ref];
  if (route.mode === "multi" && (route.ministries.length < 2 || route.joint_review.required !== true || route.joint_review.status !== "COMPLETED" || route.joint_review.reviewer !== "junjichu" || !resolves("joint_review_receipts", route.joint_review.receipt_ref) || jointReceipt?.status !== "COMPLETED" || jointReceipt?.reviewer !== "junjichu" || JSON.stringify(jointReceipt?.ministries) !== JSON.stringify(route.ministries))) errors.add("joint_review_required");
  if (route.mode === "single" && (route.ministries.length !== 1 || route.joint_review.required !== false || route.joint_review.status !== "NOT_REQUIRED" || route.joint_review.receipt_ref !== null)) errors.add("single_route_invalid");
  const responsibility = envelope.responsibility;
  const authority = trusted.authority_projections?.[responsibility.authority_projection_ref];
  if (!exact(responsibility, ["accountable_ministry", "responsible_bureaus", "authority_projection_ref"]) || !route.ministries.includes(responsibility.accountable_ministry) || !strings(responsibility.responsible_bureaus) || !resolves("authority_projections", responsibility.authority_projection_ref) || authority?.capability_id !== binding.skill_id || responsibility.accountable_ministry !== runtimeSkill?.accountable_ministry || JSON.stringify(runtimeSkill?.responsible_bureaus) !== JSON.stringify(responsibility.responsible_bureaus) || JSON.stringify(runtimeSkill?.required_ministries) !== JSON.stringify(route.ministries) || (runtimeSkill?.required_ministries?.length > 1 && route.mode !== "multi")) errors.add("responsibility_authority_invalid");
  const execution = envelope.execution;
  if (!exact(execution, ["phase", "side_effect_class", "preview_digest", "human_confirmation"]) || !["PREVIEW", "EXECUTE"].includes(execution.phase) || !["NONE", "INTERNAL_REVERSIBLE", "EXTERNAL_WRITE", "IRREVERSIBLE"].includes(execution.side_effect_class) || !exact(execution.human_confirmation, ["required", "status", "work_product_ref", "receipt_ref"])) errors.add("execution_invalid");
  const consequential = ["EXTERNAL_WRITE", "IRREVERSIBLE"].includes(execution.side_effect_class);
  const workProduct = trusted.work_products?.[execution.human_confirmation.work_product_ref];
  const confirmation = trusted.confirmation_receipts?.[execution.human_confirmation.receipt_ref];
  if (consequential && execution.phase === "EXECUTE" && (execution.human_confirmation.required !== true || execution.human_confirmation.status !== "CONFIRMED" || !resolves("work_products", execution.human_confirmation.work_product_ref) || !resolves("confirmation_receipts", execution.human_confirmation.receipt_ref) || confirmation?.work_product_ref !== execution.human_confirmation.work_product_ref || confirmation?.version !== workProduct?.version || confirmation?.decision !== "CONFIRMED" || workProduct?.content_digest !== execution.preview_digest)) errors.add("human_confirmation_required");
  if (execution.phase !== "EXECUTE" && envelope.tool_policy.decision === "ALLOW_EXECUTE") errors.add("preview_cannot_execute_tools");
  const tools = envelope.tool_policy;
  const toolDecision = trusted.tool_decisions?.[tools.decision_receipt_ref];
  const toolPolicy = trusted.tool_policies?.[tools.policy_ref];
  if (!exact(tools, ["policy_ref", "requested_tool_ids", "decision", "decision_receipt_ref"]) || !resolves("tool_policies", tools.policy_ref) || toolPolicy?.capability_id !== binding.skill_id || !strings(tools.requested_tool_ids) || tools.requested_tool_ids.some((id) => !runtimeSkill?.allowed_tool_ids?.includes(id)) || !["DENY", "ALLOW_PREVIEW", "ALLOW_EXECUTE"].includes(tools.decision) || (tools.decision !== "DENY" && (!tools.requested_tool_ids.length || !resolves("tool_decisions", tools.decision_receipt_ref) || toolDecision?.policy_ref !== tools.policy_ref || JSON.stringify(toolDecision?.requested_tool_ids) !== JSON.stringify(tools.requested_tool_ids) || toolDecision?.decision !== tools.decision || toolDecision?.side_effect_class !== execution.side_effect_class))) errors.add("tool_policy_invalid");
  const outcome = envelope.outcome;
  if (!exact(outcome, ["status", "reason_codes", "retryable"]) || !["READY", "DEGRADED", "BLOCKED", "FAILED"].includes(outcome.status) || !strings(outcome.reason_codes)) errors.add("outcome_invalid");
  if (["DEGRADED", "BLOCKED", "FAILED"].includes(outcome.status) && outcome.reason_codes.length === 0) errors.add("nonready_reason_required");
  if (["BLOCKED", "FAILED"].includes(outcome.status) && tools.decision !== "DENY") errors.add("terminal_outcome_denies_tools");
  if (["PARTIAL", "BLOCKED", "UNAVAILABLE"].includes(evidence.status) && outcome.status === "READY") errors.add("evidence_gap_cannot_be_ready");
  return [...errors].sort();
}

const merge = (base, patch) => {
  if (!object(base) || !object(patch)) return structuredClone(patch);
  const result = structuredClone(base);
  for (const [key, value] of Object.entries(patch)) result[key] = object(value) && object(result[key]) ? merge(result[key], value) : structuredClone(value);
  return result;
};

test("draft is an overlay over existing RuntimeSkill, evidence, and work-product facts", () => {
  const schema = JSON.parse(readFileSync(schemaPath, "utf8"));
  const mapping = readFileSync(mappingPath, "utf8");
  assert.equal(schema.$id, "https://chaotang-os.invalid/contracts/six-ministry-capability-execution.schema.json");
  for (const source of ["backend/app/agents/runtime_skills/models.py", "backend/app/agents/runtime_skills/registry.py", "backend/app/agents/evidence_protocol.py", "backend/app/work_products/models.py"]) assert.match(mapping, new RegExp(source.replaceAll("/", "\\/")));
  assert.match(mapping, /不得成为第二事实源/);
});

test("valid preview and confirmed execution fixtures satisfy the semantic guard", () => {
  const fixture = parseProtocolJson(readFileSync(fixturePath, "utf8"));
  assert.deepEqual(validate(merge(fixture.base, fixture.valid_preview_patch), fixture.trusted_context), []);
  assert.deepEqual(validate(merge(fixture.base, fixture.valid_confirmed_execution_patch), fixture.trusted_context), []);
});

test("hostile fixtures fail closed at authority, owner, review, confirmation, tool, and evidence boundaries", () => {
  const fixture = parseProtocolJson(readFileSync(fixturePath, "utf8"));
  for (const item of fixture.hostile_cases) assert.ok(validate(merge(fixture.base, item.patch), merge(fixture.trusted_context, item.trusted_patch ?? {})).includes(item.expected_error), item.id);
});

test("unknown fields and type confusion fail closed", () => {
  const fixture = parseProtocolJson(readFileSync(fixturePath, "utf8"));
  const preview = merge(fixture.base, fixture.valid_preview_patch);
  assert.deepEqual(validate({ ...preview, model_approved: true }, fixture.trusted_context), ["envelope_shape_invalid"]);
  const confused = structuredClone(preview); confused.identity.owner_user_id = { value: "owner-1" };
  assert.ok(validate(confused, fixture.trusted_context).includes("identity_invalid"));
});

test("schema exposes a strict explicit capsule-bound discriminator branch", () => {
  const schema = parseProtocolJson(readFileSync(schemaPath, "utf8"));
  assert.deepEqual(schema.oneOf, [{ "$ref": "#/$defs/runtimeSkillEnvelope" }, { "$ref": "#/$defs/capsuleBoundEnvelope" }]);
  assert.equal(schema.$defs.capsuleBoundEnvelope.properties.contract_role.const, "capability-capsule-binding-candidate-not-authority");
  assert.equal(schema.$defs.capsuleBoundEnvelope.additionalProperties, false);
});

test("Draft 2020-12 accepts both branches and rejects self-promotion", () => {
  const schema = parseProtocolJson(readFileSync(schemaPath, "utf8"));
  const fixture = parseProtocolJson(readFileSync(fixturePath, "utf8"));
  const { capabilities, ids } = checkedInCapabilities();
  const projection = merge(fixture.capsule_projection_base, {
    capability_binding: { capability_id: ids[0], ...capabilities[ids[0]] },
    capability_view: { type: "Pack", resolution_status: "CAPSULE_REFS_ONLY", decision: "DENY", refs: [capabilityRef(capabilities, ids[0])], edges: [], budget: 1 },
  });
  assert.deepEqual(draft202012Errors(schema, merge(fixture.base, fixture.valid_preview_patch)), []);
  assert.deepEqual(draft202012Errors(schema, merge(fixture.base, fixture.valid_confirmed_execution_patch)), []);
  assert.deepEqual(draft202012Errors(schema, projection), []);
  assert.ok(draft202012Errors(schema, merge(projection, { security_projection: { lifecycle: "ACTIVE" } })).length > 0);
});

test("mechanically binds exactly six checked-in capsules, locks, and exact-zero-grant projections", () => {
  const fixture = parseProtocolJson(readFileSync(fixturePath, "utf8"));
  const { capabilities, ids } = checkedInCapabilities();
  for (const id of ids) {
    const projection = merge(fixture.capsule_projection_base, {
      capability_binding: { capability_id: id, ...capabilities[id] },
      capability_view: { type: "Pack", resolution_status: "CAPSULE_REFS_ONLY", decision: "DENY", refs: [capabilityRef(capabilities, id)], edges: [], budget: 1 },
    });
    assert.deepEqual(validateCapsuleEnvelope(projection, { capabilities }), [], id);
  }
});

test("freezes the exact standard and legacy capsule directory identities", () => {
  const standardIds = EXPECTED_CAPSULE_IDS.filter((id) => id !== "decision-quality-gate");
  const legacyIds = ["decision-quality-gate"];
  assert.throws(() => assertCheckedInCapabilityLayout(EXPECTED_CAPSULE_IDS, standardIds, legacyIds));
});

test("capsule-bound security fixtures deny self-promotion, authority, MCP, A2A, Pack, and Swarm bypasses", () => {
  const fixture = parseProtocolJson(readFileSync(fixturePath, "utf8"));
  const schema = parseProtocolJson(readFileSync(schemaPath, "utf8"));
  const { capabilities, ids } = checkedInCapabilities();
  const base = merge(fixture.capsule_projection_base, {
    capability_binding: { capability_id: ids[0], ...capabilities[ids[0]] },
    capability_view: { type: "Pack", resolution_status: "CAPSULE_REFS_ONLY", decision: "DENY", refs: [capabilityRef(capabilities, ids[0])], edges: [], budget: 1 },
  });
  for (const item of fixture.capsule_hostile_cases) {
    const instance = merge(base, materializePatch(item.patch, capabilities, ids));
    const semanticErrors = validateCapsuleEnvelope(instance, { capabilities });
    assert.ok(draft202012Errors(schema, instance).length > 0 || semanticErrors.includes(item.expected_error), item.id);
    assert.ok(semanticErrors.includes(item.expected_error), item.id);
  }
});

test("only inert Pack resolves capsule refs while six runtime-dependent view types remain unresolved and denied", () => {
  const schema = parseProtocolJson(readFileSync(schemaPath, "utf8"));
  const fixture = parseProtocolJson(readFileSync(fixturePath, "utf8"));
  const { capabilities, ids } = checkedInCapabilities();
  const base = merge(fixture.capsule_projection_base, {
    capability_binding: { capability_id: ids[0], ...capabilities[ids[0]] },
  });
  const refs = ids.slice(0, 2).map((id) => capabilityRef(capabilities, id));
  const pack = merge(base, { capability_view: { type: "Pack", resolution_status: "CAPSULE_REFS_ONLY", decision: "DENY", refs, edges: [], budget: 2 } });
  assert.deepEqual(draft202012Errors(schema, pack), []);
  assert.deepEqual(validateCapsuleEnvelope(pack, { capabilities }), []);
  for (const type of ["Tool", "Skill", "Agent", "Workflow", "Swarm", "Expert"]) {
    const unresolved = merge(base, { capability_view: { type, resolution_status: "UNRESOLVED", decision: "DENY", refs: [], edges: [], budget: 1 } });
    assert.deepEqual(draft202012Errors(schema, unresolved), []);
    assert.ok(validateCapsuleEnvelope(unresolved, { capabilities }).includes("capability_view_unresolved"), type);
  }
  assert.equal(pack.security_projection.execution_authority, "NONE");
  assert.equal(pack.security_projection.external_effects, false);
  assert.equal(pack.outcome.status, "NO_EXECUTION_AUTHORITY");
});

test("strict parser rejects duplicates, non-finite numbers, excessive depth, and oversized protocol input", () => {
  assert.throws(() => parseProtocolJson('{"contract_role":"a","\\u0063ontract_role":"b"}'), /DUPLICATE_JSON_KEY/);
  for (const invalid of ['{"value":NaN}', '{"value":Infinity}', '{"value":1e999}']) assert.throws(() => parseProtocolJson(invalid), /TRUST_FILE_INVALID_JSON/);
  assert.throws(() => parseProtocolJson(`${"[".repeat(130)}0${"]".repeat(130)}`), /TRUST_FILE_INVALID_JSON/);
  assert.throws(() => parseProtocolJson(`{"padding":"${"x".repeat(MAX_PROTOCOL_BYTES)}"}`), /PROTOCOL_JSON_BUDGET_EXCEEDED/);
});
