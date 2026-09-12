import type {
  ArchiveDecision,
  ArchiveDecisionValue,
  ReviewStatusValue,
  ShiguanArchive,
  ShiguanOutcomePage,
  ShiguanOutcomeProjection,
  ShiguanOutcomeValue,
  ShiguanRecallMatch,
  ShiguanReviewStatus,
  ShiguanStatistics,
} from "../../lib/backendClient.ts";
import type { CourtDataState } from "../../features/court-visuals/types";
import { decisionActionsForArchive, formatArchiveDecision } from "./shiguanDecision.ts";

export type ShiguanErrorKind =
  | "validation"
  | "not_found"
  | "conflict"
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

export interface ShiguanDecisionState extends ShiguanRequestState {
  archiveId: string | null;
}

export interface ShiguanOutcomeState extends ShiguanRequestState {
  archiveId: string | null;
}

export interface ShiguanOutcomeListState extends ShiguanRequestState {
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
  decisionState: ShiguanDecisionState;
  outcomes: ShiguanOutcomeProjection[];
  outcomeState: ShiguanOutcomeState;
  outcomeListState: ShiguanOutcomeListState;
  outcomeNextCursor: string | null;
  pendingOutcomeDrafts: Record<string, ShiguanOutcomeInput>;
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

/** 与后端 OutcomeCreate 对齐；重试必须原样复用同一份，否则幂等键会绑定不同内容。 */
export interface ShiguanOutcomeInput {
  outcome: ShiguanOutcomeValue;
  occurredAt: string;
  idempotencyKey: string;
  supersedesEventId?: string;
}

export interface ShiguanTransport {
  listArchives(
    input: ShiguanFilterInput,
    signal: AbortSignal,
  ): Promise<ShiguanArchive[]>;
  getArchive?(archiveId: string, signal: AbortSignal): Promise<ShiguanArchive>;
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
  decide(
    archiveId: string,
    decision: ArchiveDecisionValue,
    signal: AbortSignal,
  ): Promise<ArchiveDecision>;
  /** 结果账为渐进增强能力：未实现时史馆其余功能不受影响。 */
  listOutcomes?(
    archiveId: string,
    cursor: string | null,
    signal: AbortSignal,
  ): Promise<ShiguanOutcomePage>;
  recordOutcome?(
    archiveId: string,
    input: ShiguanOutcomeInput,
    signal: AbortSignal,
  ): Promise<ShiguanOutcomeProjection>;
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
    decisionState: {
      ...requestState("ready", "选择文书后可在卷尾处置。"),
      archiveId: null,
    },
    outcomes: [],
    outcomeState: {
      ...requestState("ready", "选择档案后可记入结果账。"),
      archiveId: null,
    },
    outcomeListState: { ...requestState("ready", "选择档案后可读取结果账。"), archiveId: null },
    outcomeNextCursor: null,
    pendingOutcomeDrafts: {},
  };

  private readonly listeners = new Set<Listener>();
  private readonly generations = {
    archives: 0,
    archive: 0,
    statistics: 0,
    recall: 0,
    review: 0,
    decision: 0,
    outcomeList: 0,
    outcomeWrite: 0,
  };
  private readonly aborters: Partial<Record<keyof typeof this.generations, AbortController>> = {};
  private readonly outcomeCache = new Map<string, ShiguanOutcomePage & { historyComplete: boolean }>();
  private readonly outcomeWriteStates = new Map<string, ShiguanOutcomeState>();
  private readonly outcomeWriteGenerations = new Map<string, number>();
  private readonly outcomeWriteAborters = new Map<string, AbortController>();
  private readonly confirmedReviews = new Map<string, ShiguanReviewStatus>();
  private readonly confirmedDecisions = new Map<string, ArchiveDecision>();
  /** IDs loaded by a deep link may legitimately sit outside the current 100-record list page. */
  private readonly deepLinkedArchiveIds = new Set<string>();
  private deepLinkTarget: string | null = null;
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
    if (this.deepLinkTarget) { this.openArchive(this.deepLinkTarget); return; }
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

  selectArchive(id: string, preserveDeepLink = false): void {
    if (!this.active || this.disposed || !this.currentState.archives.some((archive) => archive.id === id)) return;
    // Only an explicit selection may cancel the independently requested target.
    if (!preserveDeepLink) {
      this.begin("archive");
      this.deepLinkTarget = null;
      this.deepLinkedArchiveIds.clear();
    }
    const cached = this.outcomeCache.get(id);
    const outcomeState = this.outcomeWriteStates.get(id) ?? {
      ...requestState("ready", "选择档案后可记入结果账。"), archiveId: id,
    };
    this.update({ selectedArchiveId: id, outcomes: cached?.items ?? [], outcomeNextCursor: cached?.nextCursor ?? null, outcomeState });
    this.loadOutcomes(id, null, false);
  }

