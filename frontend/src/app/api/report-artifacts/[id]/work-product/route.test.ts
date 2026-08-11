import assert from "node:assert/strict";
import test from "node:test";

import { createGetHandler } from "./route.ts";

const context = (id: string) => ({ params: Promise.resolve({ id }) });
const request = (session = "opaque-session") =>
  new Request("http://localhost/api/report-artifacts/x/work-product", {
    headers: session ? { cookie: `courtos_session=${session}` } : {},
  });

test("work-product GET rejects missing session before backend call", async () => {
  let calls = 0;
  const handler = createGetHandler(async () => {
    calls += 1;
    throw new Error("must not call");
  });
  assert.equal((await handler(request(""), context("artifact-1"))).status, 401);
  assert.equal(calls, 0);
});

test("work-product GET forwards only opaque artifact id and server session", async () => {
  let observed: unknown;
  const handler = createGetHandler(async (id, options) => {
    observed = { id, options };
    return {
      ok: true as const,
      data: {
        workStatus: "READY_FOR_HUMAN_CONFIRMATION",
        confirmationStatus: "PENDING",
      } as never,
    };
  });
  const response = await handler(request(), context("report 甲+v1"));
  assert.equal(response.status, 200);
  assert.deepEqual(observed, {
    id: "report 甲+v1",
    options: { sessionId: "opaque-session" },
  });
});

for (const [kind, status] of [
  ["unauthenticated", 401],
  ["not_found", 404],
  ["unavailable", 503],
  ["contract", 503],
] as const) {
  test(`work-product GET maps ${kind} to sanitized ${status}`, async () => {
    const handler = createGetHandler(async () => ({ ok: false as const, kind }));
    const response = await handler(request(), context("artifact-1"));
    assert.equal(response.status, status);
    assert.doesNotMatch(
      await response.text(),
      /opaque-session|owner|private-backend/,
    );
  });
}
