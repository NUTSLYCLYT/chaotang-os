import assert from "node:assert/strict";
import test from "node:test";

import { createFeedsHandler } from "./handler.ts";

const FEEDS = { sources: [], generatedAt: "2026-10-08T00:00:00Z" };

test("feeds BFF returns the approved source registry envelope", async () => {
  const handler = createFeedsHandler(async (options) => {
    assert.deepEqual(options, { sessionId: "opaque-session" });
    return { ok: true, data: FEEDS };
  }, () => "opaque-session");
  const response = await handler(new Request("http://local/api/jinyiwei/feeds"));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: "ok", feeds: FEEDS });
});

test("feeds BFF rejects anonymous and query-bearing requests before backend", async () => {
  let calls = 0;
  const handler = createFeedsHandler(async () => { calls += 1; return { ok: true, data: FEEDS }; }, () => null);
  assert.equal((await handler(new Request("http://local/api/jinyiwei/feeds"))).status, 401);
  const authenticated = createFeedsHandler(async () => { calls += 1; return { ok: true, data: FEEDS }; }, () => "opaque-session");
  assert.equal((await authenticated(new Request("http://local/api/jinyiwei/feeds?source=all"))).status, 400);
  assert.equal(calls, 0);
});
