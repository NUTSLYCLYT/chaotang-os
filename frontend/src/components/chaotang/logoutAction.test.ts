import assert from "node:assert/strict";
import test from "node:test";

import { logoutAction } from "./logoutAction.ts";

test("logout action uses the cookie-only same-origin BFF", async () => {
  const requests: Array<{ input: string | URL | Request; init?: RequestInit }> = [];
  const redirects: string[] = [];

  const result = await logoutAction({
    fetchImpl: async (input, init) => {
      requests.push({ input, init });
      return new Response(null, { status: 204 });
    },
    redirect: (href) => redirects.push(href),
  });

  assert.equal(result, true);
  assert.equal(requests.length, 1);
  assert.equal(requests[0]?.input, "/api/auth/logout");
  assert.deepEqual(requests[0]?.init, {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
  });
  assert.deepEqual(redirects, ["/login"]);
});

test("logout action accepts only BFF states that clear or lack the local cookie", async () => {
  for (const status of [204, 401, 503]) {
    const redirects: string[] = [];
    const result = await logoutAction({
      fetchImpl: async () => new Response(null, { status }),
      redirect: (href) => redirects.push(href),
    });
    assert.equal(result, true, `status ${status}`);
    assert.deepEqual(redirects, ["/login"]);
  }
});

test("logout action keeps unexpected and network failures retryable", async () => {
  const redirects: string[] = [];
  const redirect = (href: string) => redirects.push(href);

  assert.equal(await logoutAction({
    fetchImpl: async () => new Response(null, { status: 418 }),
    redirect,
  }), false);
  assert.equal(await logoutAction({
    fetchImpl: async () => { throw new Error("offline"); },
    redirect,
  }), false);
  assert.deepEqual(redirects, []);
});
