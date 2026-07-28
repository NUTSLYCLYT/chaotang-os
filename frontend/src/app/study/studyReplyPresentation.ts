import type { ShiguanArchive } from "../../lib/backendClient.ts";

export type StudyReplyPresentation =
  | { source: "current" }
  | { source: "archive"; archiveId: string };

export const CURRENT_REPLY_PRESENTATION: StudyReplyPresentation = {
  source: "current",
};

export function selectArchivedReply(archiveId: string): StudyReplyPresentation {
  return { source: "archive", archiveId };
}

export function resetToCurrentReply(): StudyReplyPresentation {
  return CURRENT_REPLY_PRESENTATION;
}

export function resolveSelectedArchive(
  presentation: StudyReplyPresentation,
  archives: ShiguanArchive[],
): ShiguanArchive | null {
  if (presentation.source !== "archive") return null;
  return archives.find((archive) => archive.id === presentation.archiveId) ?? null;
}
