import assert from "node:assert/strict";
import test from "node:test";

import { createNewsHandler } from "./handler.ts";
import type { JinyiweiNewsPreview } from "../../../../lib/backendClient.ts";

const PREVIEW: JinyiweiNewsPreview = { snapshotId: "snapshot-1", rulesVersion: "news-preview-v1", replayFingerprint: "a".repeat(64), sourceFingerprints: [], articles: [], events: [], rejected: [], generatedAt: "2026-10-08T00:00:00Z", doNotInfer: "标题不等于事实" };
const INPUT = { snapshotId: "snapshot-1", entries: [] };

test("news BFF forwards an authenticated offline snapshot preview", async () => {
  const handler = createNewsHandler(async (input, options) => { assert.deepEqual(input, INPUT); assert.deepEqual(options, { sessionId: "opaque-session" }); return { ok: true, data: PREVIEW }; }, () => "opaque-session");
  const response = await handler(new Request("http://local/api/jinyiwei/news/preview", { method: "POST", body: JSON.stringify(INPUT) }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: "ok", news: PREVIEW });
});

test("news BFF rejects anonymous, query-bearing, and malformed requests", async () => {
  let calls = 0;
  const reader = async () => { calls += 1; return { ok: true as const, data: PREVIEW }; };
  assert.equal((await createNewsHandler(reader, () => null)(new Request("http://local/api/jinyiwei/news/preview", { method: "POST", body: JSON.stringify(INPUT) }))).status, 401);
  assert.equal((await createNewsHandler(reader, () => "opaque-session")(new Request("http://local/api/jinyiwei/news/preview?x=1", { method: "POST", body: JSON.stringify(INPUT) }))).status, 400);
  assert.equal((await createNewsHandler(reader, () => "opaque-session")(new Request("http://local/api/jinyiwei/news/preview", { method: "POST", body: "{}" }))).status, 400);
  assert.equal(calls, 0);
});
