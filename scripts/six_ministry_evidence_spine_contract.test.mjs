import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();
const schemaPath = join(root, "docs/contracts/six-ministry-evidence-spine.schema.json");
const contractPath = join(root, "docs/contracts/six-ministry-evidence-spine.md");
const decisionPath = join(root, "docs/decisions/0044-six-ministry-evidence-spine.md");
const taskPath = join(root, "docs/product/tasks/2026-08-14-six-ministry-trusted-evidence-spine.md");

const schema = () => JSON.parse(readFileSync(schemaPath, "utf8"));

function walkSchemas(node, visit) {
  if (!node || typeof node !== "object") return;
  visit(node);
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) value.forEach((item) => walkSchemas(item, visit));
    else walkSchemas(value, visit);
  }
}

test("the exchange contract is closed at every object boundary", () => {
  const document = schema();
  assert.equal(document.$schema, "https://json-schema.org/draft/2020-12/schema");
  assert.equal(document.$id, "https://chaotang-os.invalid/contracts/six-ministry-evidence-spine.schema.json");
  assert.deepEqual(document.oneOf, [
    { $ref: "#/$defs/decisionRequest" },
    { $ref: "#/$defs/decisionEnvelope" },
  ]);
  walkSchemas(document, (node) => {
    if (node.type === "object") {
      assert.equal(node.additionalProperties, false, `open object schema: ${JSON.stringify(node)}`);
      assert.ok(Array.isArray(node.required), `object must declare required keys: ${JSON.stringify(node)}`);
      assert.deepEqual([...node.required].sort(), Object.keys(node.properties ?? {}).sort());
    }
  });
});

test("request contains intent and opaque material bindings, never identity, routing, trust or authority claims", () => {
  const request = schema().$defs.decisionRequest;
  assert.deepEqual(Object.keys(request.properties).sort(), [
    "constraints",
    "material_refs",
    "message_type",
    "objective",
    "request_id",
    "schema_version",
  ]);
  assert.equal(request.properties.message_type.const, "decision_request");
  assert.deepEqual(Object.keys(schema().$defs.requestConstraints.properties).sort(), ["as_of", "output_language"]);
  assert.deepEqual(Object.keys(schema().$defs.materialRef.properties).sort(), ["expected_digest", "kind", "opaque_id", "version"]);
  const forbidden = ["owner", "owner_user_id", "tenant", "tenant_id", "verified", "approved", "permission", "tool", "url", "path", "status", "capability", "ministry", "department"];
  const requestText = JSON.stringify(request).toLowerCase();
  for (const field of forbidden) assert.doesNotMatch(requestText, new RegExp(`\\"${field}\\"\\s*:`), field);
});

test("response fixes the current isolation and no-effect posture", () => {
  const defs = schema().$defs;
  assert.equal(defs.scope.properties.scope_mode.const, "owner_only");
  assert.deepEqual(defs.scope.properties.tenant_id, { type: "null" });
  assert.equal(defs.externalEffects.properties.authorized.const, false);
  assert.equal(defs.externalEffects.properties.mode.const, "none");
  assert.deepEqual(defs.decision.properties.status.enum, ["completed", "degraded", "failed"]);
  assert.deepEqual(defs.decision.properties.action_disposition.enum, ["preview", "hold", "block"]);
  assert.deepEqual(Object.keys(defs.decision.properties).sort(), [
    "action_disposition",
    "artifact_refs",
    "conflicts",
    "facts",
    "findings",
    "missing_evidence",
    "next_actions",
    "risks",
    "status",
    "summary",
  ]);
});

test("stable errors identify phase and retryability", () => {
  const error = schema().$defs.decisionError;
  assert.deepEqual(Object.keys(error.properties).sort(), ["code", "phase", "retryable"]);
  assert.deepEqual(error.properties.phase.enum, ["request", "identity", "routing", "runtime", "evidence", "authority", "decision", "audit"]);
  assert.deepEqual(error.properties.code.enum, [
    "INVALID_REQUEST",
    "IDENTITY_UNAVAILABLE",
    "OWNER_SCOPE_MISMATCH",
    "ROUTE_UNAPPROVED",
    "RUNTIME_SKILL_UNAVAILABLE",
    "MATERIAL_NOT_FOUND",
    "MATERIAL_BINDING_MISMATCH",
    "EVIDENCE_UNAVAILABLE",
    "EVIDENCE_INCOMPLETE",
    "EVIDENCE_CONFLICT",
    "EVIDENCE_STALE",
    "AUTHORITY_UNAVAILABLE",
    "AUTHORITY_DENIED",
    "JOINT_REVIEW_REQUIRED",
    "AUDIT_WRITE_FAILED",
    "INTERNAL_ERROR",
  ]);
});

test("architecture and task documents preserve the existing authorities and honest ministry readiness", () => {
  const text = [contractPath, decisionPath, taskPath].map((path) => readFileSync(path, "utf8")).join("\n");
  for (const adr of ["ADR 0018", "ADR 0027", "ADR 0028", "ADR 0029", "ADR 0036", "ADR 0037"]) assert.match(text, new RegExp(adr));
  for (const source of [
    "Evidence Protocol",
    "CurrentUser",
    "RuntimeSkill",
    "WorkProduct",
    "ConfirmationReceipt",
    "DecreeJob",
    "军机处",
  ]) assert.match(text, new RegExp(source));
  assert.match(text, /户部[^\n]*(真实|grounding)/i);
  assert.match(text, /礼部[^\n]*(citation|引用)[^\n]*draft/i);
  for (const ministry of ["吏部", "刑部", "工部", "兵部"]) assert.match(text, new RegExp(`${ministry}[^\\n]*(降级|degraded|缺少权威)`, "i"));
  assert.match(text, /不得成为第二事实源/);
  assert.match(text, /外部副作用[^\n]*false/);
});
