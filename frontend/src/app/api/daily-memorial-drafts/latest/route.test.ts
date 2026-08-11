
import assert from "node:assert/strict";
import test from "node:test";

import { createLatestHandler } from "./route.ts";
import { getLatestDailyMemorialDraft } from "../../../../lib/backendClient.ts";

const request = (query = "", session = "opaque-session") => new Request(`http://local/api/daily-memorial-drafts/latest${query}`, {
  headers: session ? { cookie: `courtos_session=${session}` } : {},
});
test("daily memorial latest BFF requires cookie and rejects every query before backend call", async () => {
  let calls = 0;
  const handler = createLatestHandler(async () => {
    calls += 1;
    return { ok: false, kind: "unknown", error: "private" };
  });
  assert.equal((await handler(request("", ""))).status, 401);
  assert.equal((await handler(request("?owner=secret"))).status, 400);
  assert.equal(calls, 0);
});

test("daily memorial latest BFF forwards only opaque session and returns success", async () => {
  let options: unknown;
  const handler = createLatestHandler(async (received) => {
    options = received;
    return { ok: true, data: { status: "PENDING", draft: null, memorialId: null, failureCode: null } };
  });
  const response = await handler(request());
  assert.equal(response.status, 200);
  assert.deepEqual(options, { sessionId: "opaque-session" });
  assert.deepEqual(await response.json(), { status: "ok", latest: { status: "PENDING", draft: null, memorialId: null, failureCode: null } });
});

test("daily memorial latest BFF preserves the valid no-run null state", async () => {
  const handler = createLatestHandler((options) => getLatestDailyMemorialDraft({
    ...options,
    fetchImpl: async () => Response.json(null),
  }));
  const response = await handler(request());
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: "ok", latest: null });
});

test("daily memorial latest BFF maps failures to sanitized stable responses", async () => {
  const cases = [["unauthenticated", 401], ["not_found", 404], ["conflict", 409], ["storage", 503], ["network", 503], ["unknown", 503]] as const;
  for (const [kind, status] of cases) {
    const handler = createLatestHandler(async () => ({ ok: false, kind, error: "Bearer secret at http://backend/C:/db" }));
    const response = await handler(request());
    assert.equal(response.status, status);
    const serialized = JSON.stringify(await response.json());
    assert.doesNotMatch(serialized, /secret|backend|C:\/db/);
  }
});

test("daily memorial latest BFF sanitizes an unexpected backend throw", async () => {
  const handler = createLatestHandler(async () => { throw new Error("Bearer secret at C:/private/db"); });
  const response = await handler(request());
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { status: "error", reason: "unknown", message: "每日奏报暂时不可用" });
});
