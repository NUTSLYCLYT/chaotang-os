import assert from "node:assert/strict";
import test from "node:test";

import type { DadianOverview } from "../../lib/backendClient.ts";
import { createDadianViewModel } from "./dadianViewModel.ts";

function overview(replyCount: number): DadianOverview {
  return {
    replyCount,
    departmentCounts: [{ department: "户部", count: 1 }],
    pendingReviewCount: 1,
    todayFocus: "核对真实回奏",
    recentReplies: [],
  };
}

test("view model retains the overview without projecting removed detail sections", () => {
  const data = overview(1);
  const view = createDadianViewModel({ overview: data, error: null });

  assert.equal(view.overview, data);
  assert.equal("departmentOptions" in view, false);
  assert.equal("replies" in view, false);
});

test("view model distinguishes loading, blocking error, empty, and ready", () => {
  assert.equal(createDadianViewModel({ overview: null, error: null }).state, "loading");
  assert.equal(createDadianViewModel({ overview: null, error: "读取失败" }).state, "error");
  assert.equal(createDadianViewModel({ overview: overview(0), error: null }).state, "empty");
  assert.equal(createDadianViewModel({ overview: overview(1), error: null }).state, "ready");
});

test("view model keeps a refresh error nonblocking when overview data exists", () => {
  const data = overview(1);
  const view = createDadianViewModel({ overview: data, error: "大殿概览暂时不可用，请稍后重试。" });

  assert.equal(view.state, "ready");
  assert.equal(view.overview, data);
  assert.equal(view.blockingError, null);
  assert.match(view.nonBlockingError ?? "", /暂时不可用/);
});
