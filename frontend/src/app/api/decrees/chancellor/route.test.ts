import assert from "node:assert/strict";
import { test } from "node:test";

import type { SubmitDecreeResult } from "../../../../lib/backendClient.ts";
import { createPostHandler } from "./handler.ts";

function makeRequest(body: unknown, authenticated = true): Request {
  const normalizedBody =
    typeof body === "object" &&
    body !== null &&
    "decreeText" in body
      ? {
          ...(body as Record<string, unknown>),
          draftVersion: 1,
          draftFingerprint: "a".repeat(64),
          idempotencyKey:
            (body as Record<string, unknown>).idempotencyKey ??
            "test-idempotency-key",
        }
      : body;
  return new Request("http://localhost/api/decrees/chancellor", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(authenticated ? { cookie: "courtos_session=test-session" } : {}),
    },
    body: typeof normalizedBody === "string"
      ? normalizedBody
      : JSON.stringify(normalizedBody),
  });
}

const SINGLE_RESULT = {
  ok: true,
  data: {
    status: "ok",
    chancellor: "丞相",
    routeType: "single",
    rationale: "职责明确。",
    processingPath: ["上书房", "丞相", "户部"],
    departments: ["户部"],
    ministryOpinions: [{
      department: "户部",
      bureauOpinions: [{ bureau: "预算司", opinion: "预算可控。" }],
      opinion: "分期拨付。",
    }],
    councilVerdict: null,
    finalVerdict: "准行。",
    recommendations: ["核定预算", "分期拨付", "设置审计节点"],
    deliveryKind: "accounting_report",
    deliveryPeriod: { startYear: 2024, endYear: 2025 },
    artifacts: [{
      artifactId: "artifact-1",
      kind: "ACCOUNTING_MANAGEMENT_REPORT_XLSX",
      displayName: "management-report.xlsx",
      periodStart: 2024,
      periodEnd: 2025,
      generatedAt: "2026-07-29T08:00:00Z",
    }],
  },
} satisfies SubmitDecreeResult;

const MULTI_RESULT = {
  ok: true,
  data: {
    ...SINGLE_RESULT.data,
    routeType: "multi",
    rationale: "需要两部会办。",
    processingPath: ["上书房", "丞相", "军机处", "户部", "工部"],
    departments: ["户部", "工部"],
    ministryOpinions: [
      SINGLE_RESULT.data.ministryOpinions[0],
      {
        department: "工部",
        bureauOpinions: [{ bureau: "进度司", opinion: "可分段施工。" }],
        opinion: "按里程碑验收。",
      },
    ],
    councilVerdict: "军机处会审通过。",
  },
} satisfies SubmitDecreeResult;

test("POST：未认证请求在调用后端前返回 401", async () => {
  let calls = 0;
  const handler = createPostHandler(async () => {
    calls += 1;
    return SINGLE_RESULT;
  });

  const response = await handler(makeRequest({ decreeText: "测试" }, false));

  assert.equal(response.status, 401);
  assert.equal(calls, 0);
  assert.deepEqual(await response.json(), {
    status: "error",
    reason: "unauthenticated",
    message: "authentication required",
  });
});

for (const [name, result] of [["single", SINGLE_RESULT], ["multi", MULTI_RESULT]] as const) {
  test(`POST：${name} 成功结果映射为固定 200 envelope 并转发会话`, async () => {
    let calls = 0;
    const handler = createPostHandler(async (text, options) => {
      calls += 1;
      assert.equal(typeof text, "string");
      assert.equal(options?.sessionId, "test-session");
      assert.equal(options?.draftVersion, 1);
      assert.equal(options?.draftFingerprint, "a".repeat(64));
      assert.equal(options?.idempotencyKey, "test-idempotency-key");
      return result;
    });

    const response = await handler(makeRequest({ decreeText: "请核查国库存银" }));
    const body = await response.json() as Record<string, unknown>;

    assert.equal(calls, 1);
    assert.equal(response.status, 200);
    assert.equal(body.routeType, result.data.routeType);
    assert.deepEqual(body.processingPath, result.data.processingPath);
    assert.deepEqual(body.recommendations, result.data.recommendations);
    assert.deepEqual(body.artifacts, result.data.artifacts);
  });
}

test("POST preserves an empty artifacts list", async () => {
  const handler = createPostHandler(async () => ({
    ...SINGLE_RESULT,
    data: { ...SINGLE_RESULT.data, deliveryKind: "none", deliveryPeriod: null, artifacts: [] },
  }));
  const response = await handler(makeRequest({ decreeText: "test" }));
  assert.deepEqual((await response.json() as { artifacts: unknown }).artifacts, []);
});

