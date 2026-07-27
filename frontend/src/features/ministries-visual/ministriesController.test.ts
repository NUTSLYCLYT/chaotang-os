import assert from "node:assert/strict";
import test from "node:test";

import { createMinistriesController, decodeReplyCasesPayload } from "./ministriesController.ts";

const ARCHIVE = {
  id: "reply-1",
  type: "REPLY",
  title: "真实回奏",
  participatingDepartments: ["户部"],
  replyProcess: "丞相 → 户部 → 丞相",
  replyConclusion: "准予施行。",
  replyTime: "2026-07-24T08:00:00+00:00",
  respondent: "丞相",
};
const response = (archives: unknown[]) =>
  new Response(JSON.stringify({ status: "ok", archives }), { status: 200 });
const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

test("decoder rejects any partially invalid REPLY payload", () => {
  assert.equal(decodeReplyCasesPayload(null), null);
  assert.equal(
    decodeReplyCasesPayload({ status: "ok", archives: [ARCHIVE, { ...ARCHIVE, id: " " }] }),
    null,
  );
  assert.deepEqual(
    decodeReplyCasesPayload({ status: "ok", archives: [ARCHIVE] })?.map((item) => item.id),
    ["reply-1"],
  );
});

test("controller publishes ready and empty through the protected no-store GET", async () => {
  const calls: Array<{ input: string; init: RequestInit }> = [];
  const responses = [response([ARCHIVE]), response([])];
  const controller = createMinistriesController({
    fetch: async (input, init) => {
      calls.push({ input, init });
      return responses.shift()!;
    },
    redirect: () => assert.fail("must not redirect"),
  });
  controller.connect(() => undefined);
  controller.start();
  await flush();
  assert.equal(controller.state.status, "ready");
  controller.retry();
  await flush();
  assert.equal(controller.state.status, "empty");
  assert.deepEqual(calls.map((call) => call.input), [
    "/api/shiguan/archives?type=REPLY&limit=100",
    "/api/shiguan/archives?type=REPLY&limit=100",
  ]);
  assert.ok(calls.every((call) => call.init.cache === "no-store"));
});

test("retry aborts stale requests and newest generation wins", async () => {
  const first = deferred<Response>();
  const second = deferred<Response>();
  const signals: AbortSignal[] = [];
  let call = 0;
  const controller = createMinistriesController({
    fetch: (_input, init) => {
      signals.push(init.signal);
      return [first, second][call++].promise;
    },
    redirect: () => undefined,
  });
  controller.connect(() => undefined);
  controller.start();
  controller.retry();
  assert.equal(signals[0]?.aborted, true);
  second.resolve(response([{ ...ARCHIVE, id: "new" }]));
  await flush();
  first.resolve(response([{ ...ARCHIVE, id: "old" }]));
  await flush();
  assert.equal(controller.state.cases?.[0]?.id, "new");
});

test("401 redirects only while connected and disconnect aborts late state", async () => {
  const pending = deferred<Response>();
  const redirects: string[] = [];
  const scheduled: Array<() => void> = [];
  let signal: AbortSignal | undefined;
  const controller = createMinistriesController({
    fetch: (_input, init) => {
      signal = init.signal;
      return pending.promise;
    },
    redirect: (location) => redirects.push(location),
    schedule: (task) => scheduled.push(task),
  });
  const disconnect = controller.connect(() => undefined);
  controller.start();
  disconnect();
  pending.resolve(new Response(null, { status: 401 }));
  await flush();
  scheduled.splice(0).forEach((task) => task());
  assert.deepEqual(redirects, []);
  assert.equal(signal?.aborted, true);

  const liveRedirects: string[] = [];
  const live = createMinistriesController({
    fetch: async () => new Response(null, { status: 401 }),
    redirect: (location) => liveRedirects.push(location),
    schedule: (task) => scheduled.push(task),
  });
  live.connect(() => undefined);
  live.start();
  await flush();
  scheduled.splice(0).forEach((task) => task());
  assert.deepEqual(liveRedirects, ["/login"]);
});
