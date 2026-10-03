import assert from "node:assert/strict";
import test from "node:test";

import {
  activeJobStorageKey,
  clearInvalidActiveJob,
  loadActiveJob,
  loadPendingSubmission,
  nextPollDelayMs,
  pendingSubmissionStorageKey,
  readPendingSubmission,
  saveActiveJob,
  savePendingSubmission,
} from "./decreeJobPolling.ts";

class MemoryStorage {
  values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

test("poll delay honors Retry-After then uses bounded 1/2/3/5 second backoff", () => {
  assert.equal(nextPollDelayMs("7", 0), 7000);
  assert.deepEqual(
    [0, 1, 2, 3, 8].map((attempt) => nextPollDelayMs(null, attempt)),
    [1000, 2000, 3000, 5000, 5000],
  );
});

test("active and pending refresh state are owner-namespaced and contain only safe identifiers", () => {
  const storage = new MemoryStorage();
  saveActiveJob(storage, "user-a", { jobId: "a".repeat(32), idempotencyKey: "key-a" });
  savePendingSubmission(storage, "user-a", {
    idempotencyKey: "key-a",
    requestHash: "b".repeat(64),
  });

  assert.deepEqual(loadActiveJob(storage, "user-a"), {
    jobId: "a".repeat(32),
    idempotencyKey: "key-a",
  });
  assert.deepEqual(loadPendingSubmission(storage, "user-a"), {
    idempotencyKey: "key-a",
    requestHash: "b".repeat(64),
  });
  assert.equal(loadActiveJob(storage, "user-b"), null);
  assert.equal(loadPendingSubmission(storage, "user-b"), null);
  assert.deepEqual(
    Object.keys(JSON.parse(storage.getItem(activeJobStorageKey("user-a")) ?? "{}")).sort(),
    ["idempotencyKey", "jobId"],
  );
  assert.deepEqual(
    Object.keys(JSON.parse(storage.getItem(pendingSubmissionStorageKey("user-a")) ?? "{}")).sort(),
    ["idempotencyKey", "requestHash"],
  );
});

test("render-phase reads are side-effect free and leave invalid persisted state in place", () => {
  const storage = new MemoryStorage();
  const activeKey = activeJobStorageKey("user-a");
  const pendingKey = pendingSubmissionStorageKey("user-a");
  const invalidActive = JSON.stringify({ jobId: "not-a-job", idempotencyKey: "key-a" });
  const invalidPending = JSON.stringify({ idempotencyKey: "key-a", requestHash: "not-a-hash" });
  storage.setItem(activeKey, invalidActive);
  storage.setItem(pendingKey, invalidPending);

  assert.equal(loadActiveJob(storage, "user-a"), null);
  assert.equal(readPendingSubmission(storage, "user-a"), null);
  assert.equal(storage.getItem(activeKey), invalidActive);
  assert.equal(storage.getItem(pendingKey), invalidPending);
});

test("active load flows still remove invalid persisted state", () => {
  const storage = new MemoryStorage();
  const activeKey = activeJobStorageKey("user-a");
  const pendingKey = pendingSubmissionStorageKey("user-a");
  storage.setItem(activeKey, JSON.stringify({ jobId: "not-a-job", idempotencyKey: "key-a" }));
  storage.setItem(pendingKey, JSON.stringify({ idempotencyKey: "key-a", requestHash: "not-a-hash" }));

  clearInvalidActiveJob(storage, "user-a");
  assert.equal(storage.getItem(activeKey), null);

  assert.equal(loadPendingSubmission(storage, "user-a"), null);
  assert.equal(storage.getItem(pendingKey), null);
});

test("active cleanup leaves absent and valid active jobs untouched", () => {
  const storage = new MemoryStorage();
  clearInvalidActiveJob(storage, "user-a");
  assert.equal(storage.getItem(activeJobStorageKey("user-a")), null);

  saveActiveJob(storage, "user-a", { jobId: "a".repeat(32), idempotencyKey: "key-a" });
  clearInvalidActiveJob(storage, "user-a");
  assert.deepEqual(loadActiveJob(storage, "user-a"), {
    jobId: "a".repeat(32),
    idempotencyKey: "key-a",
  });
});
