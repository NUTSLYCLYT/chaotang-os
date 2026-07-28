import assert from "node:assert/strict";
import test from "node:test";
import {
  EMPTY_CONSULT_STATE,
  beginConsult,
  closeStudyDrawer,
  failConsult,
  finishConsult,
} from "./chancellorConsultStatus.ts";

test("consult state preserves strict user-assistant history", () => {
  const pending = beginConsult(EMPTY_CONSULT_STATE);
  const done = finishConsult(pending, "如何赈灾？", "可先核实灾情。");
  assert.equal(done.pending, false);
  assert.deepEqual(done.messages.map((message) => message.role), ["user", "assistant"]);
});

test("consult failure preserves prior messages", () => {
  const done = finishConsult(EMPTY_CONSULT_STATE, "问", "答");
  const failed = failConsult(beginConsult(done));
  assert.deepEqual(failed.messages, done.messages);
  assert.match(failed.error ?? "", /暂时无法回应/);
});

test("closing either drawer clears it and restores focus to its own trigger", () => {
  for (const side of ["left", "right"] as const) {
    let open: "left" | "right" | null = side;
    let focusCount = 0;
    let scheduled: (() => void) | undefined;
    closeStudyDrawer(
      side,
      (value) => { open = value; },
      { focus: () => { focusCount += 1; } },
      (callback) => { scheduled = callback; },
    );
    assert.equal(open, null);
    assert.equal(focusCount, 0);
    scheduled?.();
    assert.equal(focusCount, 1);
  }
});
