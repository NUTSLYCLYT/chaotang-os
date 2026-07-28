import assert from "node:assert/strict";
import test from "node:test";

import type { ShiguanArchive } from "../../lib/backendClient.ts";
import {
  EMPTY_STUDY_RECENT_REPLIES_STATE,
  beginStudyRecentRepliesLoad,
  invalidateStudyRecentReplies,
  requestStudyRecentReplies,
  resolveStudyRecentReplies,
  toggleStudyRecentReply,
} from "./studyRecentReplies.ts";

function reply(id: string): ShiguanArchive {
  return {
    id,
    type: "REPLY",
    title: `Reply ${id}`,
    content: "Complete reply",
    matterType: "Transport",
    department: "Revenue",
    relatedArchiveIds: [],
    evidence: [],
    createdAt: "2026-07-28T08:00:00Z",
    lessonsLearned: null,
    pitfalls: null,
    sourceKind: "DECREE",
    sourceText: "Decree text",
    participatingDepartments: ["Revenue"],
    replyProcess: "Chancellor -> Revenue -> Chancellor",
    replyConclusion: "Approved",
    replyTime: "2026-07-28T09:00:00Z",
    respondent: "Chancellor",
    reviewStatus: null,
    evidenceReferences: [],
  };
}

test("requests the three most recent replies with the fixed same-origin GET contract", async () => {
  let input: string | URL | Request = "";
  let init: RequestInit | undefined;

  const result = await requestStudyRecentReplies(async (actualInput, actualInit) => {
    input = actualInput;
    init = actualInit;
    return Response.json({
      status: "ok",
      archives: [reply("reply-1"), reply("reply-2"), reply("reply-3")],
    });
  });

  assert.equal(input, "/api/shiguan/archives?type=REPLY&limit=3");
  assert.equal(init?.method, "GET");
  assert.deepEqual(result, {
    ok: true,
    archives: [reply("reply-1"), reply("reply-2"), reply("reply-3")],
  });
});

test("maps 401 before decoding the response body", async () => {
  let jsonCalls = 0;
  const result = await requestStudyRecentReplies(async () => ({
    status: 401,
    ok: false,
    json() {
      jsonCalls += 1;
      throw new Error("must not decode");
    },
  }) as unknown as Response);

  assert.equal(jsonCalls, 0);
  assert.deepEqual(result, {
    ok: false,
    kind: "unauthenticated",
    message: "会话已过期，请重新登录",
  });
});

test("maps transport failures to a stable network error", async () => {
  const result = await requestStudyRecentReplies(async () => {
    throw new Error("private upstream detail");
  });

  assert.deepEqual(result, {
    ok: false,
    kind: "network",
    message: "无法读取最近回奏，请稍后重试",
  });
});

test("maps non-200 and non-JSON responses to a stable unknown error", async () => {
  for (const response of [
    Response.json({ status: "error", message: "private detail" }, { status: 503 }),
    new Response("<html>not json</html>", { status: 200 }),
  ]) {
    assert.deepEqual(await requestStudyRecentReplies(async () => response), {
      ok: false,
      kind: "unknown",
      message: "最近回奏响应不完整，请稍后重试",
    });
  }
});

test("rejects envelopes that are not exactly status ok with at most three complete replies", async () => {
  const invalidBodies = [
    { status: "error", archives: [] },
    { status: "ok", archives: [], extra: true },
    { status: "ok", archives: [{ ...reply("memorial-1"), type: "MEMORIAL" }] },
    {
      status: "ok",
      archives: [
        reply("reply-1"),
        reply("reply-2"),
        reply("reply-3"),
        reply("reply-4"),
      ],
    },
    {
      status: "ok",
      archives: [{
        ...reply("reply-1"),
        reviewStatus: { status: "ACHIEVED" },
      }],
    },
  ];

  for (const body of invalidBodies) {
    assert.deepEqual(
      await requestStudyRecentReplies(async () => Response.json(body)),
      {
        ok: false,
        kind: "unknown",
        message: "最近回奏响应不完整，请稍后重试",
      },
    );
  }
});

