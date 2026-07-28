import assert from "node:assert/strict";
import test from "node:test";

import { listJunjichuCases } from "./backendClient.ts";

const CASE = {
  id: "case-1",
  decree_text: "请议边防",
  departments: ["兵部", "户部"],
  status: "COUNCIL_REVIEWING",
  processing_path: ["丞相分流", "军机处会审"],
  completed_ministry_opinions: [{
    department: "兵部",
    bureau_opinions: [{ bureau: "武库司", opinion: "核验军械" }],
    opinion: "兵部意见",
  }],
  council_verdict: null,
  reply_id: null,
  failure_reason: null,
  created_at: "2026-07-28T00:00:00+00:00",
  updated_at: "2026-07-28T00:01:00+00:00",
};

test("junjichu client sends filters and opaque session without an owner parameter", async () => {
  let url = "";
  let authorization = "";
  const result = await listJunjichuCases({
    baseUrl: "https://backend.invalid",
    status: "COUNCIL_REVIEWING",
    department: "兵部",
    keyword: "边防",
    sessionId: "opaque-session",
    fetchImpl: async (input, init) => {
      url = String(input);
      authorization = new Headers(init?.headers).get("authorization") ?? "";
      return new Response(JSON.stringify([CASE]), { status: 200 });
    },
  });

  assert.equal(result.ok, true);
  assert.match(url, /status=COUNCIL_REVIEWING/);
  assert.match(url, /department=%E5%85%B5%E9%83%A8/);
  assert.match(url, /keyword=%E8%BE%B9%E9%98%B2/);
  assert.doesNotMatch(url, /owner/);
  assert.equal(authorization, "Bearer opaque-session");
});

test("junjichu client maps 401, 404, 400, and 503 responses", async () => {
  for (const [status, kind] of [[401, "unauthenticated"], [404, "not_found"], [400, "validation"], [503, "storage"]] as const) {
    const result = await listJunjichuCases({
      baseUrl: "https://backend.invalid",
      fetchImpl: async () => new Response("{}", { status }),
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.kind, kind);
  }
});

test("junjichu client rejects extra or malformed nested ministry data", async () => {
  for (const body of [
    [{ ...CASE, owner_user_id: "owner-1" }],
    [{ ...CASE, completed_ministry_opinions: [{ ...CASE.completed_ministry_opinions[0], owner_user_id: "owner-1" }] }],
    [{ ...CASE, completed_ministry_opinions: [{ ...CASE.completed_ministry_opinions[0], bureau_opinions: [{ bureau: "武库司", opinion: "核验", evidence: "secret" }] }] }],
  ]) {
    const result = await listJunjichuCases({
      baseUrl: "https://backend.invalid",
      fetchImpl: async () => new Response(JSON.stringify(body), { status: 200 }),
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.kind, "unknown");
  }
});
