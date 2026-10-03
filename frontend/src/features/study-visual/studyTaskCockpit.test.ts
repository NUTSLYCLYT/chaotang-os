import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import type { ChancellorDraftResult } from "../../app/study/chancellorDraft.ts";
import type { DecreeJobProgress } from "../../app/study/decreeStatus.ts";
import {
  SOURCE_MODE_LABELS,
  projectStudyTaskCockpit,
  projectStudyPrimaryAction,
  resolveStudyDraftBlockRecovery,
} from "./studyTaskCockpit.ts";

test("one full-page business action is projected for every confirmation/job phase", () => {
  const base = { uiPhase: "idle" as const, draftStatus: null, draftPending: false,
    consultPending: false, understandingReady: false, goal: "铭硕方案", dailyMemorialReady: false };
  assert.deepEqual(projectStudyPrimaryAction(base), { stage: "EMPTY", label: "请丞相复述" });
  assert.deepEqual(projectStudyPrimaryAction({ ...base, goal: "", dailyMemorialReady: true }),
    { stage: "DAILY_MEMORIAL_REVIEW_ONLY", label: "确认上奏并归档为奏折" });
  assert.deepEqual(projectStudyPrimaryAction({ ...base, understandingReady: true, dailyMemorialReady: true }),
    { stage: "UNDERSTANDING_READY", label: "确认理解 · 生成拟旨" });
  for (const uiPhase of ["enqueueing", "queued", "running"] as const) {
    assert.deepEqual(projectStudyPrimaryAction({ ...base, uiPhase, draftStatus: "DRAFT_READY", understandingReady: true }),
      { stage: "QUEUED_OR_RUNNING", label: null });
  }
  assert.deepEqual(projectStudyPrimaryAction({ ...base, consultPending: true, understandingReady: true }),
    { stage: "CONSULTING", label: null });
  assert.deepEqual(projectStudyPrimaryAction({ ...base, draftPending: true, understandingReady: true }),
    { stage: "CONFIRMED_AND_DRAFTING", label: null });
  assert.deepEqual(projectStudyPrimaryAction({ ...base, draftStatus: "DRAFT_READY" }),
    { stage: "DRAFT_READY", label: "确认下旨 · 开始办理" });
  assert.deepEqual(projectStudyPrimaryAction({ ...base, uiPhase: "error", draftStatus: "DRAFT_READY" }),
    { stage: "FAILED_OR_CANCELLED", label: "查看原因与下一步" });
  assert.deepEqual(projectStudyPrimaryAction({ ...base, uiPhase: "success" }),
    { stage: "SUCCEEDED", label: "查看成果" });
});

const NON_READY_DRAFT_STATUSES = [
  "CLARIFYING", "NEEDS_INPUT", "PARTIAL", "ISSUE_BLOCKED",
  "ISSUED", "EXECUTING", "RETURNED",
] as const;

test("a non-ready draft projects a real block plus one recovery action instead of EMPTY", () => {
  const base = { uiPhase: "idle" as const, draftPending: false, consultPending: false,
    understandingReady: true, goal: "核验经营目标", dailyMemorialReady: true };
  for (const draftStatus of NON_READY_DRAFT_STATUSES) {
    const recovery = resolveStudyDraftBlockRecovery(draftStatus);
    assert.equal(recovery.status, draftStatus);
    assert.equal(recovery.action, "REDRAFT");
    assert.ok(recovery.label.length > 0);
    assert.deepEqual(
      projectStudyPrimaryAction({ ...base, draftStatus }),
      { stage: "DRAFT_BLOCKED", label: recovery.label },
      draftStatus,
    );
  }
});

test("EMPTY is only projected when there is no draft at all", () => {
  const base = { uiPhase: "idle" as const, draftPending: false, consultPending: false,
    understandingReady: false, goal: "核验经营目标", dailyMemorialReady: true };
  assert.deepEqual(projectStudyPrimaryAction({ ...base, draftStatus: null }),
    { stage: "EMPTY", label: "请丞相复述" });
  for (const draftStatus of NON_READY_DRAFT_STATUSES) {
    assert.notEqual(projectStudyPrimaryAction({ ...base, draftStatus }).stage, "EMPTY", draftStatus);
  }
});

const READY_DRAFT: ChancellorDraftResult = {
  status: "DRAFT_READY",
  version: 7,
  fingerprint: "a".repeat(64),
  understanding: "核验经营目标",
  expert_example: "核验经营目标并提交结论。",
  recommendation_reason: "目标清晰",
  assumptions: [],
  revision_prompt: "可直接下旨",
  decree_text: "核验经营目标并提交结论。",
  draft: {
    objective: "核验经营目标",
    scope: ["华东区域"],
    exclusions: ["不调整组织架构"],
    input_materials: ["经营月报"],
    material_gaps: ["缺少七月复盘"],
    key_questions: ["增长是否可持续"],
    departments: [],
    execution_steps: ["核验数据", "形成结论"],
    deliverables: ["经营核验报告"],
    completion_criteria: ["结论有事实引用"],
    permissions_and_limits: ["只读访问经营数据"],
    current_status: "DRAFT_READY",
  },
};

const FAILED_PROGRESS: DecreeJobProgress = {
  jobId: "b".repeat(32),
  state: "FAILED",
  stage: "FAILED",
  attemptCount: 2,
  providerRequestCount: 3,
  createdAt: "2026-08-26T01:00:00Z",
  updatedAt: "2026-08-26T01:03:00Z",
};

