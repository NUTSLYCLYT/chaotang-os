import assert from "node:assert/strict";
import test from "node:test";
import {
  captureStudyIntent, confirmedStudyDraftText, confirmStudyIntent, isStudyIntentCurrent,
  type ConfirmedStudyIntent, type StudyIntentSnapshot,
} from "./studyIntentConfirmation.ts";

const source: StudyIntentSnapshot = {
  ownerId: "synthetic-owner-a",
  normalizedOriginalGoal: "  铭硕 方案\n  报价  ",
  exactLatestChancellorRestatement: "  仅输出草案\n保留  原文与限制。  ",
  consultationGeneration: 2, contextGeneration: 3,
};

test("confirmation preserves exact interior text and freezes its independent snapshot", () => {
  const mutable = { ...source };
  const confirmed = confirmStudyIntent(mutable, mutable);
  assert.ok(confirmed);
  mutable.normalizedOriginalGoal = "被修改";
  assert.ok(Object.isFrozen(confirmed));
  assert.equal(confirmedStudyDraftText(confirmed),
    "[用户原始目标]\n铭硕 方案\n  报价\n\n[用户已确认的丞相理解]\n仅输出草案\n保留  原文与限制。");
  assert.throws(() => Object.assign(confirmed, { ownerId: "b" }), TypeError);
});

for (const [field, value] of Object.entries({
  ownerId: "synthetic-owner-b", normalizedOriginalGoal: "其他目标",
  exactLatestChancellorRestatement: "较新理解", consultationGeneration: 3, contextGeneration: 4,
})) {
  test(`changing ${field} invalidates confirmation, even when other fields match`, () => {
    const old = captureStudyIntent(source);
    assert.ok(old);
    const current = { ...source, [field]: value };
    assert.equal(isStudyIntentCurrent(old, current), false);
    assert.equal(confirmStudyIntent(old, current), null);
  });
}

test("empty, non-integral and non-finite snapshots fail closed", () => {
  for (const patch of [
    { ownerId: " " }, { normalizedOriginalGoal: " " },
    { exactLatestChancellorRestatement: " " }, { consultationGeneration: NaN },
    { contextGeneration: Infinity }, { contextGeneration: -1 }, { contextGeneration: 0.1 },
  ]) assert.equal(captureStudyIntent({ ...source, ...patch }), null);
});

test("plain, serialized and cast inputs are not confirmed factory objects", () => {
  const approved = confirmStudyIntent(source, source);
  assert.ok(approved);
  for (const forged of [source, { ...approved }, JSON.parse(JSON.stringify(approved)), null, "goal"]) {
    assert.equal(confirmedStudyDraftText(forged as ConfirmedStudyIntent), null);
  }
});
