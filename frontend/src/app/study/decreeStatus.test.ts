import { test } from "node:test";
import assert from "node:assert/strict";

import {
  IDLE_UI_STATE,
  SUBMITTING_UI_STATE,
  getDecreeFormAvailability,
  mapSubmitDecreeResultToUiState,
  mapDecreeJobFailure,
  parseChancellorSuccessResponse,
  resolveOwnerScopedDecreeUiState,
  type DecreeErrorKind,
  type DecreeUiState,
  type OwnerScopedDecreeUiState,
} from "./decreeStatus.ts";

test("async failures are mapped by truthful stable category", () => {
  assert.deepEqual(
    mapDecreeJobFailure({
      errorStage: "bureau_tool",
      errorCategory: "format",
      errorCode: "format_unrecognized",
    }),
    {
      phase: "error",
      message: "会计司未能识别现有数据格式，已尝试替代读取策略。",
      progressFreshness: "current",
      recoveryMode: "redraft",
    },
  );
  const artifactFailure = mapDecreeJobFailure({
    errorStage: "artifact",
    errorCategory: "artifact",
    errorCode: "artifact_failed",
  });
  assert.equal(artifactFailure.phase, "error");
  if (artifactFailure.phase === "error") {
    assert.match(artifactFailure.message, /Excel/);
  }
});

test("legacy unknown async failure keeps the generic fallback", () => {
  assert.deepEqual(
    mapDecreeJobFailure({
      errorStage: "private-stage",
      errorCategory: "private-category",
      errorCode: "C:/private/raw-mcp-body",
    }),
    {
      phase: "error",
      message: "发生未知错误，请稍后重试。",
      progressFreshness: "current",
      recoveryMode: "redraft",
    },
  );
});

test("IDLE_UI_STATE / SUBMITTING_UI_STATE：常量阶段字面量正确", () => {
  assert.deepEqual(IDLE_UI_STATE, { phase: "idle" });
  assert.deepEqual(SUBMITTING_UI_STATE, { phase: "enqueueing" });
});

test("getDecreeFormAvailability：初始空输入仍可编辑，但不可提交", () => {
  assert.deepEqual(getDecreeFormAvailability("", IDLE_UI_STATE), {
    canEdit: true,
    canSubmit: false,
  });
});

test("getDecreeFormAvailability：合法非空内容可编辑且可提交", () => {
  assert.deepEqual(getDecreeFormAvailability("  整饬吏治  ", IDLE_UI_STATE), {
    canEdit: true,
    canSubmit: true,
  });
});

test("getDecreeFormAvailability：空白内容不可提交", () => {
  assert.deepEqual(getDecreeFormAvailability("   \n  ", IDLE_UI_STATE), {
    canEdit: true,
    canSubmit: false,
  });
});

test("getDecreeFormAvailability：提交处理中输入与提交均禁用", () => {
  for (const state of [
    SUBMITTING_UI_STATE,
    { phase: "queued", jobId: "a".repeat(32) } as const,
    { phase: "running", jobId: "a".repeat(32) } as const,
  ]) {
    assert.deepEqual(getDecreeFormAvailability("整饬吏治", state), {
      canEdit: false,
      canSubmit: false,
    });
  }
});

test("queued/running 状态可原样携带后端已验证的公开进度，未知字段不补造", () => {
  const progress = {
    jobId: "a".repeat(32),
    state: "RUNNING" as const,
    stage: "ARCHIVING",
    attemptCount: 2,
    providerRequestCount: 7,
    createdAt: "2026-08-26T01:00:00Z",
    updatedAt: "2026-08-26T01:03:00Z",
  };
  const state: DecreeUiState = {
    phase: "running",
    jobId: progress.jobId,
    jobProgress: progress,
  };

  assert.deepEqual(state.jobProgress, progress);
  assert.equal("percent" in progress, false);
  assert.equal("eta" in progress, false);
});

