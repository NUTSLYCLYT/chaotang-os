
import assert from "node:assert/strict";
import test from "node:test";

import {
  confirmDailyMemorialDraft,
  getLatestDailyMemorialDraft,
} from "./backendClient.ts";

const fingerprint = "a".repeat(64);
const draftId = "1".repeat(32);
const memorialId = "2".repeat(32);

function draft(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: draftId,
    report_date: "2026-08-04",
    source_window_start: "2026-08-04T00:00:00+08:00",
    source_window_end: "2026-08-05T00:00:00+08:00",
    version: 1,
    fingerprint,
    bureau_result_count: 39,
    ministry_result_count: 6,
    content: "有受控事实引用的待审奏报",
    fact_refs: ["fact-1", "fact-2"],
    ...overrides,
  };
}

function latest(
  status = "READY_FOR_REVIEW",
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    status,
    draft: status === "READY_FOR_REVIEW" || status === "CONFIRMED" ? draft() : null,
    memorial_id: status === "CONFIRMED" ? memorialId : null,
    failure_code: status === "FAILED" ? "configuration_unavailable" : null,
    ...overrides,
  };
}

function response(body: unknown, status = 200): Promise<Response> {
  return Promise.resolve(Response.json(body, { status }));
}

test("daily memorial latest maps a strict ready wire contract", async () => {
  let request: { url: string; init?: RequestInit } | undefined;
  const result = await getLatestDailyMemorialDraft({
    baseUrl: "https://backend.invalid/",
    sessionId: "opaque-session",
    fetchImpl: async (input, init) => {
      request = { url: String(input), init };
      return response(latest());
    },
  });

  assert.deepEqual(result, {
    ok: true,
    data: {
      status: "READY_FOR_REVIEW",
      draft: {
        id: draftId,
        reportDate: "2026-08-04",
        sourceWindowStart: "2026-08-04T00:00:00+08:00",
        sourceWindowEnd: "2026-08-05T00:00:00+08:00",
        version: 1,
        fingerprint,
        bureauResultCount: 39,
        ministryResultCount: 6,
        content: "有受控事实引用的待审奏报",
        factRefs: ["fact-1", "fact-2"],
      },
      memorialId: null,
      failureCode: null,
    },
  });
  assert.equal(request?.url, "https://backend.invalid/api/v1/daily-memorial-drafts/latest");
  assert.equal(request?.init?.method, "GET");
  assert.equal((request?.init?.headers as Record<string, string>).authorization, "Bearer opaque-session");
});

test("daily memorial latest preserves a valid HTTP 200 null as no current run", async () => {
  const result = await getLatestDailyMemorialDraft({
    fetchImpl: async () => response(null),
  });
  assert.deepEqual(result, { ok: true, data: null });
});

test("daily memorial parser rejects malformed JSON, extra keys, and missing keys", async () => {
  const payloads: Array<() => Promise<Response>> = [
    async () => new Response("not-json", { status: 200 }),
    () => response({ ...latest(), owner: "secret" }),
    () => {
      const value = latest();
      delete value.failure_code;
      return response(value);
    },
    () => response(latest("READY_FOR_REVIEW", { draft: { ...draft(), owner: "secret" } })),
  ];
  for (const fetchImpl of payloads) {
    assert.deepEqual(await getLatestDailyMemorialDraft({ fetchImpl }), {
      ok: false,
      kind: "unknown",
      error: "每日奏报暂时不可用",
    });
  }
});

