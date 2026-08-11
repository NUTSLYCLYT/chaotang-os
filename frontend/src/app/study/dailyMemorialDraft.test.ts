
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  EMPTY_DAILY_MEMORIAL_STATE,
  canConfirmDailyMemorial,
  dailyMemorialPhaseLabel,
  requestDailyMemorialConfirmation,
  requestLatestDailyMemorial,
  resolveDailyMemorialLoad,
  runDailyMemorialConfirmation,
  type DailyMemorialUiState,
} from "./dailyMemorialDraft.ts";

const fingerprint = "a".repeat(64);
const draft = {
  id: "0123456789abcdef0123456789abcdef",
  reportDate: "2026-08-04",
  sourceWindowStart: "2026-08-04T00:00:00+08:00",
  sourceWindowEnd: "2026-08-05T00:00:00+08:00",
  version: 2,
  fingerprint,
  bureauResultCount: 39 as const,
  ministryResultCount: 6 as const,
  content: "据受控事实汇成的每日奏折。",
  factRefs: ["fact-1", "fact-2"],
};

test("daily memorial pure resolver maps null and every backend status", () => {
  assert.equal(resolveDailyMemorialLoad(null).phase, "idle");
  assert.equal(resolveDailyMemorialLoad({ status: "PENDING", draft: null, memorialId: null, failureCode: null }).phase, "loading");
  assert.equal(resolveDailyMemorialLoad({ status: "GENERATING", draft: null, memorialId: null, failureCode: null }).phase, "generating");
  assert.equal(resolveDailyMemorialLoad({ status: "SKIPPED_NO_FACTS", draft: null, memorialId: null, failureCode: null }).phase, "no_facts");
  assert.equal(resolveDailyMemorialLoad({ status: "FAILED", draft: null, memorialId: null, failureCode: "invocation_failed" }).phase, "failed");
  assert.equal(resolveDailyMemorialLoad({ status: "READY_FOR_REVIEW", draft, memorialId: null, failureCode: null }).phase, "ready");
  assert.equal(resolveDailyMemorialLoad({ status: "CONFIRMED", draft, memorialId: "memorial-1", failureCode: null }).phase, "confirmed");
});

test("only the exact current ready draft can be confirmed", () => {
  const ready = resolveDailyMemorialLoad({ status: "READY_FOR_REVIEW", draft, memorialId: null, failureCode: null });
  assert.equal(canConfirmDailyMemorial(ready), true);
  for (const state of [
    EMPTY_DAILY_MEMORIAL_STATE,
    { phase: "loading", draft: null, memorialId: null, message: "正在读取" },
    { ...ready, phase: "confirming" },
    { ...ready, phase: "error" },
    resolveDailyMemorialLoad({ status: "CONFIRMED", draft, memorialId: "memorial-1", failureCode: null }),
  ] as DailyMemorialUiState[]) {
    assert.equal(canConfirmDailyMemorial(state), false);
  }
});

test("latest request is GET-only and maps 401 without exposing backend details", async () => {
  let request: { input: string; init?: RequestInit } | undefined;
  const result = await requestLatestDailyMemorial(async (input, init) => {
    request = { input: String(input), init };
    return Response.json({ status: "error", reason: "unauthenticated", message: "private" }, { status: 401 });
  });
  assert.equal(request?.input, "/api/daily-memorial-drafts/latest");
  assert.equal(request?.init?.method, "GET");
  assert.deepEqual(result, { ok: false, kind: "unauthenticated" });
});

test("browser requests map every stable BFF error and network failure", async () => {
  const expected = new Map<number, string>([
    [401, "unauthenticated"], [404, "not_found"], [409, "conflict"], [503, "storage"], [400, "unknown"],
  ]);
  for (const [status, kind] of expected) {
    const result = await requestLatestDailyMemorial(async () => new Response("private", { status }));
    assert.deepEqual(result, { ok: false, kind });
  }
  assert.deepEqual(
    await requestLatestDailyMemorial(async () => { throw new Error("private"); }),
    { ok: false, kind: "network" },
  );
});

test("phase labels never call an idle, failed, or confirmed draft pending review", () => {
  assert.equal(dailyMemorialPhaseLabel("idle"), "未生成");
  assert.equal(dailyMemorialPhaseLabel("ready"), "待审");
  assert.equal(dailyMemorialPhaseLabel("failed"), "失败");
  assert.equal(dailyMemorialPhaseLabel("confirmed"), "已归档");
});

