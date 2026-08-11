import assert from "node:assert/strict";
import test from "node:test";

import { createPostHandler } from "./route.ts";

const context = (id: string) => ({ params: Promise.resolve({ id }) });
const request = (body: string, session = "opaque-session") =>
  new Request("http://localhost/api/report-artifacts/x/confirmation", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(session ? { cookie: `courtos_session=${session}` } : {}),
    },
    body,
  });

test("confirmation POST rejects missing session before parsing or backend call", async () => {
  let calls = 0;
  const handler = createPostHandler(async () => {
    calls += 1;
    throw new Error("must not call");
  });
  assert.equal(
    (await handler(request("not-json", ""), context("artifact-1"))).status,
    401,
  );
  assert.equal(calls, 0);
});

for (const body of [
  "not-json",
  "null",
  JSON.stringify({ decision: "PENDING", structured_reason: "不能待定" }),
  JSON.stringify({ decision: "CONFIRMED", structured_reason: " " }),
  JSON.stringify({
    decision: "CONFIRMED",
    structured_reason: "ok",
    owner_user_id: "attacker",
  }),
]) {
  test(`confirmation POST rejects malformed body without backend call: ${body}`, async () => {
    let calls = 0;
    const handler = createPostHandler(async () => {
      calls += 1;
      throw new Error("must not call");
    });
    assert.equal(
      (await handler(request(body), context("artifact-1"))).status,
      400,
    );
    assert.equal(calls, 0);
  });
}

for (const decision of [["CONFIRMED"], { value: "CONFIRMED" }, 1]) {
  test(`confirmation POST rejects non-string decision ${JSON.stringify(decision)} without backend call`, async () => {
    let calls = 0;
    const handler = createPostHandler(async () => {
      calls += 1;
      throw new Error("must not call");
    });
    const response = await handler(
      request(
        JSON.stringify({
          decision,
          structured_reason: "不能强制转换 decision",
        }),
      ),
      context("artifact-1"),
    );
    assert.equal(response.status, 400);
    assert.equal(calls, 0);
  });
}

test("confirmation POST forwards only allowed decision, reason, artifact id and server session", async () => {
  let observed: unknown;
  const handler = createPostHandler(async (id, payload, options) => {
    observed = { id, payload, options };
    return {
      ok: true as const,
      data: { confirmationStatus: "CONFIRMED" } as never,
    };
  });
  const response = await handler(
    request(
      JSON.stringify({
        decision: "CONFIRMED",
        structured_reason: "已核对来源",
      }),
    ),
    context("report 甲+v1"),
  );
  assert.equal(response.status, 200);
  assert.deepEqual(observed, {
    id: "report 甲+v1",
    payload: { decision: "CONFIRMED", structuredReason: "已核对来源" },
    options: { sessionId: "opaque-session" },
  });
});

for (const [kind, status] of [
  ["unauthenticated", 401],
  ["not_found", 404],
  ["invalid_transition", 409],
  ["unavailable", 503],
  ["contract", 503],
] as const) {
  test(`confirmation POST maps ${kind} to sanitized ${status}`, async () => {
    const handler = createPostHandler(async () => ({ ok: false as const, kind }));
    const response = await handler(
      request(
        JSON.stringify({
          decision: "ESCALATED",
          structured_reason: "需上级复核",
        }),
      ),
      context("artifact-1"),
    );
    assert.equal(response.status, status);
    assert.doesNotMatch(
      await response.text(),
      /opaque-session|owner|private-backend/,
    );
  });
}
