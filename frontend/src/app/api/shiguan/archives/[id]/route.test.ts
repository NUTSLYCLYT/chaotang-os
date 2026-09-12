import assert from "node:assert/strict";
import test from "node:test";
import { GET } from "./route.ts";

const params = (id: string) => ({ params: Promise.resolve({ id }) });
const request = (session = true) => new Request("http://localhost/api/shiguan/archives/reply-1", {
  headers: session ? { cookie: "courtos_session=test-session" } : {},
});

test("single archive BFF rejects invalid ids and missing sessions without forwarding", async () => {
  const original = globalThis.fetch;
  let forwards = 0;
  globalThis.fetch = async () => { forwards += 1; return new Response(); };
  try {
    const browserAuthorizationOnly = new Request("http://localhost/api/shiguan/archives/reply-1", {
      headers: { authorization: "Bearer browser-supplied" },
    });
    assert.equal((await GET(browserAuthorizationOnly, params("reply-1"))).status, 401);
    assert.equal(forwards, 0);
  } finally { globalThis.fetch = original; }
  assert.equal((await GET(request(), params("bad/id"))).status, 400);
});

test("single archive BFF forwards only the cookie session and maps upstream auth/unavailability", async () => {
  const original = globalThis.fetch;
  const statuses = [401, 503];
  const forwarded: string[] = [];
  globalThis.fetch = async (_input, init) => {
    forwarded.push(new Headers(init?.headers).get("authorization") ?? "");
    return new Response(JSON.stringify({ detail: "private owner information" }), { status: statuses.shift() ?? 503 });
  };
  try {
    const browserAndCookie = new Request("http://localhost/api/shiguan/archives/reply-1", {
      headers: { cookie: "courtos_session=test-session", authorization: "Bearer browser-supplied" },
    });
    const unauthorized = await GET(browserAndCookie, params("reply-1"));
    const unavailable = await GET(browserAndCookie, params("reply-1"));
    assert.equal(unauthorized.status, 401);
    assert.equal(unavailable.status, 503);
    assert.deepEqual(forwarded, ["Bearer test-session", "Bearer test-session"]);
    assert.doesNotMatch(await unavailable.text(), /private/);
  } finally { globalThis.fetch = original; }
});

test("single archive BFF makes unknown and cross-owner not-found responses equivalent", async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => new Response(
    JSON.stringify({ detail: ++calls === 1 ? "unknown-private" : "cross-owner-private" }),
    { status: 404 },
  );
  try {
    const first = await GET(request(), params("reply-unknown"));
    const second = await GET(request(), params("reply-cross-owner"));
    assert.equal(first.status, 404);
    assert.equal(second.status, 404);
    assert.equal(await first.text(), await second.text());
    assert.equal(first.headers.get("cache-control"), second.headers.get("cache-control"));
    assert.doesNotMatch(await GET(request(), params("reply-third")).then((response) => response.text()), /private/);
  } finally { globalThis.fetch = original; }
});
