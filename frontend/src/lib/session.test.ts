import assert from "node:assert/strict";
import { test } from "node:test";

import {
  SESSION_COOKIE_NAME,
  clearSessionCookie,
  readSessionId,
  setSessionCookie,
} from "./session.ts";

test("reads the opaque session only from the named request cookie", () => {
  const request = new Request("http://localhost/api/auth/me", {
    headers: { cookie: "theme=dark; courtos_session=test-session; locale=zh" },
  });

  assert.equal(SESSION_COOKIE_NAME, "courtos_session");
  assert.equal(readSessionId(request), "test-session");
  assert.equal(readSessionId(new Request("http://localhost")), null);
});

test("rejects decoded whitespace-only sessions without rewriting nonblank opaque sessions", () => {
  for (const encodedWhitespace of ["%20", "%09", "%20%09%20"]) {
    const request = new Request("http://localhost", {
      headers: { cookie: `courtos_session=${encodedWhitespace}` },
    });
    assert.equal(readSessionId(request), null, encodedWhitespace);
  }

  const opaque = new Request("http://localhost", {
    headers: { cookie: "courtos_session=%20opaque%20" },
  });
  assert.equal(readSessionId(opaque), " opaque ");
});

test("sets an HttpOnly same-site session cookie", () => {
  const response = new Response(null);
  setSessionCookie(response, "test-session");

  assert.match(
    response.headers.get("set-cookie") ?? "",
    /courtos_session=test-session; Path=\/; HttpOnly; SameSite=Lax/,
  );
});

test("sets Secure on the production session cookie", () => {
  const environment = process.env as Record<string, string | undefined>;
  const original = environment.NODE_ENV;
  environment.NODE_ENV = "production";
  try {
    const response = new Response(null);
    setSessionCookie(response, "test-session");
    assert.match(response.headers.get("set-cookie") ?? "", /; Secure/);
  } finally {
    if (original === undefined) delete environment.NODE_ENV;
    else environment.NODE_ENV = original;
  }
});

test("clears the session cookie at the same path", () => {
  const response = new Response(null);
  clearSessionCookie(response);

  assert.match(
    response.headers.get("set-cookie") ?? "",
    /courtos_session=; Path=\/; HttpOnly; SameSite=Lax; Max-Age=0/,
  );
});
