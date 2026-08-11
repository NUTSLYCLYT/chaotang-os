import assert from "node:assert/strict";
import test from "node:test";
import { appendDecreeSessionRecord } from "./decreeSessionLog.ts";

test("session decree log appends final success and error outcomes", () => {
  const success = appendDecreeSessionRecord([], "  整顿河工  ", {
    phase: "success", chancellor: "丞相", routeType: "single", rationale: "r",
    processingPath: ["丞相"], departments: ["工部"], ministryOpinions: [],
    councilVerdict: null, finalVerdict: "准奏", recommendations: ["执行"], deliveryKind: "none", artifacts: [],
  });
  const failed = appendDecreeSessionRecord(success, "赈灾", { phase: "error", message: "未能办理" });
  assert.deepEqual(failed.map(({ decree, outcome, summary }) => ({ decree, outcome, summary })), [
    { decree: "整顿河工", outcome: "success", summary: "准奏" },
    { decree: "赈灾", outcome: "error", summary: "未能办理" },
  ]);
});

test("session decree log ignores non-final states", () => {
  const records = [{ id: 1, decree: "旧旨", outcome: "success" as const, summary: "已办" }];
  for (const state of [
    { phase: "enqueueing" } as const,
    { phase: "queued", jobId: "a".repeat(32) } as const,
    { phase: "running", jobId: "a".repeat(32) } as const,
  ]) {
    assert.equal(appendDecreeSessionRecord(records, "新旨", state), records);
  }
});
