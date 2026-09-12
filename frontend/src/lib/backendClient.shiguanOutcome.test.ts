// Lands at frontend/src/lib/backendClient.shiguanOutcome.test.ts
import assert from "node:assert/strict";
import test from "node:test";

import {
  createShiguanOutcome,
  listShiguanArchiveOutcomes,
  listShiguanOutcomes,
} from "./backendClient.ts";

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

const EXPECTED = {
  eventId: PROJECTION.event_id,
  archiveId: "a-1",
  eventKind: "RECORDED",
  outcome: "ACHIEVED",
  sourceType: "OWNER_ATTESTATION",
  sourceAuthLevel: "AUTHENTICATED_OWNER_ASSERTION",
  occurredAt: PROJECTION.occurred_at,
  recordedAt: PROJECTION.recorded_at,
  archiveDigest: PROJECTION.archive_digest,
  decisionDigest: PROJECTION.decision_digest,
  evidenceBundleDigest: PROJECTION.evidence_bundle_digest,
  evidenceCount: 3,
  supersedesEventId: null,
  eventDigest: PROJECTION.event_digest,
};

function stubFetch(status: number, body: unknown) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchImpl = (async (input: unknown, init?: RequestInit) => {
    calls.push({ url: String(input), init: init ?? {} });
    return new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}

const BASE = { baseUrl: "https://backend.invalid", sessionId: "s-1" };

test("createShiguanOutcome posts the exact closed payload and parses the receipt", async () => {
  const { fetchImpl, calls } = stubFetch(201, PROJECTION);
  const result = await createShiguanOutcome(
    "a /甲",
    {
      outcome: "ACHIEVED",
      occurredAt: "2026-09-01T02:00:00Z",
      idempotencyKey: "case-001.retry",
    },
    { ...BASE, fetchImpl },
  );

  assert.equal(result.ok, true);
  assert.deepEqual(result.ok && result.data, EXPECTED);
  assert.equal(
    calls[0].url,
    "https://backend.invalid/api/v1/shiguan/archives/a%20%2F%E7%94%B2/outcomes",
  );
  assert.equal(calls[0].init.method, "POST");
  assert.equal(
    (calls[0].init.headers as Record<string, string>).authorization,
    "Bearer s-1",
  );
  // The closed backend contract forbids extra keys; the client must not add any.
  assert.deepEqual(JSON.parse(String(calls[0].init.body)), {
    outcome: "ACHIEVED",
    occurred_at: "2026-09-01T02:00:00Z",
    idempotency_key: "case-001.retry",
  });
});

test("createShiguanOutcome forwards supersedes_event_id only when supplied", async () => {
  const { fetchImpl, calls } = stubFetch(201, {
    ...PROJECTION,
    event_kind: "CORRECTED",
    supersedes_event_id: "f".repeat(32),
  });
  const result = await createShiguanOutcome(
    "a-1",
    {
      outcome: "NOT_ACHIEVED",
      occurredAt: "2026-09-02T02:00:00Z",
      idempotencyKey: "case-001.correction",
      supersedesEventId: "f".repeat(32),
    },
    { ...BASE, fetchImpl },
  );

  assert.equal(result.ok, true);
  assert.equal(result.ok && result.data.eventKind, "CORRECTED");
  assert.equal(result.ok && result.data.supersedesEventId, "f".repeat(32));
  assert.deepEqual(JSON.parse(String(calls[0].init.body)), {
    outcome: "NOT_ACHIEVED",
    occurred_at: "2026-09-02T02:00:00Z",
    idempotency_key: "case-001.correction",
    supersedes_event_id: "f".repeat(32),
  });
});

test("createShiguanOutcome rejects a malformed or widened projection", async () => {
  const cases: unknown[] = [
    { ...PROJECTION, outcome: "MAYBE" },
    { ...PROJECTION, event_kind: "DELETED" },
    { ...PROJECTION, source_type: "SYSTEM_INFERENCE" },
    { ...PROJECTION, evidence_count: 0 },
    { ...PROJECTION, event_id: "short" },
    { ...PROJECTION, supersedes_event_id: "not-hex" },
    { ...PROJECTION, extra: "widened" },
    (() => {
      // 缺失必填字段：闭合契约要求少一个键也判为不可信。
      const missingDigest: Record<string, unknown> = { ...PROJECTION };
      delete missingDigest.event_digest;
      return missingDigest;
    })(),
  ];
  for (const body of cases) {
    const { fetchImpl } = stubFetch(201, body);
    const result = await createShiguanOutcome(
      "a-1",
      { outcome: "ACHIEVED", occurredAt: "2026-09-01T02:00:00Z", idempotencyKey: "k-12345678" },
      { ...BASE, fetchImpl },
    );
    assert.equal(result.ok, false, `expected rejection for ${JSON.stringify(body).slice(0, 60)}`);
    assert.equal(result.ok === false && result.kind, "unknown");
  }
});

test("createShiguanOutcome maps backend status codes to stable kinds", async () => {
  const cases = [
    [401, "unauthenticated"],
    [404, "not_found"],
    [409, "conflict"],
    [422, "validation"],
    [503, "storage"],
  ] as const;
  for (const [status, kind] of cases) {
    const { fetchImpl } = stubFetch(status, { detail: "sensitive backend detail" });
    const result = await createShiguanOutcome(
      "a-1",
      { outcome: "ACHIEVED", occurredAt: "2026-09-01T02:00:00Z", idempotencyKey: "k-12345678" },
      { ...BASE, fetchImpl },
    );
    assert.equal(result.ok, false);
    assert.equal(result.ok === false && result.kind, kind);
  }
});

test("listShiguanArchiveOutcomes sends bounded paging and parses a page", async () => {
  const { fetchImpl, calls } = stubFetch(200, {
    items: [PROJECTION],
    next_cursor: "cursor-2",
  });
  const result = await listShiguanArchiveOutcomes("a-1", {
    ...BASE,
    fetchImpl,
    limit: 25,
    cursor: "cursor-1",
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.ok && result.data, { items: [EXPECTED], nextCursor: "cursor-2" });
  const url = new URL(calls[0].url);
  assert.equal(url.pathname, "/api/v1/shiguan/archives/a-1/outcomes");
  assert.equal(url.searchParams.get("limit"), "25");
  assert.equal(url.searchParams.get("cursor"), "cursor-1");
});

test("listShiguanOutcomes parses an empty terminal page", async () => {
  const { fetchImpl, calls } = stubFetch(200, { items: [], next_cursor: null });
  const result = await listShiguanOutcomes({ ...BASE, fetchImpl });

  assert.equal(result.ok, true);
  assert.deepEqual(result.ok && result.data, { items: [], nextCursor: null });
  assert.equal(new URL(calls[0].url).pathname, "/api/v1/shiguan/outcomes");
});

test("outcome listings reject a widened or malformed page", async () => {
  const cases: unknown[] = [
    { items: [PROJECTION] },
    { items: [PROJECTION], next_cursor: null, extra: 1 },
    { items: [{ ...PROJECTION, outcome: "MAYBE" }], next_cursor: null },
    { items: PROJECTION, next_cursor: null },
  ];
  for (const body of cases) {
    const { fetchImpl } = stubFetch(200, body);
    const result = await listShiguanOutcomes({ ...BASE, fetchImpl });
    assert.equal(result.ok, false, `expected rejection for ${JSON.stringify(body).slice(0, 60)}`);
  }
});

test("outcome calls sanitize an unreachable backend", async () => {
  const fetchImpl = (async () => { throw new TypeError("injected offline failure"); }) as unknown as typeof fetch;
  const result = await listShiguanOutcomes({ ...BASE, fetchImpl });
  assert.equal(result.ok, false);
  assert.equal(result.ok === false && result.kind, "network");
});
