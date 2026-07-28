import assert from "node:assert/strict";
import test from "node:test";
import { EMPTY_CONSULT_STATE } from "./chancellorConsultStatus.ts";
import {
  requestChancellorConsult,
  submitChancellorConsult,
  submitConsultDraft,
} from "./chancellorConsultSubmission.ts";

test("consult request uses the dedicated same-origin BFF", async () => {
  let input = "";
  const result = await requestChancellorConsult([{ role: "user", content: "问" }], async (value) => {
    input = String(value);
    return new Response(JSON.stringify({ reply: "答" }), { status: 200 });
  });
  assert.equal(input, "/api/chat/chancellor-consult");
  assert.deepEqual(result, { ok: true, reply: "答" });
});

test("successful consult sends ordered history and appends the real reply", async () => {
  let sent: unknown;
  const result = await submitChancellorConsult({
    state: EMPTY_CONSULT_STATE,
    content: " 请给建议 ",
    request: async (messages) => { sent = messages; return { ok: true, reply: "臣建议先核实。" }; },
  });
  assert.deepEqual(sent, [{ role: "user", content: "请给建议" }]);
  assert.deepEqual(result.state.messages.map((message) => message.role), ["user", "assistant"]);
});

test("failed consult does not retain the failed user turn", async () => {
  const result = await submitChancellorConsult({
    state: EMPTY_CONSULT_STATE,
    content: "失败消息",
    request: async () => ({ ok: false }),
  });
  assert.deepEqual(result.state.messages, []);
  assert.equal(result.clearDraft, false);
});

test("drawer draft survives failure and is cleared only after a successful retry", async () => {
  let attempts = 0;
  const first = await submitConsultDraft("  请保留这段输入  ", async () => {
    attempts += 1;
    return false;
  });
  assert.equal(first, "  请保留这段输入  ");

  const second = await submitConsultDraft(first, async (content) => {
    attempts += 1;
    assert.equal(content, "请保留这段输入");
    return true;
  });
  assert.equal(second, "");
  assert.equal(attempts, 2);
});
