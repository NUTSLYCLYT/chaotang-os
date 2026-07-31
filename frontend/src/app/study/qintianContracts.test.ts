import assert from "node:assert/strict";
import test from "node:test";

import {
  parseQintianConsultResponse,
  parseQintianForecast,
  parseQintianForecastList,
  parseQintianPendingTriggers,
  parseQintianReview,
} from "./qintianContracts.ts";

const subject = { kind: "DECREE", id: "decree-1", title: "开海试点", content: "先做小范围验证" };
const evidence = [{ id: "ev-1", summary: "需求访谈", source: "奏折附件", as_of: "2026-07-30T09:00:00Z" }];
const trigger = {
  id: "trigger-1", signal: "退款率", threshold: "高于 8%", window: "连续两周",
  review_at: "2026-08-30T09:00:00Z", status: "PENDING",
};
const forecast = {
  id: "forecast-1",
  created_at: "2026-07-30T10:00:00Z",
  subject,
  question: "是否应当继续？",
  judgment: "先做最低成本验证，再决定是否扩大。",
  status: "COMPLETED",
  confidence: "MEDIUM",
  confidence_basis: "现有证据覆盖需求，尚缺成本实测。",
  review_at: "2026-08-30T09:00:00Z",
  methodology_version: "qintian-v1",
  scenarios: [
    { kind: "OPTIMISTIC", summary: "试点验证成功", impact: "可以扩大", time_window: "90 天", probability_interval: null, counterfactual: "若退款率越线则不成立" },
    { kind: "BASELINE", summary: "需要补证后推进", impact: "维持试点", time_window: "90 天", probability_interval: null, counterfactual: "若成本显著下降则转乐观" },
    { kind: "PESSIMISTIC", summary: "成本超出红线", impact: "停止扩大", time_window: "90 天", probability_interval: null, counterfactual: "若需求复购稳定则不成立" },
  ],
  assumptions: [{ statement: "需求保持稳定", critical: true }],
  evidence_refs: evidence,
  triggers: [trigger],
  reviews: [],
  human_signoff_required: true,
  disclaimer: "仅供决策辅助，不构成执行授权。",
};

test("strictly parses consultation and a complete three-scenario forecast", () => {
  assert.deepEqual(parseQintianConsultResponse({ status: "ok", consultant: "钦天监", reply: "先观察退款率。" }), {
    status: "ok", consultant: "钦天监", reply: "先观察退款率。",
  });
  const parsed = parseQintianForecast(forecast);
  assert.ok(parsed);
  assert.equal(parsed.scenarios[1].kind, "BASELINE");
  assert.equal(parsed.scenarios[0].probabilityInterval, null);
  assert.equal(parsed.triggers[0].reviewAt, trigger.review_at);
  assert.equal(parsed.humanSignoffRequired, true);
});

test("rejects incomplete, duplicate, and probability-inconsistent scenarios", () => {
  assert.equal(parseQintianForecast({ ...forecast, scenarios: forecast.scenarios.slice(0, 2) }), null);
  assert.equal(parseQintianForecast({ ...forecast, scenarios: [forecast.scenarios[0], forecast.scenarios[0], forecast.scenarios[2]] }), null);
  assert.equal(parseQintianForecast({
    ...forecast,
    scenarios: forecast.scenarios.map((scenario) => ({
      ...scenario, probability_interval: { lower: 0.8, upper: 0.2 },
    })),
  }), null);
});

test("rejects owner, raw provider details, extra fields, and malformed evidence", () => {
  assert.equal(parseQintianForecast({ ...forecast, owner_user_id: "secret-owner" }), null);
  assert.equal(parseQintianForecast({ ...forecast, provider_error: "private stack" }), null);
  assert.equal(parseQintianForecast({ ...forecast, evidence_refs: [{ ...evidence[0], as_of: "yesterday" }] }), null);
});

test("parses forecast lists, pending triggers, and reviews with exact contracts", () => {
  assert.deepEqual(parseQintianForecastList({ items: [forecast] })?.items[0].id, "forecast-1");
  const pending = parseQintianPendingTriggers({
    items: [{
      ...trigger,
      forecast_id: "forecast-1",
      forecast_summary: "是否应当继续？",
      is_due: true,
      subject,
      context_ref: { kind: subject.kind, id: subject.id },
    }],
  });
  assert.equal(pending?.items[0].forecastId, "forecast-1");
  assert.equal(pending?.items[0].isDue, true);
  assert.deepEqual(parseQintianReview({
    id: "review-1", forecast_id: "forecast-1", trigger_id: "trigger-1", decision: "KEEP",
    observation: "退款率连续两周为 3%", judgment_invalidated: false,
    created_at: "2026-08-30T10:00:00Z",
  }), {
    id: "review-1", forecastId: "forecast-1", triggerId: "trigger-1", decision: "KEEP",
    observation: "退款率连续两周为 3%", judgmentInvalidated: false,
    createdAt: "2026-08-30T10:00:00Z",
  });
});
