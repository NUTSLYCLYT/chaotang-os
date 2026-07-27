import assert from "node:assert/strict";
import test from "node:test";

import type { ReplyCaseView } from "../court-replies/replyFeed.ts";
import { projectJunjichuFacts } from "./junjichuProjection.ts";

const REPLY: ReplyCaseView = {
  id: "reply-1",
  title: "会审回奏",
  departments: ["户部", "工部", "户部"],
  process: "丞相 → 户部 → 工部 → 丞相",
  conclusion: "准予施行。",
  repliedAt: "2026-07-24T08:00:00+00:00",
  respondent: "丞相",
};

test("junjichu facts use neutral labels and derive counts from the archived reply", () => {
  assert.deepEqual(projectJunjichuFacts(REPLY), [
    { label: "参与部门", value: 3 },
    { label: "司级明细", value: null },
    { label: "风险字段", value: null },
  ]);
});
