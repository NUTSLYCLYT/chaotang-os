"use client";

import { useEffect, useRef, useState } from "react";

import {
  IDLE_UI_STATE,
  getDecreeFormAvailability,
  type DecreeUiState,
} from "./decreeStatus";
import {
  requestStudySubmission,
  submitStudyDecree,
} from "./studySubmission";
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
  canIssueChancellorDraft,
  requestChancellorDraft,
  type ChancellorDraftResult,
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

type ChancellorDraftRequestResult = Awaited<
  ReturnType<typeof requestChancellorDraft>
>;

interface ChancellorDraftRequestRunnerOptions {
  requestId: number;
  sourceText: string;
  getLatestRequestId(): number;
  getCurrentSourceText(): string;
  request(sourceText: string): Promise<ChancellorDraftRequestResult>;
  setPending(pending: boolean): void;
  setError(error: string | null): void;
  setDraft(draft: ChancellorDraftResult): void;
  scheduleRedirect(path: string): void;
}

export async function runChancellorDraftRequest({
  requestId,
  sourceText,
  getLatestRequestId,
  getCurrentSourceText,
  request,
  setPending,
  setError,
  setDraft,
  scheduleRedirect,
}: ChancellorDraftRequestRunnerOptions): Promise<boolean> {
  const normalizedSource = sourceText.trim();
  const result = await request(normalizedSource);
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
  const [decreeText, setDecreeText] = useState("");
  const [uiState, setUiState] = useState<DecreeUiState>(IDLE_UI_STATE);
  const [consultState, setConsultState] = useState<ChancellorConsultState>(EMPTY_CONSULT_STATE);
  const [draftResult, setDraftResult] = useState<ChancellorDraftResult | null>(null);
  const [draftPending, setDraftPending] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [recentReplies, setRecentReplies] =
    useState<StudyRecentRepliesState>(EMPTY_STUDY_RECENT_REPLIES_STATE);
  const [replyPresentation, setReplyPresentation] =
    useState<StudyReplyPresentation>(CURRENT_REPLY_PRESENTATION);
  const recentRepliesRef = useRef<StudyRecentRepliesState>(
    EMPTY_STUDY_RECENT_REPLIES_STATE,
  );
  const decreeTextRef = useRef("");
  const draftRequestIdRef = useRef(0);

  useEffect(() => {
    const restoreTimer = window.setTimeout(() => {
      setConsultState({
        ...EMPTY_CONSULT_STATE,
        messages: loadChancellorConsultMessages(userId, window.localStorage),
      });
    }, 0);
    return () => window.clearTimeout(restoreTimer);
  }, [userId]);

  function commitRecentReplies(
    update: (state: StudyRecentRepliesState) => StudyRecentRepliesState,
  ) {
    const next = update(recentRepliesRef.current);
    recentRepliesRef.current = next;
    setRecentReplies(next);
  }

  const { canEdit, canSubmit } = getDecreeFormAvailability(decreeText, uiState);
  const canIssue = canSubmit && canIssueChancellorDraft(draftResult);
  const selectedArchivedReply = resolveSelectedArchive(replyPresentation, recentReplies.archives);

  async function handleSubmitDecree() {
    await runStudyDecreeSubmission({
      canSubmit: canIssue,
      resetPresentation: () =>
        setReplyPresentation(resetToCurrentReply()),
      submit: () => submitStudyDecree({
        decreeText: draftResult?.decree_text ?? "",
        canSubmit: canIssue,
        setUiState: (state) => {
          setUiState(state);
          if (state.phase === "success") {
            commitRecentReplies(invalidateStudyRecentReplies);
          }
        },
        requestSubmission: (text) => requestStudySubmission(text, {
            draftVersion: draftResult?.version ?? 0,
            draftFingerprint: draftResult?.fingerprint ?? "",
            // Keep the browser receiver intact: some embedded browsers reject an
            // unbound `fetch` when the submission boundary invokes it as a
            // dependency method.
            fetchImpl: window.fetch.bind(window),
            scheduleRedirect: scheduleStudyLoginRedirect,
        }),
      }),
    });
  }

  async function handleDraft() {
    if (!decreeText.trim() || draftPending) return;
    const requestId = draftRequestIdRef.current + 1;
    draftRequestIdRef.current = requestId;
    const sourceText = decreeText;
    setDraftPending(true);
    setDraftError(null);
    await runChancellorDraftRequest({
      requestId,
      sourceText,
      getLatestRequestId: () => draftRequestIdRef.current,
      getCurrentSourceText: () => decreeTextRef.current,
      request: (text) => requestChancellorDraft(
        text,
        (draftResult?.version ?? 0) + 1,
        window.fetch.bind(window),
      ),
      setPending: setDraftPending,
      setError: setDraftError,
      setDraft: setDraftResult,
      scheduleRedirect: scheduleStudyLoginRedirect,
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
      onDraft={() => void handleDraft()}
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
    />
  );
}
