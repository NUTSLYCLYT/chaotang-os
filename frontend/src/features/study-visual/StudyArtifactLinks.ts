import { Fragment, createElement, type ReactElement } from "react";

import type {
  ArtifactState,
  ConfirmationDecision,
  ConfirmationStatus,
  ReportArtifact,
  WorkProductStatus,
} from "../../lib/backendClient.ts";

export interface StudyArtifactConfirmationSnapshot {
  workStatus: WorkProductStatus;
  confirmationStatus: ConfirmationStatus;
  artifactState: ArtifactState;
  replyId: string | null;
}

const WORK_STATUSES: readonly WorkProductStatus[] = [
  "NEEDS_DATA", "NEEDS_REVIEW", "BLOCKED", "READY_FOR_HUMAN_CONFIRMATION", "REVISION_REQUIRED",
];
const CONFIRMATION_STATUSES: readonly ConfirmationStatus[] = [
  "PENDING", "CONFIRMED", "REVISION_REQUIRED", "ESCALATED",
];
const ARTIFACT_STATES: readonly ArtifactState[] = ["PENDING", "PUBLISHED", "ABORTED"];

export function parseStudyArtifactConfirmationSnapshot(
  value: unknown,
): StudyArtifactConfirmationSnapshot | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (!WORK_STATUSES.includes(record.workStatus as WorkProductStatus) ||
      !CONFIRMATION_STATUSES.includes(record.confirmationStatus as ConfirmationStatus) ||
      !ARTIFACT_STATES.includes(record.artifactState as ArtifactState) ||
      !(record.replyId === undefined || record.replyId === null || (typeof record.replyId === "string" && record.replyId.trim().length > 0))) return null;
  return {
    workStatus: record.workStatus as WorkProductStatus,
    confirmationStatus: record.confirmationStatus as ConfirmationStatus,
    artifactState: record.artifactState as ArtifactState,
    replyId: typeof record.replyId === "string" ? record.replyId : null,
  };
}

export function projectStudyArtifactConfirmation(
  snapshot: Pick<StudyArtifactConfirmationSnapshot, "workStatus" | "confirmationStatus">,
): { label: string; showControls: boolean } {
  if (snapshot.confirmationStatus === "CONFIRMED") return { label: "已人工确认", showControls: false };
  if (snapshot.confirmationStatus === "REVISION_REQUIRED") return { label: "已退回修改", showControls: false };
  if (snapshot.confirmationStatus === "ESCALATED") return { label: "已升级处理", showControls: false };
  if (snapshot.workStatus === "READY_FOR_HUMAN_CONFIRMATION") {
    return { label: "机器校验通过，待人工确认", showControls: true };
  }
  const labels: Record<Exclude<WorkProductStatus, "READY_FOR_HUMAN_CONFIRMATION">, string> = {
    NEEDS_DATA: "机器校验未完成：需要补充数据",
    NEEDS_REVIEW: "机器校验未完成：需要复核",
    BLOCKED: "机器校验已阻断",
    REVISION_REQUIRED: "机器校验要求修改",
  };
  return { label: labels[snapshot.workStatus], showControls: false };
}

export type StudyArtifactConfirmationPhase =
  | "idle"
  | "loading"
  | "ready"
  | "submitting"
  | "legacy"
  | "error";

export interface StudyArtifactConfirmationState {
  phase: StudyArtifactConfirmationPhase;
  snapshot: StudyArtifactConfirmationSnapshot | null;
  message: string | null;
  verifiedReplyId: string | null;
}

export interface StudyArtifactConfirmationUi {
  label: string | null;
  showLookupButton: boolean;
  showControls: boolean;
  downloadOnly: boolean;
  replyId: string | null;
}

export function initialStudyArtifactConfirmationState(): StudyArtifactConfirmationState {
  return { phase: "idle", snapshot: null, message: null, verifiedReplyId: null };
}

