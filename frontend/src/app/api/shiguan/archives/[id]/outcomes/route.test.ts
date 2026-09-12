// Lands at frontend/src/app/api/shiguan/archives/[id]/outcomes/route.test.ts
import assert from "node:assert/strict";
import test from "node:test";

import { GET, POST } from "./route.ts";

const PROJECTION = {
  event_id: "0123456789abcdef0123456789abcdef",
  archive_id: "a-1",
  event_kind: "RECORDED",
  outcome: "ACHIEVED",
  source_type: "OWNER_ATTESTATION",
  source_auth_level: "AUTHENTICATED_OWNER_ASSERTION",
  occurred_at: "2026-09-01T02:00:00Z",
  recorded_at: "2026-09-01T02:00:05Z",
  archive_digest: `sha256:${"a".repeat(64)}`,
  decision_digest: `sha256:${"b".repeat(64)}`,
  evidence_bundle_digest: `sha256:${"c".repeat(64)}`,
  evidence_count: 3,
  supersedes_event_id: null,
  event_digest: `sha256:${"d".repeat(64)}`,
};

function postRequest(body: unknown, session = true): Request {
  return new Request("http://localhost/api/shiguan/archives/a-1/outcomes", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(session ? { cookie: "courtos_session=test-session" } : {}),
    },
    body: JSON.stringify(body),
  });
}

function getRequest(query = "", session = true): Request {
  return new Request(`http://localhost/api/shiguan/archives/a-1/outcomes${query}`, {
    headers: session ? { cookie: "courtos_session=test-session" } : {},
  });
}

const params = (id = "a-1") => ({ params: Promise.resolve({ id }) });

async function withBackendFetch(
  status: number,
  body: unknown,
  run: (facts: () => { url?: string; authorization?: string; body?: string; method?: string }) => Promise<void>,
): Promise<void> {
  let seen: { url?: string; authorization?: string; body?: string; method?: string } = {};
  const originalFetch = globalThis.fetch;
  const original = process.env.BACKEND_BASE_URL;
  process.env.BACKEND_BASE_URL = "https://backend.invalid";
  globalThis.fetch = async (input, init) => {
    const headers = init?.headers as Record<string, string> | undefined;
    seen = {
      url: String(input),
      authorization: headers?.authorization,
      body: typeof init?.body === "string" ? init.body : undefined,
      method: init?.method,
    };
    return new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
  };
  try {
    await run(() => seen);
  } finally {
    globalThis.fetch = originalFetch;
    if (original === undefined) delete process.env.BACKEND_BASE_URL;
    else process.env.BACKEND_BASE_URL = original;
  }
}

const VALID_BODY = {
  outcome: "ACHIEVED",
  occurredAt: "2026-09-01T02:00:00Z",
  idempotencyKey: "case-001.first",
};

test("outcome BFF rejects an absent session before forwarding", async () => {
  for (const response of [
    await POST(postRequest(VALID_BODY, false), params()),
    await GET(getRequest("", false), params()),
  ]) {
    assert.equal(response.status, 401);
    assert.equal((await response.json() as { reason: string }).reason, "unauthenticated");
  }
});

test("outcome BFF accepts only the exact closed create payload", async () => {
  for (const body of [
    null,
    {},
    { outcome: "MAYBE", occurredAt: "2026-09-01T02:00:00Z", idempotencyKey: "case-001.first" },
    { outcome: "ACHIEVED", occurredAt: "2026-09-01T02:00:00Z" },
    { ...VALID_BODY, owner: "user-2" },
    // 幂等键过短：后端要求 8-128 位，前端必须先挡住而不是让它落到后端。
    { ...VALID_BODY, idempotencyKey: "short" },
    { ...VALID_BODY, supersedesEventId: "not-hex" },
  ]) {
    const response = await POST(postRequest(body), params());
    assert.equal(response.status, 400, `expected 400 for ${JSON.stringify(body)}`);
    assert.equal((await response.json() as { reason: string }).reason, "validation");
  }
});

