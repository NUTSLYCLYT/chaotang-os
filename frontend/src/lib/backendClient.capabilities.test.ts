import assert from "node:assert/strict";
import test from "node:test";

import { getCapability, listCapabilities } from "./backendClient.ts";

const registryEnvelope = {
  status: "ok",
  registry: {
    schema_version: "capability-registry.v1",
    owner: "CapabilityRegistry V1 readonly projection",
    canonical_writer: "existing source-of-truth modules only",
    readonly_sources: ["backend/app/capabilities/projection.py"],
    items: [
      {
        card: {
          id: "mcp.westock",
          name: "腾讯自选股",
          type: "mcp",
          source: "honglusi",
          best_use_case: "外部只读数据服务入口",
          input_needed: ["已批准连接"],
          output_produced: ["外部数据候选"],
          risk_level: "high",
          cost_level: "medium",
          reuse_potential: "medium",
          recommended_home: "honglusi",
          status: "trial",
          evidence_sources: ["backend/config/jinyiwei_mcp.yaml"],
          active: true,
          sample_count: 0,
          authority_score: null,
          zero_permission_when_inactive: true,
        },
        persona: null,
        external_review: {
          provider: "mcp",
          permission_needed: ["刑部安全审查"],
          data_exposure: ["EXTERNAL_PUBLIC"],
          allowed_actions: ["READ_ONLY"],
          forbidden_actions: ["external write"],
          requires_xingbu_review: true,
          default_grant_duration: "single request",
          audit_required: true,
        },
        promotion_case: {
          capability_id: "mcp.westock",
          current_home: "honglusi",
          recommended_action: "入鸿胪寺外部能力候选",
          rationale: "外部能力默认 fail-closed",
          required_evidence: ["安全审查"],
          reviewer_department: "吏部",
        },
      },
    ],
    agent_personas: [],
    summary: {
      total: 1,
      by_type: { mcp: 1 },
      by_home: { honglusi: 1 },
      by_status: { trial: 1 },
      external_review_required: 1,
      small_sample_without_authority_score: 1,
    },
  },
};

test("listCapabilities sends only server bearer auth and parses readonly registry", async () => {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const result = await listCapabilities({
    sessionId: "session-1",
    source: "honglusi",
    home: "honglusi",
    baseUrl: "http://backend.local",
    fetchImpl: (async (url: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(url), init: init ?? {} });
      return new Response(JSON.stringify(registryEnvelope), { status: 200, headers: { "content-type": "application/json" } });
    }) as typeof fetch,
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(calls[0].url, "http://backend.local/api/v1/capabilities?home=honglusi&source=honglusi");
  assert.deepEqual(calls[0].init.headers, { authorization: "Bearer session-1" });
  assert.equal(result.data.items[0].card.recommendedHome, "honglusi");
  assert.equal(result.data.items[0].externalReview?.requiresXingbuReview, true);
  assert.equal(result.data.items[0].card.authorityScore, null);
});

test("listCapabilities rejects blank sessions before touching the backend", async () => {
  let called = false;
  const result = await listCapabilities({
    sessionId: " ",
    fetchImpl: (async () => {
      called = true;
      return new Response("{}");
    }) as typeof fetch,
  });

  assert.deepEqual(result, { ok: false, kind: "unauthenticated", error: "能力总账只读服务暂时不可用，请稍后重试。" });
  assert.equal(called, false);
});

test("getCapability encodes detail id and rejects malformed backend envelopes", async () => {
  const urls: string[] = [];
  const ok = await getCapability("mcp.westock/data", {
    sessionId: "session-1",
    baseUrl: "http://backend.local/",
    fetchImpl: (async (url: RequestInfo | URL) => {
      urls.push(String(url));
      return new Response(JSON.stringify({ status: "ok", capability: registryEnvelope.registry.items[0] }), { status: 200 });
    }) as typeof fetch,
  });
  const malformed = await getCapability("mcp.westock", {
    sessionId: "session-1",
    baseUrl: "http://backend.local",
    fetchImpl: (async () => new Response(JSON.stringify({ status: "ok", capability: { owner_user_id: "leak" } }), { status: 200 })) as typeof fetch,
  });

  assert.equal(ok.ok, true);
  assert.equal(urls[0], "http://backend.local/api/v1/capabilities/mcp.westock%2Fdata");
  assert.deepEqual(malformed, { ok: false, kind: "unknown", error: "能力总账只读服务暂时不可用，请稍后重试。" });
});
