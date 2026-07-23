import assert from "node:assert/strict";
import test from "node:test";

import { NAV_LINKS, PAIN_POINTS, PROOF_ITEMS, STAGES, USE_CASES } from "./welcomeContent.ts";

test("welcome content preserves the public navigation and decision-system sections", () => {
  assert.deepEqual(NAV_LINKS.map((item) => item.href), ["#pain-points", "#solution", "#use-cases", "#conversion"]);
  assert.equal(PAIN_POINTS.length, 4);
  assert.equal(STAGES.length, 5);
  assert.equal(USE_CASES.length, 3);
  assert.equal(PROOF_ITEMS.length, 4);
  assert.equal(PAIN_POINTS[0].title, "老板每天被小事打断");
  assert.equal(USE_CASES[0].title, "客户要降价，签不签？");
});
