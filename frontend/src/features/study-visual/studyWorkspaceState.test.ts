import assert from "node:assert/strict";
import test from "node:test";

import {
  getStudyDepartmentCountLabel,
  projectStudyArtifacts,
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
    artifacts: [],
  };

  assert.equal(getStudyDepartmentCountLabel(success), "2 部门");
  assert.deepEqual(projectStudyArtifacts(success), []);
});

test("study workspace projects exact report artifact metadata from success state", () => {
  const artifacts = [{
    artifactId: "report 甲/2025",
    kind: "ACCOUNTING_MANAGEMENT_REPORT_XLSX" as const,
    displayName: "2025年度财务管理报告",
    periodStart: 2025,
    periodEnd: 2025,
    generatedAt: "2026-07-29T08:00:00Z",
  }];
  const state: DecreeUiState = {
    phase: "success", chancellor: "丞相", routeType: "single", rationale: "户部办理",
    processingPath: ["丞相", "户部"], departments: ["户部"], ministryOpinions: [],
    councilVerdict: null, finalVerdict: "准行", recommendations: ["一", "二", "三"],
    artifacts,
  };
  assert.deepEqual(projectStudyArtifacts(state), artifacts);
  assert.deepEqual(projectStudyArtifacts({ phase: "idle" }), []);
});
