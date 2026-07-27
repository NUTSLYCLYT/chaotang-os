import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { test } from "node:test";

import { POST as login } from "./login/route.ts";
import { GET as me } from "./me/route.ts";
import { POST as logout } from "./logout/route.ts";
import { POST as register } from "./register/route.ts";

const user = { id: "user-1", username: "court", email: "court@example.com" };

async function startAuthStub(logoutStatus = 204): Promise<{
  baseUrl: string;
  authorization: () => string | undefined;
  close: () => Promise<void>;
}> {
  let lastAuthorization: string | undefined;
  const server: Server = createServer((req, res) => {
    lastAuthorization = req.headers.authorization;
    const send = (status: number, body?: unknown) => {
      res.writeHead(status, body === undefined ? undefined : { "content-type": "application/json" });
      res.end(body === undefined ? undefined : JSON.stringify(body));
    };
    if (req.method === "POST" && req.url === "/api/v1/auth/register") {
      send(201, { user, session_id: "test-session" });
      return;
    }
    if (req.method === "POST" && req.url === "/api/v1/auth/login") {
      send(200, { user, session_id: "test-session" });
      return;
    }
    if (req.method === "GET" && req.url === "/api/v1/auth/me") {
      if (req.headers.authorization !== "Bearer test-session") {
        send(401, { message: "invalid credentials" });
        return;
      }
      send(200, user);
      return;
    }
    if (req.method === "POST" && req.url === "/api/v1/auth/logout") {
      if (req.headers.authorization !== "Bearer test-session") {
        send(401, { message: "invalid credentials" });
        return;
      }
      send(logoutStatus, logoutStatus === 204 ? undefined : { message: "invalid credentials" });
      return;
    }
    send(404);
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
  try {
    return await run();
  } finally {
    if (original === undefined) delete process.env.BACKEND_BASE_URL;
    else process.env.BACKEND_BASE_URL = original;
  }
}

function jsonRequest(path: string, body: unknown, cookie?: string): Request {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  });
}

test("login BFF sets an HttpOnly same-site cookie and omits the backend session id", async () => {
  const stub = await startAuthStub();
  try {
    const response = await withBackendBaseUrl(stub.baseUrl, () =>
      login(jsonRequest("/api/auth/login", { identifier: "court", password: "six-or-more" })),
    );
    assert.equal(response.status, 200);
    assert.match(response.headers.get("set-cookie") ?? "", /courtos_session=.*HttpOnly.*SameSite=Lax/);
    assert.deepEqual(await response.json(), { user });
  } finally {
    await stub.close();
  }
});

test("register BFF sets a cookie only after the backend creates the user", async () => {
  const stub = await startAuthStub();
  try {
    const response = await withBackendBaseUrl(stub.baseUrl, () =>
      register(jsonRequest("/api/auth/register", { username: "court", email: "court@example.com", password: "six-or-more" })),
    );
    assert.equal(response.status, 201);
    assert.match(response.headers.get("set-cookie") ?? "", /courtos_session=test-session/);
    assert.deepEqual(await response.json(), { user });
  } finally {
    await stub.close();
  }
});

test("authenticated auth BFF forwards the cookie session and rejects no-cookie callers", async () => {
  const stub = await startAuthStub();
  try {
    await withBackendBaseUrl(stub.baseUrl, async () => {
      const withoutCookie = await me(new Request("http://localhost/api/auth/me"));
      assert.equal(withoutCookie.status, 401);
      assert.deepEqual(await withoutCookie.json(), { status: "error", reason: "unauthenticated", message: "authentication required" });

      const response = await me(new Request("http://localhost/api/auth/me", { headers: { cookie: "courtos_session=test-session" } }));
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { user });
      assert.equal(stub.authorization(), "Bearer test-session");
    });
  } finally {
    await stub.close();
  }
});

test("logout revokes the cookie session before clearing its browser cookie", async () => {
  const stub = await startAuthStub();
  try {
    await withBackendBaseUrl(stub.baseUrl, async () => {
      const response = await logout(jsonRequest("/api/auth/logout", {}, "courtos_session=test-session"));
      assert.equal(response.status, 204);
      assert.equal(stub.authorization(), "Bearer test-session");
      assert.match(response.headers.get("set-cookie") ?? "", /courtos_session=.*Max-Age=0/);
    });
  } finally {
    await stub.close();
  }
});

test("logout clears the local cookie even when FastAPI rejects revocation", async () => {
  const stub = await startAuthStub(401);
  try {
    await withBackendBaseUrl(stub.baseUrl, async () => {
      const response = await logout(jsonRequest("/api/auth/logout", {}, "courtos_session=test-session"));
      assert.equal(response.status, 401);
      assert.equal(stub.authorization(), "Bearer test-session");
      assert.match(response.headers.get("set-cookie") ?? "", /courtos_session=.*Max-Age=0/);
    });
  } finally {
    await stub.close();
  }
});
