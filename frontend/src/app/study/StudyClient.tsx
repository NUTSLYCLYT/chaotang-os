"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

import {
  IDLE_UI_STATE,
  getDecreeFormAvailability,
  resolveOwnerScopedDecreeUiState,
  type DecreeUiState,
  type OwnerScopedDecreeUiState,
} from "./decreeStatus";
import {
  requestStudySubmission,
  resumeStudySubmission,
  submitStudyDecree,
} from "./studySubmission";
import { loadActiveJob } from "./decreeJobPolling";
import { DevStudyWorkspace } from "../../features/study-visual/DevStudyWorkspace";
import {
  EMPTY_CONSULT_STATE,
  type ChancellorConsultState,
} from "./chancellorConsultStatus";
import {
  requestChancellorConsult,
  submitChancellorConsult,
} from "./chancellorConsultSubmission";
import {
  loadChancellorConsultMessages,
  saveChancellorConsultMessages,
} from "./chancellorConsultPersistence";
import {
  EMPTY_CHANCELLOR_DRAFT_COMPOSER_STATE,
  canIssueChancellorDraft,
  requestChancellorDraft,
  resolveOwnerScopedChancellorDraftComposerState,
  type ChancellorDraftComposerState,
  type ChancellorDraftResult,
  type OwnerScopedChancellorDraftComposerState,
} from "./chancellorDraft";
import {
  EMPTY_STUDY_RECENT_REPLIES_STATE,
  beginStudyRecentRepliesLoad,
  invalidateStudyRecentReplies,
  requestStudyRecentReplies,
  resolveStudyRecentReplies,
  toggleStudyRecentReply,
  type StudyRecentRepliesState,
  type StudyRecentRepliesResult,
} from "./studyRecentReplies";
import {
  CURRENT_REPLY_PRESENTATION,
  resetToCurrentReply,
  resolveSelectedArchive,
  selectArchivedReply,
  type StudyReplyPresentation,
} from "./studyReplyPresentation";
import {
  beginDailyMemorialLoad,
  failDailyMemorial,
  requestDailyMemorialConfirmation,
  requestLatestDailyMemorial,
  resolveDailyMemorialLoad,
  runDailyMemorialConfirmation,
  type DailyMemorialUiState,
} from "./dailyMemorialDraft";

function scheduleStudyLoginRedirect(path: string): void {
  window.setTimeout(() => window.location.assign(path), 0);
}

interface StudyRecentRepliesLoaderOptions {
  stateRef: { current: StudyRecentRepliesState };
  setState(state: StudyRecentRepliesState): void;
  request(): Promise<StudyRecentRepliesResult>;
  scheduleRedirect(path: string): void;
}

export async function loadStudyRecentReplies({
  stateRef,
  setState,
  request,
  scheduleRedirect,
}: StudyRecentRepliesLoaderOptions): Promise<void> {
  const load = beginStudyRecentRepliesLoad(stateRef.current);
  if (!load.shouldRequest) return;

  stateRef.current = load.state;
  setState(load.state);
  const result = await request();
  if (
    stateRef.current.generation === load.generation &&
    result.ok === false &&
    result.kind === "unauthenticated"
  ) {
    scheduleRedirect("/login?next=%2Fstudy");
  }
  const resolved = resolveStudyRecentReplies(
    stateRef.current,
    result,
    load.generation,
  );
  stateRef.current = resolved;
  setState(resolved);
}

interface StudyDecreeSubmissionRunnerOptions {
  canSubmit: boolean;
  resetPresentation(): void;
  submit(): Promise<void>;
}

export async function runStudyDecreeSubmission({
  canSubmit,
  resetPresentation,
  submit,
}: StudyDecreeSubmissionRunnerOptions): Promise<boolean> {
  if (!canSubmit) return false;
  resetPresentation();
  await submit();
  return true;
}

interface StudyDecreeUiStateCommitOptions {
  state: DecreeUiState;
  setUiState(state: DecreeUiState): void;
  clearDraft(): void;
  invalidateRecentReplies(): void;
}

export function commitStudyDecreeUiState({
  state,
  setUiState,
  clearDraft,
  invalidateRecentReplies,
}: StudyDecreeUiStateCommitOptions): void {
  setUiState(state);
  if (state.phase !== "success") return;
  clearDraft();
  invalidateRecentReplies();
}

