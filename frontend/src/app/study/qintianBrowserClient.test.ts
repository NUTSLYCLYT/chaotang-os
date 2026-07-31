import assert from "node:assert/strict";
import test from "node:test";

import {
  consultQintianFromBrowser,
  createQintianForecastFromBrowser,
  loadPendingQintianTriggersFromBrowser,
  reviewQintianForecastFromBrowser,
} from "./qintianBrowserClient.ts";
import { parseQintianForecast } from "./qintianContracts.ts";

const forecast = {
  id: "forecast-1", created_at: "2026-07-30T10:00:00Z",
  subject: { kind: "DRAFT", id: "draft-1", title: "拟旨草稿", content: "先试点" },
  question: "是否继续？", judgment: "先验证。", status: "COMPLETED", confidence: "MEDIUM",
  confidence_basis: "证据有限。", review_at: "2026-08-30T09:00:00Z",
  methodology_version: "qintian-v1",
  scenarios: [
    { kind: "OPTIMISTIC", summary: "成功", impact: "扩大", time_window: "90 天", probability_interval: null, counterfactual: "越线则失效" },
    { kind: "BASELINE", summary: "维持", impact: "试点", time_window: "90 天", probability_interval: { lower: 0.4, upper: 0.6 }, counterfactual: "成本下降则转乐观" },
    { kind: "PESSIMISTIC", summary: "失败", impact: "停止", time_window: "90 天", probability_interval: null, counterfactual: "需求稳定则不成立" },
  ],
  assumptions: [],
  evidence_refs: [],
  triggers: [],
  reviews: [],
  human_signoff_required: true, disclaimer: "仅供决策辅助。",
};

test("uses only same-origin qintian BFF paths and parses wrapped forecast", async () => {
  assert.ok(parseQintianForecast(forecast));
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const result = await createQintianForecastFromBrowser({
    idempotencyKey: "context-12345678",
    subject: { kind: "DRAFT", id: "draft-1", title: "拟旨草稿", content: "先试点" },
    question: "未来 90 天是否值得继续？",
    evidenceRefs: [],
    reviewAt: "2026-08-30T09:00:00Z",
  }, async (url, init) => {
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify({ status: "ok", forecast }), { status: 201 });
  });
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(calls[0].url, "/api/qintianjian/forecasts");
  assert.equal(calls[0].init?.method, "POST");
});

test("surfaces provider unavailable without inventing a response", async () => {
  const result = await consultQintianFromBrowser(
    [{ role: "user", content: "现在时机如何？" }],
    async () => new Response(JSON.stringify({
      status: "error", reason: "model_unavailable", message: "钦天监模型暂不可用",
    }), { status: 502 }),
  );
  assert.deepEqual(result, {
    ok: false,
    kind: "provider_unavailable",
    message: "钦天监模型暂不可用",
  });
});

test("loads due triggers and submits an explicit review decision", async () => {
  const pending = await loadPendingQintianTriggersFromBrowser(async () =>
    new Response(JSON.stringify({
      status: "ok",
      triggers: [{
        id: "trigger-1", signal: "退款率", threshold: "高于 8%", window: "两周",
        review_at: "2026-08-30T09:00:00Z", status: "PENDING",
        forecast_id: "forecast-1", forecast_summary: "先验证", is_due: true,
        subject: { kind: "DRAFT", id: "draft-1", title: "拟旨草稿", content: "先试点" },
        context_ref: { kind: "DRAFT", id: "draft-1" },
      }],
    }), { status: 200 }));
  assert.equal(pending.ok && pending.data[0].isDue, true);

  let body = "";
  const reviewed = await reviewQintianForecastFromBrowser(
    "forecast-1",
    {
      triggerId: "trigger-1",
      decision: "KEEP",
      observation: "实际退款率连续两周为 3%",
      judgmentInvalidated: false,
    },
    async (url, init) => {
      assert.equal(url, "/api/qintianjian/forecasts/forecast-1/reviews");
      body = String(init?.body);
      return new Response(JSON.stringify({
        status: "ok",
        review: {
          id: "review-1", forecast_id: "forecast-1", trigger_id: "trigger-1", decision: "KEEP",
          observation: "实际退款率连续两周为 3%", judgment_invalidated: false,
          created_at: "2026-08-30T10:00:00Z",
        },
      }), { status: 201 });
    },
  );
  assert.equal(reviewed.ok, true);
  assert.deepEqual(JSON.parse(body), {
    triggerId: "trigger-1",
    decision: "KEEP",
    observation: "实际退款率连续两周为 3%",
    judgmentInvalidated: false,
  });
});
