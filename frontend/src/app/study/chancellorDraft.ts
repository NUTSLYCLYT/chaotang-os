export type ChancellorDraftStatus =
  | "CLARIFYING"
  | "DRAFT_READY"
  | "NEEDS_INPUT"
  | "PARTIAL"
  | "ISSUE_BLOCKED"
  | "ISSUED"
  | "EXECUTING"
  | "RETURNED";

export interface ChancellorDraftResult {
  status: ChancellorDraftStatus;
  version: number;
  fingerprint: string;
  understanding: string;
  expert_example: string;
  recommendation_reason: string;
  assumptions: string[];
  revision_prompt: string;
  draft: Record<string, unknown> | null;
  decree_text: string | null;
}

export async function requestChancellorDraft(
  content: string,
  version: number,
  fetchImpl: typeof fetch,
): Promise<
  | { ok: true; draft: ChancellorDraftResult }
  | { ok: false; unauthenticated?: boolean }
> {
  try {
    const response = await fetchImpl("/api/drafts/chancellor", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: content.trim() }],
        version,
      }),
    });
    if (response.status === 401) return { ok: false, unauthenticated: true };
    if (!response.ok) return { ok: false };
    const body = await response.json() as ChancellorDraftResult;
    if (
      typeof body.understanding !== "string" ||
      typeof body.expert_example !== "string" ||
      typeof body.fingerprint !== "string" ||
      typeof body.version !== "number"
    ) {
      return { ok: false };
    }
    return { ok: true, draft: body };
  } catch {
    return { ok: false };
  }
}

export function canIssueChancellorDraft(
  draft: ChancellorDraftResult | null,
): boolean {
  return draft?.status === "DRAFT_READY" &&
    draft.draft !== null &&
    typeof draft.decree_text === "string" &&
    Boolean(draft.decree_text.trim());
}
