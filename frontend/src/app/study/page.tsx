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
 * `error` 分支，交由页面展示。浏览器全程不获取 `BACKEND_BASE_URL`，也不直接
 * 请求 FastAPI。
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

export default function StudyPage() {
  const [decreeText, setDecreeText] = useState("");
  const [uiState, setUiState] = useState<DecreeUiState>(IDLE_UI_STATE);

  const isSubmitting = uiState.phase === "submitting";
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
    <main>
      <h1>上书房</h1>
      <p>在此输入旨意，点击“下旨”后将由丞相 Agent 生成回奏。</p>
      <p data-testid="decree-fee-notice">
        <strong>
          注意：点击“下旨”会按顺序触发司级咨询、部级补充、军机处会审（仅多部门）和丞相汇总，
          最坏可能产生 54 次同步 DeepSeek API 调用并等待较久，请确认旨意内容后再提交。
        </strong>
      </p>
      <section>
        <label htmlFor="decree-text">旨意</label>
        <br />
        <textarea
          id="decree-text"
          data-testid="decree-textarea"
          value={decreeText}
          onChange={(event) => setDecreeText(event.target.value)}
          rows={6}
          cols={60}
          maxLength={2000}
          disabled={!canEdit}
          placeholder="请输入 1-2000 字的旨意内容……"
        />
        <br />
        <button
          type="button"
          data-testid="submit-decree-button"
          onClick={handleSubmitDecree}
          disabled={!canSubmit}
        >
          {isSubmitting ? "处理中……" : "下旨"}
        </button>
      </section>
      <section>
        <h2>丞相回奏</h2>
        {uiState.phase === "idle" && <p data-testid="decree-status">尚未提交旨意。</p>}
        {uiState.phase === "submitting" && (
          <p data-testid="decree-status">
            正在依次完成司级意见、部级补充及最终回奏，最多可能有 54 次同步调用，请耐心等候……
          </p>
        )}
        {uiState.phase === "success" && (
          <div data-testid="decree-status" data-decree-ok="true">
            <p data-testid="decree-rationale">
              {uiState.chancellor}判断：{uiState.rationale}
            </p>
            <p data-testid="decree-processing-path">
              流转路径：{uiState.processingPath.join(" → ")}
            </p>
            <h3>分层部门意见</h3>
            <ul data-testid="decree-ministry-opinions">
              {uiState.ministryOpinions.map((opinion) => (
                <li key={opinion.department}>
                  <h4>{opinion.department}</h4>
                  <p>司级意见</p>
                  <ol data-testid={`decree-bureau-opinions-${opinion.department}`}>
                    {opinion.bureauOpinions.map((bureauOpinion) => (
                      <li key={bureauOpinion.bureau}>
                        {bureauOpinion.bureau}：{bureauOpinion.opinion}
                      </li>
                    ))}
                  </ol>
                  <p>部级补充：{opinion.opinion}</p>
                </li>
              ))}
            </ul>
            {uiState.routeType === "multi" && (
              <p data-testid="decree-council-verdict">
                军机处会审结论：{uiState.councilVerdict}
              </p>
            )}
            <p data-testid="decree-final-verdict">丞相总结：{uiState.finalVerdict}</p>
            <h3>丞相三项建议</h3>
            <ol data-testid="decree-recommendations">
              {uiState.recommendations.map((recommendation) => (
                <li key={recommendation}>{recommendation}</li>
              ))}
            </ol>
          </div>
        )}
        {uiState.phase === "error" && (
          <p data-testid="decree-status" data-decree-ok="false">
            下旨失败：{uiState.message}
          </p>
        )}
      </section>
    </main>
  );
}