test("owner-scoped decree state hides A reply synchronously during A to B to A switching", () => {
  const aSuccess: DecreeUiState = {
    phase: "success",
    chancellor: "丞相",
    routeType: "single",
    rationale: "owner A private rationale",
    processingPath: ["丞相", "户部", "丞相"],
    departments: ["户部"],
    ministryOpinions: [{
      department: "户部",
      bureauOpinions: [{ bureau: "度支司", opinion: "owner A private opinion" }],
      opinion: "owner A private ministry opinion",
    }],
    councilVerdict: null,
    finalVerdict: "owner A private verdict",
    recommendations: ["建议一", "建议二", "建议三"],
    deliveryKind: "accounting_report",
    deliveryPeriod: { startYear: 2025, endYear: 2025 },
    artifacts: [{
      artifactId: "owner-a-report",
      kind: "ACCOUNTING_MANAGEMENT_REPORT_XLSX",
      displayName: "owner A private attachment",
      periodStart: 2025,
      periodEnd: 2025,
      generatedAt: "2026-08-09T00:00:00Z",
    }],
  };
  const envelope: OwnerScopedDecreeUiState = { ownerId: "owner-a", value: aSuccess };

  assert.equal(resolveOwnerScopedDecreeUiState(envelope, "owner-a"), aSuccess);
  assert.deepEqual(resolveOwnerScopedDecreeUiState(envelope, "owner-b"), IDLE_UI_STATE);
  assert.equal(resolveOwnerScopedDecreeUiState(envelope, "owner-a"), aSuccess);
});

test("a stale A callback cannot make A state visible while B is current", () => {
  const staleWrite: OwnerScopedDecreeUiState = {
    ownerId: "owner-a",
    value: { phase: "error", message: "owner A private failure" },
  };

  assert.deepEqual(resolveOwnerScopedDecreeUiState(staleWrite, "owner-b"), IDLE_UI_STATE);
});

test("mapSubmitDecreeResultToUiState：single 路由成功结果映射为 success 状态，携带完整流转字段", () => {
  const state = mapSubmitDecreeResultToUiState({
    ok: true,
    data: {
      status: "ok",
      chancellor: "丞相",
      routeType: "single",
      rationale: "此事职责明确，交由吏部办理即可。",
      processingPath: ["上书房", "丞相", "吏部"],
      departments: ["吏部"],
      ministryOpinions: [{ department: "吏部", bureauOpinions: [{ bureau: "任免司", opinion: "核查考绩。" }], opinion: "吏部补充：复核职责匹配。" }],
      councilVerdict: null,
      finalVerdict: "丞相汇总：核查考绩并复核职责。",
      recommendations: ["核查考绩", "复核职责", "限期整改"],
      deliveryKind: "none",
      deliveryPeriod: null,
      artifacts: [],
    },
  });

  assert.deepEqual(state, {
    phase: "success",
    chancellor: "丞相",
    routeType: "single",
    rationale: "此事职责明确，交由吏部办理即可。",
    processingPath: ["上书房", "丞相", "吏部"],
    departments: ["吏部"],
    ministryOpinions: [{ department: "吏部", bureauOpinions: [{ bureau: "任免司", opinion: "核查考绩。" }], opinion: "吏部补充：复核职责匹配。" }],
    councilVerdict: null,
    finalVerdict: "丞相汇总：核查考绩并复核职责。",
    recommendations: ["核查考绩", "复核职责", "限期整改"],
    deliveryKind: "none",
    deliveryPeriod: null,
    artifacts: [],
  });
});

test("mapSubmitDecreeResultToUiState：multi 路由成功结果映射为 success 状态，携带全部部门意见与会审结论", () => {
  const state = mapSubmitDecreeResultToUiState({
    ok: true,
    data: {
      status: "ok",
      chancellor: "丞相",
      routeType: "multi",
      rationale: "此事涉及工程与钱粮，需户部、工部会同办理。",
      processingPath: ["上书房", "丞相", "军机处", "户部", "工部"],
      departments: ["户部", "工部"],
      ministryOpinions: [
        { department: "户部", bureauOpinions: [{ bureau: "预算司", opinion: "预算可控。" }], opinion: "户部补充：分期拨付。" },
        { department: "工部", bureauOpinions: [{ bureau: "进度司", opinion: "可分段施工。" }], opinion: "工部补充：按里程碑验收。" },
      ],
      councilVerdict: "军机处会审：分期拨付并按里程碑验收。",
      finalVerdict: "丞相汇总：准予分阶段兴修水利。",
      recommendations: ["先完成勘察", "分期拨付预算", "按里程碑验收"],
      deliveryKind: "accounting_report",
      deliveryPeriod: { startYear: 2025, endYear: 2025 },
      artifacts: [{
        artifactId: "report 甲/2025",
        kind: "ACCOUNTING_MANAGEMENT_REPORT_XLSX",
        displayName: "2025年度财务管理报告",
        periodStart: 2025,
        periodEnd: 2025,
        generatedAt: "2026-07-29T08:00:00Z",
      }],
    },
  });

  assert.equal(state.phase, "success");
  if (state.phase === "success") {
    assert.equal(state.routeType, "multi");
    assert.equal(state.departments.length, 2);
    assert.equal(state.ministryOpinions.length, 2);
    assert.equal(state.processingPath.includes("军机处"), true);
    assert.ok(state.councilVerdict);
    assert.equal(state.recommendations.length, 3);
    assert.ok(state.finalVerdict.length > 0);
    assert.deepEqual(state.artifacts, [{
      artifactId: "report 甲/2025",
      kind: "ACCOUNTING_MANAGEMENT_REPORT_XLSX",
      displayName: "2025年度财务管理报告",
      periodStart: 2025,
      periodEnd: 2025,
      generatedAt: "2026-07-29T08:00:00Z",
    }]);
  }
});

