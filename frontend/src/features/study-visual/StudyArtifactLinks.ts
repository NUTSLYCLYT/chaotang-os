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
      !ARTIFACT_STATES.includes(record.artifactState as ArtifactState)) return null;
  return {
    workStatus: record.workStatus as WorkProductStatus,
    confirmationStatus: record.confirmationStatus as ConfirmationStatus,
    artifactState: record.artifactState as ArtifactState,
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
}

export interface StudyArtifactConfirmationUi {
  label: string | null;
  showLookupButton: boolean;
  showControls: boolean;
  downloadOnly: boolean;
}

export function initialStudyArtifactConfirmationState(): StudyArtifactConfirmationState {
  return { phase: "idle", snapshot: null, message: null };
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
    };
  }
  if (state.snapshot) {
    const snapshotView = projectStudyArtifactConfirmation(state.snapshot);
    return {
      label: snapshotView.label,
      showLookupButton: false,
      showControls: snapshotView.showControls,
      downloadOnly: false,
    };
  }
  return {
    label: null,
    showLookupButton: state.phase !== "loading",
    showControls: false,
    downloadOnly: false,
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
    return publish({ phase: snapshot ? "ready" : "error", snapshot, message });
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
      if (disposed || state.phase === "legacy" || state.phase === "loading" || state.phase === "submitting" || state.phase === "ready") {
        return state;
      }
      const requestGeneration = ++generation;
      publish({ phase: "loading", snapshot: null, message: null });
      try {
        const response = await fetchImpl(
          `/api/report-artifacts/${encodeURIComponent(options.artifactId)}/work-product`,
          { method: "GET", cache: "no-store" },
        );
        if (disposed || requestGeneration !== generation) return state;
        if (response.status === 404) {
          return publishForGeneration(requestGeneration, {
            phase: "legacy", snapshot: null, message: null,
          });
        }
        const snapshot = await parseSuccessfulResponse(response);
        if (disposed || requestGeneration !== generation) return state;
        return snapshot
          ? publishForGeneration(requestGeneration, { phase: "ready", snapshot, message: null })
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
      publish({ phase: "submitting", snapshot: previous, message: null });
      try {
        const response = await fetchImpl(
          `/api/report-artifacts/${encodeURIComponent(options.artifactId)}/confirmation`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ decision, structured_reason: reason.trim() }),
          },
        );
        const snapshot = await parseSuccessfulResponse(response);
        if (disposed || requestGeneration !== generation) return state;
        return snapshot
          ? publishForGeneration(requestGeneration, { phase: "ready", snapshot, message: null })
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
