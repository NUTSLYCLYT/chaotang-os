import assert from "node:assert/strict";
import test from "node:test";

import { normalizeInviteCode, validateLogin, validateRegister } from "./formValidation.ts";

test("login validation requires both fields", () => {
  assert.equal(validateLogin({ username: "", password: "secret" }), "请填写账号和密码。");
  assert.equal(validateLogin({ username: "court", password: "" }), "请填写账号和密码。");
  assert.equal(validateLogin({ username: "court", password: "secret" }), null);
});

test("registration validation checks fields", () => {
  const valid = { username: "court", email: "court@example.com", password: "secret", confirm: "secret" };
  assert.equal(validateRegister({ ...valid, email: "invalid" }), "请填写有效的邮箱地址。");
  assert.equal(validateRegister({ ...valid, confirm: "other" }), "两次输入的密码不一致。");
  assert.equal(validateRegister({ ...valid, password: "123", confirm: "123" }), "密码至少需要 6 位。");
  assert.equal(validateRegister({ ...valid, username: " " }), "请先完成所有必填字段。");
});

test("invite normalization uppercases and trims", () => {
  assert.equal(normalizeInviteCode(" court2026 "), "COURT2026");
  assert.equal(normalizeInviteCode("   "), "");
});