type ChancellorDraftRequestResult = Awaited<
  ReturnType<typeof requestChancellorDraft>
>;

interface ChancellorDraftRequestRunnerOptions {
  requestId: number;
  sourceText: string;
  getLatestRequestId(): number;
  getCurrentSourceText(): string;
  isCurrentOwner?(): boolean;
  request(sourceText: string): Promise<ChancellorDraftRequestResult>;
  setPending(pending: boolean): void;
  setError(error: string | null): void;
  setDraft(draft: ChancellorDraftResult): void;
  clearStaleOwnerPending?(): void;
  scheduleRedirect(path: string): void;
}

export function clearOwnerDraftPending(
  envelope: OwnerScopedChancellorDraftComposerState,
  ownerId: string,
): OwnerScopedChancellorDraftComposerState {
  if (envelope.ownerId !== ownerId || !envelope.value.draftPending) return envelope;
  return {
    ...envelope,
    value: { ...envelope.value, draftPending: false },
  };
}

export async function runChancellorDraftRequest({
  requestId,
  sourceText,
  getLatestRequestId,
  getCurrentSourceText,
  isCurrentOwner,
  request,
  setPending,
  setError,
  setDraft,
  clearStaleOwnerPending,
  scheduleRedirect,
}: ChancellorDraftRequestRunnerOptions): Promise<boolean> {
  const normalizedSource = sourceText.trim();
  const result = await request(normalizedSource);
  if (isCurrentOwner?.() === false) {
    clearStaleOwnerPending?.();
    return false;
  }
  if (
    requestId !== getLatestRequestId() ||
    getCurrentSourceText().trim() !== normalizedSource
  ) {
    return false;
  }

  setPending(false);
  if (!result.ok) {
    if (result.unauthenticated) {
      scheduleRedirect("/login?next=%2Fstudy");
    }
    setError("丞相暂时无法拟旨，请稍后再试。");
    return true;
  }
  setDraft(result.draft);
  return true;
}

