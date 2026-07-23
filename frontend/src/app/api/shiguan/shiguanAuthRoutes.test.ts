import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { test } from "node:test";

import { GET as archives } from "./archives/route.ts";
import { PATCH as review } from "./archives/[id]/review/route.ts";
import { POST as recall } from "./recall/route.ts";
import { GET as statistics } from "./statistics/route.ts";

const unauthenticated = {
  status: "error",
  reason: "unauthenticated",
  message: "authentication required",
};

async function startUnauthorizedStub(): Promise<{
  baseUrl: string;
  authorization: () => string | undefined;
  close: () => Promise<void>;
}> {
  let lastAuthorization: string | undefined;
  const server: Server = createServer((req, res) => {
    lastAuthorization = req.headers.authorization;
    res.writeHead(401, { "content-type": "application/json" });
    res.end(JSON.stringify({ message: "invalid credentials" }));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    authorization: () => lastAuthorization,
    close: () => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())),
  };
}

async function withBackendBaseUrl<T>(baseUrl: string, run: () => Promise<T>): Promise<T> {
  const original = process.env.BACKEND_BASE_URL;
  process.env.BACKEND_BASE_URL = baseUrl;
  try { return await run(); }
  finally {
    if (original === undefined) delete process.env.BACKEND_BASE_URL;
    else process.env.BACKEND_BASE_URL = original;
  }
}

function request(url: string, method: string, body?: unknown, session = false): Request {
  return new Request(url, {
    method,
    headers: { ...(body === undefined ? {} : { "content-type": "application/json" }), ...(session ? { cookie: "courtos_session=test-session" } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

async function assertProtected(
  invoke: (withSession: boolean) => Promise<Response>,
): Promise<void> {
  const noCookie = await invoke(false);
  assert.equal(noCookie.status, 401);
  assert.deepEqual(await noCookie.json(), unauthenticated);

  const stub = await startUnauthorizedStub();
  try {
    await withBackendBaseUrl(stub.baseUrl, async () => {
      const response = await invoke(true);
      assert.equal(response.status, 401);
      assert.deepEqual(await response.json(), unauthenticated);
      assert.equal(stub.authorization(), "Bearer test-session");
    });
  } finally {
    await stub.close();
  }
}

test("archives BFF short-circuits absent cookies and preserves backend 401", async () => {
  await assertProtected((withSession) => archives(request("http://localhost/api/shiguan/archives", "GET", undefined, withSession)));
});

test("statistics BFF short-circuits absent cookies and preserves backend 401", async () => {
  await assertProtected((withSession) => statistics(request("http://localhost/api/shiguan/statistics", "GET", undefined, withSession)));
});

test("recall BFF short-circuits absent cookies and preserves backend 401", async () => {
  await assertProtected((withSession) => recall(request("http://localhost/api/shiguan/recall", "POST", { matterType: "memorial" }, withSession)));
});

test("review BFF short-circuits absent cookies and preserves backend 401", async () => {
  await assertProtected((withSession) => review(
    request("http://localhost/api/shiguan/archives/a-1/review", "PATCH", { status: "ACHIEVED" }, withSession),
    { params: { id: "a-1" } },
  ));
});
