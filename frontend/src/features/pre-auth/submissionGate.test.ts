import assert from "node:assert/strict";
import test from "node:test";

import { createSubmissionGate } from "./submissionGate.ts";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

test("run becomes busy synchronously and ignores a duplicate until resolve", async () => {
  const busyStates: boolean[] = [];
  const pending = deferred<string>();
  let calls = 0;
  const gate = createSubmissionGate((busy) => busyStates.push(busy));

  const first = gate.run(() => {
    calls += 1;
    return pending.promise;
  });
  const duplicate = gate.run(() => {
    calls += 1;
    return Promise.resolve("duplicate");
  });

  assert.equal(gate.isBusy(), true);
  assert.equal(calls, 1);
  assert.equal(duplicate, undefined);
  assert.deepEqual(busyStates, [true]);

  pending.resolve("first");
  assert.equal(await first, "first");
  assert.equal(gate.isBusy(), false);
  assert.deepEqual(busyStates, [true, false]);
});

test("run restores and notifies the idle state after rejection", async () => {
  const busyStates: boolean[] = [];
  const pending = deferred<never>();
  const gate = createSubmissionGate((busy) => busyStates.push(busy));

  const run = gate.run(() => pending.promise);
  assert.ok(run);
  pending.reject(new Error("request failed"));

  await assert.rejects(run, /request failed/);
  assert.equal(gate.isBusy(), false);
  assert.deepEqual(busyStates, [true, false]);
});

test("run restores and notifies the idle state after a synchronous throw", async () => {
  const busyStates: boolean[] = [];
  const gate = createSubmissionGate((busy) => busyStates.push(busy));

  const run = gate.run(() => {
    throw new Error("synchronous failure");
  });

  assert.ok(run);
  await assert.rejects(run, /synchronous failure/);
  assert.equal(gate.isBusy(), false);
  assert.deepEqual(busyStates, [true, false]);
});