const VALID_PAGE_BODY = {
  status: "ok",
  chancellor: "丞相",
  routeType: "single",
  rationale: "交由户部办理。",
  processingPath: ["上书房", "丞相（首次分流）", "户部", "户部（部级补充）", "丞相（最终汇总）"],
  departments: ["户部"],
  ministryOpinions: [{ department: "户部", bureauOpinions: [{ bureau: "预算司", opinion: "预算可控。" }], opinion: "户部补充：分期拨付。" }],
  councilVerdict: null,
  finalVerdict: "丞相汇总：分期拨付。",
  recommendations: ["核定预算", "分期拨付", "设置审计节点"],
  deliveryKind: "none",
  deliveryPeriod: null,
  artifacts: [],
};

test("parseChancellorSuccessResponse：严格接受完整 single 分层响应", () => {
  assert.deepEqual(parseChancellorSuccessResponse(VALID_PAGE_BODY), VALID_PAGE_BODY);
});

test("parseChancellorSuccessResponse：精确保留报告产物元数据", () => {
  const artifacts = [{
    artifactId: "report 甲/2025",
    kind: "ACCOUNTING_MANAGEMENT_REPORT_XLSX",
    displayName: "2025年度财务管理报告",
    periodStart: 2025,
    periodEnd: 2025,
    generatedAt: "2026-07-29T08:00:00Z",
  }] as const;
  assert.deepEqual(parseChancellorSuccessResponse({ ...VALID_PAGE_BODY, deliveryKind: "accounting_analysis", deliveryPeriod: { startYear: 2025, endYear: 2025 }, artifacts })?.artifacts, artifacts);
});

test("parseChancellorSuccessResponse rejects delivery/cardinality mismatch", () => {
  const artifact = {
    artifactId: "unexpected",
    kind: "ACCOUNTING_MANAGEMENT_REPORT_XLSX" as const,
    displayName: "unexpected.xlsx",
    periodStart: 2025,
    periodEnd: 2025,
    generatedAt: "2026-07-29T08:00:00Z",
  };
  assert.equal(parseChancellorSuccessResponse({ ...VALID_PAGE_BODY, artifacts: [artifact] }), null);
  assert.equal(parseChancellorSuccessResponse({ ...VALID_PAGE_BODY, deliveryKind: "accounting_analysis", deliveryPeriod: { startYear: 2025, endYear: 2025 }, artifacts: [] }), null);
  assert.equal(parseChancellorSuccessResponse({ ...VALID_PAGE_BODY, deliveryKind: "accounting_analysis", deliveryPeriod: { startYear: 2024, endYear: 2024 }, artifacts: [artifact] }), null);
});

test("parseChancellorSuccessResponse：拒绝重复的报告产物 ID", () => {
  const artifact = {
    artifactId: "report 甲/2025",
    kind: "ACCOUNTING_MANAGEMENT_REPORT_XLSX",
    displayName: "2025年度财务管理报告",
    periodStart: 2025,
    periodEnd: 2025,
    generatedAt: "2026-07-29T08:00:00Z",
  };
  assert.equal(parseChancellorSuccessResponse({
    ...VALID_PAGE_BODY,
    artifacts: [artifact, { ...artifact, displayName: "重复报告" }],
  }), null);
});

