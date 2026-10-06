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

function parsePendingSubmission(raw: string): PendingDecreeSubmission | null {
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
    // Fall through to null.
  }
  return null;
}

/**
 * Side-effect-free read for render paths: invalid persisted state fails closed
 * to `null` but is left in place, so rendering never mutates storage.
 */
export function readPendingSubmission(
  storage: SafeStorage,
  userId: string,
): PendingDecreeSubmission | null {
  const raw = storage.getItem(pendingSubmissionStorageKey(userId));
  if (raw === null) return null;
  return parsePendingSubmission(raw);
}

/**
 * Active load used by the submission flow: reads and removes invalid state.
 */
export function loadPendingSubmission(
  storage: SafeStorage,
  userId: string,
): PendingDecreeSubmission | null {
  const key = pendingSubmissionStorageKey(userId);
  const raw = storage.getItem(key);
  if (raw === null) return null;
  const value = parsePendingSubmission(raw);
  if (value !== null) return value;
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

function parseActiveJob(raw: string): ActiveDecreeJob | null {
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
    // Fall through to null.
  }
  return null;
}

/**
 * Side-effect-free read for render paths: invalid persisted state fails closed
 * to `null` but is left in place, so rendering never mutates storage. Active
 * load flows call {@link clearInvalidActiveJob} separately to prune it.
 */
export function loadActiveJob(
  storage: SafeStorage,
  userId: string,
): ActiveDecreeJob | null {
  const raw = storage.getItem(activeJobStorageKey(userId));
  if (raw === null) return null;
  return parseActiveJob(raw);
}

/**
 * Active cleanup used by load flows (resume/retry): removes only a present but
 * invalid active job entry, leaving absent and valid state untouched.
 */
export function clearInvalidActiveJob(storage: SafeStorage, userId: string): void {
  const key = activeJobStorageKey(userId);
  const raw = storage.getItem(key);
  if (raw === null) return;
  if (parseActiveJob(raw) === null) storage.removeItem(key);
}

export function clearActiveJob(storage: SafeStorage, userId: string): void {
  storage.removeItem(activeJobStorageKey(userId));
}
