"use client";

import { useState } from "react";

import {
  IDLE_UI_STATE,
  SUBMITTING_UI_STATE,
  getDecreeFormAvailability,
  mapSubmitDecreeResultToUiState,
  parseChancellorSuccessResponse,
  type DecreeErrorKind,
  type DecreeUiState,
} from "./decreeStatus";
import { DevStudyWorkspace } from "../../features/study-visual/DevStudyWorkspace";

/** `route.ts` 失败响应体的形状：脱敏、携带稳定 `reason` 分类。 */
interface ChancellorErrorResponseBody {
  status: "error";
  reason: DecreeErrorKind;
  message: string;
}

const KNOWN_ERROR_KINDS: DecreeErrorKind[] = ["validation", "config", "model", "network", "unknown"];

function isKnownErrorKind(value: unknown): value is DecreeErrorKind {
  return typeof value === "string" && (KNOWN_ERROR_KINDS as string[]).includes(value);
}

/**
 * 调用同源相对路径 `/api/decrees/chancellor`（`route.ts`），永远不抛出未捕获异常：
 * 网络错误、响应体不是合法 JSON 等场景都会被吞掉并映射为 `DecreeUiState` 的
 * `error` 分支，交由页面展示。浏览器全程不获取后端服务地址，也不直接请求 FastAPI。
 */
async function callChancellorRoute(decreeText: string): Promise<DecreeUiState> {
  let response: Response;
  try {
    response = await fetch("/api/decrees/chancellor", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ decreeText }),
    });
  } catch (error) {
    return mapSubmitDecreeResultToUiState({
      ok: false,
      kind: "network",
      error: error instanceof Error ? error.message : String(error),
    });
  }

  if (response.status === 401) {
    window.setTimeout(() => window.location.assign("/login?next=%2Fstudy"), 0);
    return {
      phase: "error",
      message: "会话已过期，正在返回登录页。",
    };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return mapSubmitDecreeResultToUiState({
      ok: false,
      kind: "unknown",
      error: "响应体不是合法 JSON",
    });
  }

  if (response.ok) {
    const success = parseChancellorSuccessResponse(body);
    if (success !== null) {
      return mapSubmitDecreeResultToUiState({
        ok: true,
        data: success,
      });
    }
    return mapSubmitDecreeResultToUiState({
      ok: false,
      kind: "unknown",
      error: "响应体不符合预期契约",
    });
  }

  const error = body as Partial<ChancellorErrorResponseBody>;
  const kind: DecreeErrorKind = isKnownErrorKind(error.reason) ? error.reason : "unknown";
  return mapSubmitDecreeResultToUiState({
    ok: false,
    kind,
    error: typeof error.message === "string" ? error.message : "",
  });
}

export function StudyClient() {
  const [decreeText, setDecreeText] = useState("");
  const [uiState, setUiState] = useState<DecreeUiState>(IDLE_UI_STATE);

  const { canEdit, canSubmit } = getDecreeFormAvailability(decreeText, uiState);

  async function handleSubmitDecree() {
    if (!canSubmit) {
      return;
    }
    setUiState(SUBMITTING_UI_STATE);
    const nextState = await callChancellorRoute(decreeText);
    setUiState(nextState);
  }

  return (
    <DevStudyWorkspace
      decreeText={decreeText}
      uiState={uiState}
      canEdit={canEdit}
      canSubmit={canSubmit}
      onDecreeTextChange={setDecreeText}
      onSubmit={() => void handleSubmitDecree()}
    />
  );
}
