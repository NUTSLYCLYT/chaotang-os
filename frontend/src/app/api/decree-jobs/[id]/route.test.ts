import assert from "node:assert/strict";
import test from "node:test";

import { createGetHandler, dynamic, revalidate } from "./route.ts";


const JOB_ID = "a".repeat(32);
const DATA = {
  jobId: JOB_ID,
  state: "QUEUED" as const,
  stage: "QUEUED",
  attemptCount: 0,
  providerRequestCount: 0,
  cancelRequested: false,
  result: null,
  error: null,
  createdAt: "2026-08-05T12:00:00Z",
  updatedAt: "2026-08-05T12:00:00Z",
};

test("job GET route is force-dynamic and never revalidated", () => {
  assert.equal(dynamic, "force-dynamic");
  assert.equal(revalidate, 0);
});


test("job GET requires the HttpOnly session before backend access", async () => {
  let calls = 0;
  const handler = createGetHandler(
    async () => { calls += 1; return { ok: true, data: DATA }; },
    () => null,
  );
  const response = await handler(
    new Request(`http://localhost/api/decree-jobs/${JOB_ID}`),
    { params: Promise.resolve({ id: JOB_ID }) },
  );
  assert.equal(response.status, 401);
  assert.equal(calls, 0);
});


test("job GET forwards only the server-side session and returns camelCase", async () => {
  let observed = { id: "", sessionId: "" };
  const handler = createGetHandler(
    async (id, options) => {
      observed = { id, sessionId: options.sessionId ?? "" };
      return { ok: true, data: DATA };
    },
    () => "opaque-session",
  );
  const response = await handler(
    new Request(`http://localhost/api/decree-jobs/${JOB_ID}`),
    { params: Promise.resolve({ id: JOB_ID }) },
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.deepEqual(observed, { id: JOB_ID, sessionId: "opaque-session" });
  assert.deepEqual(await response.json(), DATA);
});


test("job GET rejects malformed IDs and preserves opaque 404", async () => {
  const handler = createGetHandler(
    async () => ({ ok: false, kind: "not_found" as const }),
    () => "session",
  );
  const invalid = await handler(
    new Request("http://localhost/api/decree-jobs/bad"),
    { params: Promise.resolve({ id: "bad" }) },
  );
  const missing = await handler(
    new Request(`http://localhost/api/decree-jobs/${JOB_ID}`),
    { params: Promise.resolve({ id: JOB_ID }) },
  );
  assert.equal(invalid.status, 400);
  assert.equal(missing.status, 404);
  assert.deepEqual(await missing.json(), {
    status: "error",
    reason: "not_found",
    message: "decree job not found",
  });
});


test("job GET converts an unexpected backend client exception to 503", async () => {
  const handler = createGetHandler(
    async () => { throw new Error("backend exploded"); },
    () => "session",
  );
  const response = await handler(
    new Request(`http://localhost/api/decree-jobs/${JOB_ID}`),
    { params: Promise.resolve({ id: JOB_ID }) },
  );
  assert.equal(response.status, 503);
  assert.equal((await response.json() as { reason: string }).reason, "unavailable");
});

test("job GET preserves a validated backend failure instead of mapping it to 503", async () => {
  const failed = {
    ...DATA,
    state: "FAILED" as const,
    stage: "FAILED",
    error: {
      code: "validation_failed",
      stage: "validation" as const,
      category: "validation" as const,
    },
  };
  const handler = createGetHandler(
    async () => ({ ok: true, data: failed }),
    () => "session",
  );
  const response = await handler(
    new Request(`http://localhost/api/decree-jobs/${JOB_ID}`),
    { params: Promise.resolve({ id: JOB_ID }) },
  );
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json() as { error: object }).error, failed.error);
});
