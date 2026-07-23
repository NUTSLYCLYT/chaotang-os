import assert from "node:assert/strict";
import test from "node:test";

import { getStudyWorkspaceSummary } from "./studyWorkspace.ts";

test("labels idle, submitting, successful, and failed decree states for the workspace", () => {
  assert.deepEqual(getStudyWorkspaceSummary({ phase: "idle" }), {
    stage: "候旨",
    detail: "请在中枢拟定旨意，确认后再下旨。",
    tone: "neutral",
  });
  assert.deepEqual(getStudyWorkspaceSummary({ phase: "submitting" }), {
    stage: "会审中",
    detail: "六部与丞相正在依次审议旨意。",
    tone: "pending",
  });
  assert.deepEqual(
    getStudyWorkspaceSummary({
      phase: "success",
      chancellor: "丞相",
      routeType: "single",
      rationale: "可行",
      processingPath: ["丞相"],
      departments: ["户部"],
      ministryOpinions: [],
      councilVerdict: null,
      finalVerdict: "准奏",
      recommendations: ["一", "二", "三"],
    }),
    {
      stage: "已回奏",
      detail: "丞相回奏已送达中枢。",
      tone: "success",
    },
  );
  assert.deepEqual(getStudyWorkspaceSummary({ phase: "error", message: "失败" }), {
    stage: "待复核",
    detail: "本次下旨未完成，可核对内容后重试。",
    tone: "danger",
  });
});
