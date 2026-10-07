import assert from "node:assert/strict";
import test from "node:test";

import { createBingbuHandler } from "./route.ts";

test("Bingbu BFF forwards an authenticated overview request", async () => {
  let seen: unknown;
  const handler = createBingbuHandler(async (path, options) => {
    seen = { path, options };
    return { ok: true, status: 200, data: { ok: true } };
  }, () => "opaque-session");
  const response = await handler(new Request("http://local/api/bingbu/overview"), { params: Promise.resolve({ segments: ["overview"] }) });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: "ok", data: { ok: true } });
  assert.deepEqual(seen, { path: "/api/v1/bingbu/overview", options: { method: "GET", body: undefined, sessionId: "opaque-session" } });
});

test("Bingbu BFF rejects missing session and malformed JSON before backend", async () => {
  let calls = 0;
  const handler = createBingbuHandler(async () => { calls += 1; return { ok: true, status: 200, data: {} }; }, () => null);
  const response = await handler(new Request("http://local/api/bingbu/imports/commit", { method: "POST", body: "{" }), { params: Promise.resolve({ segments: ["imports", "commit"] }) });
  assert.equal(response.status, 401);
  assert.equal(calls, 0);
});

test("Bingbu BFF rejects unknown routes and unsupported query fields before backend", async () => {
  let calls = 0;
  const handler = createBingbuHandler(async () => { calls += 1; return { ok: true, status: 200, data: {} }; }, () => "opaque-session");
  const unknown = await handler(new Request("http://local/api/bingbu/not-a-route"), { params: Promise.resolve({ segments: ["not-a-route"] }) });
  const query = await handler(new Request("http://local/api/bingbu/opportunities?owner_id=other"), { params: Promise.resolve({ segments: ["opportunities"] }) });
  assert.equal(unknown.status, 400);
  assert.equal(query.status, 400);
  assert.equal(calls, 0);
});
