import assert from "node:assert/strict";
import test from "node:test";

import { createPostHandler } from "./route.ts";


const JOB_ID = "a".repeat(32);


test("job cancellation is owner-authenticated and forwards POST server-side", async () => {
  let observed = { id: "", sessionId: "" };
  const handler = createPostHandler(
    async (id, options) => {
      observed = { id, sessionId: options.sessionId ?? "" };
      return {
        ok: true,
        data: {
          jobId: JOB_ID, state: "CANCELLED", stage: "CANCELLED",
          attemptCount: 0, providerRequestCount: 0, cancelRequested: false,
          result: null,
          error: { code: "cancelled", stage: "queue", category: "cancelled" },
          createdAt: "2026-08-05T12:00:00Z", updatedAt: "2026-08-05T12:00:01Z",
        },
      };
    },
    () => "opaque-session",
  );
  const response = await handler(
    new Request(`http://localhost/api/decree-jobs/${JOB_ID}/cancel`, { method: "POST" }),
    { params: Promise.resolve({ id: JOB_ID }) },
  );
  assert.equal(response.status, 200);
  assert.deepEqual(observed, { id: JOB_ID, sessionId: "opaque-session" });
  assert.equal((await response.json() as { state: string }).state, "CANCELLED");
});


test("job cancellation converts an unexpected backend client exception to 503", async () => {
  const handler = createPostHandler(
    async () => { throw new Error("backend exploded"); },
    () => "session",
  );
  const response = await handler(
    new Request(`http://localhost/api/decree-jobs/${JOB_ID}/cancel`, { method: "POST" }),
    { params: Promise.resolve({ id: JOB_ID }) },
  );
  assert.equal(response.status, 503);
  assert.equal((await response.json() as { reason: string }).reason, "unavailable");
});