test("POST maps an accepted job to browser-reachable same-origin monitor URLs", async () => {
  let observedKey = "";
  const jobId = "b".repeat(32);
  const handler = createPostHandler(async (_text, options) => {
    observedKey = options?.idempotencyKey ?? "";
    return {
      ok: true,
      data: {
        jobId,
        state: "QUEUED" as const,
        statusUrl: `/api/v1/decree-jobs/${jobId}`,
        cancelUrl: `/api/v1/decree-jobs/${jobId}/cancel`,
        acceptedAt: "2026-08-07T12:00:00Z",
        replayed: false,
      },
      location: `/api/v1/decree-jobs/${jobId}`,
      retryAfterSeconds: 1,
    };
  });

  const response = await handler(makeRequest({
    decreeText: "test",
    idempotencyKey: "browser-key",
  }));
  const body = await response.json() as {
    statusUrl: string;
    cancelUrl: string;
  };

  assert.equal(response.status, 202);
  assert.equal(response.headers.get("location"), `/api/decree-jobs/${jobId}`);
  assert.equal(response.headers.get("retry-after"), "1");
  assert.equal(body.statusUrl, `/api/decree-jobs/${jobId}`);
  assert.equal(body.cancelUrl, `/api/decree-jobs/${jobId}/cancel`);
  assert.equal(observedKey, "browser-key");
});

for (const [kind, expectedStatus, expectedReason] of [
  ["source_not_current", 409, "source_not_current"],
  ["draft_not_current", 409, "draft_not_current"],
  ["conflict", 409, "idempotency_conflict"],
  ["unavailable", 503, "unknown"],
] as const) {
  test(`POST preserves async enqueue error classification: ${kind}`, async () => {
    const handler = createPostHandler(async () => ({ ok: false, kind }));
    const response = await handler(makeRequest({ decreeText: "测试" }));
    const body = await response.json() as { reason: string };

    assert.equal(response.status, expectedStatus);
    assert.equal(body.reason, expectedReason);
  });
}

for (const [kind, expectedStatus] of [
  ["validation", 422],
  ["config", 503],
  ["model", 502],
  ["timeout", 504],
  ["network", 503],
  ["unauthenticated", 401],
  ["unknown", 503],
] as const) {
  test(`POST：${kind} 使用脱敏固定错误映射`, async () => {
    const handler = createPostHandler(async () => ({
      ok: false,
      kind,
      error: "private backend detail",
    }));

    const response = await handler(makeRequest({ decreeText: "测试" }));
    const text = await response.text();

    assert.equal(response.status, expectedStatus);
    assert.equal(text.includes("private backend detail"), false);
    assert.equal((JSON.parse(text) as { reason: string }).reason, kind);
  });
}

test("POST：submit 依赖意外抛出时返回脱敏 503 JSON", async () => {
  const handler = createPostHandler(async () => {
    throw new Error("private backend detail");
  });

  const response = await handler(makeRequest({ decreeText: "测试" }));
  const text = await response.text();

  assert.equal(response.status, 503);
  assert.equal(text.includes("private backend detail"), false);
  assert.deepEqual(JSON.parse(text), {
    status: "error",
    reason: "unknown",
    message: "服务暂时不可用，请稍后重试。",
  });
});

for (const [name, body] of [
  ["非法 JSON", "not-json{"],
  ["缺少 decreeText", { somethingElse: "旨意" }],
  ["decreeText 非字符串", { decreeText: 12345 }],
] as const) {
  test(`POST：${name} 在调用后端前返回稳定 400`, async () => {
    let calls = 0;
    const handler = createPostHandler(async () => {
      calls += 1;
      return SINGLE_RESULT;
    });

    const response = await handler(makeRequest(body));

    assert.equal(response.status, 400);
    assert.equal(calls, 0);
  });
}

for (const decreeText of [" ", "旨".repeat(2001)]) {
  test(`POST rejects out-of-bounds decree text before backend: ${decreeText.length}`, async () => {
    let calls = 0;
    const handler = createPostHandler(async () => {
      calls += 1;
      return SINGLE_RESULT;
    });

    const response = await handler(makeRequest({ decreeText }));

    assert.equal(response.status, 400);
    assert.equal(calls, 0);
  });
}

test("POST preserves a valid 2000-character decree text exactly", async () => {
  const decreeText = ` ${"旨".repeat(1998)} `;
  let received = "";
  const handler = createPostHandler(async (text) => {
    received = text;
    return SINGLE_RESULT;
  });

  const response = await handler(makeRequest({ decreeText }));

  assert.equal(response.status, 200);
  assert.equal(received, decreeText);
});
