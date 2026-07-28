import assert from "node:assert/strict";
import { test } from "node:test";

import type { SubmitDecreeResult } from "../../../../lib/backendClient.ts";
import { createPostHandler } from "./route.ts";

function makeRequest(body: unknown, authenticated = true): Request {
  return new Request("http://localhost/api/decrees/chancellor", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(authenticated ? { cookie: "courtos_session=test-session" } : {}),
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const SINGLE_RESULT: SubmitDecreeResult = {
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
  },
};

const MULTI_RESULT: SubmitDecreeResult = {
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
};

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
      return result;
    });

    const response = await handler(makeRequest({ decreeText: "请核查国库存银" }));
    const body = await response.json() as Record<string, unknown>;

    assert.equal(calls, 1);
    assert.equal(response.status, 200);
    assert.equal(body.routeType, result.data.routeType);
    assert.deepEqual(body.processingPath, result.data.processingPath);
    assert.deepEqual(body.recommendations, result.data.recommendations);
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
