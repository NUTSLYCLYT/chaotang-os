import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();
const schemaPath = join(root, "docs/contracts/six-ministry-capability-execution.schema.json");
const mappingPath = join(root, "docs/contracts/six-ministry-capability-execution.md");
const fixturePath = join(root, "scripts/fixtures/six-ministry-execution/security-cases.json");

const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const exact = (value, keys) => object(value) && Object.keys(value).length === keys.length && Object.keys(value).every((key) => keys.includes(key));
const strings = (value) => Array.isArray(value) && value.every((item) => typeof item === "string" && item.length > 0) && new Set(value).size === value.length;

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
  const fixture = JSON.parse(readFileSync(fixturePath, "utf8"));
  assert.deepEqual(validate(merge(fixture.base, fixture.valid_preview_patch), fixture.trusted_context), []);
  assert.deepEqual(validate(merge(fixture.base, fixture.valid_confirmed_execution_patch), fixture.trusted_context), []);
});

test("hostile fixtures fail closed at authority, owner, review, confirmation, tool, and evidence boundaries", () => {
  const fixture = JSON.parse(readFileSync(fixturePath, "utf8"));
  for (const item of fixture.hostile_cases) assert.ok(validate(merge(fixture.base, item.patch), merge(fixture.trusted_context, item.trusted_patch ?? {})).includes(item.expected_error), item.id);
});

test("unknown fields and type confusion fail closed", () => {
  const fixture = JSON.parse(readFileSync(fixturePath, "utf8"));
  const preview = merge(fixture.base, fixture.valid_preview_patch);
  assert.deepEqual(validate({ ...preview, model_approved: true }, fixture.trusted_context), ["envelope_shape_invalid"]);
  const confused = structuredClone(preview); confused.identity.owner_user_id = { value: "owner-1" };
  assert.ok(validate(confused, fixture.trusted_context).includes("identity_invalid"));
});
