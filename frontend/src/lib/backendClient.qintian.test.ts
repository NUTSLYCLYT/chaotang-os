import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  consultQintian,
  createQintianForecast,
  getQintianForecast,
  listPendingQintianTriggers,
  listQintianForecasts,
  reviewQintianForecast,
} from "./backendClient.ts";

const minimalForecast = {
  id: "forecast-1", created_at: "2026-07-30T10:00:00Z",
  subject: { kind: "DRAFT", id: "draft-1", title: "试点", content: "小范围推进" },
  question: "是否继续？", judgment: "先验证", status: "COMPLETED", confidence: "LOW",
  confidence_basis: "证据有限", review_at: "2026-08-30T00:00:00Z", methodology_version: "qintian-v1",
  scenarios: [
    { kind: "OPTIMISTIC", summary: "好", impact: "扩大", time_window: "90 天", probability_interval: null, counterfactual: "退款越线" },
    { kind: "BASELINE", summary: "中", impact: "维持", time_window: "90 天", probability_interval: null, counterfactual: "成本下降" },
    { kind: "PESSIMISTIC", summary: "坏", impact: "停止", time_window: "90 天", probability_interval: null, counterfactual: "需求稳定" },
  ],
  assumptions: [{ statement: "假设", critical: true }], evidence_refs: [],
  triggers: [{ id: "t-1", signal: "退款", threshold: "8%", window: "两周", review_at: "2026-08-30T00:00:00Z", status: "PENDING" }],
  reviews: [], human_signoff_required: true, disclaimer: "仅供辅助",
};

function responder(body: unknown, status = 200) {
  let seenUrl = "";
  let seenInit: RequestInit | undefined;
  return {
    seen: () => ({ url: seenUrl, init: seenInit }),
    fetch: (async (url: string | URL | Request, init?: RequestInit) => {
      seenUrl = String(url); seenInit = init;
      return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
    }) as typeof fetch,
  };
}

test("Qintian model calls use a dedicated timeout budget instead of the 3 second health timeout", async () => {
  const source = await readFile(new URL("./backendClient.ts", import.meta.url), "utf8");
  assert.match(source, /const QINTIAN_TIMEOUT_MS = 30000;/);
  assert.match(
    source,
    /requestQintian[\s\S]*?setTimeout\(\(\) => controller\.abort\(\), options\.timeoutMs \?\? QINTIAN_TIMEOUT_MS\)/,
  );
});

test("Qintian clients forward only bearer session and the documented request body", async () => {
  const stub = responder(minimalForecast);
  const result = await createQintianForecast({
    idempotencyKey: "idem-key-123",
    subject: { kind: "DRAFT", id: "draft-1", title: "试点", content: "小范围推进" },
    question: "是否继续？",
    evidenceRefs: [],
    reviewAt: "2026-08-30T00:00:00Z",
  }, { baseUrl: "http://backend", sessionId: "opaque", fetchImpl: stub.fetch });
  assert.equal(result.ok, true);
  assert.equal(stub.seen().url, "http://backend/api/v1/qintianjian/forecasts");
  assert.equal((stub.seen().init?.headers as Record<string, string>).authorization, "Bearer opaque");
  assert.deepEqual(JSON.parse(String(stub.seen().init?.body)), {
    idempotency_key: "idem-key-123",
    subject: { kind: "DRAFT", id: "draft-1", title: "试点", content: "小范围推进" },
    question: "是否继续？",
    evidence_refs: [],
    review_at: "2026-08-30T00:00:00Z",
  });
});

test("Qintian clients use the exact protected endpoint paths", async () => {
  const calls: string[] = [];
  const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push(`${init?.method ?? "GET"} ${String(url)}`);
    const path = String(url);
    const body = path.endsWith("/consult")
      ? { status: "ok", consultant: "钦天监", reply: "答" }
      : path.endsWith("/triggers/pending") ? { items: [] }
      : path.endsWith("/reviews") ? {
          id: "r-1", forecast_id: "forecast-1", trigger_id: "t-1", decision: "KEEP",
          observation: "退款率连续两周为 3%", judgment_invalidated: false,
          created_at: "2026-07-30T10:00:00Z",
        }
      : path.endsWith("/forecasts") && (init?.method ?? "GET") === "GET" ? { items: [] }
      : minimalForecast;
    return new Response(JSON.stringify(body));
  }) as typeof fetch;
  const options = { baseUrl: "http://backend", sessionId: "opaque", fetchImpl };

  await consultQintian({ messages: [{ role: "user", content: "怎么看？" }] }, options);
  await listQintianForecasts(options);
  await getQintianForecast("forecast /一", options);
  await listPendingQintianTriggers(options);
  await reviewQintianForecast("forecast /一", {
    triggerId: "t-1",
    decision: "KEEP",
    observation: "退款率连续两周为 3%",
    judgmentInvalidated: false,
  }, options);

  assert.deepEqual(calls, [
    "POST http://backend/api/v1/qintianjian/consult",
    "GET http://backend/api/v1/qintianjian/forecasts",
    "GET http://backend/api/v1/qintianjian/forecasts/forecast%20%2F%E4%B8%80",
    "GET http://backend/api/v1/qintianjian/triggers/pending",
    "POST http://backend/api/v1/qintianjian/forecasts/forecast%20%2F%E4%B8%80/reviews",
  ]);
});

test("provider unavailable and malformed success remain explicit safe failures", async () => {
  const unavailable = responder({ detail: "provider secret" }, 503);
  const failed = await consultQintian(
    { messages: [{ role: "user", content: "怎么看？" }] },
    { baseUrl: "http://backend", sessionId: "opaque", fetchImpl: unavailable.fetch },
  );
  assert.deepEqual(failed, { ok: false, kind: "model_unavailable", error: "钦天监模型暂不可用" });
  assert.doesNotMatch(JSON.stringify(failed), /provider secret/);

  const malformed = responder({ ...minimalForecast, owner_user_id: "owner" });
  const rejected = await getQintianForecast("forecast-1", {
    baseUrl: "http://backend", sessionId: "opaque", fetchImpl: malformed.fetch,
  });
  assert.equal(rejected.ok, false);
  if (!rejected.ok) assert.equal(rejected.kind, "unknown");
});

test("Qintian clients reject a missing session before fetch", async () => {
  let calls = 0;
  const result = await listQintianForecasts({ fetchImpl: (async () => { calls += 1; return new Response(); }) as typeof fetch });
  assert.deepEqual(result, { ok: false, kind: "unauthenticated", error: "authentication required" });
  assert.equal(calls, 0);
});
