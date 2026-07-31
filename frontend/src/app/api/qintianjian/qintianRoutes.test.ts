import assert from "node:assert/strict";
import test from "node:test";

import { createConsultHandler } from "./consult/route.ts";
import { createForecastsGetHandler, createForecastsPostHandler } from "./forecasts/route.ts";
import { createForecastGetHandler } from "./forecasts/[id]/route.ts";
import { createReviewHandler } from "./forecasts/[id]/reviews/route.ts";
import { createPendingTriggersHandler } from "./triggers/pending/route.ts";

const authenticated = (path: string, method = "GET", body?: unknown) => new Request(`http://local${path}`, {
  method,
  headers: { cookie: "courtos_session=opaque", ...(body === undefined ? {} : { "content-type": "application/json" }) },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

test("all Qintian BFF handlers reject missing opaque sessions before backend calls", async () => {
  let calls = 0;
  const backend = async () => { calls += 1; return { ok: true as const, data: { items: [] } }; };
  const responses = await Promise.all([
    createConsultHandler(backend as never)(new Request("http://local/api/qintianjian/consult", { method: "POST" })),
    createForecastsGetHandler(backend as never)(new Request("http://local/api/qintianjian/forecasts")),
    createForecastsPostHandler(backend as never)(new Request("http://local/api/qintianjian/forecasts", { method: "POST" })),
    createForecastGetHandler(backend as never)(new Request("http://local/api/qintianjian/forecasts/id"), { params: Promise.resolve({ id: "id" }) }),
    createReviewHandler(backend as never)(new Request("http://local/api/qintianjian/forecasts/id/reviews", { method: "POST" }), { params: Promise.resolve({ id: "id" }) }),
    createPendingTriggersHandler(backend as never)(new Request("http://local/api/qintianjian/triggers/pending")),
  ]);
  assert.deepEqual(responses.map((response) => response.status), [401, 401, 401, 401, 401, 401]);
  assert.equal(calls, 0);
});

test("forecast creation rejects owner and malformed bodies without forwarding", async () => {
  let calls = 0;
  const handler = createForecastsPostHandler((async () => { calls += 1; return { ok: false, kind: "unknown", error: "" }; }) as never);
  for (const body of [
    { owner_user_id: "owner" },
    { idempotencyKey: "short", subject: {}, question: "?", evidenceRefs: [], reviewAt: "bad" },
  ]) {
    const response = await handler(authenticated("/api/qintianjian/forecasts", "POST", body));
    assert.equal(response.status, 400);
  }
  assert.equal(calls, 0);
});

test("forecast creation forwards only the strict browser contract plus server session", async () => {
  let seen: unknown;
  const handler = createForecastsPostHandler((async (input: unknown, options: unknown) => {
    seen = { input, options };
    return { ok: true, data: { id: "forecast-1" } };
  }) as never);
  const body = {
    idempotencyKey: "idem-key-123",
    subject: { kind: "DRAFT", id: "draft-1", title: "试点", content: "先验证" },
    question: "是否继续？",
    evidenceRefs: [{ id: "ev-1", summary: "访谈", source: "附件", asOf: null }],
    reviewAt: "2026-08-30T00:00:00Z",
  };
  const response = await handler(authenticated("/api/qintianjian/forecasts", "POST", body));
  assert.equal(response.status, 201);
  assert.deepEqual(seen, { input: body, options: { sessionId: "opaque" } });
});

test("consult and review bodies are strict and use decoded opaque route IDs", async () => {
  let reviewSeen: unknown;
  const consult = createConsultHandler((async (input: unknown, options: unknown) => ({
    ok: true, data: { status: "ok", consultant: "钦天监", reply: JSON.stringify({ input, options }) },
  })) as never);
  const consultResponse = await consult(authenticated("/api/qintianjian/consult", "POST", {
    messages: [{ role: "user", content: "怎么看？" }],
  }));
  assert.equal(consultResponse.status, 200);

  const review = createReviewHandler((async (id: string, input: unknown, options: unknown) => {
    reviewSeen = { id, input, options };
    return { ok: true, data: { id: "review-1" } };
  }) as never);
  const reviewResponse = await review(
    authenticated("/api/qintianjian/forecasts/a%2Fb/reviews", "POST", {
      triggerId: "trigger-1",
      decision: "KEEP",
      observation: "退款率连续两周为 3%",
      judgmentInvalidated: false,
    }),
    { params: Promise.resolve({ id: "a%2Fb" }) },
  );
  assert.equal(reviewResponse.status, 201);
  assert.deepEqual(reviewSeen, {
    id: "a/b",
    input: {
      triggerId: "trigger-1",
      decision: "KEEP",
      observation: "退款率连续两周为 3%",
      judgmentInvalidated: false,
    },
    options: { sessionId: "opaque" },
  });
});

test("read routes reject query injection and never expose backend or provider errors", async () => {
  const failed = async () => ({ ok: false as const, kind: "model_unavailable" as const, error: "provider-key / private/path" });
  const list = createForecastsGetHandler(failed as never);
  assert.equal((await list(authenticated("/api/qintianjian/forecasts?owner=secret"))).status, 400);
  const response = await list(authenticated("/api/qintianjian/forecasts"));
  assert.equal(response.status, 502);
  assert.doesNotMatch(await response.text(), /provider-key|private\/path|owner/);

  const pending = createPendingTriggersHandler(failed as never);
  const pendingResponse = await pending(authenticated("/api/qintianjian/triggers/pending"));
  assert.equal(pendingResponse.status, 502);
  assert.doesNotMatch(await pendingResponse.text(), /provider-key|private\/path/);
});