test("outcome BFF forwards encoded ID, Bearer session, and snake_case body", async () => {
  await withBackendFetch(201, PROJECTION, async (facts) => {
    const response = await POST(postRequest(VALID_BODY), params("a /甲"));
    assert.equal(response.status, 201);
    const payload = await response.json() as { status: string; outcome: { eventId: string } };
    assert.equal(payload.status, "ok");
    assert.equal(payload.outcome.eventId, PROJECTION.event_id);

    assert.equal(
      facts().url,
      "https://backend.invalid/api/v1/shiguan/archives/a%20%2F%E7%94%B2/outcomes",
    );
    assert.equal(facts().method, "POST");
    assert.equal(facts().authorization, "Bearer test-session");
    assert.deepEqual(JSON.parse(facts().body ?? "null"), {
      outcome: "ACHIEVED",
      occurred_at: "2026-09-01T02:00:00Z",
      idempotency_key: "case-001.first",
    });
  });
});

test("outcome BFF preserves the caller idempotency key verbatim", async () => {
  // 幂等语义要求键由调用方稳定提供；BFF 不得改写或重新生成。
  await withBackendFetch(201, PROJECTION, async (facts) => {
    await POST(postRequest({ ...VALID_BODY, idempotencyKey: "case-001.retry-3" }), params());
    assert.equal(
      JSON.parse(facts().body ?? "null").idempotency_key,
      "case-001.retry-3",
    );
  });
});

test("outcome BFF forwards a correction as an append with supersedes_event_id", async () => {
  await withBackendFetch(201, {
    ...PROJECTION,
    event_kind: "CORRECTED",
    supersedes_event_id: "f".repeat(32),
  }, async (facts) => {
    const response = await POST(
      postRequest({ ...VALID_BODY, idempotencyKey: "case-001.fix", supersedesEventId: "f".repeat(32) }),
      params(),
    );
    assert.equal(response.status, 201);
    assert.deepEqual(JSON.parse(facts().body ?? "null"), {
      outcome: "ACHIEVED",
      occurred_at: "2026-09-01T02:00:00Z",
      idempotency_key: "case-001.fix",
      supersedes_event_id: "f".repeat(32),
    });
  });
});

test("outcome BFF lists a page with bounded paging", async () => {
  await withBackendFetch(200, { items: [PROJECTION], next_cursor: "cursor-2" }, async (facts) => {
    const response = await GET(getRequest("?limit=25&cursor=cursor-1"), params());
    assert.equal(response.status, 200);
    const payload = await response.json() as {
      status: string;
      page: { items: unknown[]; nextCursor: string | null };
    };
    assert.equal(payload.status, "ok");
    assert.equal(payload.page.items.length, 1);
    assert.equal(payload.page.nextCursor, "cursor-2");

    const url = new URL(facts().url ?? "");
    assert.equal(url.searchParams.get("limit"), "25");
    assert.equal(url.searchParams.get("cursor"), "cursor-1");
  });
});

test("outcome BFF rejects out-of-range paging before forwarding", async () => {
  for (const query of ["?limit=0", "?limit=101", "?limit=abc"]) {
    const response = await GET(getRequest(query), params());
    assert.equal(response.status, 400, `expected 400 for ${query}`);
    assert.equal((await response.json() as { reason: string }).reason, "validation");
  }
});

test("outcome BFF maps backend failures to stable sanitized responses", async () => {
  const cases = [
    [404, "not_found"],
    [409, "conflict"],
    [422, "validation"],
    [503, "storage"],
  ] as const;
  for (const [status, reason] of cases) {
    await withBackendFetch(status, { detail: "sensitive backend detail" }, async () => {
      const response = await POST(postRequest(VALID_BODY), params());
      assert.equal(response.status, status);
      const payload = await response.json() as { reason: string; message: string };
      assert.equal(payload.reason, reason);
      assert.ok(!payload.message.includes("sensitive"));
      if (reason === "conflict") {
        assert.match(payload.message, /采纳状态/u);
        assert.match(payload.message, /证据/u);
        assert.match(payload.message, /更正目标/u);
      }
    });
  }
});

test("outcome BFF sanitizes an unreachable backend", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new TypeError("injected offline failure"); };
  try {
    const response = await POST(postRequest(VALID_BODY), params());
    assert.equal(response.status, 503);
    assert.equal((await response.json() as { reason: string }).reason, "network");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