for (const [name, body] of [
  ["single 含军机处结论", { ...VALID_PAGE_BODY, councilVerdict: "不应存在" }],
  [
    "multi 缺少军机处结论",
    {
      ...VALID_PAGE_BODY,
      routeType: "multi",
      departments: ["户部", "工部"],
      ministryOpinions: [
        VALID_PAGE_BODY.ministryOpinions[0],
        { department: "工部", bureauOpinions: [{ bureau: "进度司", opinion: "按期推进。" }], opinion: "工部补充。" },
      ],
      councilVerdict: null,
    },
  ],
  ["部与意见不对应", { ...VALID_PAGE_BODY, ministryOpinions: [{ ...VALID_PAGE_BODY.ministryOpinions[0], department: "工部" }] }],
  ["司级意见为空", { ...VALID_PAGE_BODY, ministryOpinions: [{ ...VALID_PAGE_BODY.ministryOpinions[0], bureauOpinions: [] }] }],
  ["部级意见含额外字段", { ...VALID_PAGE_BODY, ministryOpinions: [{ ...VALID_PAGE_BODY.ministryOpinions[0], extra: true }] }],
  [
    "司级意见含额外字段",
    {
      ...VALID_PAGE_BODY,
      ministryOpinions: [{
        ...VALID_PAGE_BODY.ministryOpinions[0],
        bureauOpinions: [{ ...VALID_PAGE_BODY.ministryOpinions[0].bureauOpinions[0], extra: true }],
      }],
    },
  ],
  [
    "司级意见为空白",
    {
      ...VALID_PAGE_BODY,
      ministryOpinions: [{
        ...VALID_PAGE_BODY.ministryOpinions[0],
        bureauOpinions: [{ ...VALID_PAGE_BODY.ministryOpinions[0].bureauOpinions[0], opinion: "   " }],
      }],
    },
  ],
  ["建议不足三项", { ...VALID_PAGE_BODY, recommendations: ["一", "二"] }],
  ["建议超过三项", { ...VALID_PAGE_BODY, recommendations: ["一", "二", "三", "四"] }],
  ["建议含空白项", { ...VALID_PAGE_BODY, recommendations: ["一", "   ", "三"] }],
  ["建议含非字符串项", { ...VALID_PAGE_BODY, recommendations: ["一", 2, "三"] }],
  ["建议去空白后重复", { ...VALID_PAGE_BODY, recommendations: ["同一项", " 同一项 ", "第三项"] }],
] as const) {
  test(`parseChancellorSuccessResponse：拒绝${name}`, () => {
    assert.equal(parseChancellorSuccessResponse(body), null);
  });
}

const ERROR_KINDS: DecreeErrorKind[] = ["validation", "idempotency_conflict", "config", "model", "timeout", "network", "unknown"];

test("mapSubmitDecreeResultToUiState：timeout 映射为明确的下旨处理超时提示", () => {
  const state = mapSubmitDecreeResultToUiState({
    ok: false,
    kind: "timeout",
    error: "请求超时",
  });

  assert.deepEqual(state, {
    phase: "error",
    message: "下旨处理超时，请稍后重试。",
    progressFreshness: "current",
    recoveryMode: "redraft",
  });
});

for (const kind of ERROR_KINDS) {
  test(`mapSubmitDecreeResultToUiState：kind=${kind} 映射为 error 状态，携带非空中文文案`, () => {
    const state = mapSubmitDecreeResultToUiState({
      ok: false,
      kind,
      error: "任意后端原始错误描述，不应被直接透传到 UI",
    });

    assert.equal(state.phase, "error");
    if (state.phase === "error") {
      assert.equal(typeof state.message, "string");
      assert.ok(state.message.length > 0);
      assert.equal(
        state.progressFreshness,
        kind === "network" || kind === "unknown" ? "stale" : "current",
      );
      assert.equal(state.recoveryMode, "redraft");
      // 固定友好文案：不应等于原始错误描述（保证不泄露内部实现细节）。
      assert.notEqual(state.message, "任意后端原始错误描述，不应被直接透传到 UI");
    }
  });
}

test("mapSubmitDecreeResultToUiState：不同 kind 的错误文案彼此不同（可用于区分场景）", () => {
  const messages = new Set(
    ERROR_KINDS.map((kind) => {
      const state = mapSubmitDecreeResultToUiState({ ok: false, kind, error: "" });
      return state.phase === "error" ? state.message : "";
    }),
  );
  assert.equal(messages.size, ERROR_KINDS.length);
});
