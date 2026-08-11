import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  buildInvestigationQuery,
  createGenerationGuard,
  formatConfidence,
  getPageAvailability,
  qualityPresentation,
  resetDetailForListRefresh,
  statusPresentation,
} from "./jinyiweiStatus.ts";

test("status and quality labels include a non-color symbol", () => {
  assert.deepEqual(statusPresentation("BLOCKED"), { label: "受阻", symbol: "!" });
  assert.deepEqual(statusPresentation("UNAVAILABLE"), { label: "不可用", symbol: "×" });
  assert.deepEqual(qualityPresentation("UNVERIFIED"), { label: "未核验", symbol: "?" });
  assert.equal(formatConfidence(0.876), "87.6%");
});

test("pagination uses the returned item count", () => {
  assert.deepEqual(getPageAvailability(20, 20, 45, 20), {
    previousOffset: 0,
    canPrevious: true,
    canNext: true,
  });
  assert.equal(getPageAvailability(40, 20, 45, 5).canNext, false);
  assert.equal(buildInvestigationQuery("PARTIAL", 20, 0), "status=PARTIAL&limit=20&offset=0");
});

test("generation guard suppresses stale async responses", () => {
  const guard = createGenerationGuard();
  const first = guard.next();
  const second = guard.next();
  assert.equal(guard.isCurrent(first), false);
  assert.equal(guard.isCurrent(second), true);
  guard.invalidate();
  assert.equal(guard.isCurrent(second), false);
});

test("list refresh immediately aborts and invalidates the current detail", () => {
  const controller = new AbortController();
  const guard = createGenerationGuard();
  const generation = guard.next();
  let selection: string | null = "inv-old";
  let detail: string | null = "old detail";

  resetDetailForListRefresh(
    controller,
    guard,
    () => { selection = null; },
    () => { detail = null; },
  );

  assert.equal(controller.signal.aborted, true);
  assert.equal(guard.isCurrent(generation), false);
  assert.equal(selection, null);
  assert.equal(detail, null);
});

test("legacy page remains a read-only authenticated redirect to the visual desk", async () => {
  const source = await readFile(new URL("./page.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /method\s*:\s*["'](?:POST|PATCH|PUT|DELETE)/);
  assert.doesNotMatch(source, /<form|contentEditable|fetch\(|["']use client["']/);
  assert.match(source, /redirectLegacyJinyiweiEntry\(requireUser, redirect\)/);
});
