import { test } from "node:test";
import assert from "node:assert/strict";

import {
  IDLE_UI_STATE,
  SUBMITTING_UI_STATE,
  getDecreeFormAvailability,
  mapSubmitDecreeResultToUiState,
  type DecreeErrorKind,
} from "./decreeStatus.ts";

test("IDLE_UI_STATE / SUBMITTING_UI_STATE：常量阶段字面量正确", () => {
  assert.deepEqual(IDLE_UI_STATE, { phase: "idle" });
  assert.deepEqual(SUBMITTING_UI_STATE, { phase: "submitting" });
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
  assert.deepEqual(getDecreeFormAvailability("整饬吏治", SUBMITTING_UI_STATE), {
    canEdit: false,
    canSubmit: false,
  });
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
      ministryOpinions: [{ department: "吏部", opinion: "臣部已知晓，建议核查官员考绩。" }],
      finalVerdict: "臣部已知晓，建议核查官员考绩。",
    },
  });

  assert.deepEqual(state, {
    phase: "success",
    chancellor: "丞相",
    routeType: "single",
    rationale: "此事职责明确，交由吏部办理即可。",
    processingPath: ["上书房", "丞相", "吏部"],
    departments: ["吏部"],
    ministryOpinions: [{ department: "吏部", opinion: "臣部已知晓，建议核查官员考绩。" }],
    finalVerdict: "臣部已知晓，建议核查官员考绩。",
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
        { department: "户部", opinion: "臣部已核查库银，可拨付部分钱粮。" },
        { department: "工部", opinion: "臣部已勘察地形，可即刻兴工。" },
      ],
      finalVerdict: "军机处会审：准予兴修水利，钱粮由户部拨付，工部督造。",
    },
  });

  assert.equal(state.phase, "success");
  if (state.phase === "success") {
    assert.equal(state.routeType, "multi");
    assert.equal(state.departments.length, 2);
    assert.equal(state.ministryOpinions.length, 2);
    assert.equal(state.processingPath.includes("军机处"), true);
    assert.ok(state.finalVerdict.length > 0);
  }
});

const ERROR_KINDS: DecreeErrorKind[] = ["validation", "config", "model", "network", "unknown"];

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
