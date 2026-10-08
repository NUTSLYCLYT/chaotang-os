import assert from "node:assert/strict";
import test from "node:test";

import { getJinyiweiTrust } from "../../../../../../lib/backendClient.ts";
import { createTrustHandler } from "./handler.ts";

test("trust BFF forwards owner-scoped session and response", async () => {
  let seen: unknown;
  const handler = createTrustHandler(async (id, options) => {
    seen = { id, options };
    return { ok: true, data: { assessments: {}, generatedAt: "2026-10-08T00:00:00Z" } };
  }, () => "opaque-session");
  const response = await handler(new Request("http://local/api/jinyiwei/investigations/case/trust"), { params: Promise.resolve({ id: "case" }) });
  assert.equal(response.status, 200);
  assert.deepEqual(seen, { id: "case", options: { sessionId: "opaque-session" } });
  assert.deepEqual(await response.json(), { status: "ok", trust: { assessments: {}, generatedAt: "2026-10-08T00:00:00Z" } });
});

test("trust BFF rejects missing sessions before calling backend", async () => {
  let calls = 0;
  const handler = createTrustHandler(async () => { calls += 1; return { ok: false, kind: "unknown", error: "unused" }; }, () => null);
  const response = await handler(new Request("http://local/api/jinyiwei/investigations/case/trust"), { params: Promise.resolve({ id: "case" }) });
  assert.equal(response.status, 401);
  assert.equal(calls, 0);
});

test("trust BFF maps owner-scoped not found without leaking backend detail", async () => {
  const handler = createTrustHandler(
    (id, options) => getJinyiweiTrust(id, { ...options, baseUrl: "https://backend.invalid", fetchImpl: async () => new Response(JSON.stringify({ detail: "private" }), { status: 404 }) }),
    () => "opaque-session",
  );
  const response = await handler(new Request("http://local/api/jinyiwei/investigations/case/trust"), { params: Promise.resolve({ id: "case" }) });
  assert.equal(response.status, 404);
  assert.equal((await response.text()).includes("private"), false);
});
