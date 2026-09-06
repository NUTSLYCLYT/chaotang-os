/** A browser confirmation snapshot, never a replacement for server authority. */
export interface StudyIntentSnapshot {
  readonly ownerId: string;
  readonly normalizedOriginalGoal: string;
  readonly exactLatestChancellorRestatement: string;
  readonly consultationGeneration: number;
  readonly contextGeneration: number;
}

declare const confirmedIntent: unique symbol;
export type ConfirmedStudyIntent = Readonly<StudyIntentSnapshot> & {
  readonly [confirmedIntent]: true;
};

// An untrusted clone/JSON or a TypeScript cast cannot masquerade as a UI confirmation.
const confirmedSnapshots = new WeakSet<object>();

export function captureStudyIntent(source: StudyIntentSnapshot): StudyIntentSnapshot | null {
  if (
    typeof source.ownerId !== "string" || !source.ownerId.trim() ||
    typeof source.normalizedOriginalGoal !== "string" ||
    !source.normalizedOriginalGoal.trim() ||
    typeof source.exactLatestChancellorRestatement !== "string" ||
    !source.exactLatestChancellorRestatement.trim() ||
    !Number.isSafeInteger(source.consultationGeneration) || source.consultationGeneration < 0 ||
    !Number.isSafeInteger(source.contextGeneration) || source.contextGeneration < 0
  ) return null;
  return Object.freeze({
    ownerId: source.ownerId,
    normalizedOriginalGoal: source.normalizedOriginalGoal.trim(),
    exactLatestChancellorRestatement: source.exactLatestChancellorRestatement.trim(),
    consultationGeneration: source.consultationGeneration,
    contextGeneration: source.contextGeneration,
  });
}

export function isStudyIntentCurrent(
  snapshot: StudyIntentSnapshot | null,
  current: StudyIntentSnapshot,
): boolean {
  if (!snapshot) return false;
  const latest = captureStudyIntent(current);
  return latest !== null && snapshot.ownerId === latest.ownerId &&
    snapshot.normalizedOriginalGoal === latest.normalizedOriginalGoal &&
    snapshot.exactLatestChancellorRestatement === latest.exactLatestChancellorRestatement &&
    snapshot.consultationGeneration === latest.consultationGeneration &&
    snapshot.contextGeneration === latest.contextGeneration;
}

/** Call only from the explicit confirm action, with a fresh current-source snapshot. */
export function confirmStudyIntent(
  snapshot: StudyIntentSnapshot,
  current: StudyIntentSnapshot,
): ConfirmedStudyIntent | null {
  const frozen = captureStudyIntent(snapshot);
  if (!isStudyIntentCurrent(frozen, current) || frozen === null) return null;
  confirmedSnapshots.add(frozen);
  return frozen as ConfirmedStudyIntent;
}

export function confirmedStudyDraftText(input: ConfirmedStudyIntent): string | null {
  if (typeof input !== "object" || input === null || !confirmedSnapshots.has(input)) return null;
  return "[用户原始目标]\n" + input.normalizedOriginalGoal +
    "\n\n[用户已确认的丞相理解]\n" + input.exactLatestChancellorRestatement;
}