test("confirmation POST sends only the current version and fingerprint", async () => {
  let request: { input: string; init?: RequestInit } | undefined;
  const result = await requestDailyMemorialConfirmation(draft, async (input, init) => {
    request = { input: String(input), init };
    return Response.json({
      status: "ok",
      confirmation: { status: "CONFIRMED", draftId: draft.id, memorialId: "memorial-1" },
    });
  });
  assert.equal(request?.input, `/api/daily-memorial-drafts/${draft.id}/confirm`);
  assert.equal(request?.init?.method, "POST");
  assert.deepEqual(JSON.parse(String(request?.init?.body)), { version: 2, fingerprint });
  assert.deepEqual(result, { ok: true, data: { status: "CONFIRMED", draftId: draft.id, memorialId: "memorial-1" } });
});

test("confirmation never reports optimistic success for 409 or malformed success", async () => {
  const conflict = await requestDailyMemorialConfirmation(draft, async () =>
    Response.json({ status: "error", reason: "conflict", message: "private" }, { status: 409 }));
  const malformed = await requestDailyMemorialConfirmation(draft, async () =>
    Response.json({ status: "ok", confirmation: { status: "CONFIRMED", draftId: draft.id } }));
  assert.deepEqual(conflict, { ok: false, kind: "conflict" });
  assert.deepEqual(malformed, { ok: false, kind: "unknown" });
});

test("camel BFF success rejects every malformed strict draft field", async () => {
  const validLatest = {
    status: "READY_FOR_REVIEW",
    draft,
    memorialId: null,
    failureCode: null,
  };
  const malformedDrafts = [
    { ...draft, extra: true },
    { ...draft, id: "bad/id" },
    { ...draft, reportDate: "2026-02-30" },
    { ...draft, sourceWindowStart: "2026-08-04T00:00:00" },
    { ...draft, sourceWindowEnd: "2026-08-03T00:00:00+08:00" },
    { ...draft, version: 0 },
    { ...draft, version: Number.MAX_SAFE_INTEGER + 1 },
    { ...draft, fingerprint: "A".repeat(64) },
    { ...draft, bureauResultCount: 38 },
    { ...draft, ministryResultCount: 5 },
    { ...draft, content: "   " },
    { ...draft, factRefs: [] },
    { ...draft, factRefs: ["fact-1", "fact-1"] },
    { ...draft, factRefs: [" fact-1"] },
    { ...draft, factRefs: ["bad/fact"] },
  ];
  for (const malformed of malformedDrafts) {
    const result = await requestLatestDailyMemorial(async () => Response.json({
      status: "ok",
      latest: { ...validLatest, draft: malformed },
    }));
    assert.deepEqual(result, { ok: false, kind: "unknown" });
  }
});

test("camel BFF success preserves one complete valid ready draft", async () => {
  const latest = { status: "READY_FOR_REVIEW", draft, memorialId: null, failureCode: null } as const;
  assert.deepEqual(
    await requestLatestDailyMemorial(async () => Response.json({ status: "ok", latest })),
    { ok: true, data: latest },
  );
});

test("camel BFF success preserves a lowercase stable failure code", async () => {
  const latest = {
    status: "FAILED",
    draft: null,
    memorialId: null,
    failureCode: "invocation_failed",
  } as const;
  const result = await requestLatestDailyMemorial(async () =>
    Response.json({ status: "ok", latest }));

  assert.deepEqual(result, { ok: true, data: latest });
  assert.equal(result.ok && resolveDailyMemorialLoad(result.data).phase, "failed");
});

test("camel BFF success enforces status nullability and strict confirmation IDs", async () => {
  const invalidLatest = [
    { status: "READY_FOR_REVIEW", draft: null, memorialId: null, failureCode: null },
    { status: "CONFIRMED", draft, memorialId: null, failureCode: null },
    { status: "FAILED", draft: null, memorialId: null, failureCode: null },
    { status: "GENERATING", draft: null, memorialId: "memorial-1", failureCode: null },
  ];
  for (const latest of invalidLatest) {
    assert.deepEqual(
      await requestLatestDailyMemorial(async () => Response.json({ status: "ok", latest })),
      { ok: false, kind: "unknown" },
    );
  }
  for (const confirmation of [
    { status: "CONFIRMED", draftId: "bad/id", memorialId: "memorial-1" },
    { status: "CONFIRMED", draftId: draft.id, memorialId: "bad/id" },
    { status: "CONFIRMED", draftId: draft.id, memorialId: " memorial-1" },
  ]) {
    assert.deepEqual(
      await requestDailyMemorialConfirmation(draft, async () => Response.json({ status: "ok", confirmation })),
      { ok: false, kind: "unknown" },
    );
  }
});

