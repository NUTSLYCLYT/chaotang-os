import assert from "node:assert/strict";
import test from "node:test";

import { getCapability, listCapabilities } from "./backendClient.ts";

function registryEnvelope() {
  return {
    status: "ok",
    registry: {
      schema_version: "capability-registry.v2",
      owner: "CapabilityRegistry V2 readonly projection",
      canonical_writer: "existing source-of-truth modules only",
      readonly_sources: ["backend/config/personal_capabilities.snapshot.json"],
      items: [
        {
          card: {
            id: "external-provider:figma",
            name: "Figma",
            type: "provider",
            source: "honglusi",
            best_use_case: "设计读写与设计转代码",
            input_needed: ["明确任务目的"],
            output_produced: ["外部能力候选结果"],
            risk_level: "high",
            cost_level: "medium",
            reuse_potential: "medium",
            recommended_home: "honglusi",
            status: "trial",
            evidence_sources: ["backend/config/personal_capabilities.snapshot.json"],
            active: false,
            sample_count: 0,
            authority_score: null,
            zero_permission_when_inactive: true,
          },
          persona: null,
          external_review: {
            provider: "Figma",
            permission_needed: ["Figma 账号/方案"],
            data_exposure: ["设计、代码、素材和提示词"],
            allowed_actions: ["METADATA_ONLY"],
            forbidden_actions: ["external write"],
            requires_xingbu_review: true,
            default_grant_duration: "no runtime grant",
            audit_required: true,
          },
          promotion_case: {
            capability_id: "external-provider:figma",
            current_home: "honglusi",
            recommended_action: "入鸿胪寺外部能力候选",
            rationale: "外部能力默认 fail-closed",
            required_evidence: ["安全审查"],
            reviewer_department: "吏部",
          },
          catalog: {
            origin: "personal_catalog",
            category: null,
            natural_language_trigger: "在 Figma 中创建页面",
            explicit_trigger: null,
            invocation_policy: "PREPARE_THEN_CONFIRM",
            fee_status: "取决于 Figma 方案",
            permission_summary: "读写均需任务级确认",
            external_data: "是：设计和代码",
            readiness: {
              visibility_status: "catalog_visible",
              installation_status: "see_current_status",
              connection_status: "connected",
              verification_status: "see_current_status_and_evidence",
              runtime_binding_status: "not_bound",
            },
            blocker: "尚未绑定朝堂 Runtime；当前仅可用于选型和编写协作草案。",
            provider_group: "Figma",
            tool_count: 1,
            tools: [
              {
                id: "mcp-tool:figma",
                name: "mcp__figma__use_figma",
                provider_group: "Figma",
                invocation_policy: "PREPARE_THEN_CONFIRM",
                connection_status: "inherit_provider_status",
                verification_status: "not_individually_verified",
                runtime_binding_status: "not_bound",
              },
            ],
          },
        },
      ],
      agent_personas: [],
      summary: {
        total: 1,
        by_type: { provider: 1 },
        by_home: { honglusi: 1 },
        by_status: { trial: 1 },
        external_review_required: 1,
        small_sample_without_authority_score: 1,
        catalog_hanlin_skills: 0,
        catalog_provider_groups: 1,
        catalog_mcp_tools: 1,
        catalog_snapshot_provider_groups: 16,
        catalog_snapshot_mcp_tools: 92,
        catalog_excluded_support_tools: 9,
      },
    },
  };
}

test("listCapabilities sends only server bearer auth and parses V2 registry", async () => {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const result = await listCapabilities({
    sessionId: "session-1",
    source: "honglusi",
    home: "honglusi",
    baseUrl: "http://backend.local",
    fetchImpl: (async (url: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(url), init: init ?? {} });
      return new Response(JSON.stringify(registryEnvelope()), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch,
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(
    calls[0].url,
    "http://backend.local/api/v1/capabilities?home=honglusi&source=honglusi",
  );
  assert.deepEqual(calls[0].init.headers, { authorization: "Bearer session-1" });
  assert.equal(result.data.schemaVersion, "capability-registry.v2");
  assert.equal(
    result.data.items[0].catalog?.readiness.runtimeBindingStatus,
    "not_bound",
  );
  assert.equal(result.data.items[0].catalog?.tools.length, 1);
  assert.equal(result.data.summary.catalogSnapshotMcpTools, 92);
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

  assert.deepEqual(result, {
    ok: false,
    kind: "unauthenticated",
    error: "能力总账只读服务暂时不可用，请稍后重试。",
  });
  assert.equal(called, false);
});

test("getCapability encodes detail id and rejects malformed backend envelopes", async () => {
  const urls: string[] = [];
  const envelope = registryEnvelope();
  const ok = await getCapability("external-provider:figma/data", {
    sessionId: "session-1",
    baseUrl: "http://backend.local/",
    fetchImpl: (async (url: RequestInfo | URL) => {
      urls.push(String(url));
      return new Response(
        JSON.stringify({ status: "ok", capability: envelope.registry.items[0] }),
        { status: 200 },
      );
    }) as typeof fetch,
  });
  const malformed = await getCapability("external-provider:figma", {
    sessionId: "session-1",
    baseUrl: "http://backend.local",
    fetchImpl: (async () =>
      new Response(
        JSON.stringify({ status: "ok", capability: { owner_user_id: "leak" } }),
        { status: 200 },
      )) as typeof fetch,
  });

  assert.equal(ok.ok, true);
  assert.equal(
    urls[0],
    "http://backend.local/api/v1/capabilities/external-provider%3Afigma%2Fdata",
  );
  assert.deepEqual(malformed, {
    ok: false,
    kind: "unknown",
    error: "能力总账只读服务暂时不可用，请稍后重试。",
  });
});

test("V2 parser rejects V1, unknown fields, and runtime binding claims", async () => {
  const variants = [
    (() => {
      const value = registryEnvelope();
      value.registry.schema_version = "capability-registry.v1";
      return value;
    })(),
    (() => {
      const value = registryEnvelope();
      Object.assign(value.registry.items[0].catalog, { unexpected: true });
      return value;
    })(),
    (() => {
      const value = registryEnvelope();
      value.registry.items[0].catalog.readiness.runtime_binding_status = "bound";
      return value;
    })(),
  ];

  for (const body of variants) {
    const result = await listCapabilities({
      sessionId: "session-1",
      baseUrl: "http://backend.local",
      fetchImpl: (async () =>
        new Response(JSON.stringify(body), { status: 200 })) as typeof fetch,
    });
    assert.deepEqual(result, {
      ok: false,
      kind: "unknown",
      error: "能力总账只读服务暂时不可用，请稍后重试。",
    });
  }
});
