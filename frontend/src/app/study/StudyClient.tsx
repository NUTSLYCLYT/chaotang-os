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

export function StudyClient({ userId }: { userId: string }) {
  const [decreeText, setDecreeText] = useState("");
  const [uiState, setUiState] = useState<DecreeUiState>(IDLE_UI_STATE);
  const [consultState, setConsultState] = useState<ChancellorConsultState>(EMPTY_CONSULT_STATE);
  const [recentReplies, setRecentReplies] =
    useState<StudyRecentRepliesState>(EMPTY_STUDY_RECENT_REPLIES_STATE);
  const [replyPresentation, setReplyPresentation] =
    useState<StudyReplyPresentation>(CURRENT_REPLY_PRESENTATION);
  const recentRepliesRef = useRef<StudyRecentRepliesState>(
    EMPTY_STUDY_RECENT_REPLIES_STATE,
  );

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
  const selectedArchivedReply = resolveSelectedArchive(replyPresentation, recentReplies.archives);

  async function handleSubmitDecree() {
    await runStudyDecreeSubmission({
      canSubmit,
      resetPresentation: () =>
        setReplyPresentation(resetToCurrentReply()),
      submit: () => submitStudyDecree({
        decreeText,
        canSubmit,
        setUiState: (state) => {
          setUiState(state);
          if (state.phase === "success") {
            commitRecentReplies(invalidateStudyRecentReplies);
          }
        },
        requestSubmission: (text) => requestStudySubmission(text, {
            // Keep the browser receiver intact: some embedded browsers reject an
            // unbound `fetch` when the submission boundary invokes it as a
            // dependency method.
            fetchImpl: window.fetch.bind(window),
            scheduleRedirect: scheduleStudyLoginRedirect,
        }),
      }),
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
      canSubmit={canSubmit}
      onDecreeTextChange={setDecreeText}
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