test("409 confirmation refreshes once and never retries the stale POST", async () => {
  const ready = resolveDailyMemorialLoad({ status: "READY_FOR_REVIEW", draft, memorialId: null, failureCode: null });
  let current = ready;
  let posts = 0;
  const refreshMessages: string[] = [];
  const handled = await runDailyMemorialConfirmation({
    state: ready,
    getCurrentState: () => current,
    commit: (state) => { current = state; },
    request: async () => { posts += 1; return { ok: false, kind: "conflict" }; },
    refresh: async (message) => { refreshMessages.push(message); },
    scheduleRedirect: () => assert.fail("must not redirect"),
  });
  assert.equal(handled, true);
  assert.equal(posts, 1);
  assert.deepEqual(refreshMessages, ["草稿已更新，请重新审阅"]);
  assert.equal(current.phase, "confirming");
});

test("confirmation commits server memorial id only for the unchanged current draft", async () => {
  const ready = resolveDailyMemorialLoad({ status: "READY_FOR_REVIEW", draft, memorialId: null, failureCode: null });
  let current = ready;
  await runDailyMemorialConfirmation({
    state: ready,
    getCurrentState: () => current,
    commit: (state) => { current = state; },
    request: async () => ({ ok: true, data: { status: "CONFIRMED", draftId: draft.id, memorialId: "server-memorial" } }),
    refresh: async () => assert.fail("must not refresh"),
    scheduleRedirect: () => assert.fail("must not redirect"),
  });
  assert.equal(current.phase, "confirmed");
  assert.equal(current.memorialId, "server-memorial");
});

test("confirmation ignores success when current version changes with the same id and fingerprint", async () => {
  const ready = resolveDailyMemorialLoad({ status: "READY_FOR_REVIEW", draft, memorialId: null, failureCode: null });
  let current = ready;
  const handled = await runDailyMemorialConfirmation({
    state: ready,
    getCurrentState: () => current,
    commit: (state) => { current = state; },
    request: async () => {
      current = { ...ready, draft: { ...draft, version: 3 } };
      return { ok: true, data: { status: "CONFIRMED", draftId: draft.id, memorialId: "server-memorial" } };
    },
    refresh: async () => assert.fail("must not refresh"),
    scheduleRedirect: () => assert.fail("must not redirect"),
  });
  assert.equal(handled, false);
  assert.equal(current.phase, "ready");
  assert.equal(current.draft?.version, 3);
  assert.equal(current.memorialId, null);
});

test("401 confirmation redirects to protected study login without confirmed state", async () => {
  const ready = resolveDailyMemorialLoad({ status: "READY_FOR_REVIEW", draft, memorialId: null, failureCode: null });
  let current = ready;
  const redirects: string[] = [];
  await runDailyMemorialConfirmation({
    state: ready,
    getCurrentState: () => current,
    commit: (state) => { current = state; },
    request: async () => ({ ok: false, kind: "unauthenticated" }),
    refresh: async () => assert.fail("must not refresh"),
    scheduleRedirect: (path) => redirects.push(path),
  });
  assert.deepEqual(redirects, ["/login?next=%2Fstudy"]);
  assert.equal(current.phase, "error");
  assert.equal(current.memorialId, null);
});

test("StudyClient source mounts a read but confirmation remains click-only", async () => {
  const source = await readFile(new URL("./StudyClient.tsx", import.meta.url), "utf8");
  assert.match(source, /useEffect\([\s\S]*?requestLatestDailyMemorial/);
  assert.match(source, /onConfirmDailyMemorial=/);
  assert.doesNotMatch(source, /useEffect\([\s\S]{0,400}?requestDailyMemorialConfirmation/);
  assert.doesNotMatch(source, /onRetryDailyMemorial=\{[^}]*requestDailyMemorialConfirmation/);
});
