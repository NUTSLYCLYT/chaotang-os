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
import { clearInvalidActiveJob, loadActiveJob } from "./decreeJobPolling";
import { DevStudyWorkspace } from "../../features/study-visual/DevStudyWorkspace";
import {
  EMPTY_CONSULT_STATE,
  type ChancellorConsultState,
} from "./chancellorConsultStatus";
import {
  requestChancellorConsult,
} from "./chancellorConsultSubmission";
import {
  captureStudyIntent, confirmStudyIntent, isStudyIntentCurrent,
  type ConfirmedStudyIntent, type StudyIntentSnapshot,
} from "./studyIntentConfirmation";
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

function scheduleCurrentStudyLoginRedirect(path: string, isCurrent: () => boolean): void {
  window.setTimeout(() => { if (isCurrent()) window.location.assign(path); }, 0);
}

export async function runStudyConsultRequest(options: {
  isCurrent(): boolean;
  request(): ReturnType<typeof requestChancellorConsult>;
  accept(reply: string): void;
  fail(): void;
  scheduleRedirect(path: string): void;
}): Promise<boolean> {
  if (!options.isCurrent()) return false;
  let response: Awaited<ReturnType<typeof requestChancellorConsult>>;
  try { response = await options.request(); } catch { response = { ok: false }; }
  if (!options.isCurrent()) return false;
  if (!response.ok) {
    if (response.unauthenticated) options.scheduleRedirect("/login?next=%2Fstudy");
    options.fail();
    return false;
  }
  options.accept(response.reply);
  return true;
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
  isCurrentSource?(): boolean;
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
  isCurrentSource,
  request,
  setPending,
  setError,
  setDraft,
  clearStaleOwnerPending,
  scheduleRedirect,
}: ChancellorDraftRequestRunnerOptions): Promise<boolean> {
  const normalizedSource = sourceText.trim();
  if (isCurrentSource?.() === false) return false;
  const result = await request(normalizedSource);
  if (isCurrentOwner?.() === false) {
    clearStaleOwnerPending?.();
    return false;
  }
  if (
    isCurrentSource?.() === false || requestId !== getLatestRequestId() ||
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
  const [ownerScopedConsult, setOwnerScopedConsult] = useState({ ownerId: userId, value: EMPTY_CONSULT_STATE });
  const consultState = ownerScopedConsult.ownerId === userId ? ownerScopedConsult.value : EMPTY_CONSULT_STATE;
  const setConsultState = (value: ChancellorConsultState) => setOwnerScopedConsult({ ownerId: userId, value });
  const [currentIntent, setCurrentIntent] = useState<StudyIntentSnapshot>({
    ownerId: userId, normalizedOriginalGoal: "", exactLatestChancellorRestatement: "",
    consultationGeneration: 0, contextGeneration: 0,
  });
  const intentRef = useRef(currentIntent);
  const [understanding, setUnderstanding] = useState<StudyIntentSnapshot | null>(null);
  const understandingRef = useRef<StudyIntentSnapshot | null>(null);
  const [confirmedIntent, setConfirmedIntent] = useState<ConfirmedStudyIntent | null>(null);
  const draftFlightRef = useRef<number | null>(null);
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
  const recentRepliesOwnerEpochRef = useRef(0);
  const dailyMemorialOwnerEpochRef = useRef(0);

  // Reset the rendered state as well as the request refs. React retries this
  // render before committing children, so returning A after B cannot revive A.
  if (currentIntent.ownerId !== userId) {
    const emptyDailyMemorial = beginDailyMemorialLoad();
    setCurrentIntent({ ownerId: userId, normalizedOriginalGoal: "", exactLatestChancellorRestatement: "",
      consultationGeneration: currentIntent.consultationGeneration + 1,
      contextGeneration: currentIntent.contextGeneration + 1 });
    setUnderstanding(null);
    setConfirmedIntent(null);
    setRecentReplies(EMPTY_STUDY_RECENT_REPLIES_STATE);
    setReplyPresentation(CURRENT_REPLY_PRESENTATION);
    setDailyMemorialState(emptyDailyMemorial);
    setOwnerScopedDraftComposer({ ownerId: userId, value: EMPTY_CHANCELLOR_DRAFT_COMPOSER_STATE });
    setOwnerScopedUiState({ ownerId: userId, value: IDLE_UI_STATE });
    setOwnerScopedConsult({ ownerId: userId, value: EMPTY_CONSULT_STATE });
  }

  function isCurrentDailyMemorialOwner(ownerId: string, epoch: number): boolean {
    return activeOwnerRef.current === ownerId && dailyMemorialOwnerEpochRef.current === epoch;
  }

  function commitDailyMemorial(
    state: DailyMemorialUiState,
    ownerId = userId,
    epoch = dailyMemorialOwnerEpochRef.current,
  ) {
    if (!isCurrentDailyMemorialOwner(ownerId, epoch)) return;
    dailyMemorialRef.current = state;
    setDailyMemorialState(state);
  }

  async function loadLatestDailyMemorial(
    message?: string,
    ownerId = userId,
    epoch = dailyMemorialOwnerEpochRef.current,
  ) {
    if (!isCurrentDailyMemorialOwner(ownerId, epoch)) return;
    commitDailyMemorial(beginDailyMemorialLoad(), ownerId, epoch);
    const result = await requestLatestDailyMemorial(window.fetch.bind(window));
    if (!isCurrentDailyMemorialOwner(ownerId, epoch)) return;
    if (!result.ok) {
      if (result.kind === "unauthenticated") {
        scheduleCurrentStudyLoginRedirect("/login?next=%2Fstudy", () =>
          isCurrentDailyMemorialOwner(ownerId, epoch));
      }
      commitDailyMemorial(failDailyMemorial(message), ownerId, epoch);
      return;
    }
    const state = resolveDailyMemorialLoad(result.data);
    commitDailyMemorial(message ? { ...state, message } : state, ownerId, epoch);
  }

  async function handleConfirmDailyMemorial() {
    const confirmingOwner = userId;
    const confirmingEpoch = dailyMemorialOwnerEpochRef.current;
    if (!isCurrentDailyMemorialOwner(confirmingOwner, confirmingEpoch)) return;
    const current = dailyMemorialRef.current;
    await runDailyMemorialConfirmation({
      state: current,
      getCurrentState: () => isCurrentDailyMemorialOwner(confirmingOwner, confirmingEpoch)
        ? dailyMemorialRef.current : beginDailyMemorialLoad(),
      commit: (state) => commitDailyMemorial(state, confirmingOwner, confirmingEpoch),
      request: (draft) => isCurrentDailyMemorialOwner(confirmingOwner, confirmingEpoch)
        ? requestDailyMemorialConfirmation(draft, window.fetch.bind(window))
        : Promise.resolve({ ok: false as const, kind: "network" as const }),
      refresh: (message) => loadLatestDailyMemorial(message, confirmingOwner, confirmingEpoch),
      scheduleRedirect: (path) => scheduleCurrentStudyLoginRedirect(path, () =>
        isCurrentDailyMemorialOwner(confirmingOwner, confirmingEpoch)),
    });
  }

  useEffect(() => {
    const ownerId = userId;
    const epoch = dailyMemorialOwnerEpochRef.current;
    void requestLatestDailyMemorial(window.fetch.bind(window)).then((result) => {
      if (!isCurrentDailyMemorialOwner(ownerId, epoch)) return;
      if (!result.ok) {
        if (result.kind === "unauthenticated") {
          scheduleCurrentStudyLoginRedirect("/login?next=%2Fstudy", () =>
            isCurrentDailyMemorialOwner(ownerId, epoch));
        }
        const failedState = failDailyMemorial();
        dailyMemorialRef.current = failedState;
        setDailyMemorialState(failedState);
        return;
      }
      const loadedState = resolveDailyMemorialLoad(result.data);
      dailyMemorialRef.current = loadedState;
      setDailyMemorialState(loadedState);
    });
  }, [userId]);

  useEffect(() => {
    const restoringGeneration = intentRef.current.contextGeneration;
    const restoreTimer = window.setTimeout(() => {
      if (activeOwnerRef.current !== userId || intentRef.current.contextGeneration !== restoringGeneration) return;
      setOwnerScopedConsult({
        ownerId: userId,
        value: { ...EMPTY_CONSULT_STATE,
          messages: loadChancellorConsultMessages(userId, window.localStorage) },
      });
    }, 0);
    return () => window.clearTimeout(restoreTimer);
  }, [userId]);

  useLayoutEffect(() => {
    activeOwnerRef.current = userId;
    if (intentRef.current.ownerId !== userId) {
      intentRef.current = { ownerId: userId, normalizedOriginalGoal: "", exactLatestChancellorRestatement: "",
        consultationGeneration: intentRef.current.consultationGeneration + 1,
        contextGeneration: intentRef.current.contextGeneration + 1 };
      recentRepliesOwnerEpochRef.current += 1;
      dailyMemorialOwnerEpochRef.current += 1;
      recentRepliesRef.current = EMPTY_STUDY_RECENT_REPLIES_STATE;
      dailyMemorialRef.current = beginDailyMemorialLoad();
      understandingRef.current = null;
      draftRequestIdRef.current += 1;
      draftFlightRef.current = null;
    }
  }, [userId]);

  useEffect(() => {
    let currentOwner = true;
    const active = loadActiveJob(window.sessionStorage, userId);
    if (active === null) {
      // Active load flow (not render): prune present-but-invalid persisted state.
      clearInvalidActiveJob(window.sessionStorage, userId);
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
  const visibleUnderstanding = currentIntent.ownerId === userId &&
    isStudyIntentCurrent(understanding, currentIntent) ? understanding : null;
  const confirmedSourceCurrent = currentIntent.ownerId === userId &&
    isStudyIntentCurrent(confirmedIntent, currentIntent);
  const canIssue = !["enqueueing", "queued", "running"].includes(uiState.phase) &&
    confirmedSourceCurrent && canIssueChancellorDraft(draftResult);
  const selectedArchivedReply = resolveSelectedArchive(replyPresentation, recentReplies.archives);

  async function handleSubmitDecree() {
    if (activeOwnerRef.current !== userId ||
      !isStudyIntentCurrent(confirmedIntent, intentRef.current)) return;
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
            isCurrent: () => activeOwnerRef.current === submittingOwner &&
              isStudyIntentCurrent(confirmedIntent, intentRef.current),
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
    if (!normalizedSource || draftPending || draftFlightRef.current !== null ||
      ["enqueueing", "queued", "running"].includes(uiState.phase)) return;
    const snapshot = understandingRef.current;
    const confirmed = snapshot && confirmStudyIntent(snapshot, intentRef.current);
    if (!confirmed || confirmed.ownerId !== userId || confirmed.normalizedOriginalGoal !== normalizedSource) return;
    const draftingOwner = userId;
    const requestId = draftRequestIdRef.current + 1;
    draftRequestIdRef.current = requestId;
    draftFlightRef.current = requestId;
    setConfirmedIntent(confirmed);
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
      isCurrentSource: () => isStudyIntentCurrent(confirmed, intentRef.current),
      request: () => requestChancellorDraft(
        confirmed,
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
      scheduleRedirect: (path) => scheduleCurrentStudyLoginRedirect(path, () =>
        activeOwnerRef.current === draftingOwner && requestId === draftRequestIdRef.current &&
        isStudyIntentCurrent(confirmed, intentRef.current)),
    });
    if (draftFlightRef.current === requestId) draftFlightRef.current = null;
  }

  async function handleRetryProgress() {
    const recoveringOwner = userId;
    const active = loadActiveJob(window.sessionStorage, userId);
    clearInvalidActiveJob(window.sessionStorage, userId);
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
      if (isStudyIntentCurrent(understandingRef.current, intentRef.current)) {
        await handleDraft(fallbackSourceText);
      } else {
        await handleRestate(fallbackSourceText);
      }
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
    const loadingOwner = userId;
    const loadingEpoch = recentRepliesOwnerEpochRef.current;
    const isCurrentRecentRepliesOwner = () => activeOwnerRef.current === loadingOwner &&
      recentRepliesOwnerEpochRef.current === loadingEpoch;
    if (!isCurrentRecentRepliesOwner()) return;
    await loadStudyRecentReplies({
      stateRef: recentRepliesRef,
      setState: (state) => {
        if (!isCurrentRecentRepliesOwner()) return;
        recentRepliesRef.current = state;
        setRecentReplies(state);
      },
      request: () => requestStudyRecentReplies(window.fetch.bind(window)),
      scheduleRedirect: (path) => scheduleCurrentStudyLoginRedirect(path,
        isCurrentRecentRepliesOwner),
    });
  }

  function invalidateIntent(sourceText: string) {
    const next = { ownerId: userId, normalizedOriginalGoal: sourceText.trim(),
      exactLatestChancellorRestatement: "",
      consultationGeneration: intentRef.current.consultationGeneration + 1,
      contextGeneration: intentRef.current.contextGeneration + 1 };
    intentRef.current = next;
    setCurrentIntent(next);
    understandingRef.current = null;
    setUnderstanding(null);
    setConfirmedIntent(null);
    draftRequestIdRef.current += 1;
    draftFlightRef.current = null;
    decreeTextRef.current = sourceText;
    setDecreeText(sourceText);
    setDraftPending(false);
    setDraftResult(null);
    setDraftError(null);
    return next;
  }

  async function performConsult(content: string, goal: string) {
    if (!content.trim() || !goal.trim() || ["enqueueing", "queued", "running"].includes(uiState.phase)) return false;
    const token = invalidateIntent(goal);
    const sendingState = { ...consultState, pending: true, error: null };
    const messages = [...sendingState.messages.slice(-18), { role: "user" as const, content: content.trim() }];
    setConsultState(sendingState);
    setUiState(IDLE_UI_STATE);
    const isCurrent = () => activeOwnerRef.current === userId && intentRef.current === token;
    return runStudyConsultRequest({
      isCurrent,
      request: () => requestChancellorConsult(messages, window.fetch.bind(window)),
      accept: (reply) => {
        const snapshot = captureStudyIntent({ ...token, exactLatestChancellorRestatement: reply });
        if (!snapshot) { setConsultState({ ...sendingState, pending: false, error: "未取得有效复述，请重试。" }); return; }
        intentRef.current = snapshot;
        setCurrentIntent(snapshot);
        understandingRef.current = snapshot;
        setUnderstanding(snapshot);
        const result = { state: { messages: [...messages, { role: "assistant" as const, content: reply }], pending: false, error: null } };
        setConsultState(result.state);
        saveChancellorConsultMessages(userId, result.state.messages, window.localStorage);
      },
      fail: () => setConsultState({ ...sendingState, pending: false, error: "丞相暂时无法复述，请稍后再试。" }),
      scheduleRedirect: (path) => scheduleCurrentStudyLoginRedirect(path, isCurrent),
    });
  }

  async function handleRestate(sourceText: string) {
    return performConsult("请先复述以下目标，明确缺失资料与限制；不要执行或生成正式旨意。\n\n" + sourceText.trim(), sourceText);
  }

  async function handleConsultSend(content: string) {
    return performConsult(content, decreeTextRef.current.trim() || content.trim());
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
        if (!canEdit) return;
        invalidateIntent(value);
        setConsultState({ ...consultState, pending: false, error: null });
        setUiState(IDLE_UI_STATE);
      }}
      understanding={visibleUnderstanding}
      onRestate={(sourceText) => void handleRestate(sourceText)}
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