test("cockpit starts LOCAL without inventing a goal, acceptance, or progress", () => {
  const cockpit = projectStudyTaskCockpit({
    decreeText: "",
    draftResult: null,
    uiState: { phase: "idle" },
  });

  assert.equal(cockpit.sourceMode, "LOCAL");
  assert.equal(cockpit.title, undefined);
  assert.equal(cockpit.acceptance, undefined);
  assert.equal(cockpit.progress, undefined);
  assert.deepEqual(Object.keys(SOURCE_MODE_LABELS), ["DEMO", "LOCAL", "API_LIVE"]);
});

test("enqueueing and a bare job id stay LOCAL until a verified snapshot exists", () => {
  for (const uiState of [
    { phase: "enqueueing" } as const,
    { phase: "queued", jobId: "1".repeat(32) } as const,
    { phase: "running", jobId: "1".repeat(32) } as const,
  ]) {
    const cockpit = projectStudyTaskCockpit({
      decreeText: "核验经营目标",
      draftResult: null,
      uiState,
    });

    assert.equal(cockpit.sourceMode, "LOCAL", uiState.phase);
    assert.equal(cockpit.progress, undefined, uiState.phase);
  }
});

test("a first network or invalid-response error without a snapshot is not API_LIVE", () => {
  const cockpit = projectStudyTaskCockpit({
    decreeText: "核验经营目标",
    draftResult: null,
    uiState: {
      phase: "error",
      message: "当前状态不可用",
      progressFreshness: "stale",
      recoveryMode: "redraft",
    },
  });

  assert.equal(cockpit.sourceMode, "LOCAL");
  assert.equal(cockpit.progress, undefined);
});

test("a stale error with a verified snapshot keeps API provenance", () => {
  const cockpit = projectStudyTaskCockpit({
    decreeText: "核验经营目标",
    draftResult: null,
    uiState: {
      phase: "error",
      message: "当前状态不可用",
      lastVerifiedProgress: FAILED_PROGRESS,
      progressFreshness: "stale",
      recoveryMode: "resume",
    },
  });

  assert.equal(cockpit.sourceMode, "API_LIVE");
  assert.deepEqual(cockpit.progress, FAILED_PROGRESS);
});

test("a retained draft cannot make the current enqueueing branch API_LIVE", () => {
  const cockpit = projectStudyTaskCockpit({
    decreeText: "核验经营目标",
    draftResult: READY_DRAFT,
    uiState: { phase: "enqueueing" },
  });

  assert.equal(cockpit.sourceMode, "LOCAL");
  assert.equal(cockpit.progress, undefined);
});

test("a retained draft cannot make a snapshot-free stale task error API_LIVE", () => {
  const cockpit = projectStudyTaskCockpit({
    decreeText: "核验经营目标",
    draftResult: READY_DRAFT,
    uiState: {
      phase: "error",
      message: "当前状态不可用",
      progressFreshness: "stale",
      recoveryMode: "redraft",
    },
  });

  assert.equal(cockpit.sourceMode, "LOCAL");
  assert.equal(cockpit.progress, undefined);
});

test("a retained draft plus a stale verified task snapshot remains API_LIVE", () => {
  const cockpit = projectStudyTaskCockpit({
    decreeText: "核验经营目标",
    draftResult: READY_DRAFT,
    uiState: {
      phase: "error",
      message: "当前状态不可用",
      lastVerifiedProgress: FAILED_PROGRESS,
      progressFreshness: "stale",
      recoveryMode: "resume",
    },
  });

  assert.equal(cockpit.sourceMode, "API_LIVE");
  assert.deepEqual(cockpit.progress, FAILED_PROGRESS);
});

test("cockpit exposes every existing DraftEdict acceptance value unchanged", () => {
  const cockpit = projectStudyTaskCockpit({
    decreeText: "原始目标",
    draftResult: READY_DRAFT,
    uiState: { phase: "idle" },
  });

  assert.equal(cockpit.sourceMode, "API_LIVE");
  assert.equal(cockpit.title, READY_DRAFT.decree_text);
  assert.deepEqual(cockpit.acceptance, {
    objective: "核验经营目标",
    scope: ["华东区域"],
    exclusions: ["不调整组织架构"],
    inputMaterials: ["经营月报"],
    materialGaps: ["缺少七月复盘"],
    keyQuestions: ["增长是否可持续"],
    executionSteps: ["核验数据", "形成结论"],
    deliverables: ["经营核验报告"],
    completionCriteria: ["结论有事实引用"],
    permissionsAndLimits: ["只读访问经营数据"],
  });
});

test("cockpit leaves missing API acceptance fields absent and preserves failed progress", () => {
  const incomplete = {
    ...READY_DRAFT,
    draft: {
      ...READY_DRAFT.draft,
      material_gaps: undefined,
    },
  } as unknown as ChancellorDraftResult;
  const cockpit = projectStudyTaskCockpit({
    decreeText: "原始目标",
    draftResult: incomplete,
    uiState: {
      phase: "error",
      message: "办理失败",
      lastVerifiedProgress: FAILED_PROGRESS,
    },
  });

  assert.equal(cockpit.acceptance?.materialGaps, undefined);
  assert.equal(JSON.stringify(cockpit.acceptance).includes("待补充"), false);
  assert.deepEqual(cockpit.progress, FAILED_PROGRESS);
});

test("Study workspace delegates task truth projection to one pure cockpit module", async () => {
  const source = await readFile(new URL("./DevStudyWorkspace.tsx", import.meta.url), "utf8");

  assert.match(source, /from "\.\/studyTaskCockpit"/);
  assert.match(source, /projectStudyTaskCockpit\(\{/);
  assert.match(source, /SOURCE_MODE_LABELS/);
});
