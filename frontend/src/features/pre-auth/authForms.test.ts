import assert from "node:assert/strict";
import test from "node:test";

import { submitLogin, submitRegister } from "./formValidation.ts";

test("successful registration uses the BFF and defaults to study", async () => {
  let requestUrl = "";
  const result = await submitRegister(
    { username: "court", email: "court@example.com", password: "six-or-more", confirm: "six-or-more" },
    undefined,
    async (url, init) => {
      requestUrl = url;
      assert.equal(init?.method, "POST");
      assert.deepEqual(JSON.parse(String(init?.body)), { username: "court", email: "court@example.com", password: "six-or-more" });
      return new Response(JSON.stringify({ user: { id: "user-1", username: "court", email: "court@example.com" } }), { status: 201 });
    },
  );

  assert.deepEqual(result, { ok: true, destination: "/study", requestUrl: "/api/auth/register" });
  assert.equal(requestUrl, "/api/auth/register");
});

test("successful login uses an allowlisted next destination", async () => {
  const result = await submitLogin(
    { username: "court", password: "six-or-more" },
    "/shiguan",
    async (url) => {
      assert.equal(url, "/api/auth/login");
      return new Response(JSON.stringify({ user: { id: "user-1", username: "court", email: "court@example.com" } }), { status: 200 });
    },
  );

  assert.deepEqual(result, { ok: true, destination: "/shiguan", requestUrl: "/api/auth/login" });
});

test("form submissions reject an untrusted next path and surface BFF failures", async () => {
  const result = await submitLogin(
    { username: "court", password: "six-or-more" },
    "https://attacker.example",
    async () => new Response(JSON.stringify({ status: "error", reason: "unauthenticated" }), { status: 401 }),
  );

  assert.deepEqual(result, { ok: false, message: "用户名或密码不正确。", requestUrl: "/api/auth/login" });
});