test("starts idle state as stale and requests the first load", () => {
  assert.deepEqual(EMPTY_STUDY_RECENT_REPLIES_STATE, {
    phase: "idle",
    archives: [],
    stale: true,
    generation: 0,
    selectedArchiveId: null,
    message: null,
  });
  assert.deepEqual(
    beginStudyRecentRepliesLoad(EMPTY_STUDY_RECENT_REPLIES_STATE),
    {
      shouldRequest: true,
      generation: 0,
      state: {
        phase: "loading",
        archives: [],
        stale: true,
        generation: 0,
        selectedArchiveId: null,
        message: null,
      },
    },
  );
});

test("does not request a fresh ready state again", () => {
  const state = {
    ...EMPTY_STUDY_RECENT_REPLIES_STATE,
    phase: "ready" as const,
    archives: [reply("reply-1")],
    stale: false,
  };
  assert.deepEqual(beginStudyRecentRepliesLoad(state), {
    shouldRequest: false,
    generation: null,
    state,
  });
});

test("invalidates successful data without discarding archives or selection", () => {
  const state = {
    ...EMPTY_STUDY_RECENT_REPLIES_STATE,
    phase: "ready" as const,
    archives: [reply("reply-1")],
    stale: false,
    selectedArchiveId: "reply-1",
  };
  const invalidated = invalidateStudyRecentReplies(state);

  assert.deepEqual(invalidated, { ...state, stale: true, generation: 1 });
  assert.deepEqual(beginStudyRecentRepliesLoad(invalidated), {
    shouldRequest: true,
    generation: 1,
    state: { ...invalidated, phase: "loading" },
  });
});

test("resolves success to ready or empty and clears stale state", () => {
  const loading = beginStudyRecentRepliesLoad(
    EMPTY_STUDY_RECENT_REPLIES_STATE,
  ).state;
  assert.deepEqual(
    resolveStudyRecentReplies(loading, {
      ok: true,
      archives: [reply("reply-1")],
    }, 0),
    {
      ...loading,
      phase: "ready",
      archives: [reply("reply-1")],
      stale: false,
    },
  );
  assert.deepEqual(
    resolveStudyRecentReplies(loading, { ok: true, archives: [] }, 0),
    {
      ...loading,
      phase: "empty",
      archives: [],
      stale: false,
    },
  );
});

test("resolves 401 and other failures to error while preserving stable messages", () => {
  const loading = beginStudyRecentRepliesLoad(
    EMPTY_STUDY_RECENT_REPLIES_STATE,
  ).state;
  for (const result of [
    {
      ok: false as const,
      kind: "unauthenticated" as const,
      message: "会话已过期，请重新登录",
    },
    {
      ok: false as const,
      kind: "unknown" as const,
      message: "最近回奏响应不完整，请稍后重试",
    },
  ]) {
    assert.deepEqual(resolveStudyRecentReplies(loading, result, 0), {
      ...loading,
      phase: "error",
      message: result.message,
    });
  }
});

test("ignores an old resolve after a loading request is invalidated", () => {
  const load = beginStudyRecentRepliesLoad(
    EMPTY_STUDY_RECENT_REPLIES_STATE,
  );
  const invalidated = invalidateStudyRecentReplies(load.state);
  const afterOldResolve = resolveStudyRecentReplies(
    invalidated,
    { ok: true, archives: [reply("old-reply")] },
    load.generation,
  );

  assert.deepEqual(afterOldResolve, invalidated);
  assert.equal(afterOldResolve.stale, true);
  assert.deepEqual(beginStudyRecentRepliesLoad(afterOldResolve), {
    shouldRequest: true,
    generation: 1,
    state: { ...afterOldResolve, phase: "loading" },
  });
});

test("toggles one selected reply at a time", () => {
  const ready = {
    ...EMPTY_STUDY_RECENT_REPLIES_STATE,
    phase: "ready" as const,
    archives: [reply("reply-1"), reply("reply-2")],
    stale: false,
  };
  const first = toggleStudyRecentReply(ready, "reply-1");
  assert.equal(first.selectedArchiveId, "reply-1");
  assert.equal(
    toggleStudyRecentReply(first, "reply-1").selectedArchiveId,
    null,
  );
  assert.equal(
    toggleStudyRecentReply(first, "reply-2").selectedArchiveId,
    "reply-2",
  );
});
