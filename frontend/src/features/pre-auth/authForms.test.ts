import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { submitLogin, submitRegister } from "./formValidation.ts";

test("login posts only identifier and password", async () => {
  let body: unknown;
  await submitLogin(
    { username: " court@example.com ", password: "six-or-more" },
    undefined,
    async (_url, init) => {
      body = JSON.parse(String(init?.body));
      return new Response("{}", { status: 200 });
    },
  );

  assert.deepEqual(body, { identifier: "court@example.com", password: "six-or-more" });
});

test("auth forms drive their disabled submitting state through a synchronous gate", async () => {
  const login = await readFile(new URL("./LoginForm.tsx", import.meta.url), "utf8");
  const register = await readFile(new URL("./RegisterForm.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("./preAuth.module.css", import.meta.url), "utf8");

  for (const form of [login, register]) {
    assert.match(form, /createSubmissionGate/);
    assert.match(form, /\.run\(\(\) => submit(?:Login|Register)/);
    assert.match(form, /disabled=\{submitting\}/);
  }
  assert.match(login, /submitting \? "正在入朝…" : "进入上书房"/);
  assert.match(register, /submitting \? "正在创建…" : "创建朝堂"/);
  assert.match(css, /\.button:disabled\s*\{[\s\S]*?cursor:\s*wait;[\s\S]*?opacity:\s*\.7;/);
});

test("login shows a registration success notice only for the exact marker", async () => {
  const login = await readFile(new URL("./LoginForm.tsx", import.meta.url), "utf8");

  assert.match(
    login,
    /const registered = searchParams\.get\("registered"\) === "1";[\s\S]{0,1200}\{registered \?[\s\S]{0,400}role="status"[\s\S]{0,200}注册成功，请登录[\s\S]{0,200}: null\}/,
  );
});

test("successful registration always returns to login with a success marker", async () => {
  let requestUrl = "";
  const result = await submitRegister(
    { username: "court", email: "court@example.com", password: "six-or-more", confirm: "six-or-more" },
    "/shiguan",
    async (url, init) => {
      requestUrl = url;
      assert.equal(init?.method, "POST");
      assert.deepEqual(JSON.parse(String(init?.body)), { username: "court", email: "court@example.com", password: "six-or-more" });
      return new Response("{}", { status: 201 });
    },
  );
  assert.deepEqual(result, {
    ok: true,
    destination: "/login?registered=1",
    requestUrl: "/api/auth/register",
  });
  assert.equal(requestUrl, "/api/auth/register");
});

test("successful login defaults to dadian and preserves exact protected destinations", async () => {
  const request = async () => new Response("{}", { status: 200 });
  for (const [next, destination] of [
    [undefined, "/dadian"],
    ["/dadian", "/dadian"],
    ["/study", "/study"],
    ["/shiguan", "/shiguan"],
    ["https://attacker.example", "/dadian"],
    ["/unknown", "/dadian"],
  ] as const) {
    const result = await submitLogin({ username: "court", password: "six-or-more" }, next, request);
    assert.equal(result.ok && result.destination, destination);
  }
});

test("login surfaces a 401 BFF failure", async () => {
  const result = await submitLogin(
    { username: "court", password: "six-or-more" },
    undefined,
    async () => new Response(JSON.stringify({ status: "error", reason: "unauthenticated" }), { status: 401 }),
  );

  assert.deepEqual(result, { ok: false, message: "用户名或密码不正确。", requestUrl: "/api/auth/login" });
});
