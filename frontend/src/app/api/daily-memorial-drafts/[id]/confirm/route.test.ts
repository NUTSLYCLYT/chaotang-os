
import assert from "node:assert/strict";
import test from "node:test";

import { createConfirmHandler } from "./route.ts";

const draftId = "1".repeat(32);
const fingerprint = "a".repeat(64);
const context = (id: string) => ({ params: Promise.resolve({ id }) });
const request = (body: unknown = { version: 1, fingerprint }, session = "opaque-session", raw = false) => new Request(`http://local/api/daily-memorial-drafts/${draftId}/confirm`, {
  method: "POST",
  headers: { ...(session ? { cookie: `courtos_session=${session}` } : {}), "content-type": "application/json" },
  body: raw ? String(body) : JSON.stringify(body),
});
test("daily memorial confirm BFF rejects missing auth before backend call", async () => {
  let calls = 0;
  const handler = createConfirmHandler(async () => { calls += 1; throw new Error("must not call"); });
  assert.equal((await handler(request(undefined, ""), context(draftId))).status, 401);
  assert.equal(calls, 0);
});

test("daily memorial confirm BFF rejects malformed ID and exact body with zero backend calls", async () => {
  let calls = 0;
  const handler = createConfirmHandler(async () => { calls += 1; throw new Error("must not call"); });
  const invalid: Array<[Request, string]> = [
    [request(), "unsafe/id"],
    [request(), "A".repeat(32)],
    [request("not-json", "opaque-session", true), draftId],
    [request({ version: 0, fingerprint }), draftId],
    [request({ version: 1.5, fingerprint }), draftId],
    [request({ version: 1, fingerprint: "bad" }), draftId],
    [request({ version: 1, fingerprint, owner: "secret" }), draftId],
    [request({ version: 1 }), draftId],
  ];
  for (const [input, id] of invalid) assert.equal((await handler(input, context(id))).status, 400);
  assert.equal(calls, 0);
});

test("daily memorial confirm BFF forwards exact current values and session only", async () => {
  let captured: unknown;
  const handler = createConfirmHandler(async (...args) => {
    captured = args;
    return { ok: true, data: { status: "CONFIRMED", draftId, memorialId: "2".repeat(32) } };
  });
  const response = await handler(request(), context(draftId));
  assert.equal(response.status, 200);
  assert.deepEqual(captured, [draftId, { version: 1, fingerprint }, { sessionId: "opaque-session" }]);
  assert.deepEqual(await response.json(), { status: "ok", confirmation: { status: "CONFIRMED", draftId, memorialId: "2".repeat(32) } });
});

test("daily memorial confirm BFF sanitizes backend conflict, absence, storage, and network failures", async () => {
  const cases = [["unauthenticated", 401], ["not_found", 404], ["conflict", 409], ["storage", 503], ["network", 503], ["unknown", 503]] as const;
  for (const [kind, status] of cases) {
    const handler = createConfirmHandler(async () => ({ ok: false, kind, error: "session/private/backend-url" }));
    const response = await handler(request(), context(draftId));
    assert.equal(response.status, status);
    assert.doesNotMatch(JSON.stringify(await response.json()), /session|private|backend-url/);
  }
});

test("daily memorial confirm BFF rejects query parameters and sanitizes unexpected throws", async () => {
  let calls = 0;
  const handler = createConfirmHandler(async () => {
    calls += 1;
    throw new Error("Bearer secret at C:/private/db");
  });
  const withOwner = new Request(`http://local/api/daily-memorial-drafts/${draftId}/confirm?owner=secret`, {
    method: "POST",
    headers: { cookie: "courtos_session=opaque-session", "content-type": "application/json" },
    body: JSON.stringify({ version: 1, fingerprint }),
  });
  assert.equal((await handler(withOwner, context(draftId))).status, 400);
  assert.equal(calls, 0);

  const response = await handler(request(), context(draftId));
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { status: "error", reason: "unknown", message: "每日奏报暂时不可用" });
});
