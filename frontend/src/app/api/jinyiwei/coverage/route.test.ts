import assert from "node:assert/strict";
import test from "node:test";

import { createCoverageHandler } from "./handler.ts";

const COVERAGE = {
  points: [],
  generatedAt: "2026-10-08T00:00:00Z",
  scannedInvestigations: 0,
  totalInvestigations: 0,
  truncated: false,
};

test("coverage BFF forwards the opaque session and returns the read projection", async () => {
  const handler = createCoverageHandler(async (options) => {
    assert.deepEqual(options, { sessionId: "opaque-session" });
    return { ok: true, data: COVERAGE };
  }, () => "opaque-session");
  const response = await handler(new Request("http://local/api/jinyiwei/coverage"));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: "ok", coverage: COVERAGE });
});

test("coverage BFF rejects anonymous and query-bearing requests before backend", async () => {
  let calls = 0;
  const handler = createCoverageHandler(async () => { calls += 1; return { ok: true, data: COVERAGE }; }, () => null);
  assert.equal((await handler(new Request("http://local/api/jinyiwei/coverage"))).status, 401);
  const authenticated = createCoverageHandler(async () => { calls += 1; return { ok: true, data: COVERAGE }; }, () => "opaque-session");
  assert.equal((await authenticated(new Request("http://local/api/jinyiwei/coverage?region=CN"))).status, 400);
  assert.equal(calls, 0);
});

test("coverage BFF sanitizes backend failures", async () => {
  const handler = createCoverageHandler(async () => ({ ok: false, kind: "storage", error: "C:\\private\\db" }), () => "opaque-session");
  const response = await handler(new Request("http://local/api/jinyiwei/coverage"));
  assert.equal(response.status, 503);
  assert.equal((await response.text()).includes("private"), false);
});
