export type WelcomePhase = "closed" | "waiting" | "opening" | "finished";

export type WelcomeState = {
  phase: WelcomePhase;
  mediaReady: boolean;
  attendRequested: boolean;
};

export type WelcomeEvent =
  | { type: "attend" }
  | { type: "media-ready" }
  | { type: "media-error" }
  | { type: "timeout" }
  | { type: "complete" };

export const initialWelcomeState: WelcomeState = {
  phase: "closed",
  mediaReady: false,
  attendRequested: false,
};

export function nextWelcomeState(current: WelcomeState, event: WelcomeEvent): WelcomeState {
  if (current.phase === "finished" || current.phase === "opening") {
    return event.type === "complete" && current.phase === "opening"
      ? { ...current, phase: "finished" }
      : current;
  }

  if (event.type === "attend") {
    if (current.attendRequested) return current;
    return {
      phase: current.mediaReady ? "opening" : "waiting",
      mediaReady: current.mediaReady,
      attendRequested: true,
    };
  }

  if (event.type === "media-ready") {
    return {
      ...current,
      mediaReady: true,
      phase: current.attendRequested ? "opening" : "closed",
    };
  }

  if (event.type === "media-error" || event.type === "timeout") {
    return current.attendRequested ? { ...current, phase: "finished" } : current;
  }

  return current;
}
