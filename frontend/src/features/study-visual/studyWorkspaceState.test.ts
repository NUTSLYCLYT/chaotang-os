import assert from "node:assert/strict";
import test from "node:test";

import {
  getStudyDepartmentCountLabel,
} from "./studyWorkspaceState.ts";
import type { DecreeUiState } from "../../app/study/decreeStatus.ts";

test("study route summary stays pending before a successful real routing result", () => {
  const states: DecreeUiState[] = [
    { phase: "idle" },
    { phase: "submitting" },
    { phase: "error", message: "请求失败" },
  ];

  for (const state of states) {
    assert.equal(getStudyDepartmentCountLabel(state), "待分流");
  }
});

test("study route summary counts departments only from a successful decoded result", () => {
  const success: DecreeUiState = {
    phase: "success",
    routeType: "multi",
    departments: ["户部", "工部"],
    chancellor: "丞相",
    rationale: "跨部办理。",
    processingPath: ["丞相", "军机处", "户部", "工部", "丞相"],
    ministryOpinions: [
      {
        department: "户部",
        bureauOpinions: [{ bureau: "预算司", opinion: "预算可控。" }],
        opinion: "分期拨付。",
      },
      {
        department: "工部",
        bureauOpinions: [{ bureau: "营造司", opinion: "工期可行。" }],
        opinion: "分段验收。",
      },
    ],
    councilVerdict: "准予会审办理。",
    finalVerdict: "准行。",
    recommendations: ["分期", "验收", "归档"],
  };

  assert.equal(getStudyDepartmentCountLabel(success), "2 部门");
});
