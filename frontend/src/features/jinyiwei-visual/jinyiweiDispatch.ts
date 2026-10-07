import type { JinyiweiDetail } from "../../lib/backendClient";

export type FactDispatchInput = Pick<
  JinyiweiDetail,
  "request" | "evidenceByFact" | "resolvedFacts" | "adoptions"
>;

export type FactDispatchRow = {
  factKey: string;
  description: string;
  evidenceCount: number;
  relatedReplyCount: number;
  status: "RESOLVED" | "PENDING" | "NO_EVIDENCE";
};

export function dispatchStatusLabel(status: FactDispatchRow["status"]): string {
  return ({ RESOLVED: "已核验", PENDING: "待核验", NO_EVIDENCE: "尚无证据" } as const)[status];
}

/**
 * Build the read-only “fact → evidence → reply” spine from the server-checked
 * case detail. An empty evidence group remains NO_EVIDENCE; it is never
 * promoted to a conclusion by the presentation layer.
 */
export function buildFactDispatchRows(detail: FactDispatchInput): FactDispatchRow[] {
  const resolved = new Set(detail.resolvedFacts);
  const repliesByEvidence = new Map<string, Set<string>>();
  for (const adoption of detail.adoptions) {
    const replies = repliesByEvidence.get(adoption.evidenceId) ?? new Set<string>();
    replies.add(adoption.replyId);
    repliesByEvidence.set(adoption.evidenceId, replies);
  }

  return detail.request.requiredFacts.map((fact) => {
    const evidence = detail.evidenceByFact[fact.key] ?? [];
    const relatedReplies = new Set<string>();
    for (const item of evidence) {
      for (const replyId of repliesByEvidence.get(item.evidenceId) ?? []) {
        relatedReplies.add(replyId);
      }
    }
    return {
      factKey: fact.key,
      description: fact.description,
      evidenceCount: evidence.length,
      relatedReplyCount: relatedReplies.size,
      status: evidence.length === 0
        ? "NO_EVIDENCE"
        : resolved.has(fact.key) ? "RESOLVED" : "PENDING",
    };
  });
}
