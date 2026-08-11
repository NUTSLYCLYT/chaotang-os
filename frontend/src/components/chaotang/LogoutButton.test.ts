import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("visible logout posts the cookie-only BFF and returns to login", async () => {
  const source = await readFile(new URL("./LogoutButton.tsx", import.meta.url), "utf8");

  assert.match(source, /^"use client";/);
  assert.match(source, /import \{ logoutAction \} from "\.\/logoutAction"/);
  assert.match(source, /await logoutAction\(\)/);
  assert.doesNotMatch(source, /authorization|sessionId|courtos_session/i);
  assert.doesNotMatch(source, /document\.cookie|localStorage|sessionStorage|Bearer|BACKEND_BASE_URL/);
});

test("logout exposes busy and retryable failure states", async () => {
  const source = await readFile(new URL("./LogoutButton.tsx", import.meta.url), "utf8");

  assert.match(source, /disabled=\{status === "pending"\}/);
  assert.match(source, /aria-busy=\{status === "pending"\}/);
  assert.match(source, /role="alert"/);
  assert.match(source, /:\s*"退出";/);
  assert.match(source, /退出中…/);
  assert.match(source, /重试退出/);
});
