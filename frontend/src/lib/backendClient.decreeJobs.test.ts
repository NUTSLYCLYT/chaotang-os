import assert from "node:assert/strict";
import test from "node:test";

import { cancelDecreeJob, getDecreeJob } from "./backendClient.ts";


const QUEUED = {
  job_id: "a".repeat(32),
  state: "QUEUED",
  stage: "QUEUED",
  attempt_count: 0,
  provider_request_count: 0,
  cancel_requested: false,
  result: null,
  error: null,
  created_at: "2026-08-05T12:00:00Z",
  updated_at: "2026-08-05T12:00:00Z",
};


test("getDecreeJob maps the strict owner-scoped status contract", async () => {
  let requested = "";
  let authorization = "";
  const result = await getDecreeJob("a".repeat(32), {
    baseUrl: "http://backend.test/",
    sessionId: "opaque-session",
    fetchImpl: async (input, init) => {
      requested = String(input);
      authorization = new Headers(init?.headers).get("authorization") ?? "";
      return Response.json(QUEUED);
    },
  });

  assert.equal(requested, `http://backend.test/api/v1/decree-jobs/${"a".repeat(32)}`);
  assert.equal(authorization, "Bearer opaque-session");
  assert.deepEqual(result, {
    ok: true,
    data: {
      jobId: "a".repeat(32),
      state: "QUEUED",
      stage: "QUEUED",
      attemptCount: 0,
      providerRequestCount: 0,
      cancelRequested: false,
      result: null,
      error: null,
      createdAt: "2026-08-05T12:00:00Z",
      updatedAt: "2026-08-05T12:00:00Z",
    },
  });
});


test("getDecreeJob rejects result leakage before success", async () => {
  const result = await getDecreeJob("a".repeat(32), {
    sessionId: "session",
    fetchImpl: async () => Response.json({ ...QUEUED, result: { status: "ok" } }),
  });
  assert.deepEqual(result, { ok: false, kind: "unknown" });
});


test("getDecreeJob rejects an unvalidated persisted success payload", async () => {
  const result = await getDecreeJob("a".repeat(32), {
    sessionId: "session",
    fetchImpl: async () => Response.json({
      ...QUEUED,
      state: "SUCCEEDED",
      stage: "SUCCEEDED",
      result: { status: "ok" },
    }),
  });
  assert.deepEqual(result, { ok: false, kind: "unknown" });
});


test("getDecreeJob maps authentication, ownership and availability errors", async () => {
  const withoutSession = await getDecreeJob("a".repeat(32), {
    fetchImpl: async () => { throw new Error("must not call"); },
  });
  const notFound = await getDecreeJob("a".repeat(32), {
    sessionId: "session",
    fetchImpl: async () => Response.json({}, { status: 404 }),
  });
  const unavailable = await getDecreeJob("a".repeat(32), {
    sessionId: "session",
    fetchImpl: async () => Response.json({}, { status: 503 }),
  });
  assert.deepEqual(withoutSession, { ok: false, kind: "unauthenticated" });
  assert.deepEqual(notFound, { ok: false, kind: "not_found" });
  assert.deepEqual(unavailable, { ok: false, kind: "unavailable" });
});

for (const [code, stage, category] of [
  ["validation_failed", "validation", "validation"],
  ["format_unrecognized", "bureau_tool", "format"],
  ["tool_unavailable", "bureau_tool", "tool"],
  ["source_not_found", "bureau_tool", "data"],
  ["artifact_failed", "artifact", "artifact"],
] as const) {
  test(`getDecreeJob preserves public failure contract: ${code}`, async () => {
    const result = await getDecreeJob("a".repeat(32), {
      sessionId: "session",
      fetchImpl: async () => Response.json({
        ...QUEUED,
        state: "FAILED",
        stage: "FAILED",
        error: { code, stage, category },
      }),
    });
    assert.equal(result.ok, true);
    if (result.ok) assert.deepEqual(result.data.error, { code, stage, category });
  });
}

test("getDecreeJob rejects unknown public failure metadata", async () => {
  const result = await getDecreeJob("a".repeat(32), {
    sessionId: "session",
    fetchImpl: async () => Response.json({
      ...QUEUED,
      state: "FAILED",
      stage: "FAILED",
      error: { code: "future_failure", stage: "future", category: "future" },
    }),
  });
  assert.deepEqual(result, { ok: false, kind: "unknown" });
});


test("cancelDecreeJob posts to the owner-scoped cancellation endpoint", async () => {
  let method = "";
  let requested = "";
  const result = await cancelDecreeJob("a".repeat(32), {
    baseUrl: "http://backend.test",
    sessionId: "session",
    fetchImpl: async (input, init) => {
      requested = String(input);
      method = init?.method ?? "";
      return Response.json({
        ...QUEUED,
        state: "CANCELLED",
        stage: "CANCELLED",
        error: { code: "cancelled", stage: "queue", category: "cancelled" },
      });
    },
  });
  assert.equal(method, "POST");
  assert.equal(requested, `http://backend.test/api/v1/decree-jobs/${"a".repeat(32)}/cancel`);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.data.state, "CANCELLED");
    assert.deepEqual(result.data.error, {
      code: "cancelled",
      stage: "queue",
      category: "cancelled",
    });
  }
});
