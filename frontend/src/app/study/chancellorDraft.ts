export type ChancellorDraftStatus =
  | "CLARIFYING"
  | "DRAFT_READY"
  | "NEEDS_INPUT"
  | "PARTIAL"
  | "ISSUE_BLOCKED"
  | "ISSUED"
  | "EXECUTING"
  | "RETURNED";

export interface ChancellorDraftDepartment {
  department: string;
  bureaus: string[];
  role: string;
  reason: string;
  responsibility: string;
  expected_output: string;
}

export interface DraftDepartmentDisplayRow {
  department: string;
  bureaus: string;
  role: string;
  reason: string;
  responsibility: string;
  expectedOutput: string;
}

export function draftDepartmentDisplayRows(
  departments: readonly ChancellorDraftDepartment[],
): DraftDepartmentDisplayRow[] {
  return departments.map((item) => ({
    department: item.department,
    bureaus: item.bureaus.join("、"),
    role: item.role,
    reason: item.reason,
    responsibility: item.responsibility,
    expectedOutput: item.expected_output,
  }));
}

export interface ChancellorDraftEdict {
  objective: string;
  scope: string[];
  exclusions: string[];
  input_materials: string[];
  material_gaps: string[];
  key_questions: string[];
  departments: ChancellorDraftDepartment[];
  execution_steps: string[];
  deliverables: string[];
  completion_criteria: string[];
  permissions_and_limits: string[];
  current_status: ChancellorDraftStatus;
}

export interface ChancellorDraftResult {
  status: ChancellorDraftStatus;
  version: number;
  fingerprint: string;
  understanding: string;
  expert_example: string;
  recommendation_reason: string;
  assumptions: string[];
  revision_prompt: string;
  draft: ChancellorDraftEdict | null;
  decree_text: string | null;
}

export interface ChancellorDraftComposerState {
  decreeText: string;
  draftResult: ChancellorDraftResult | null;
  draftPending: boolean;
  draftError: string | null;
}

export interface OwnerScopedChancellorDraftComposerState {
  ownerId: string;
  value: ChancellorDraftComposerState;
}

export const EMPTY_CHANCELLOR_DRAFT_COMPOSER_STATE: ChancellorDraftComposerState = {
  decreeText: "",
  draftResult: null,
  draftPending: false,
  draftError: null,
};

export function resolveOwnerScopedChancellorDraftComposerState(
  envelope: OwnerScopedChancellorDraftComposerState,
  currentOwnerId: string,
): ChancellorDraftComposerState {
  return envelope.ownerId === currentOwnerId
    ? envelope.value
    : EMPTY_CHANCELLOR_DRAFT_COMPOSER_STATE;
}

export interface DraftConfirmationProjection {
  visibleCanonicalText: string;
  showIssueAction: boolean;
}

export function projectDraftConfirmation(
  draft: ChancellorDraftResult,
): DraftConfirmationProjection {
  return {
    visibleCanonicalText: draft.expert_example,
    showIssueAction: draft.status === "DRAFT_READY",
  };
}

export const MAX_DECREE_TEXT_LENGTH = 2000;

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
      typeof body.version !== "number" ||
      (body.status === "DRAFT_READY"
        ? typeof body.decree_text !== "string" ||
          body.draft === null ||
          body.decree_text !== body.expert_example
        : body.decree_text !== undefined && body.decree_text !== null)
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
  if (
    draft?.status !== "DRAFT_READY" ||
    draft.draft === null ||
    typeof draft.decree_text !== "string"
  ) {
    return false;
  }
  const normalizedLength = draft.decree_text.trim().length;
  return normalizedLength >= 1 &&
    normalizedLength <= MAX_DECREE_TEXT_LENGTH;
}