  /** Resolve the target independently of the current list page. */
  openArchive(id: string | null): void {
    if (!this.active || this.disposed) return;
    const { generation, signal } = this.begin("archive");
    this.deepLinkTarget = id && id.trim() ? id : null;
    this.deepLinkedArchiveIds.clear();
    if (!this.deepLinkTarget) { this.loadArchives(this.lastFilter); return; }
    const targetId = this.deepLinkTarget;
    const getArchive = this.transport.getArchive;
    if (!getArchive) return;
    this.begin("outcomeList");
    this.update({ selectedArchiveId: null, outcomes: [], outcomeNextCursor: null,
      archiveState: requestState("loading", "正在读取对应回奏…") });
    void (async () => {
      try {
        let archive = await getArchive.call(this.transport, targetId, signal);
        if (!this.isCurrent("archive", generation)) return;
        if (archive.id !== targetId || archive.type !== "REPLY") {
          throw new ShiguanUiError("not_found", "未找到对应回奏。");
        }
        const confirmedReview = this.confirmedReviews.get(targetId);
        if (confirmedReview && isOlderReview(archive.reviewStatus, confirmedReview)) {
          archive = { ...archive, reviewStatus: confirmedReview };
        }
        const confirmedDecision = this.confirmedDecisions.get(targetId);
        if (confirmedDecision && (!archive.decisionStatus ||
            Date.parse(archive.decisionStatus.decidedAt) < Date.parse(confirmedDecision.decidedAt))) {
          archive = { ...archive, decisionStatus: confirmedDecision };
        }
        this.deepLinkedArchiveIds.add(targetId);
        const existing = this.currentState.archives.filter((item) => item.id !== targetId);
        this.update({ archives: [archive, ...existing], archiveState: requestState("ready", "已读取对应回奏。") });
        this.selectArchive(targetId, true);
      } catch (error) {
        const normalized = this.handleError("archive", generation, error);
        if (normalized) this.update({ archiveState: requestState("error", normalized.message,
          { stale: false, errorKind: normalized.kind }) });
      }
    })();
  }

  retryOutcomes(): void {
    if (this.currentState.selectedArchiveId) this.loadOutcomes(this.currentState.selectedArchiveId, null, false);
  }

  loadMoreOutcomes(): boolean {
    const archiveId = this.currentState.selectedArchiveId;
    if (!archiveId || !this.currentState.outcomeNextCursor || this.currentState.outcomeListState.status === "loading") return false;
    this.loadOutcomes(archiveId, this.currentState.outcomeNextCursor, true);
    return true;
  }

  recordOutcome(archiveId: string, input: ShiguanOutcomeInput): boolean {
    if (!this.active || this.disposed || this.outcomeWriteStates.get(archiveId)?.status === "loading") return false;
    // A retry is always the first frozen draft; caller input must never replace its idempotency identity.
    this.runRecordOutcome(archiveId, this.currentState.pendingOutcomeDrafts[archiveId] ?? input);
    return true;
  }

  private loadOutcomes(archiveId: string, cursor: string | null, append: boolean): void {
    const list = this.transport.listOutcomes;
    if (!list || !this.active || this.disposed) return;
    const refreshCompleteHistory = !append && this.outcomeCache.get(archiveId)?.historyComplete === true;
    const { generation, signal } = this.begin("outcomeList");
    if (this.currentState.selectedArchiveId === archiveId) {
      this.update({ outcomeListState: { ...requestState("loading", "正在读取结果账…", { stale: append || this.currentState.outcomes.length > 0 }), archiveId } });
    }
    void (async () => {
      try {
        // Revalidate a completed history to its end before enabling correction again.
        // Retaining the old null cursor alone could hide new events from another session.
        const refreshed: ShiguanOutcomeProjection[] = [];
        const visited = new Set<string | null>();
        let nextCursor = cursor;
        do {
          if (visited.has(nextCursor)) throw new ShiguanUiError("unknown", "结果账分页未前进，请重试读取。");
          visited.add(nextCursor);
          const page = await list.call(this.transport, archiveId, nextCursor, signal);
          if (!this.isCurrent("outcomeList", generation)) return;
          if (page.items.some((item) => item.archiveId !== archiveId)) {
            throw new ShiguanUiError("unknown", "结果账返回了不匹配的档案。");
          }
          refreshed.push(...page.items);
          nextCursor = page.nextCursor;
        } while (refreshCompleteHistory && nextCursor !== null);
        // The ledger is append-only. Merge even a late first page so it cannot erase a confirmed write.
        const existing = this.outcomeCache.get(archiveId)?.items ?? [];
        const byId = new Map(existing.map(item => [item.eventId, item]));
        for (const item of refreshed) if (!byId.has(item.eventId)) byId.set(item.eventId, item);
        const items = [...byId.values()];
        this.outcomeCache.set(archiveId, { items, nextCursor, historyComplete: nextCursor === null });
        if (this.currentState.selectedArchiveId === archiveId) {
          this.update({ outcomes: items, outcomeNextCursor: nextCursor, outcomeListState: { ...requestState(items.length ? "ready" : "empty", items.length ? "结果账已更新。" : "尚无结果记录。"), archiveId } });
        }
      } catch (error) {
        const normalized = this.handleError("outcomeList", generation, error);
        if (normalized && this.currentState.selectedArchiveId === archiveId) {
          this.update({ outcomeListState: { ...requestState("error", normalized.message, { stale: this.currentState.outcomes.length > 0, errorKind: normalized.kind }), archiveId } });
        }
      }
    })();
  }