export function projectStudyArtifactConfirmationUi(
  state: StudyArtifactConfirmationState,
): StudyArtifactConfirmationUi {
  if (state.phase === "legacy") {
    return {
      label: "此成果仅支持下载",
      showLookupButton: false,
      showControls: false,
      downloadOnly: true,
      replyId: null,
    };
  }
  if (state.snapshot) {
    const snapshotView = projectStudyArtifactConfirmation(state.snapshot);
    return {
      label: snapshotView.label,
      showLookupButton: state.phase === "ready" && Boolean(state.snapshot.replyId) && !state.verifiedReplyId,
      showControls: snapshotView.showControls,
      downloadOnly: false,
      replyId: state.verifiedReplyId,
    };
  }
  return {
    label: null,
    showLookupButton: state.phase !== "loading",
    showControls: false,
    downloadOnly: false,
    replyId: null,
  };
}

export interface StudyArtifactConfirmationController {
  getState(): StudyArtifactConfirmationState;
  activate(): void;
  dispose(): void;
  load(): Promise<StudyArtifactConfirmationState>;
  submit(decision: ConfirmationDecision, reason: string): Promise<StudyArtifactConfirmationState>;
}

export function createStudyArtifactConfirmationController(options: {
  artifactId: string;
  fetchImpl?: typeof fetch;
  onUnauthorized?: () => void;
  onStateChange?: (state: StudyArtifactConfirmationState) => void;
}): StudyArtifactConfirmationController {
  const fetchImpl = options.fetchImpl ?? fetch;
  let state = initialStudyArtifactConfirmationState();
  let generation = 0;
  let disposed = false;
  let submissionActive = false;

  function publish(next: StudyArtifactConfirmationState): StudyArtifactConfirmationState {
    state = next;
    options.onStateChange?.(next);
    return next;
  }

  function publishForGeneration(
    requestGeneration: number,
    next: StudyArtifactConfirmationState,
  ): StudyArtifactConfirmationState {
    if (disposed || requestGeneration !== generation) return state;
    return publish(next);
  }

  function preserveSnapshot(
    snapshot: StudyArtifactConfirmationSnapshot | null,
    message: string,
    requestGeneration?: number,
  ): StudyArtifactConfirmationState {
    if (disposed || (requestGeneration !== undefined && requestGeneration !== generation)) {
      return state;
    }
    return publish({ phase: snapshot ? "ready" : "error", snapshot, message, verifiedReplyId: null });
  }

  function handleUnauthorized(requestGeneration: number): StudyArtifactConfirmationState {
    if (disposed || requestGeneration !== generation) return state;
    publish({ phase: "error", snapshot: null, message: "会话已过期，请重新登录", verifiedReplyId: null });
    options.onUnauthorized?.();
    return state;
  }

  async function parseSuccessfulResponse(
    response: Response,
  ): Promise<StudyArtifactConfirmationSnapshot | null> {
    if (!response.ok) return null;
    try {
      return parseStudyArtifactConfirmationSnapshot(await response.json());
    } catch {
      return null;
    }
  }

  async function verifyReply(
    requestGeneration: number,
    snapshot: StudyArtifactConfirmationSnapshot,
  ): Promise<StudyArtifactConfirmationState> {
    if (!snapshot.replyId) {
      return publishForGeneration(requestGeneration, { phase: "ready", snapshot, message: "尚未关联回奏", verifiedReplyId: null });
    }
    try {
      const response = await fetchImpl(`/api/shiguan/archives/${encodeURIComponent(snapshot.replyId)}`, { method: "GET", cache: "no-store" });
      if (response.status === 401) return handleUnauthorized(requestGeneration);
      const body = response.ok ? await response.json() as { archive?: { id?: unknown; type?: unknown } } : null;
      if (body?.archive?.id === snapshot.replyId && body.archive.type === "REPLY") {
        return publishForGeneration(requestGeneration, { phase: "ready", snapshot, message: null, verifiedReplyId: snapshot.replyId });
      }
      return publishForGeneration(requestGeneration, { phase: "ready", snapshot, message: response.status === 404 ? "回奏尚未回写或不可访问，可重试读取" : "对应回奏暂时不可用，请重试", verifiedReplyId: null });
    } catch {
      return publishForGeneration(requestGeneration, { phase: "ready", snapshot, message: "对应回奏暂时不可用，请重试", verifiedReplyId: null });
    }
  }

  return {
    getState: () => state,
    activate() {
      if (!disposed) return;
      disposed = false;
      generation += 1;
    },
    dispose() {
      disposed = true;
      generation += 1;
      submissionActive = false;
    },
    async load() {
      if (disposed || state.phase === "legacy" || state.phase === "loading" || state.phase === "submitting" || (state.phase === "ready" && (!state.snapshot?.replyId || state.verifiedReplyId))) {
        return state;
      }
      const requestGeneration = ++generation;
      if (state.phase === "ready" && state.snapshot?.replyId) {
        const snapshot = state.snapshot;
        publish({ phase: "loading", snapshot, message: "正在核验对应回奏…", verifiedReplyId: null });
        return verifyReply(requestGeneration, snapshot);
      }
      publish({ phase: "loading", snapshot: null, message: null, verifiedReplyId: null });
      try {
        const response = await fetchImpl(
          `/api/report-artifacts/${encodeURIComponent(options.artifactId)}/work-product`,
          { method: "GET", cache: "no-store" },
        );
        if (disposed || requestGeneration !== generation) return state;
        if (response.status === 404) {
          return publishForGeneration(requestGeneration, {
            phase: "legacy", snapshot: null, message: null, verifiedReplyId: null,
          });
        }
        if (response.status === 401) return handleUnauthorized(requestGeneration);
        const snapshot = await parseSuccessfulResponse(response);
        if (disposed || requestGeneration !== generation) return state;
        return snapshot
          ? await verifyReply(requestGeneration, snapshot)
          : preserveSnapshot(null, "确认状态暂时不可用", requestGeneration);
      } catch {
        return preserveSnapshot(null, "确认状态暂时不可用", requestGeneration);
      }
    },
    async submit(decision, reason) {
      if (disposed || submissionActive || state.phase === "submitting") return state;
      const previous = state.snapshot;
      if (!reason.trim()) return preserveSnapshot(previous, "请填写确认理由");
      if (!previous || !projectStudyArtifactConfirmation(previous).showControls) {
        return preserveSnapshot(previous, "当前状态不可确认");
      }
      submissionActive = true;
      const requestGeneration = ++generation;
      publish({ phase: "submitting", snapshot: previous, message: null, verifiedReplyId: state.verifiedReplyId });
      try {
        const response = await fetchImpl(
          `/api/report-artifacts/${encodeURIComponent(options.artifactId)}/confirmation`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ decision, structured_reason: reason.trim() }),
          },
        );
        if (response.status === 401) return handleUnauthorized(requestGeneration);
        const snapshot = await parseSuccessfulResponse(response);
        if (disposed || requestGeneration !== generation) return state;
        return snapshot
          ? await verifyReply(requestGeneration, snapshot)
          : preserveSnapshot(previous, "确认提交暂时不可用", requestGeneration);
      } catch {
        return preserveSnapshot(previous, "确认提交暂时不可用", requestGeneration);
      } finally {
        if (requestGeneration === generation) submissionActive = false;
      }
    },
  };
}

export function StudyArtifactLinks(
  props: { artifacts: ReportArtifact[]; className?: string },
): ReactElement | null {
  if (props.artifacts.length === 0) return null;
  return createElement(
    Fragment,
    null,
    ...props.artifacts.map((artifact) => createElement(
      "p",
      { className: props.className, key: artifact.artifactId },
      createElement(
        "a",
        {
          "data-testid": `decree-artifact-${artifact.artifactId}`,
          href: `/api/report-artifacts/${encodeURIComponent(artifact.artifactId)}`,
        },
        `下载财务报告：${artifact.displayName}（${artifact.periodStart}–${artifact.periodEnd}）`,
      ),
    )),
  );
}
