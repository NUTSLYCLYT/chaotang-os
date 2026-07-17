import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

import { POST } from "./route.ts";

/**
 * 离线测试 `POST /api/decrees/chancellor` Route Handler：直接 `import { POST }`
 * 并构造 `Request`/调用返回的 `Response`，不启动真实 Next.js 服务器、不产生任何
 * 真实网络或 DeepSeek 调用。参考 `src/lib/backendClient.test.ts` 起本地 stub 服务
 * 的方式，通过 `process.env.BACKEND_BASE_URL` 让 `submitDecree()`（Route Handler
 * 内部调用）指向本地 stub。
 */

/** 启动一个只响应 `POST /api/v1/decrees/chancellor` 的本地 stub 服务。 */
async function startDecreeStub(
  status: number,
  body: unknown,
): Promise<{ baseUrl: string; close: () => Promise<void> }> {
  const server: Server = createServer((req, res) => {
    if (req.method === "POST" && req.url === "/api/v1/decrees/chancellor") {
      const payload = typeof body === "string" ? body : JSON.stringify(body);
      res.writeHead(status, { "content-type": "application/json" });
      res.end(payload);
      return;
    }
    res.writeHead(404);
    res.end();
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as AddressInfo;

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}

/** 找一个当前空闲、但调用时保证没有服务监听的端口，用于模拟「后端不可达」。 */
async function findUnusedPort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as AddressInfo;
  const port = address.port;
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  return port;
}

/** 在 `run()` 期间把 `BACKEND_BASE_URL` 临时设置为 `baseUrl`，结束后恢复原值。 */
async function withBackendBaseUrl<T>(baseUrl: string, run: () => Promise<T>): Promise<T> {
  const original = process.env.BACKEND_BASE_URL;
  process.env.BACKEND_BASE_URL = baseUrl;
  try {
    return await run();
  } finally {
    if (original === undefined) {
      delete process.env.BACKEND_BASE_URL;
    } else {
      process.env.BACKEND_BASE_URL = original;
    }
  }
}

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/decrees/chancellor", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

test("POST：成功路径（single 路由）- 后端返回符合契约的响应时映射为 200，新字段全部透传", async () => {
  const stub = await startDecreeStub(200, {
    status: "ok",
    chancellor: "丞相",
    route_type: "single",
    rationale: "此事职责明确，交由户部办理即可。",
    processing_path: ["上书房", "丞相", "户部"],
    departments: ["户部"],
    ministry_opinions: [{ department: "户部", bureau_opinions: [{ bureau: "预算司", opinion: "预算可控。" }], opinion: "户部补充：分期拨付。" }],
    council_verdict: null,
    final_verdict: "丞相汇总：预算可控，可分期拨付。",
    recommendations: ["核定预算", "分期拨付", "设置审计节点"],
  });
  try {
    const response = await withBackendBaseUrl(stub.baseUrl, () =>
      POST(makeRequest({ decreeText: "请核查国库存银" })),
    );

    assert.equal(response.status, 200);
    const body = (await response.json()) as Record<string, unknown>;
    assert.deepEqual(body, {
      status: "ok",
      chancellor: "丞相",
      routeType: "single",
      rationale: "此事职责明确，交由户部办理即可。",
      processingPath: ["上书房", "丞相", "户部"],
      departments: ["户部"],
      ministryOpinions: [{ department: "户部", bureauOpinions: [{ bureau: "预算司", opinion: "预算可控。" }], opinion: "户部补充：分期拨付。" }],
      councilVerdict: null,
      finalVerdict: "丞相汇总：预算可控，可分期拨付。",
      recommendations: ["核定预算", "分期拨付", "设置审计节点"],
    });
  } finally {
    await stub.close();
  }
});

test("POST：成功路径（multi 路由）- 后端返回符合契约的响应时映射为 200，含军机处会审字段", async () => {
  const stub = await startDecreeStub(200, {
    status: "ok",
    chancellor: "丞相",
    route_type: "multi",
    rationale: "此事涉及工程与钱粮，需户部、工部会同办理。",
    processing_path: ["上书房", "丞相", "军机处", "户部", "工部"],
    departments: ["户部", "工部"],
    ministry_opinions: [
      { department: "户部", bureau_opinions: [{ bureau: "预算司", opinion: "预算可控。" }], opinion: "户部补充：分期拨付。" },
      { department: "工部", bureau_opinions: [{ bureau: "进度司", opinion: "可分段施工。" }], opinion: "工部补充：按里程碑验收。" },
    ],
    council_verdict: "军机处会审：分期拨付并按里程碑验收。",
    final_verdict: "丞相汇总：准予分阶段兴修水利。",
    recommendations: ["先完成勘察", "分期拨付预算", "按里程碑验收"],
  });
  try {
    const response = await withBackendBaseUrl(stub.baseUrl, () =>
      POST(makeRequest({ decreeText: "兴修水利并征调粮草以工代赈" })),
    );

    assert.equal(response.status, 200);
    const body = (await response.json()) as Record<string, unknown>;
    assert.equal(body.routeType, "multi");
    assert.deepEqual(body.processingPath, ["上书房", "丞相", "军机处", "户部", "工部"]);
    assert.deepEqual(body.departments, ["户部", "工部"]);
    assert.deepEqual(body.ministryOpinions, [
      { department: "户部", bureauOpinions: [{ bureau: "预算司", opinion: "预算可控。" }], opinion: "户部补充：分期拨付。" },
      { department: "工部", bureauOpinions: [{ bureau: "进度司", opinion: "可分段施工。" }], opinion: "工部补充：按里程碑验收。" },
    ]);
    assert.equal(body.councilVerdict, "军机处会审：分期拨付并按里程碑验收。");
    assert.equal(body.finalVerdict, "丞相汇总：准予分阶段兴修水利。");
    assert.deepEqual(body.recommendations, ["先完成勘察", "分期拨付预算", "按里程碑验收"]);
  } finally {
    await stub.close();
  }
});

for (const [name, backendBody] of [
  [
    "嵌套司级意见含额外字段",
    {
      status: "ok",
      chancellor: "丞相",
      route_type: "single",
      rationale: "交由户部办理。",
      processing_path: ["上书房", "丞相（首次分流）", "户部", "户部·预算司", "户部（部级补充）", "丞相（最终汇总）"],
      departments: ["户部"],
      ministry_opinions: [{ department: "户部", bureau_opinions: [{ bureau: "预算司", opinion: "预算可控。", extra: true }], opinion: "户部补充。" }],
      council_verdict: null,
      final_verdict: "丞相总结。",
      recommendations: ["建议一", "建议二", "建议三"],
    },
  ],
  [
    "multi 缺少军机处会审结论",
    {
      status: "ok",
      chancellor: "丞相",
      route_type: "multi",
      rationale: "需两部会办。",
      processing_path: ["上书房", "丞相（首次分流）", "军机处（召集）", "户部", "工部", "军机处（会审）", "丞相（最终汇总）"],
      departments: ["户部", "工部"],
      ministry_opinions: [
        { department: "户部", bureau_opinions: [{ bureau: "预算司", opinion: "预算意见。" }], opinion: "户部补充。" },
        { department: "工部", bureau_opinions: [{ bureau: "进度司", opinion: "进度意见。" }], opinion: "工部补充。" },
      ],
      council_verdict: null,
      final_verdict: "丞相总结。",
      recommendations: ["建议一", "建议二", "建议三"],
    },
  ],
] as const) {
  test(`POST：后端 200 但${name}时拒绝成功并映射为 503 unknown`, async () => {
    const stub = await startDecreeStub(200, backendBody);
    try {
      const response = await withBackendBaseUrl(stub.baseUrl, () =>
        POST(makeRequest({ decreeText: "测试非法分层结果" })),
      );
      assert.equal(response.status, 503);
      const body = (await response.json()) as Record<string, unknown>;
      assert.equal(body.status, "error");
      assert.equal(body.reason, "unknown");
    } finally {
      await stub.close();
    }
  });
}

test("POST：后端校验失败(422) - 映射为 422，且响应体不含后端 detail 原文", async () => {
  const stub = await startDecreeStub(422, {
    detail: [{ msg: "旨意长度不合法", type: "value_error" }],
  });
  try {
    const response = await withBackendBaseUrl(stub.baseUrl, () => POST(makeRequest({ decreeText: "" })));

    assert.equal(response.status, 422);
    const body = (await response.json()) as Record<string, unknown>;
    assert.equal(body.status, "error");
    assert.equal(body.reason, "validation");
    assert.equal(typeof body.message, "string");
    assert.ok((body.message as string).length > 0);
    assert.equal(JSON.stringify(body).includes("value_error"), false);
  } finally {
    await stub.close();
  }
});

test("POST：后端配置失败(503) - 映射为 503", async () => {
  const stub = await startDecreeStub(503, {
    status: "error",
    reason: "config_unavailable",
    message: "后端配置暂不可用，请稍后重试。",
  });
  try {
    const response = await withBackendBaseUrl(stub.baseUrl, () =>
      POST(makeRequest({ decreeText: "请核查国库存银" })),
    );

    assert.equal(response.status, 503);
    const body = (await response.json()) as Record<string, unknown>;
    assert.equal(body.status, "error");
    assert.equal(body.reason, "config");
  } finally {
    await stub.close();
  }
});

test("POST：模型调用失败(502) - 映射为 502", async () => {
  const stub = await startDecreeStub(502, {
    status: "error",
    reason: "model_unavailable",
    message: "丞相暂时无法给出回奏，请稍后重试。",
  });
  try {
    const response = await withBackendBaseUrl(stub.baseUrl, () =>
      POST(makeRequest({ decreeText: "请核查国库存银" })),
    );

    assert.equal(response.status, 502);
    const body = (await response.json()) as Record<string, unknown>;
    assert.equal(body.status, "error");
    assert.equal(body.reason, "model");
  } finally {
    await stub.close();
  }
});

test("POST：后端不可达 - 映射为 503（network），不抛出异常", async () => {
  const unusedPort = await findUnusedPort();

  let threw = false;
  let response: Response | undefined;
  try {
    response = await withBackendBaseUrl(`http://127.0.0.1:${unusedPort}`, () =>
      POST(makeRequest({ decreeText: "请核查国库存银" })),
    );
  } catch {
    threw = true;
  }

  assert.equal(threw, false, "POST 不应抛出异常");
  assert.ok(response);
  assert.equal(response!.status, 503);
  const body = (await response!.json()) as Record<string, unknown>;
  assert.equal(body.status, "error");
  assert.equal(body.reason, "network");
});

test("POST：请求体不是合法 JSON - 返回稳定 4xx，不 500，不调用后端", async () => {
  const request = new Request("http://localhost/api/decrees/chancellor", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "not-json{",
  });

  const response = await POST(request);

  assert.equal(response.status, 400);
  const body = (await response.json()) as Record<string, unknown>;
  assert.equal(body.status, "error");
  assert.equal(typeof body.message, "string");
});

test("POST：请求体缺少 decreeText 字段 - 返回稳定 4xx，不调用后端", async () => {
  const response = await POST(makeRequest({ somethingElse: "旨意" }));

  assert.equal(response.status, 400);
  const body = (await response.json()) as Record<string, unknown>;
  assert.equal(body.status, "error");
});

test("POST：请求体 decreeText 字段类型不是字符串 - 返回稳定 4xx，不调用后端", async () => {
  const response = await POST(makeRequest({ decreeText: 12345 }));

  assert.equal(response.status, 400);
  const body = (await response.json()) as Record<string, unknown>;
  assert.equal(body.status, "error");
});
