import assert from "node:assert/strict";
import test from "node:test";

import type { DadianOverview } from "../../lib/backendClient.ts";
import { createDadianViewModel } from "./dadianViewModel.ts";

function overview(
  replyCount: number,
  departmentCounts: DadianOverview["departmentCounts"],
): DadianOverview {
  return {
    replyCount,
    departmentCounts,
    pendingReviewCount: 1,
    todayFocus: "核对真实回奏",
    recentReplies: replyCount === 0
      ? []
      : [{
          id: "reply-1",
          title: "边储回奏",
          participatingDepartments: ["户部", "刑部"],
          replyConclusion: "结论全文",
          replyTime: "2026-07-27T08:00:00Z",
          createdAt: "2026-07-27T08:00:01Z",
          respondent: "丞相",
        }],
  };
}

test("view model projects dynamic departments and real reply fields without static inference", () => {
  const data = overview(1, [
    { department: "吏部", count: 4 },
    { department: "刑部", count: 2 },
  ]);

  const view = createDadianViewModel({ overview: data, error: null });

  assert.deepEqual(view.departmentOptions, data.departmentCounts);
  assert.deepEqual(view.replies, [{
    id: "reply-1",
    title: "边储回奏",
    conclusion: "结论全文",
    respondent: "丞相",
    departments: ["户部", "刑部"],
    replyTime: "2026-07-27T08:00:00Z",
  }]);
});

test("view model distinguishes loading, blocking error, empty, and ready", () => {
  assert.equal(
    createDadianViewModel({ overview: null, error: null }).state,
    "loading",
  );
  assert.equal(
    createDadianViewModel({ overview: null, error: "读取失败" }).state,
    "error",
  );
  assert.equal(
    createDadianViewModel({ overview: overview(0, []), error: null }).state,
    "empty",
  );
  assert.equal(
    createDadianViewModel({
      overview: overview(1, [{ department: "户部", count: 1 }]),
      error: null,
    }).state,
    "ready",
  );
});

test("view model keeps last-known-good content and makes refresh errors nonblocking", () => {
  const data = overview(1, [{ department: "户部", count: 1 }]);
  const view = createDadianViewModel({
    overview: data,
    error: "大殿概览暂时不可用，请稍后重试。",
  });

  assert.equal(view.state, "ready");
  assert.equal(view.overview, data);
  assert.equal(view.blockingError, null);
  assert.match(view.nonBlockingError ?? "", /暂时不可用/);
});