test("daily memorial draft parser validates real dates, timezone RFC3339, IDs, counts, and facts", async () => {
  const invalidDrafts = [
    draft({ report_date: "2026-02-30" }),
    draft({ source_window_start: "2026-08-04T00:00:00" }),
    draft({ source_window_start: "2026-02-30T00:00:00+08:00" }),
    draft({ id: "unsafe/id" }),
    draft({ version: 0 }),
    draft({ version: 1.5 }),
    draft({ fingerprint: "A".repeat(64) }),
    draft({ bureau_result_count: 38 }),
    draft({ ministry_result_count: 7 }),
    draft({ content: "   " }),
    draft({ fact_refs: [] }),
    draft({ fact_refs: ["fact-1", " fact-1 "] }),
    draft({ fact_refs: ["fact-1", ""] }),
  ];
  for (const invalid of invalidDrafts) {
    const result = await getLatestDailyMemorialDraft({
      fetchImpl: async () => response(latest("READY_FOR_REVIEW", { draft: invalid })),
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.kind, "unknown");
  }
});

test("daily memorial latest enforces every status-dependent combination", async () => {
  const valid = [
    latest("PENDING"),
    latest("GENERATING"),
    latest("SKIPPED_NO_FACTS"),
    latest("FAILED"),
    latest("READY_FOR_REVIEW"),
    latest("CONFIRMED"),
  ];
  for (const payload of valid) {
    assert.equal((await getLatestDailyMemorialDraft({ fetchImpl: async () => response(payload) })).ok, true);
  }

  const invalid = [
    latest("PENDING", { draft: draft() }),
    latest("READY_FOR_REVIEW", { draft: null }),
    latest("READY_FOR_REVIEW", { memorial_id: memorialId }),
    latest("CONFIRMED", { memorial_id: null }),
    latest("FAILED", { failure_code: null }),
    latest("GENERATING", { failure_code: "PRIVATE" }),
    latest("UNKNOWN"),
  ];
  for (const payload of invalid) {
    assert.equal((await getLatestDailyMemorialDraft({ fetchImpl: async () => response(payload) })).ok, false);
  }
});

test("daily memorial FAILED accepts only lowercase stable failure codes", async () => {
  const accepted = await getLatestDailyMemorialDraft({
    fetchImpl: async () => response(latest("FAILED", { failure_code: "invocation_failed" })),
  });
  assert.deepEqual(accepted, {
    ok: true,
    data: { status: "FAILED", draft: null, memorialId: null, failureCode: "invocation_failed" },
  });
  for (const failure_code of ["MODEL_UNAVAILABLE", "private/detail", "has space", ""]) {
    const rejected = await getLatestDailyMemorialDraft({
      fetchImpl: async () => response(latest("FAILED", { failure_code })),
    });
    assert.equal(rejected.ok, false);
  }
});

test("daily memorial confirm sends exact wire request and parses confirmation", async () => {
  let captured: { input: string; init?: RequestInit } | undefined;
  const result = await confirmDailyMemorialDraft(draftId, { version: 1, fingerprint }, {
    sessionId: "opaque-session",
    fetchImpl: async (input, init) => {
      captured = { input: String(input), init };
      return response({ status: "CONFIRMED", draft_id: draftId, memorial_id: memorialId });
    },
  });
  assert.deepEqual(result, { ok: true, data: { status: "CONFIRMED", draftId, memorialId } });
  assert.match(captured?.input ?? "", new RegExp(`/daily-memorial-drafts/${draftId}/confirm$`));
  assert.deepEqual(JSON.parse(String(captured?.init?.body)), { version: 1, fingerprint });
  assert.equal((captured?.init?.headers as Record<string, string>).authorization, "Bearer opaque-session");
});

test("daily memorial client maps backend and network failures without raw details", async () => {
  const expected = new Map<number, string>([[401, "unauthenticated"], [404, "not_found"], [409, "conflict"], [503, "storage"]]);
  for (const [status, kind] of expected) {
    const result = await getLatestDailyMemorialDraft({ fetchImpl: async () => response({ private: "C:/db" }, status) });
    assert.deepEqual(result, { ok: false, kind, error: "每日奏报暂时不可用" });
  }
  const network = await getLatestDailyMemorialDraft({ fetchImpl: async () => { throw new Error("https://private/session"); } });
  assert.deepEqual(network, { ok: false, kind: "network", error: "每日奏报暂时不可用" });
});
