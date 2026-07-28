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

function scheduleStudyLoginRedirect(path: string): void {
  window.setTimeout(() => window.location.assign(path), 0);
}

export function StudyClient() {
  const [decreeText, setDecreeText] = useState("");
  const [uiState, setUiState] = useState<DecreeUiState>(IDLE_UI_STATE);

  const { canEdit, canSubmit } = getDecreeFormAvailability(decreeText, uiState);

  async function handleSubmitDecree() {
    await submitStudyDecree({
      decreeText,
      canSubmit,
      setUiState,
      requestSubmission: (text) =>
        requestStudySubmission(text, {
          // Keep the browser receiver intact: some embedded browsers reject an
          // unbound `fetch` when the submission boundary invokes it as a
          // dependency method.
          fetchImpl: window.fetch.bind(window),
          scheduleRedirect: scheduleStudyLoginRedirect,
        }),
    });
  }

  return (
    <DevStudyWorkspace
      decreeText={decreeText}
      uiState={uiState}
      canEdit={canEdit}
      canSubmit={canSubmit}
      onDecreeTextChange={setDecreeText}
      onSubmit={() => void handleSubmitDecree()}
    />
  );
}
