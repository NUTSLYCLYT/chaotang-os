import assert from "node:assert/strict";
import test from "node:test";

import {
  canIssueChancellorDraft,
  requestChancellorDraft,
} from "./chancellorDraft.ts";

test("拟旨请求只调用同源 BFF，并透传版本", async () => {
  const requests: Array<{ input: string; body: string }> = [];
  const result = await requestChancellorDraft(
    " 我想赚钱 ",
    2,
    async (input, init) => {
      requests.push({ input: String(input), body: String(init?.body) });
      return Response.json({
        status: "CLARIFYING",
        version: 2,
        fingerprint: "a".repeat(64),
        understanding: "理解",
        expert_example: "案例",
        recommendation_reason: "理由",
        assumptions: [],
        revision_prompt: "修改",
        draft: null,
      });
    },
  );

  assert.equal(result.ok, true);
  assert.equal(requests[0].input, "/api/drafts/chancellor");
  assert.deepEqual(JSON.parse(requests[0].body), {
    messages: [{ role: "user", content: "我想赚钱" }],
    version: 2,
  });
});

test("只有完整的 DRAFT_READY 草案允许下旨", () => {
  const base = {
    version: 1,
    fingerprint: "a".repeat(64),
    understanding: "理解",
    expert_example: "案例",
    recommendation_reason: "理由",
    assumptions: [],
    revision_prompt: "修改",
    decree_text: null,
  };
  assert.equal(canIssueChancellorDraft({ ...base, status: "CLARIFYING", draft: null }), false);
  assert.equal(canIssueChancellorDraft({ ...base, status: "DRAFT_READY", draft: null }), false);
  assert.equal(canIssueChancellorDraft({ ...base, status: "DRAFT_READY", draft: {}, decree_text: null }), false);
  assert.equal(canIssueChancellorDraft({
    ...base,
    status: "DRAFT_READY",
    draft: {},
    decree_text: "正式草案",
  }), true);
});
