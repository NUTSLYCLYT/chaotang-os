import assert from "node:assert/strict";
import test from "node:test";

import {
  createJunjichuController,
  decodeReplyCasesPayload,
  type JunjichuControllerState,
} from "./junjichuController.ts";

const ARCHIVE = {
  id: "reply-1",
  type: "REPLY",
  title: "赈务回奏",
  participatingDepartments: ["户部", "工部"],
  replyProcess: "丞相 → 户部 → 工部 → 丞相",
  replyConclusion: "准予施行。",
  replyTime: "2026-07-24T08:00:00+00:00",
  respondent: "丞相",
};

const okResponse = (archives: unknown[]) =>
  new Response(JSON.stringify({ status: "ok", archives }), { status: 200 });
const settle = () => new Promise<void>((resolve) => setImmediate(resolve));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function harness(fetch: typeof globalThis.fetch) {
  const states: JunjichuControllerState[] = [];
  const redirects: string[] = [];
  const scheduled: Array<() => void> = [];
  const controller = createJunjichuController({
    fetch,
    redirect: (location) => redirects.push(location),
    schedule: (task) => scheduled.push(task),
  });
  const disconnect = controller.connect((state) => states.push(state));
  return {
    controller,
    disconnect,
    states,
    redirects,
    flushScheduled: () => scheduled.splice(0).forEach((task) => task()),
  };
}

test("decoder accepts only a wholly valid strict REPLY response", () => {
  assert.deepEqual(decodeReplyCasesPayload({ status: "ok", archives: [ARCHIVE] }), [{
    id: "reply-1",
    title: "赈务回奏",
    departments: ["户部", "工部"],
    process: "丞相 → 户部 → 工部 → 丞相",
    conclusion: "准予施行。",
    repliedAt: "2026-07-24T08:00:00+00:00",
    respondent: "丞相",
  }]);
  for (const payload of [
    null,
    [],
    { status: "error", archives: [] },
    { status: "ok", archives: null },
    { status: "ok", archives: [ARCHIVE, { ...ARCHIVE, id: " " }] },
  ]) {
    assert.equal(decodeReplyCasesPayload(payload), null);
  }
});

test("controller uses one protected GET and publishes ready and empty states", async () => {
  const calls: Array<{ input: string; init?: RequestInit }> = [];
  const ready = harness(async (input, init) => {
    calls.push({ input: String(input), init });
    return okResponse([ARCHIVE]);
  });
  ready.controller.start();
  await settle();
  assert.equal(ready.controller.state.status, "ready");
  assert.equal(ready.controller.state.selectedId, "reply-1");
  assert.equal(calls[0]?.input, "/api/shiguan/archives?type=REPLY&limit=100");
  assert.equal(calls[0]?.init?.cache, "no-store");

  const empty = harness(async () => okResponse([]));
  empty.controller.start();
  await settle();
  assert.equal(empty.controller.state.status, "empty");
});

test("malformed payload errors and retry aborts stale work before recovering", async () => {
  const first = deferred<Response>();
  const second = deferred<Response>();
  const signals: AbortSignal[] = [];
  let calls = 0;
  const view = harness((_input, init) => {
    signals.push(init?.signal as AbortSignal);
    calls += 1;
    return calls === 1 ? first.promise : second.promise;
  });
  view.controller.start();
  view.controller.retry();
  assert.equal(signals[0]?.aborted, true);
  second.resolve(okResponse([{ ...ARCHIVE, id: "new" }]));
  await settle();
  first.resolve(okResponse([{ ...ARCHIVE, id: "old" }]));
  await settle();
  assert.equal(view.controller.state.selectedId, "new");
});

test("401 redirects only while connected and real disconnect aborts late state", async () => {
  const live = harness(async () => new Response(null, { status: 401 }));
  live.controller.start();
  await settle();
  live.flushScheduled();
  assert.deepEqual(live.redirects, ["/login?next=%2Fjunjichu"]);

  const response = deferred<Response>();
  const disconnected = harness(() => response.promise);
  disconnected.controller.start();
  disconnected.disconnect();
  response.resolve(new Response(null, { status: 401 }));
  await settle();
  disconnected.flushScheduled();
  assert.deepEqual(disconnected.redirects, []);
});

test("Strict Mode replay reuses the initial in-flight load", async () => {
  const response = deferred<Response>();
  let calls = 0;
  const view = harness(() => {
    calls += 1;
    return response.promise;
  });
  view.controller.start();
  view.disconnect();
  view.controller.connect(() => undefined);
  view.controller.start();
  view.flushScheduled();
  assert.equal(calls, 1);
  response.resolve(okResponse([ARCHIVE]));
  await settle();
  assert.equal(view.controller.state.status, "ready");
});
