import assert from "node:assert/strict";
import test from "node:test";

import { requestBingbu } from "./backendClient.ts";

test("requestBingbu forwards the opaque session and returns the structured body", async () => {
  const originalFetch = globalThis.fetch;
  let seen: RequestInit | undefined;
  globalThis.fetch = async (_input, init) => {
    seen = init;
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  };
  try {
    const result = await requestBingbu("/api/v1/bingbu/overview", { sessionId: "opaque" });
    assert.deepEqual(result, { ok: true, status: 200, data: { ok: true } });
    assert.equal((seen?.headers as Record<string, string>).authorization, "Bearer opaque");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("requestBingbu maps protected errors without exposing backend details", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ secret: "hidden" }), { status: 404 });
  try {
    assert.deepEqual(await requestBingbu("/api/v1/bingbu/opportunities/missing", { sessionId: "opaque" }), {
      ok: false,
      status: 404,
      kind: "not_found",
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