  private runRecordOutcome(archiveId: string, input: ShiguanOutcomeInput): void {
    const loading = { ...requestState("loading", "正在记入结果账…"), archiveId };
    this.outcomeWriteStates.set(archiveId, loading);
    this.update({ pendingOutcomeDrafts: { ...this.currentState.pendingOutcomeDrafts, [archiveId]: input }, ...(this.currentState.selectedArchiveId === archiveId ? { outcomeState: loading } : {}) });
    const record = this.transport.recordOutcome;
    if (!record) { this.finishOutcomeWrite(archiveId, new ShiguanUiError("unknown", "当前环境未启用结果账记录。")); return; }
    this.outcomeWriteAborters.get(archiveId)?.abort();
    const aborter = new AbortController();
    this.outcomeWriteAborters.set(archiveId, aborter);
    const generation = (this.outcomeWriteGenerations.get(archiveId) ?? 0) + 1;
    this.outcomeWriteGenerations.set(archiveId, generation);
    void (async () => {
      try {
        const recorded = await record.call(this.transport, archiveId, input, aborter.signal);
        if (!this.isOutcomeWriteCurrent(archiveId, generation)) return;
        if (recorded.archiveId !== archiveId) {
          this.finishOutcomeWrite(archiveId, new ShiguanUiError("unknown", "结果账返回了不匹配的档案。"));
          return;
        }
        const page = this.outcomeCache.get(archiveId) ?? { items: [], nextCursor: null, historyComplete: false };
        if (!page.items.some((item) => item.eventId === recorded.eventId)) page.items = [...page.items, recorded];
        this.outcomeCache.set(archiveId, page);
        const ready = { ...requestState("ready", "结果已记入结果账。"), archiveId };
        this.outcomeWriteStates.set(archiveId, ready);
        const pending = { ...this.currentState.pendingOutcomeDrafts };
        delete pending[archiveId];
        this.update({ pendingOutcomeDrafts: pending, ...(this.currentState.selectedArchiveId === archiveId ? { outcomes: page.items, outcomeNextCursor: page.nextCursor, outcomeState: ready } : {}) });
      } catch (error) {
        if (!this.isOutcomeWriteCurrent(archiveId, generation)) return;
        const normalized = normalizeError(error);
        if (normalized?.kind === "unauthenticated") {
          this.handleUnauthorized(normalized);
          return;
        }
        if (normalized) this.finishOutcomeWrite(archiveId, normalized);
      }
    })();
  }

  private isOutcomeWriteCurrent(archiveId: string, generation: number): boolean {
    return this.active && !this.disposed && this.outcomeWriteGenerations.get(archiveId) === generation;
  }

