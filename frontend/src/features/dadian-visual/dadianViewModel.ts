import type { DadianOverview } from "../../lib/backendClient";

export type DadianDisplayState = "loading" | "error" | "empty" | "ready";

export interface DadianReplyView {
  id: string;
  title: string;
  conclusion: string;
  respondent: string;
  departments: string[];
  replyTime: string;
}

export interface DadianViewModel {
  state: DadianDisplayState;
  overview: DadianOverview | null;
  departmentOptions: DadianOverview["departmentCounts"];
  replies: DadianReplyView[];
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
      departmentOptions: [],
      replies: [],
      blockingError: error,
      nonBlockingError: null,
    };
  }

  return {
    state: overview.replyCount === 0 ? "empty" : "ready",
    overview,
    departmentOptions: overview.departmentCounts,
    replies: overview.recentReplies.map((reply) => ({
      id: reply.id,
      title: reply.title,
      conclusion: reply.replyConclusion,
      respondent: reply.respondent,
      departments: [...reply.participatingDepartments],
      replyTime: reply.replyTime,
    })),
    blockingError: null,
    nonBlockingError: error,
  };
}
