import type { DadianOverview } from "../../lib/backendClient";

export type DadianDisplayState = "loading" | "error" | "empty" | "ready";

export interface DadianViewModel {
  state: DadianDisplayState;
  overview: DadianOverview | null;
  blockingError: string | null;
  nonBlockingError: string | null;
}

export function createDadianViewModel({
  overview,
  error,
}: {
  overview: DadianOverview | null;
  error: string | null;
}): DadianViewModel {
  if (overview === null) {
    return {
      state: error === null ? "loading" : "error",
      overview: null,
      blockingError: error,
      nonBlockingError: null,
    };
  }

  return {
    state: overview.replyCount === 0 ? "empty" : "ready",
    overview,
    blockingError: null,
    nonBlockingError: error,
  };
}
