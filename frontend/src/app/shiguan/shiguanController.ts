import type {
  ReviewStatusValue,
  ShiguanArchive,
  ShiguanRecallMatch,
  ShiguanReviewStatus,
  ShiguanStatistics,
} from "../../lib/backendClient.ts";
import type { CourtDataState } from "../../features/court-visuals/types";

export type ShiguanErrorKind =
  | "validation"
  | "not_found"
  | "storage"
  | "network"
  | "unauthenticated"
  | "unknown";

export interface ShiguanRequestState {
  status: CourtDataState;
  message: string;
  stale: boolean;
  errorKind: ShiguanErrorKind | null;
}

export interface ShiguanReviewState extends ShiguanRequestState {
  archiveId: string | null;
}

export interface ShiguanControllerState {
  archives: ShiguanArchive[];
  selectedArchiveId: string | null;
  statistics: ShiguanStatistics | null;
  matches: ShiguanRecallMatch[];
  archiveState: ShiguanRequestState;
  statisticsState: ShiguanRequestState;
  recallState: ShiguanRequestState;
  reviewState: ShiguanReviewState;
}

export interface ShiguanFilterInput {
  type: string;
  matterType: string;
  department: string;
}

export interface ShiguanRecallInput {
  matterType: string;
  department: string;
}

export interface ShiguanReviewInput {
  status: ReviewStatusValue;
  note: string;
}

export interface ShiguanTransport {
  listArchives(
    input: ShiguanFilterInput,
    signal: AbortSignal,
  ): Promise<ShiguanArchive[]>;
  getStatistics(signal: AbortSignal): Promise<ShiguanStatistics>;
  recall(
    input: ShiguanRecallInput,
    signal: AbortSignal,
  ): Promise<ShiguanRecallMatch[]>;
  review(
    archiveId: string,
    input: ShiguanReviewInput,
    signal: AbortSignal,
  ): Promise<ShiguanReviewStatus>;
}

export class ShiguanUiError extends Error {
  readonly kind: ShiguanErrorKind;

  constructor(
    kind: ShiguanErrorKind,
    message: string,
  ) {
    super(message);
    this.kind = kind;
    this.name = "ShiguanUiError";
  }
}

type Listener = (state: ShiguanControllerState) => void;

const INITIAL_FILTER: ShiguanFilterInput = {
  type: "",
  matterType: "",
  department: "",
};

function requestState(
  status: CourtDataState,
  message: string,
  options: {
    stale?: boolean;
    errorKind?: ShiguanErrorKind | null;
  } = {},
): ShiguanRequestState {
  return {
    status,
    message,
    stale: options.stale ?? false,
    errorKind: options.errorKind ?? null,
  };
}

function normalizeError(error: unknown): ShiguanUiError | null {
  if (
    error instanceof DOMException &&
    error.name === "AbortError"
  ) {
    return null;
  }
  if (error instanceof ShiguanUiError) {
    return error;
  }
  return new ShiguanUiError("unknown", "史馆请求失败，请稍后重试");
}

function isOlderReview(
  candidate: ShiguanReviewStatus | null,
  confirmed: ShiguanReviewStatus,
): boolean {
  if (candidate === null) {
    return true;
  }
  const candidateTime = Date.parse(candidate.reviewedAt);
  const confirmedTime = Date.parse(confirmed.reviewedAt);
  if (Number.isNaN(candidateTime) || Number.isNaN(confirmedTime)) {
    return candidate.reviewedAt < confirmed.reviewedAt;
  }
  return candidateTime < confirmedTime;
}

export class ShiguanController {
  private readonly transport: ShiguanTransport;
  private readonly options: { onUnauthorized?: () => void };
  private currentState: ShiguanControllerState = {
    archives: [],
    selectedArchiveId: null,
    statistics: null,
    matches: [],
    archiveState: requestState("loading", "正在读取史馆档案…"),
    statisticsState: requestState("loading", "正在读取史馆统计…"),
    recallState: requestState("ready", "可按事项类型或所属部门召回旧案。"),
    reviewState: {
      ...requestState("ready", "选择档案后可更新复盘。"),
      archiveId: null,
    },
  };

  private readonly listeners = new Set<Listener>();
  private readonly generations = {
    archives: 0,
    statistics: 0,
    recall: 0,
    review: 0,
  };
  private readonly aborters: Partial<Record<keyof typeof this.generations, AbortController>> = {};
  private readonly confirmedReviews = new Map<string, ShiguanReviewStatus>();
  private lastFilter: ShiguanFilterInput = INITIAL_FILTER;
  private lastRecall: ShiguanRecallInput = { matterType: "", department: "" };
  private lifecycleVersion = 0;
  private started = false;
  private active = true;
  private disposed = false;
  private unauthorizedHandled = false;

  constructor(
    transport: ShiguanTransport,
    options: { onUnauthorized?: () => void } = {},
  ) {
    this.transport = transport;
    this.options = options;
  }

