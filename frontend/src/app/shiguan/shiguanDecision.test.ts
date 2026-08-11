import assert from "node:assert/strict";
import test from "node:test";

import {
  decisionActionsForArchive,
  formatArchiveDecision,
} from "./shiguanDecision.ts";

test("decision action matrix exposes exactly the two document-specific choices", () => {
  assert.deepEqual(decisionActionsForArchive("MEMORIAL"), [
    { decision: "APPROVED", label: "准奏" },
    { decision: "REJECTED", label: "驳回" },
  ]);
  assert.deepEqual(decisionActionsForArchive("REPLY"), [
    { decision: "ADOPTED", label: "采纳" },
    { decision: "RETURNED_FOR_RECONSIDERATION", label: "发回重议" },
  ]);
});

test("terminal decisions have explicit Chinese result labels", () => {
  assert.equal(formatArchiveDecision(null), "待处置");
  assert.equal(formatArchiveDecision("APPROVED"), "已准奏");
  assert.equal(formatArchiveDecision("REJECTED"), "已驳回");
  assert.equal(formatArchiveDecision("ADOPTED"), "已采纳");
  assert.equal(formatArchiveDecision("RETURNED_FOR_RECONSIDERATION"), "已发回重议");
});
