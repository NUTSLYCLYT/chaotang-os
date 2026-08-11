import assert from "node:assert/strict";
import test from "node:test";

import {
  listShiguanArchives,
  updateShiguanDecision,
  type ArchiveDecisionValue,
} from "./backendClient.ts";

const REPLY_ARCHIVE = {
  type: "REPLY",
  title: "漕运回奏",
  content: "已核验漕运账册。",
  matter_type: "漕运",
  department: "户部",
  related_archive_ids: [],
  evidence: [],
  lessons_learned: null,
  pitfalls: null,
  participating_departments: ["户部"],
  source_kind: "DECREE",
  source_text: "核验漕运账册",
  reply_process: "户部核验后回奏",
  reply_conclusion: "账目相符",
  reply_time: "2026-08-09T01:00:00Z",
  respondent: "户部尚书",
  id: "reply-1",
  created_at: "2026-08-09T01:00:00Z",
  review_status: null,
  decision_status: null,
  evidence_references: [],
};

function options(body: unknown, status = 200) {
  return {
    baseUrl: "https://backend.invalid",
    fetchImpl: async () => new Response(JSON.stringify(body), { status }),
    scheduleTimeout: () => "timer",
    cancelTimeout: (timer: unknown) => assert.equal(timer, "timer"),
  };
}

test("Shiguan archives require explicit decision_status null or exact object", async () => {
  const pending = await listShiguanArchives(options([REPLY_ARCHIVE]));
  assert.equal(pending.ok, true);
  if (pending.ok) assert.equal(pending.data[0].decisionStatus, null);

  const decidedAt = "2026-08-09T02:00:00Z";
  const terminal = await listShiguanArchives(options([{
    ...REPLY_ARCHIVE,
    decision_status: { decision: "ADOPTED", decided_at: decidedAt },
  }]));
  assert.equal(terminal.ok, true);
  if (terminal.ok) {
    assert.deepEqual(terminal.data[0].decisionStatus, { decision: "ADOPTED", decidedAt });
  }

  for (const archive of [
    Object.fromEntries(Object.entries(REPLY_ARCHIVE).filter(([key]) => key !== "decision_status")),
    { ...REPLY_ARCHIVE, decision_status: undefined },
    { ...REPLY_ARCHIVE, decision_status: { decision: "ADOPTED" } },
    { ...REPLY_ARCHIVE, decision_status: { decision: "APPROVED", decided_at: "not-a-date" } },
    { ...REPLY_ARCHIVE, decision_status: { decision: "APPROVED", decided_at: "2026-08-09T02:00:00" } },
    { ...REPLY_ARCHIVE, decision_status: { decision: "ADOPTED", decided_at: decidedAt, extra: true } },
  ]) {
    const result = await listShiguanArchives(options([archive]));
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.kind, "unknown");
  }
});

test("Shiguan server decoder rejects decisions that do not belong to the archive type", async () => {
  const decidedAt = "2026-08-09T02:00:00Z";
  const memorial = {
    ...REPLY_ARCHIVE,
    id: "memorial-1",
    type: "MEMORIAL",
    related_archive_ids: [],
    source_kind: null,
    source_text: null,
    participating_departments: null,
    reply_process: null,
    reply_conclusion: null,
    reply_time: null,
    respondent: null,
    decision_status: { decision: "ADOPTED", decided_at: decidedAt },
  };
  const reply = {
    ...REPLY_ARCHIVE,
    decision_status: { decision: "APPROVED", decided_at: decidedAt },
  };

  for (const mismatched of [memorial, reply]) {
    const result = await listShiguanArchives(options([mismatched]));
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.kind, "unknown");
  }
});

test("updateShiguanDecision sends an encoded owner-free PUT and parses all four values", async () => {
  const values: ArchiveDecisionValue[] = [
    "APPROVED",
    "REJECTED",
    "ADOPTED",
    "RETURNED_FOR_RECONSIDERATION",
  ];
  for (const decision of values) {
    let observedUrl = "";
    let observedInit: RequestInit | undefined;
    const result = await updateShiguanDecision("archive /甲", decision, {
      ...options({ decision, decided_at: "2026-08-09T02:00:00Z" }),
      sessionId: "opaque-session",
      fetchImpl: async (input, init) => {
        observedUrl = String(input);
        observedInit = init;
        return new Response(JSON.stringify({
          decision,
          decided_at: "2026-08-09T02:00:00Z",
        }), { status: 200 });
      },
    });
    assert.deepEqual(result, {
      ok: true,
      data: { decision, decidedAt: "2026-08-09T02:00:00Z" },
    });
    assert.equal(observedUrl, "https://backend.invalid/api/v1/shiguan/archives/archive%20%2F%E7%94%B2/decision");
    assert.equal(observedInit?.method, "PUT");
    assert.deepEqual(JSON.parse(String(observedInit?.body)), { decision });
    const headers = observedInit?.headers as Record<string, string>;
    assert.equal(headers.authorization, "Bearer opaque-session");
    assert.equal("owner" in JSON.parse(String(observedInit?.body)), false);
  }
});

test("updateShiguanDecision maps conflict, storage, network and malformed success", async () => {
  const conflict = await updateShiguanDecision("a-1", "APPROVED", options({ message: "internal" }, 409));
  assert.equal(conflict.ok, false);
  if (!conflict.ok) assert.equal(conflict.kind, "conflict");

  const storage = await updateShiguanDecision("a-1", "APPROVED", options({ message: "internal" }, 503));
  assert.equal(storage.ok, false);
  if (!storage.ok) assert.equal(storage.kind, "storage");

  const malformed = await updateShiguanDecision("a-1", "APPROVED", options({
    decision: "APPROVED",
    decided_at: "invalid",
  }));
  assert.equal(malformed.ok, false);
  if (!malformed.ok) assert.equal(malformed.kind, "unknown");

  for (const [status, kind] of [[401, "unauthenticated"], [404, "not_found"], [422, "validation"]] as const) {
    const failure = await updateShiguanDecision("a-1", "APPROVED", options({ message: "internal" }, status));
    assert.equal(failure.ok, false);
    if (!failure.ok) assert.equal(failure.kind, kind);
  }

  const network = await updateShiguanDecision("a-1", "APPROVED", {
    ...options(null),
    fetchImpl: async () => { throw new TypeError("offline"); },
  });
  assert.equal(network.ok, false);
  if (!network.ok) assert.equal(network.kind, "network");
});