  get state(): ShiguanControllerState {
    return this.currentState;
  }

  connect(listener: Listener): () => void {
    if (this.disposed) {
      return () => undefined;
    }
    this.lifecycleVersion += 1;
    this.active = true;
    this.listeners.add(listener);
    listener(this.currentState);
    let connected = true;
    return () => {
      if (!connected) {
        return;
      }
      connected = false;
      this.listeners.delete(listener);
      if (this.listeners.size > 0) {
        return;
      }
      this.active = false;
      const pendingVersion = ++this.lifecycleVersion;
      queueMicrotask(() => {
        if (
          !this.disposed &&
          this.listeners.size === 0 &&
          this.lifecycleVersion === pendingVersion
        ) {
          this.dispose();
        }
      });
    };
  }

  start(): void {
    if (this.started || !this.active || this.disposed) {
      return;
    }
    this.started = true;
    this.loadInitial();
  }

  private loadInitial(): void {
    if (!this.active || this.disposed) {
      return;
    }
    this.loadArchives(INITIAL_FILTER);
    this.loadStatistics();
  }

  filter(input: ShiguanFilterInput): void {
    if (!this.active || this.disposed) {
      return;
    }
    this.lastFilter = { ...input };
    this.loadArchives(this.lastFilter);
    this.loadStatistics();
  }

  retryArchives(): void {
    if (!this.active || this.disposed) {
      return;
    }
    this.loadArchives(this.lastFilter);
  }

  retryStatistics(): void {
    if (!this.active || this.disposed) {
      return;
    }
    this.loadStatistics();
  }

  selectArchive(id: string): void {
    if (!this.active || this.disposed) {
      return;
    }
    if (!this.currentState.archives.some((archive) => archive.id === id)) {
      return;
    }
    this.update({ selectedArchiveId: id });
  }

  recall(input: ShiguanRecallInput): boolean {
    if (!this.active || this.disposed) {
      return false;
    }
    if (
      this.currentState.recallState.status === "loading" &&
      input.matterType === this.lastRecall.matterType &&
      input.department === this.lastRecall.department
    ) {
      return false;
    }
    this.lastRecall = { ...input };
    this.loadRecall(this.lastRecall);
    return true;
  }

  retryRecall(): void {
    if (!this.active || this.disposed) {
      return;
    }
    this.loadRecall(this.lastRecall);
  }

  reviewArchive(archiveId: string, input: ShiguanReviewInput): boolean {
    if (!this.active || this.disposed) {
      return false;
    }
    if (
      this.currentState.reviewState.status === "loading" &&
      this.currentState.reviewState.archiveId === archiveId
    ) {
      return false;
    }
    this.loadReview(archiveId, input);
    return true;
  }

  private update(patch: Partial<ShiguanControllerState>): void {
    if (!this.active || this.disposed) {
      return;
    }
    this.currentState = { ...this.currentState, ...patch };
    for (const listener of this.listeners) {
      listener(this.currentState);
    }
  }

  private begin(channel: keyof typeof this.generations): {
    generation: number;
    signal: AbortSignal;
  } {
    this.aborters[channel]?.abort();
    const aborter = new AbortController();
    this.aborters[channel] = aborter;
    const generation = ++this.generations[channel];
    return { generation, signal: aborter.signal };
  }

  private isCurrent(channel: keyof typeof this.generations, generation: number): boolean {
    return this.active && !this.disposed && this.generations[channel] === generation;
  }

  private handleError(
    channel: keyof typeof this.generations,
    generation: number,
    error: unknown,
  ): ShiguanUiError | null {
    if (!this.active || this.disposed || !this.isCurrent(channel, generation)) {
      return null;
    }
    const normalized = normalizeError(error);
    if (
      normalized?.kind === "unauthenticated" &&
      !this.unauthorizedHandled
    ) {
      this.unauthorizedHandled = true;
      const requestChannels = Object.keys(this.generations) as Array<
        "archives" | "statistics" | "recall" | "review"
      >;
      for (const requestChannel of requestChannels) {
        this.generations[requestChannel] += 1;
        this.aborters[requestChannel]?.abort();
        delete this.aborters[requestChannel];
      }
      this.confirmedReviews.clear();
      const expiredState = requestState(
        "error",
        normalized.message,
        { errorKind: "unauthenticated" },
      );
      this.update({
        archives: [],
        statistics: null,
        matches: [],
        selectedArchiveId: null,
        archiveState: expiredState,
        statisticsState: expiredState,
        recallState: expiredState,
        reviewState: {
          ...expiredState,
          archiveId: null,
        },
      });
      this.options.onUnauthorized?.();
    }
    return normalized;
  }

