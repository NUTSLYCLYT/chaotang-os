import assert from "node:assert/strict";
import test from "node:test";

import { enqueueDecree } from "./backendClient.ts";


const BASE_OPTIONS = {
  sessionId: "session-only-server-side",
  idempotencyKey: "submission-1",
  draftVersion: 1,
  draftFingerprint: "a".repeat(64),
};


test("enqueueDecree returns the strict 202 envelope and forwards idempotency", async () => {
  let headers: Headers | undefined;
  const result = await enqueueDecree("请户部核查国库", {
    ...BASE_OPTIONS,
    fetchImpl: async (_input, init) => {
      headers = new Headers(init?.headers);
      return Response.json({
        job_id: "b".repeat(32), state: "QUEUED",
        status_url: `/api/v1/decree-jobs/${"b".repeat(32)}`,
        cancel_url: `/api/v1/decree-jobs/${"b".repeat(32)}/cancel`,
        accepted_at: "2026-08-07T12:00:00Z", replayed: false,
      }, {
        status: 202,
        headers: {
          location: `/api/v1/decree-jobs/${"b".repeat(32)}`,
          "retry-after": "1",
        },
      });
    },
  });

  assert.equal(result.ok, true);
  assert.equal(headers?.get("idempotency-key"), "submission-1");
  assert.equal(headers?.get("authorization"), "Bearer session-only-server-side");
  if (result.ok) {
    assert.equal(result.data.jobId, "b".repeat(32));
    assert.equal(result.location, `/api/v1/decree-jobs/${"b".repeat(32)}`);
    assert.equal(result.retryAfterSeconds, 1);
  }
});


for (const [reason, expectedKind] of [
  ["source_not_current", "source_not_current"],
  ["draft_not_current", "draft_not_current"],
  ["idempotency_conflict", "conflict"],
  ["unexpected_conflict", "unknown"],
] as const) {
  test(`enqueueDecree preserves the exact 409 reason: ${reason}`, async () => {
    const result = await enqueueDecree("请户部核查国库", {
      ...BASE_OPTIONS,
      fetchImpl: async () => Response.json(
        { status: "error", reason },
        { status: 409 },
      ),
    });

    assert.deepEqual(result, { ok: false, kind: expectedKind });
  });
}
