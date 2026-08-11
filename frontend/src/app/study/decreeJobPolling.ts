export interface ActiveDecreeJob {
  jobId: string;
  idempotencyKey: string;
}

export interface PendingDecreeSubmission {
  idempotencyKey: string;
  requestHash: string;
}

interface SafeStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const BACKOFF_SECONDS = [1, 2, 3, 5] as const;

export function activeJobStorageKey(userId: string): string {
  return `chaotang.study.active-decree-job.v1:${encodeURIComponent(userId)}`;
}

export function pendingSubmissionStorageKey(userId: string): string {
  return `chaotang.study.pending-decree-submission.v1:${encodeURIComponent(userId)}`;
}

export function savePendingSubmission(
  storage: SafeStorage,
  userId: string,
  pending: PendingDecreeSubmission,
): void {
  storage.setItem(pendingSubmissionStorageKey(userId), JSON.stringify(pending));
}

export function loadPendingSubmission(
  storage: SafeStorage,
  userId: string,
): PendingDecreeSubmission | null {
  const key = pendingSubmissionStorageKey(userId);
  const raw = storage.getItem(key);
  if (raw === null) return null;
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    if (
      Object.keys(value).length === 2 &&
      typeof value.idempotencyKey === "string" &&
      value.idempotencyKey.length > 0 &&
      value.idempotencyKey.length <= 128 &&
      typeof value.requestHash === "string" &&
      /^[0-9a-f]{64}$/.test(value.requestHash)
    ) {
      return { idempotencyKey: value.idempotencyKey, requestHash: value.requestHash };
    }
  } catch {
    // Invalid persisted state is removed below.
  }
  storage.removeItem(key);
  return null;
}

export function clearPendingSubmission(storage: SafeStorage, userId: string): void {
  storage.removeItem(pendingSubmissionStorageKey(userId));
}

export function nextPollDelayMs(retryAfter: string | null, attempt: number): number {
  if (retryAfter !== null && /^\d+$/.test(retryAfter)) {
    const seconds = Number(retryAfter);
    if (seconds > 0 && seconds <= 60) return seconds * 1000;
  }
  const index = Math.min(Math.max(0, attempt), BACKOFF_SECONDS.length - 1);
  return BACKOFF_SECONDS[index] * 1000;
}

export function saveActiveJob(
  storage: SafeStorage,
  userId: string,
  job: ActiveDecreeJob,
): void {
  storage.setItem(activeJobStorageKey(userId), JSON.stringify(job));
}

export function loadActiveJob(
  storage: SafeStorage,
  userId: string,
): ActiveDecreeJob | null {
  const key = activeJobStorageKey(userId);
  const raw = storage.getItem(key);
  if (raw === null) return null;
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    if (
      Object.keys(value).length === 2 &&
      typeof value.jobId === "string" &&
      /^[0-9a-f]{32}$/.test(value.jobId) &&
      typeof value.idempotencyKey === "string" &&
      value.idempotencyKey.length > 0 &&
      value.idempotencyKey.length <= 128
    ) {
      return { jobId: value.jobId, idempotencyKey: value.idempotencyKey };
    }
  } catch {
    // Invalid persisted state is removed below.
  }
  storage.removeItem(key);
  return null;
}

export function clearActiveJob(storage: SafeStorage, userId: string): void {
  storage.removeItem(activeJobStorageKey(userId));
}
