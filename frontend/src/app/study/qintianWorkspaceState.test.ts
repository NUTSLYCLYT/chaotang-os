import assert from "node:assert/strict";
import test from "node:test";

import type { QintianForecast, QintianPendingTrigger } from "./qintianContracts.ts";
import {
  createQintianContext,
  initialQintianWorkspaceState,
  projectQintianWorkspaceMode,
  qintianWorkspaceReducer,
} from "./qintianWorkspaceState.ts";

const forecast = {
  id: "forecast-1",
  createdAt: "2026-07-30T10:00:00Z",
  subject: { kind: "DRAFT", id: "draft-1", title: "拟旨草稿", content: "先试点" },
  question: "未来 90 天是否值得继续？",
  judgment: "先验证再扩大。",
  status: "COMPLETED",
  confidence: "MEDIUM",
  confidenceBasis: "已有需求证据，尚缺成本实测。",
  reviewAt: "2026-08-30T09:00:00Z",
  methodologyVersion: "qintian-v1",
  scenarios: [],
  assumptions: [],
  evidenceRefs: [],
  triggers: [],
  humanSignoffRequired: true,
  disclaimer: "仅供决策辅助。",
} as unknown as QintianForecast;

test("binds one stable context with archive taking precedence over reply, draft and input", () => {
  const context = createQintianContext({
    decreeText: "当前输入",
    draft: { fingerprint: "draft-1", content: "拟旨正文" },
    currentReply: { id: "reply-current", content: "当前回奏" },
    archivedReply: { id: "archive-9", content: "归档回奏" },
  });
  assert.deepEqual(context, {
    key: "REPLY:archive-9",
    subject: { kind: "REPLY", id: "archive-9", title: "归档回奏", content: "归档回奏" },
  });
  assert.equal(createQintianContext({
    decreeText: "当前输入",
    draft: { fingerprint: "draft-1", content: "拟旨正文" },
    currentReply: null,
    archivedReply: null,
  }).key, "DRAFT:draft-1");
});

test("ignores a formal response that belongs to an obsolete context", () => {
  const first = qintianWorkspaceReducer(initialQintianWorkspaceState, {
    type: "CONTEXT_CHANGED",
    contextKey: "DRAFT:draft-1",
  });
  const pending = qintianWorkspaceReducer(first, {
    type: "FORECAST_STARTED",
    contextKey: "DRAFT:draft-1",
    requestId: 1,
  });
  const changed = qintianWorkspaceReducer(pending, {
    type: "CONTEXT_CHANGED",
    contextKey: "REPLY:reply-2",
  });
  const stale = qintianWorkspaceReducer(changed, {
    type: "FORECAST_SUCCEEDED",
    contextKey: "DRAFT:draft-1",
    requestId: 1,
    forecast,
  });
  assert.equal(stale.contextKey, "REPLY:reply-2");
  assert.equal(stale.forecast, null);
});

test("prioritizes due triggers over formal results and page facts", () => {
  const due = [{
    id: "trigger-1",
    signal: "退款率",
    threshold: "高于 8%",
    window: "连续两周",
    reviewAt: "2026-07-30T09:00:00Z",
    status: "PENDING",
    forecastId: "forecast-1",
    forecastSummary: "先验证",
    isDue: true,
    subject: { kind: "DRAFT", id: "draft-1", title: "拟旨草稿", content: "先试点" },
    contextRef: { kind: "DRAFT", id: "draft-1" },
  }] as QintianPendingTrigger[];
  assert.equal(projectQintianWorkspaceMode({
    pageMode: "REPLY_READY",
    formalPhase: "ready",
    dueTriggers: due,
  }), "TRIGGER_DUE");
  assert.equal(projectQintianWorkspaceMode({
    pageMode: "REPLY_READY",
    formalPhase: "ready",
    dueTriggers: [],
  }), "FORMAL_READY");
  assert.equal(projectQintianWorkspaceMode({
    pageMode: "DRAFT_READY",
    formalPhase: "idle",
    dueTriggers: [],
  }), "DRAFT_READY");
});

test("keeps due triggers only when their subject context exactly matches the active scroll", () => {
  const bound = qintianWorkspaceReducer(initialQintianWorkspaceState, {
    type: "CONTEXT_CHANGED",
    contextKey: "REPLY:reply-current",
    subject: { kind: "REPLY", id: "reply-current", title: "当前回奏", content: "当前结论" },
  });
  const loaded = qintianWorkspaceReducer(bound, {
    type: "TRIGGERS_LOADED",
    contextKey: "REPLY:reply-current",
    triggers: [
      {
        id: "right", signal: "退款率", threshold: "8%", window: "两周",
        reviewAt: "2026-08-30T09:00:00Z", status: "PENDING",
        forecastId: "forecast-right", forecastSummary: "当前判断", isDue: true,
        subject: { kind: "REPLY", id: "reply-current", title: "当前回奏", content: "当前结论" },
        contextRef: { kind: "REPLY", id: "reply-current" },
      },
      {
        id: "wrong", signal: "成本", threshold: "超预算", window: "一月",
        reviewAt: "2026-08-30T09:00:00Z", status: "PENDING",
        forecastId: "forecast-wrong", forecastSummary: "另一奏折", isDue: true,
        subject: { kind: "REPLY", id: "another-reply", title: "归档回奏", content: "另一结论" },
        contextRef: { kind: "REPLY", id: "another-reply" },
      },
    ],
  });
  assert.deepEqual(loaded.dueTriggers.map((trigger) => trigger.id), ["right"]);
});

test("keeps provider unavailable explicit and separate from a forecast", () => {
  const bound = qintianWorkspaceReducer(initialQintianWorkspaceState, {
    type: "CONTEXT_CHANGED",
    contextKey: "DECREE:text-1",
  });
  const pending = qintianWorkspaceReducer(bound, {
    type: "FORECAST_STARTED",
    contextKey: "DECREE:text-1",
    requestId: 4,
  });
  const unavailable = qintianWorkspaceReducer(pending, {
    type: "FORECAST_FAILED",
    contextKey: "DECREE:text-1",
    requestId: 4,
    kind: "provider_unavailable",
    message: "钦天监服务暂不可用，未生成正式推演。",
  });
  assert.equal(unavailable.formalPhase, "provider_unavailable");
  assert.equal(unavailable.forecast, null);
  assert.match(unavailable.error ?? "", /未生成正式推演/);
});
