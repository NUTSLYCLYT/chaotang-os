"use client";

import { useEffect, useMemo, useState } from "react";
import {
  createStudyArtifactConfirmationController,
  initialStudyArtifactConfirmationState,
  projectStudyArtifactConfirmationUi,
} from "./StudyArtifactLinks";

export function StudyArtifactConfirmation({ artifactId }: { artifactId: string }) {
  const [state, setState] = useState(initialStudyArtifactConfirmationState);
  const [reason, setReason] = useState("");
  const controller = useMemo(() => createStudyArtifactConfirmationController({
    artifactId,
    onStateChange: setState,
  }), [artifactId]);
  useEffect(() => {
    controller.activate();
    return () => { controller.dispose(); };
  }, [controller]);
  const view = projectStudyArtifactConfirmationUi(state);
  const pending = state.phase === "loading" || state.phase === "submitting";

  if (view.downloadOnly) {
    return <p role="status">{view.label}</p>;
  }

  if (!state.snapshot) {
    return (
      <section aria-label="成果人工确认">
        {view.showLookupButton && (
          <button type="button" onClick={() => { void controller.load(); }} disabled={pending}>
            {pending ? "读取中" : "查看确认状态"}
          </button>
        )}
        {pending && <p role="status">读取中</p>}
        {state.message && <p role="status">{state.message}</p>}
      </section>
    );
  }

  return (
    <section aria-label="成果人工确认" data-artifact-state={state.snapshot.artifactState}>
      <p role="status">{view.label}</p>
      {view.showControls && (
        <fieldset disabled={pending}>
          <legend>人工确认</legend>
          <label>
            确认理由
            <textarea value={reason} onChange={(event) => setReason(event.target.value)} />
          </label>
          <button type="button" onClick={() => { void controller.submit("CONFIRMED", reason); }}>确认通过</button>
          <button type="button" onClick={() => { void controller.submit("REVISION_REQUIRED", reason); }}>退回修改</button>
          <button type="button" onClick={() => { void controller.submit("ESCALATED", reason); }}>升级处理</button>
        </fieldset>
      )}
      {state.message && <p role="alert">{state.message}</p>}
    </section>
  );
}