  private loadArchives(input: ShiguanFilterInput): void {
    if (!this.active || this.disposed) {
      return;
    }
    this.lastFilter = { ...input };
    const { generation, signal } = this.begin("archives");
    this.update({
      archiveState: requestState("loading", "正在读取史馆档案…", {
        stale: this.currentState.archives.length > 0,
      }),
    });

    void (async () => {
      try {
        const response = await this.transport.listArchives(input, signal);
        if (!this.isCurrent("archives", generation)) {
          return;
        }
        const archives = response.map((archive) => {
          const confirmed = this.confirmedReviews.get(archive.id);
          if (!confirmed) {
            return archive;
          }
          if (isOlderReview(archive.reviewStatus, confirmed)) {
            return { ...archive, reviewStatus: confirmed };
          }
          this.confirmedReviews.delete(archive.id);
          return archive;
        });
        const selectedArchiveId = archives.some(
          (archive) => archive.id === this.currentState.selectedArchiveId,
        )
          ? this.currentState.selectedArchiveId
          : archives[0]?.id ?? null;
        this.update({
          archives,
          selectedArchiveId,
          archiveState: requestState(
            archives.length === 0 ? "empty" : "ready",
            archives.length === 0 ? "没有命中档案。" : "史馆档案已更新。",
          ),
        });
      } catch (error) {
        const normalized = this.handleError("archives", generation, error);
        if (!normalized) {
          return;
        }
        this.update({
          archiveState: requestState("error", normalized.message, {
            stale: this.currentState.archives.length > 0,
            errorKind: normalized.kind,
          }),
        });
      }
    })();
  }

  private loadStatistics(): void {
    if (!this.active || this.disposed) {
      return;
    }
    const { generation, signal } = this.begin("statistics");
    this.update({
      statisticsState: requestState("loading", "正在读取史馆统计…", {
        stale: this.currentState.statistics !== null,
      }),
    });

    void (async () => {
      try {
        const statistics = await this.transport.getStatistics(signal);
        if (!this.isCurrent("statistics", generation)) {
          return;
        }
        this.update({
          statistics,
          statisticsState: requestState("ready", "史馆统计已更新。"),
        });
      } catch (error) {
        const normalized = this.handleError("statistics", generation, error);
        if (!normalized) {
          return;
        }
        this.update({
          statisticsState: requestState("error", normalized.message, {
            stale: this.currentState.statistics !== null,
            errorKind: normalized.kind,
          }),
        });
      }
    })();
  }

  private loadRecall(input: ShiguanRecallInput): void {
    if (!this.active || this.disposed) {
      return;
    }
    const { generation, signal } = this.begin("recall");
    this.update({
      recallState: requestState("loading", "正在召回旧案…", {
        stale: this.currentState.matches.length > 0,
      }),
    });

    void (async () => {
      try {
        const matches = await this.transport.recall(input, signal);
        if (!this.isCurrent("recall", generation)) {
          return;
        }
        this.update({
          matches,
          recallState: requestState(
            matches.length === 0 ? "empty" : "ready",
            matches.length === 0 ? "未命中旧案。" : "旧案召回完成。",
          ),
        });
      } catch (error) {
        const normalized = this.handleError("recall", generation, error);
        if (!normalized) {
          return;
        }
        this.update({
          recallState: requestState("error", normalized.message, {
            stale: this.currentState.matches.length > 0,
            errorKind: normalized.kind,
          }),
        });
      }
    })();
  }

  private loadReview(archiveId: string, input: ShiguanReviewInput): void {
    if (!this.active || this.disposed) {
      return;
    }
    const { generation, signal } = this.begin("review");
    this.update({
      reviewState: {
        ...requestState("loading", "正在更新复盘…"),
        archiveId,
      },
    });

    void (async () => {
      try {
        const reviewStatus = await this.transport.review(archiveId, input, signal);
        if (!this.isCurrent("review", generation)) {
          return;
        }
        this.confirmedReviews.set(archiveId, reviewStatus);
        this.update({
          archives: this.currentState.archives.map((archive) => (
            archive.id === archiveId ? { ...archive, reviewStatus } : archive
          )),
          reviewState: {
            ...requestState("ready", "复盘已更新。"),
            archiveId,
          },
        });
        this.loadStatistics();
      } catch (error) {
        const normalized = this.handleError("review", generation, error);
        if (!normalized) {
          return;
        }
        this.update({
          reviewState: {
            ...requestState("error", normalized.message, {
              errorKind: normalized.kind,
            }),
            archiveId,
          },
        });
      }
    })();
  }

  private dispose(): void {
    if (this.disposed) {
      return;
    }
    this.active = false;
    this.disposed = true;
    this.lifecycleVersion += 1;
    for (const channel of Object.keys(this.generations) as Array<keyof typeof this.generations>) {
      this.generations[channel] += 1;
      this.aborters[channel]?.abort();
      delete this.aborters[channel];
    }
    this.confirmedReviews.clear();
    this.listeners.clear();
  }
}
