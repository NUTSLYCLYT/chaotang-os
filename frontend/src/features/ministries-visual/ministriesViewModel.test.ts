import assert from "node:assert/strict";
import test from "node:test";

import type { ReplyCaseView } from "../court-replies/replyFeed.ts";
import {
  projectMinistryMetrics,
  projectMinistryReplies,
} from "./ministriesViewModel.ts";

const REPLIES: ReplyCaseView[] = [
  {
    id: "reply-1",
    title: "户部回奏一",
    departments: ["户部"],
    process: "丞相 → 户部 → 丞相",
    conclusion: "准予施行。",
    repliedAt: "2026-07-24T08:00:00+00:00",
    respondent: "丞相",
  },
  {
    id: "reply-2",
    title: "户部回奏二",
    departments: ["户部", "工部"],
    process: "丞相 → 户部 → 工部 → 丞相",
    conclusion: "补证后施行。",
    repliedAt: "2026-07-25T08:00:00+00:00",
    respondent: "丞相",
  },
  {
    id: "reply-3",
    title: "工部回奏",
    departments: ["工部"],
    process: "丞相 → 工部 → 丞相",
    conclusion: "暂缓。",
    repliedAt: "2026-07-23T08:00:00+00:00",
    respondent: "工部尚书",
  },
];

test("loading and null cases never project an empty result or numeric zero", () => {
  const loading = projectMinistryReplies({
    state: "loading",
    cases: null,
    error: null,
    department: "户部",
  });
  assert.deepEqual(loading, {
    status: "loading",
    cases: null,
    error: null,
    countLabel: "读取中",
  });
  assert.deepEqual(projectMinistryMetrics(loading), [
    ["办结回奏", "读取中"],
    ["回奏主体", "读取中"],
    ["最近回奏", "读取中"],
  ]);

  const inconsistentReady = projectMinistryReplies({
    state: "ready",
    cases: null,
    error: null,
    department: "户部",
  });
  assert.equal(inconsistentReady.status, "loading");
  assert.equal(inconsistentReady.countLabel, "读取中");
});

test("error remains blocking and never projects empty copy or zero", () => {
  const view = projectMinistryReplies({
    state: "error",
    cases: null,
    error: "读取失败",
    department: "户部",
  });
  assert.deepEqual(view, {
    status: "error",
    cases: null,
    error: "读取失败",
    countLabel: "读取失败",
  });
  assert.deepEqual(projectMinistryMetrics(view), [
    ["办结回奏", "暂不可读"],
    ["回奏主体", "暂不可读"],
    ["最近回奏", "暂不可读"],
  ]);
});

test("only a successful read with no department matches projects empty and zero", () => {
  const globallyEmpty = projectMinistryReplies({
    state: "empty",
    cases: [],
    error: null,
    department: "户部",
  });
  assert.equal(globallyEmpty.status, "empty");
  assert.equal(globallyEmpty.countLabel, "0 条");

  const noMatch = projectMinistryReplies({
    state: "ready",
    cases: REPLIES,
    error: null,
    department: "礼部",
  });
  assert.equal(noMatch.status, "empty");
  assert.deepEqual(noMatch.cases, []);
  assert.deepEqual(projectMinistryMetrics(noMatch), [
    ["办结回奏", "0 件"],
    ["回奏主体", "0 个"],
    ["最近回奏", "暂无"],
  ]);
});

test("ready metrics derive counts only from matching replies and deduplicated respondents", () => {
  const view = projectMinistryReplies({
    state: "ready",
    cases: REPLIES,
    error: null,
    department: "户部",
  });
  assert.equal(view.status, "ready");
  assert.deepEqual(view.cases?.map((item) => item.id), ["reply-1", "reply-2"]);
  assert.deepEqual(projectMinistryMetrics(view), [
    ["办结回奏", "2 件"],
    ["回奏主体", "1 个"],
    ["最近回奏", "07/25"],
  ]);
});