  private finishOutcomeWrite(archiveId: string, error: ShiguanUiError): void {
    const state = { ...requestState("error", error.message, { errorKind: error.kind }), archiveId };
    this.outcomeWriteStates.set(archiveId, state);
    const pending = { ...this.currentState.pendingOutcomeDrafts };
    if (!["network", "storage", "unknown"].includes(error.kind)) delete pending[archiveId];
    this.update({ pendingOutcomeDrafts: pending, ...(this.currentState.selectedArchiveId === archiveId ? { outcomeState: state } : {}) });
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

  decideArchive(archiveId: string, decision: ArchiveDecisionValue): boolean {
    if (!this.active || this.disposed || this.currentState.decisionState.status === "loading") {
      return false;
    }
    const archive = this.currentState.archives.find((item) => item.id === archiveId);
    if (
      !archive ||
      archive.decisionStatus !== null ||
      !decisionActionsForArchive(archive.type).some((action) => action.decision === decision)
    ) {
      return false;
    }
    this.loadDecision(archiveId, decision);
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
    if (normalized?.kind === "unauthenticated") this.handleUnauthorized(normalized);
    return normalized;
  }

  private handleUnauthorized(normalized: ShiguanUiError): void {
    if (this.unauthorizedHandled) return;
    this.unauthorizedHandled = true;
    const requestChannels = Object.keys(this.generations) as Array<keyof typeof this.generations>;
    for (const requestChannel of requestChannels) {
      this.generations[requestChannel] += 1;
      this.aborters[requestChannel]?.abort();
      delete this.aborters[requestChannel];
    }
    for (const aborter of this.outcomeWriteAborters.values()) aborter.abort();
    this.outcomeWriteAborters.clear();
    this.outcomeWriteGenerations.clear();
    this.outcomeCache.clear();
    this.outcomeWriteStates.clear();
    this.confirmedReviews.clear();
    this.confirmedDecisions.clear();
    this.deepLinkedArchiveIds.clear();
    this.deepLinkTarget = null;
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
      decisionState: {
        ...expiredState,
        archiveId: null,
      },
      outcomes: [],
      outcomeNextCursor: null,
      pendingOutcomeDrafts: {},
      outcomeListState: { ...expiredState, archiveId: null },
      outcomeState: {
        ...expiredState,
        archiveId: null,
      },
    });
    this.options.onUnauthorized?.();
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
          let reconciled = archive;
          if (confirmed) {
            if (isOlderReview(archive.reviewStatus, confirmed)) {
              reconciled = { ...reconciled, reviewStatus: confirmed };
            } else {
              this.confirmedReviews.delete(archive.id);
            }
          }
          const confirmedDecision = this.confirmedDecisions.get(archive.id);
          if (confirmedDecision) {
            const candidateTime = archive.decisionStatus
              ? Date.parse(archive.decisionStatus.decidedAt)
              : Number.NaN;
            const confirmedTime = Date.parse(confirmedDecision.decidedAt);
            if (
              archive.decisionStatus === null ||
              Number.isNaN(candidateTime) ||
              (!Number.isNaN(confirmedTime) && candidateTime < confirmedTime)
            ) {
              reconciled = { ...reconciled, decisionStatus: confirmedDecision };
            } else {
              this.confirmedDecisions.delete(archive.id);
            }
          }
          return reconciled;
        });
        const preserved = this.currentState.archives.find((archive) =>
          archive.id === this.currentState.selectedArchiveId && this.deepLinkedArchiveIds.has(archive.id),
        );
        if (preserved && !archives.some((archive) => archive.id === preserved.id)) archives.unshift(preserved);
        if (this.deepLinkTarget && !this.deepLinkedArchiveIds.has(this.deepLinkTarget)) {
          this.update({ archives });
          return;
        }
        const selectedArchiveId = archives.some(
          (archive) => archive.id === this.currentState.selectedArchiveId,
        )
          ? this.currentState.selectedArchiveId
          : archives[0]?.id ?? null;
        const selectionChanged = selectedArchiveId !== this.currentState.selectedArchiveId;
        this.update({
          archives,
          selectedArchiveId,
          archiveState: requestState(
            archives.length === 0 ? "empty" : "ready",
            archives.length === 0 ? "没有命中档案。" : "史馆档案已更新。",
          ),
        });
        if (selectedArchiveId && (selectionChanged || !this.outcomeCache.has(selectedArchiveId))) this.selectArchive(selectedArchiveId, true);
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

  private loadDecision(archiveId: string, decision: ArchiveDecisionValue): void {
    const { generation, signal } = this.begin("decision");
    this.update({
      decisionState: {
        ...requestState("loading", "正在归档处置…"),
        archiveId,
      },
    });

    void (async () => {
      try {
        const decisionStatus = await this.transport.decide(archiveId, decision, signal);
        if (!this.isCurrent("decision", generation)) return;
        this.confirmedDecisions.set(archiveId, decisionStatus);
        this.update({
          archives: this.currentState.archives.map((archive) => (
            archive.id === archiveId ? { ...archive, decisionStatus } : archive
          )),
          decisionState: {
            ...requestState("ready", `${formatArchiveDecision(decisionStatus.decision)}，处置结果已归档。`),
            archiveId,
          },
        });
      } catch (error) {
        const normalized = this.handleError("decision", generation, error);
        if (!normalized) return;
        this.update({
          decisionState: {
            ...requestState("error", normalized.message, { errorKind: normalized.kind }),
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
    for (const aborter of this.outcomeWriteAborters.values()) aborter.abort();
    this.outcomeWriteAborters.clear();
    this.outcomeWriteGenerations.clear();
    this.outcomeCache.clear();
    this.outcomeWriteStates.clear();
    this.confirmedReviews.clear();
    this.confirmedDecisions.clear();
    this.deepLinkedArchiveIds.clear();
    this.deepLinkTarget = null;
    this.listeners.clear();
  }
}
