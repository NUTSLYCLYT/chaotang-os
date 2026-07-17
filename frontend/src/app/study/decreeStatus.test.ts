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

test("mapSubmitDecreeResultToUiState：成功结果映射为 success 状态，携带丞相身份与回奏", () => {
  const state = mapSubmitDecreeResultToUiState({
    ok: true,
    data: {
      status: "ok",
      chancellor: "丞相",
      memorialText: "臣已知晓陛下旨意，建议下一步核查国库存银。",
    },
  });

  assert.deepEqual(state, {
    phase: "success",
    chancellor: "丞相",
    memorialText: "臣已知晓陛下旨意，建议下一步核查国库存银。",
  });
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