export function StudyClient({ userId }: { userId: string }) {
  const [ownerScopedDraftComposer, setOwnerScopedDraftComposer] =
    useState<OwnerScopedChancellorDraftComposerState>(() => ({
      ownerId: userId,
      value: EMPTY_CHANCELLOR_DRAFT_COMPOSER_STATE,
    }));
  const {
    decreeText,
    draftResult,
    draftPending,
    draftError,
  } = resolveOwnerScopedChancellorDraftComposerState(
    ownerScopedDraftComposer,
    userId,
  );
  const updateDraftComposer = (patch: Partial<ChancellorDraftComposerState>) => {
    setOwnerScopedDraftComposer((current) => ({
      ownerId: userId,
      value: {
        ...resolveOwnerScopedChancellorDraftComposerState(current, userId),
        ...patch,
      },
    }));
  };
  const setDecreeText = (value: string) => updateDraftComposer({ decreeText: value });
  const setDraftResult = (value: ChancellorDraftResult | null) =>
    updateDraftComposer({ draftResult: value });
  const setDraftPending = (value: boolean) => updateDraftComposer({ draftPending: value });
  const setDraftError = (value: string | null) => updateDraftComposer({ draftError: value });
  const [ownerScopedUiState, setOwnerScopedUiState] =
    useState<OwnerScopedDecreeUiState>(() => ({
      ownerId: userId,
      value: IDLE_UI_STATE,
    }));
  const uiState = resolveOwnerScopedDecreeUiState(ownerScopedUiState, userId);
  const setUiState = (state: DecreeUiState) => {
    setOwnerScopedUiState({ ownerId: userId, value: state });
  };
  const [consultState, setConsultState] = useState<ChancellorConsultState>(EMPTY_CONSULT_STATE);
  const [recentReplies, setRecentReplies] =
    useState<StudyRecentRepliesState>(EMPTY_STUDY_RECENT_REPLIES_STATE);
  const [replyPresentation, setReplyPresentation] =
    useState<StudyReplyPresentation>(CURRENT_REPLY_PRESENTATION);
  const [dailyMemorialState, setDailyMemorialState] =
    useState<DailyMemorialUiState>(() => beginDailyMemorialLoad());
  const recentRepliesRef = useRef<StudyRecentRepliesState>(
    EMPTY_STUDY_RECENT_REPLIES_STATE,
  );
  const decreeTextRef = useRef("");
  const draftRequestIdRef = useRef(0);
  const resumedJobRef = useRef<string | null>(null);
  const activeOwnerRef = useRef(userId);
  const dailyMemorialRef = useRef<DailyMemorialUiState>(beginDailyMemorialLoad());

  function commitDailyMemorial(state: DailyMemorialUiState) {
    dailyMemorialRef.current = state;
    setDailyMemorialState(state);
  }

  async function loadLatestDailyMemorial(message?: string) {
    commitDailyMemorial(beginDailyMemorialLoad());
    const result = await requestLatestDailyMemorial(window.fetch.bind(window));
    if (!result.ok) {
      if (result.kind === "unauthenticated") {
        scheduleStudyLoginRedirect("/login?next=%2Fstudy");
      }
      commitDailyMemorial(failDailyMemorial(message));
      return;
    }
    const state = resolveDailyMemorialLoad(result.data);
    commitDailyMemorial(message ? { ...state, message } : state);
  }

  async function handleConfirmDailyMemorial() {
    const current = dailyMemorialRef.current;
    await runDailyMemorialConfirmation({
      state: current,
      getCurrentState: () => dailyMemorialRef.current,
      commit: commitDailyMemorial,
      request: (draft) => requestDailyMemorialConfirmation(draft, window.fetch.bind(window)),
      refresh: loadLatestDailyMemorial,
      scheduleRedirect: scheduleStudyLoginRedirect,
    });
  }

  useEffect(() => {
    let active = true;
    void requestLatestDailyMemorial(window.fetch.bind(window)).then((result) => {
      if (!active) return;
      if (!result.ok) {
        if (result.kind === "unauthenticated") {
          scheduleStudyLoginRedirect("/login?next=%2Fstudy");
        }
        commitDailyMemorial(failDailyMemorial());
        return;
      }
      commitDailyMemorial(resolveDailyMemorialLoad(result.data));
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const restoreTimer = window.setTimeout(() => {
      setConsultState({
        ...EMPTY_CONSULT_STATE,
        messages: loadChancellorConsultMessages(userId, window.localStorage),
      });
    }, 0);
    return () => window.clearTimeout(restoreTimer);
  }, [userId]);

  useLayoutEffect(() => {
    activeOwnerRef.current = userId;
  }, [userId]);

  useEffect(() => {
    let currentOwner = true;
    const active = loadActiveJob(window.sessionStorage, userId);
    if (active === null) {
      resumedJobRef.current = null;
      return () => { currentOwner = false; };
    }
    const resumeKey = `${encodeURIComponent(userId)}:${active.jobId}`;
    if (resumedJobRef.current === resumeKey) {
      return () => { currentOwner = false; };
    }
    resumedJobRef.current = resumeKey;
    void resumeStudySubmission(active.jobId, {
      fetchImpl: window.fetch.bind(window),
      scheduleRedirect: scheduleStudyLoginRedirect,
      storage: window.sessionStorage,
      userId,
      isCurrent: () => currentOwner && activeOwnerRef.current === userId,
      onProgress: (phase, jobId, jobProgress) => {
        if (currentOwner && activeOwnerRef.current === userId) {
          setOwnerScopedUiState({ ownerId: userId, value: { phase, jobId, jobProgress } });
        }
      },
    }).then((state) => {
      if (currentOwner && activeOwnerRef.current === userId) {
        setOwnerScopedUiState({ ownerId: userId, value: state });
      }
    });
    return () => { currentOwner = false; };
  }, [userId]);

  function commitRecentReplies(
    update: (state: StudyRecentRepliesState) => StudyRecentRepliesState,
  ) {
    const next = update(recentRepliesRef.current);
    recentRepliesRef.current = next;
    setRecentReplies(next);
  }

  const { canEdit } = getDecreeFormAvailability(decreeText, uiState);
  const canIssue = !["enqueueing", "queued", "running"].includes(uiState.phase) &&
    canIssueChancellorDraft(draftResult);
  const selectedArchivedReply = resolveSelectedArchive(replyPresentation, recentReplies.archives);

  async function handleSubmitDecree() {
    const submittingOwner = userId;
    await runStudyDecreeSubmission({
      canSubmit: canIssue,
      resetPresentation: () =>
        setReplyPresentation(resetToCurrentReply()),
      submit: () => submitStudyDecree({
        decreeText: draftResult?.decree_text ?? "",
        canSubmit: canIssue,
        setUiState: (state) => {
          if (activeOwnerRef.current !== submittingOwner) return;
          commitStudyDecreeUiState({
            state,
            setUiState,
            clearDraft: () => setDraftResult(null),
            invalidateRecentReplies: () =>
              commitRecentReplies(invalidateStudyRecentReplies),
          });
        },
        requestSubmission: (text) => requestStudySubmission(text, {
            draftVersion: draftResult?.version ?? 0,
            draftFingerprint: draftResult?.fingerprint ?? "",
            // Keep the browser receiver intact: some embedded browsers reject an
            // unbound `fetch` when the submission boundary invokes it as a
            // dependency method.
            fetchImpl: window.fetch.bind(window),
            scheduleRedirect: scheduleStudyLoginRedirect,
            storage: window.sessionStorage,
            userId: submittingOwner,
            isCurrent: () => activeOwnerRef.current === submittingOwner,
            onProgress: (phase, jobId, jobProgress) => {
              if (activeOwnerRef.current === submittingOwner) {
                setUiState({ phase, jobId, jobProgress });
              }
            },
        }),
      }),
    });
  }

  async function handleDraft(sourceText: string) {
    const normalizedSource = sourceText.trim();
    if (!normalizedSource || draftPending) return;
    const draftingOwner = userId;
    const requestId = draftRequestIdRef.current + 1;
    draftRequestIdRef.current = requestId;
    decreeTextRef.current = normalizedSource;
    setDecreeText(normalizedSource);
    setUiState(IDLE_UI_STATE);
    setDraftPending(true);
    setDraftError(null);
    setDraftResult(null);
    await runChancellorDraftRequest({
      requestId,
      sourceText: normalizedSource,
      getLatestRequestId: () => draftRequestIdRef.current,
      getCurrentSourceText: () => decreeTextRef.current,
      isCurrentOwner: () => activeOwnerRef.current === draftingOwner,
      request: (text) => requestChancellorDraft(
        text,
        (draftResult?.version ?? 0) + 1,
        window.fetch.bind(window),
      ),
      setPending: setDraftPending,
      setError: setDraftError,
      setDraft: setDraftResult,
      clearStaleOwnerPending: () => {
        setOwnerScopedDraftComposer((current) =>
          clearOwnerDraftPending(current, draftingOwner));
      },
      scheduleRedirect: scheduleStudyLoginRedirect,
    });
  }

  async function handleRetryProgress() {
    const recoveringOwner = userId;
    const active = loadActiveJob(window.sessionStorage, userId);
    const fallbackSourceText = decreeText.trim() ||
      draftResult?.decree_text?.trim() || "";
    async function redraftOrExplain() {
      if (!fallbackSourceText) {
        setUiState({
          phase: "error",
          message: "当前浏览器没有可用于重新拟旨的目标。请先输入目标，再重新拟旨。",
          ...(uiState.phase === "error" && uiState.lastVerifiedProgress
            ? { lastVerifiedProgress: uiState.lastVerifiedProgress }
            : {}),
          progressFreshness: uiState.phase === "error"
            ? uiState.progressFreshness ?? "current"
            : "current",
          recoveryMode: "redraft",
        });
        return;
      }
      await handleDraft(fallbackSourceText);
    }
    if (active === null) {
      await redraftOrExplain();
      return;
    }
    if (uiState.phase !== "error" || uiState.recoveryMode !== "resume") {
      await redraftOrExplain();
      return;
    }
    const resumeKey = `${encodeURIComponent(userId)}:${active.jobId}`;
    resumedJobRef.current = resumeKey;
    const lastVerifiedProgress = uiState.phase === "error" &&
      uiState.lastVerifiedProgress?.jobId === active.jobId
      ? uiState.lastVerifiedProgress
      : undefined;
    setUiState({
      phase: "queued",
      jobId: active.jobId,
      ...(lastVerifiedProgress ? { jobProgress: lastVerifiedProgress } : {}),
    });
    const state = await resumeStudySubmission(active.jobId, {
      initialProgress: lastVerifiedProgress,
      fetchImpl: window.fetch.bind(window),
      scheduleRedirect: scheduleStudyLoginRedirect,
      storage: window.sessionStorage,
      userId: recoveringOwner,
      isCurrent: () => activeOwnerRef.current === recoveringOwner,
      onProgress: (phase, jobId, jobProgress) => {
        if (activeOwnerRef.current === recoveringOwner) {
          setUiState({ phase, jobId, jobProgress });
        }
      },
    });
    if (activeOwnerRef.current !== recoveringOwner) return;
    commitStudyDecreeUiState({
      state,
      setUiState,
      clearDraft: () => setDraftResult(null),
      invalidateRecentReplies: () =>
        commitRecentReplies(invalidateStudyRecentReplies),
    });
  }

  async function handleOpenRecentReplies() {
    await loadStudyRecentReplies({
      stateRef: recentRepliesRef,
      setState: setRecentReplies,
      request: () => requestStudyRecentReplies(window.fetch.bind(window)),
      scheduleRedirect: scheduleStudyLoginRedirect,
    });
  }

  async function handleConsultSend(content: string) {
    if (consultState.pending) return false;
    const sendingState = { ...consultState, pending: true, error: null };
    setConsultState(sendingState);
    const result = await submitChancellorConsult({
      state: { ...sendingState, messages: sendingState.messages.slice(-18) },
      content,
      request: async (messages) => {
        const response = await requestChancellorConsult(messages, window.fetch.bind(window));
        if (!response.ok && response.unauthenticated) {
          scheduleStudyLoginRedirect("/login?next=%2Fstudy");
        }
        return response;
      },
    });
    setConsultState(result.state);
    if (result.clearDraft) {
      saveChancellorConsultMessages(userId, result.state.messages, window.localStorage);
    }
    return result.clearDraft;
  }

  const recoverySourceText = decreeText.trim() ||
    draftResult?.decree_text?.trim() || "";
  let activeRecoveryJob: ReturnType<typeof loadActiveJob> = null;
  if (typeof window !== "undefined") {
    try {
      activeRecoveryJob = loadActiveJob(window.sessionStorage, userId);
    } catch {
      // Session storage may be unavailable in privacy-restricted browsers.
    }
  }
  const canResumeProgress = uiState.phase === "error" &&
    uiState.progressFreshness === "stale" &&
    uiState.recoveryMode === "resume" &&
    activeRecoveryJob !== null;
  const canRetryProgress = canResumeProgress || recoverySourceText.length > 0;
  const retryProgressLabel = canResumeProgress ? "恢复办理" : "重新拟旨";
  const retryProgressHint = canRetryProgress
    ? null
    : "请先输入目标，再重新拟旨。";

  return (
    <DevStudyWorkspace
      decreeText={decreeText}
      uiState={uiState}
      canEdit={canEdit}
      canSubmit={canIssue}
      onDecreeTextChange={(value) => {
        decreeTextRef.current = value;
        draftRequestIdRef.current += 1;
        setDecreeText(value);
        setDraftPending(false);
        setDraftResult(null);
        setDraftError(null);
      }}
      draftResult={draftResult}
      draftPending={draftPending}
      draftError={draftError}
      onDraft={(sourceText) => void handleDraft(sourceText)}
      onRetryProgress={() => void handleRetryProgress()}
      canRetryProgress={canRetryProgress}
      retryProgressLabel={retryProgressLabel}
      retryProgressHint={retryProgressHint}
      onSubmit={() => void handleSubmitDecree()}
      recentReplies={recentReplies}
      onOpenRecentReplies={handleOpenRecentReplies}
      onRetryRecentReplies={handleOpenRecentReplies}
      selectedArchivedReply={selectedArchivedReply}
      onReturnToCurrentReply={() =>
        setReplyPresentation(resetToCurrentReply())}
      onSelectRecentReply={(archiveId) => {
        commitRecentReplies((state) => toggleStudyRecentReply(state, archiveId));
        setReplyPresentation(selectArchivedReply(archiveId));
      }}
      consultMessages={consultState.messages}
      consultPending={consultState.pending}
      consultError={consultState.error}
      onConsultSend={handleConsultSend}
      dailyMemorialState={dailyMemorialState}
      onConfirmDailyMemorial={() => void handleConfirmDailyMemorial()}
      onRetryDailyMemorial={() => void loadLatestDailyMemorial()}
    />
  );
}
