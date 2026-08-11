import assert from "node:assert/strict";
import test from "node:test";

import { PUT } from "./route.ts";

function request(body: unknown, session = true): Request {
  return new Request("http://localhost/api/shiguan/archives/a-1/decision", {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      ...(session ? { cookie: "courtos_session=test-session" } : {}),
    },
    body: JSON.stringify(body),
  });
}

async function withBackendFetch(
  responseStatus: number,
  responseBody: unknown,
  run: (requestFacts: () => { url?: string; authorization?: string; body?: string }) => Promise<void>,
): Promise<void> {
  let facts: { url?: string; authorization?: string; body?: string } = {};
  const originalFetch = globalThis.fetch;
  const original = process.env.BACKEND_BASE_URL;
  process.env.BACKEND_BASE_URL = "https://backend.invalid";
  globalThis.fetch = async (input, init) => {
    const headers = init?.headers as Record<string, string> | undefined;
    facts = {
      url: String(input),
      authorization: headers?.authorization,
      body: typeof init?.body === "string" ? init.body : undefined,
    };
    return new Response(JSON.stringify(responseBody), {
      status: responseStatus,
      headers: { "content-type": "application/json" },
    });
  };
  try {
    await run(() => facts);
  } finally {
    globalThis.fetch = originalFetch;
    if (original === undefined) delete process.env.BACKEND_BASE_URL;
    else process.env.BACKEND_BASE_URL = original;
  }
}

test("decision BFF rejects absent session before forwarding", async () => {
  const response = await PUT(request({ decision: "APPROVED" }, false), { params: Promise.resolve({ id: "a-1" }) });
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), {
    status: "error",
    reason: "unauthenticated",
    message: "authentication required",
  });
});

test("decision BFF accepts only an exact one-field four-value request", async () => {
  for (const body of [
    null,
    {},
    { decision: "UNKNOWN" },
    { decision: "APPROVED", owner: "user-2" },
  ]) {
    const response = await PUT(request(body), { params: Promise.resolve({ id: "a-1" }) });
    assert.equal(response.status, 400);
    assert.equal((await response.json() as { reason: string }).reason, "validation");
  }
});

test("decision BFF forwards encoded ID, Bearer session, and owner-free body", async () => {
  await withBackendFetch(200, {
    decision: "ADOPTED",
    decided_at: "2026-08-09T02:00:00Z",
  }, async (facts) => {
    const response = await PUT(request({ decision: "ADOPTED" }), {
      params: Promise.resolve({ id: "a /甲" }),
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      status: "ok",
      decisionStatus: {
        decision: "ADOPTED",
        decidedAt: "2026-08-09T02:00:00Z",
      },
    });
    assert.equal(facts().url, "https://backend.invalid/api/v1/shiguan/archives/a%20%2F%E7%94%B2/decision");
    assert.equal(facts().authorization, "Bearer test-session");
    assert.deepEqual(JSON.parse(facts().body ?? "null"), { decision: "ADOPTED" });
  });
});

test("decision BFF maps backend failures to stable sanitized responses", async () => {
  const cases = [
    [404, "not_found", "未找到对应史馆档案。"],
    [409, "conflict", "该文书已有不同处置，请刷新查看已归档结果。"],
    [422, "validation", "处置未通过校验，请确认文书类型与决定后重试。"],
    [503, "storage", "史馆暂时不可用，请稍后重试。"],
  ] as const;
  for (const [status, reason, message] of cases) {
    await withBackendFetch(status, { message: "sensitive backend detail" }, async () => {
      const response = await PUT(request({ decision: "APPROVED" }), { params: Promise.resolve({ id: "a-1" }) });
      assert.equal(response.status, status);
      assert.deepEqual(await response.json(), { status: "error", reason, message });
    });
  }

  await withBackendFetch(200, { decision: "APPROVED", decided_at: "invalid" }, async () => {
    const response = await PUT(request({ decision: "APPROVED" }), { params: Promise.resolve({ id: "a-1" }) });
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), {
      status: "error",
      reason: "unknown",
      message: "史馆服务暂时不可用，请稍后重试。",
    });
  });
});

test("decision BFF sanitizes a deterministic unreachable-backend failure", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new TypeError("injected offline failure"); };
  try {
    const response = await PUT(request({ decision: "APPROVED" }), { params: Promise.resolve({ id: "a-1" }) });
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), {
      status: "error",
      reason: "network",
      message: "无法连接朝堂后端，请稍后重试。",
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
