"use client";

import { useEffect, useState } from "react";

import { ShiguanWorkspace } from "../../features/shiguan-visual/ShiguanWorkspace";
import { buildArchiveFilterQuery } from "./archiveStatus.ts";
import {
  parseArchivesPayload,
  parseRecallPayload,
  parseReviewPayload,
  parseStatisticsPayload,
} from "./shiguanPayload.ts";
import {
  ShiguanController,
  ShiguanUiError,
  type ShiguanErrorKind,
  type ShiguanTransport,
} from "./shiguanController.ts";
import styles from "./shiguan.module.css";

const ERROR_KINDS = new Set<ShiguanErrorKind>([
  "validation",
  "not_found",
  "storage",
  "network",
  "unauthenticated",
  "unknown",
]);

interface ErrorResponse {
  status: "error";
  reason?: unknown;
  message?: unknown;
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function responseErrorKind(response: Response, body: ErrorResponse): ShiguanErrorKind {
  if (response.status === 401) {
    return "unauthenticated";
  }
  if (typeof body.reason === "string" && ERROR_KINDS.has(body.reason as ShiguanErrorKind)) {
    return body.reason as ShiguanErrorKind;
  }
  if (response.status === 400 || response.status === 422) {
    return "validation";
  }
  if (response.status === 404) {
    return "not_found";
  }
  return "unknown";
}

async function requestJson<T>(
  input: string,
  init: RequestInit,
  parse: (body: unknown) => T | null,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(input, init);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }
    throw new ShiguanUiError("network", "无法连接史馆服务，请稍后重试");
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new ShiguanUiError("unknown", "史馆服务返回了无法识别的响应，请稍后重试");
  }

  if (!response.ok) {
    const errorBody: ErrorResponse = isRecord(body)
      ? {
          status: "error",
          reason: body.reason,
          message: body.message,
        }
      : { status: "error" };
    const kind = responseErrorKind(response, errorBody);
    const message = kind === "unauthenticated"
      ? "会话已过期，正在返回登录页。"
      : typeof errorBody.message === "string"
        ? errorBody.message
        : "史馆请求失败，请稍后重试";
    throw new ShiguanUiError(kind, message);
  }

  const parsed = parse(body);
  if (parsed === null) {
    throw new ShiguanUiError("unknown", "史馆服务返回了不完整的响应，请稍后重试");
  }
  return parsed;
}

function createTransport(): ShiguanTransport {
  return {
    listArchives: (input, signal) => {
      const query = buildArchiveFilterQuery({ ...input, limit: 100 });
      return requestJson(
        `/api/shiguan/archives?${query}`,
        { signal },
        parseArchivesPayload,
      );
    },
    getStatistics: (signal) => requestJson(
      "/api/shiguan/statistics",
      { signal },
      parseStatisticsPayload,
    ),
    recall: (input, signal) => requestJson(
      "/api/shiguan/recall",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...input, limit: 10 }),
        signal,
      },
      parseRecallPayload,
    ),
    review: (archiveId, input, signal) => requestJson(
      `/api/shiguan/archives/${archiveId}/review`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
        signal,
      },
      parseReviewPayload,
    ),
  };
}

export function ShiguanClient() {
  const [controller] = useState(() => new ShiguanController(
    createTransport(),
    {
      onUnauthorized: () => {
        window.setTimeout(
          () => window.location.assign("/login?next=%2Fshiguan"),
          0,
        );
      },
    },
  ));
  const [state, setState] = useState(controller.state);

  useEffect(() => {
    const disconnect = controller.connect(setState);
    controller.start();
    return disconnect;
  }, [controller]);

  const selectedArchive =
    state.archives.find((archive) => archive.id === state.selectedArchiveId) ?? null;

  return (
    <div className={styles.page}>
      <ShiguanWorkspace
        archives={state.archives}
        selectedArchive={selectedArchive}
        statistics={state.statistics}
        matches={state.matches}
        archiveState={state.archiveState}
        statisticsState={state.statisticsState}
        recallState={state.recallState}
        reviewState={state.reviewState}
        onSelectArchive={(id) => controller.selectArchive(id)}
        onFilter={(input) => controller.filter(input)}
        onRecall={(input) => { controller.recall(input); }}
        onReview={(archiveId, input) => { controller.reviewArchive(archiveId, input); }}
        onRetryArchives={() => controller.retryArchives()}
        onRetryStatistics={() => controller.retryStatistics()}
        onRetryRecall={() => controller.retryRecall()}
      />
    </div>
  );
}
