// Lands at frontend/src/app/api/shiguan/outcomes/route.test.ts
import assert from "node:assert/strict";
import test from "node:test";

import { GET } from "./route.ts";

const PROJECTION = {
  event_id: "0123456789abcdef0123456789abcdef",
  archive_id: "a-1",
  event_kind: "RECORDED",
  outcome: "PARTIAL",
  source_type: "OWNER_ATTESTATION",
  source_auth_level: "AUTHENTICATED_OWNER_ASSERTION",
  occurred_at: "2026-09-01T02:00:00Z",
  recorded_at: "2026-09-01T02:00:05Z",
  archive_digest: `sha256:${"a".repeat(64)}`,
  decision_digest: `sha256:${"b".repeat(64)}`,
  evidence_bundle_digest: `sha256:${"c".repeat(64)}`,
  evidence_count: 2,
  supersedes_event_id: null,
  event_digest: `sha256:${"d".repeat(64)}`,
};

function request(query = "", session = true): Request {
  return new Request(`http://localhost/api/shiguan/outcomes${query}`, {
    headers: session ? { cookie: "courtos_session=test-session" } : {},
  });
}

async function withBackendFetch(
  status: number,
  body: unknown,
  run: (facts: () => { url?: string; authorization?: string }) => Promise<void>,
): Promise<void> {
  let seen: { url?: string; authorization?: string } = {};
  const originalFetch = globalThis.fetch;
  const original = process.env.BACKEND_BASE_URL;
  process.env.BACKEND_BASE_URL = "https://backend.invalid";
  globalThis.fetch = async (input, init) => {
    const headers = init?.headers as Record<string, string> | undefined;
    seen = { url: String(input), authorization: headers?.authorization };
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

test("owner outcome listing rejects an absent session before forwarding", async () => {
  const response = await GET(request("", false));
  assert.equal(response.status, 401);
  assert.equal((await response.json() as { reason: string }).reason, "unauthenticated");
});

test("owner outcome listing forwards Bearer session and bounded paging", async () => {
  await withBackendFetch(200, { items: [PROJECTION], next_cursor: null }, async (facts) => {
    const response = await GET(request("?limit=10&cursor=c-1"));
    assert.equal(response.status, 200);
    const payload = await response.json() as {
      status: string;
      page: { items: { outcome: string }[]; nextCursor: string | null };
    };
    assert.equal(payload.status, "ok");
    assert.equal(payload.page.items[0].outcome, "PARTIAL");
    assert.equal(payload.page.nextCursor, null);

    assert.equal(facts().authorization, "Bearer test-session");
    const url = new URL(facts().url ?? "");
    assert.equal(url.pathname, "/api/v1/shiguan/outcomes");
    assert.equal(url.searchParams.get("limit"), "10");
    assert.equal(url.searchParams.get("cursor"), "c-1");
  });
});

test("owner outcome listing rejects out-of-range paging before forwarding", async () => {
  for (const query of ["?limit=0", "?limit=101", "?limit=-1", "?limit=abc", "?cursor="]) {
    const response = await GET(request(query));
    assert.equal(response.status, 400, `expected 400 for ${query}`);
    assert.equal((await response.json() as { reason: string }).reason, "validation");
  }
});

test("owner outcome listing rejects a widened backend page", async () => {
  await withBackendFetch(200, { items: [PROJECTION], next_cursor: null, extra: 1 }, async () => {
    const response = await GET(request());
    assert.equal(response.status, 503);
    assert.equal((await response.json() as { reason: string }).reason, "unknown");
  });
});

test("owner outcome listing maps backend failures without leaking detail", async () => {
  for (const [status, reason] of [[404, "not_found"], [503, "storage"]] as const) {
    await withBackendFetch(status, { detail: "sensitive backend detail" }, async () => {
      const response = await GET(request());
      assert.equal(response.status, status);
      const payload = await response.json() as { reason: string; message: string };
      assert.equal(payload.reason, reason);
      assert.ok(!payload.message.includes("sensitive"));
    });
  }
});

test("owner outcome listing sanitizes an unreachable backend", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new TypeError("injected offline failure"); };
  try {
    const response = await GET(request());
    assert.equal(response.status, 503);
    assert.equal((await response.json() as { reason: string }).reason, "network");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
