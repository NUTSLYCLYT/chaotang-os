"use client";

import { useState } from "react";

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
  appendDecreeSessionRecord,
  type DecreeSessionRecord,
} from "./decreeSessionLog";

function scheduleStudyLoginRedirect(path: string): void {
  window.setTimeout(() => window.location.assign(path), 0);
}

export function StudyClient() {
  const [decreeText, setDecreeText] = useState("");
  const [uiState, setUiState] = useState<DecreeUiState>(IDLE_UI_STATE);
  const [decreeSessionRecords, setDecreeSessionRecords] = useState<DecreeSessionRecord[]>([]);
  const [consultState, setConsultState] = useState<ChancellorConsultState>(EMPTY_CONSULT_STATE);

  const { canEdit, canSubmit } = getDecreeFormAvailability(decreeText, uiState);

  async function handleSubmitDecree() {
    const submittedText = decreeText;
    await submitStudyDecree({
      decreeText,
      canSubmit,
      setUiState: (state) => {
        setUiState(state);
        if (state.phase === "success" || state.phase === "error") {
          setDecreeSessionRecords((records) => appendDecreeSessionRecord(records, submittedText, state));
        }
      },
      requestSubmission: (text) => requestStudySubmission(text, {
          // Keep the browser receiver intact: some embedded browsers reject an
          // unbound `fetch` when the submission boundary invokes it as a
          // dependency method.
          fetchImpl: window.fetch.bind(window),
          scheduleRedirect: scheduleStudyLoginRedirect,
      }),
    });
  }

  async function handleConsultSend(content: string) {
    if (consultState.pending) return false;
    const sendingState = { ...consultState, pending: true, error: null };
    setConsultState(sendingState);
    const result = await submitChancellorConsult({
      state: sendingState,
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
      decreeSessionRecords={decreeSessionRecords}
      consultMessages={consultState.messages}
      consultPending={consultState.pending}
      consultError={consultState.error}
      onConsultSend={handleConsultSend}
    />
  );
}
