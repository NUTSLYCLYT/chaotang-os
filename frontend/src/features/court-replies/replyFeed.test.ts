import assert from "node:assert/strict";
import test from "node:test";

import {
  filterReplyCasesByDepartment,
  toReplyCaseView,
} from "./replyFeed.ts";

const replyArchive = {
  id: "reply-1",
  type: "REPLY",
  title: "赈务回奏",
  content: "回奏正文",
  matterType: "赈务",
  department: "户部",
  relatedArchiveIds: [],
  evidence: [],
  createdAt: "2026-07-24T08:00:01+00:00",
  lessonsLearned: null,
  pitfalls: null,
  sourceKind: "DECREE",
  sourceText: "赈济灾民",
  participatingDepartments: ["户部", "工部"],
  replyProcess: "丞相 → 户部 → 工部 → 丞相",
  replyConclusion: "准予施行。",
  replyTime: "2026-07-24T08:00:00+00:00",
  respondent: "丞相",
  reviewStatus: null,
};

test("only complete REPLY archives become court cases", () => {
  const memorialArchive = {
    ...replyArchive,
    id: "memorial-1",
    type: "MEMORIAL",
  };

  assert.equal(toReplyCaseView(memorialArchive), null);
  assert.deepEqual(toReplyCaseView(replyArchive), {
    id: "reply-1",
    title: "赈务回奏",
    departments: ["户部", "工部"],
    process: "丞相 → 户部 → 工部 → 丞相",
    conclusion: "准予施行。",
    repliedAt: "2026-07-24T08:00:00+00:00",
    respondent: "丞相",
  });
});

test("incomplete REPLY archives fail closed without inferring missing facts", () => {
  const invalidStrings = [null, undefined, "", " ", 7, false, [], {}];
  for (const field of [
    "id",
    "title",
    "replyProcess",
    "replyConclusion",
    "replyTime",
    "respondent",
  ]) {
    for (const invalid of invalidStrings) {
      assert.equal(toReplyCaseView({ ...replyArchive, [field]: invalid }), null);
    }
  }

  for (const archive of [
    null,
    undefined,
    [],
    "REPLY",
    { ...replyArchive, id: null },
    { ...replyArchive, id: 7 },
    { ...replyArchive, id: " " },
    { ...replyArchive, title: null },
    { ...replyArchive, title: [] },
    { ...replyArchive, title: " " },
    { ...replyArchive, type: "MEMORIAL" },
    { ...replyArchive, type: null },
    { ...replyArchive, type: 7 },
    { ...replyArchive, participatingDepartments: "户部" },
    { ...replyArchive, participatingDepartments: null },
    { ...replyArchive, participatingDepartments: [] },
    { ...replyArchive, participatingDepartments: ["户部", 7] },
    { ...replyArchive, participatingDepartments: ["户部", " "] },
    { ...replyArchive, replyProcess: 7 },
    { ...replyArchive, replyProcess: null },
    { ...replyArchive, replyProcess: " " },
    { ...replyArchive, replyConclusion: [] },
    { ...replyArchive, replyConclusion: null },
    { ...replyArchive, replyConclusion: " " },
    { ...replyArchive, replyTime: undefined },
    { ...replyArchive, replyTime: false },
    { ...replyArchive, replyTime: null },
    { ...replyArchive, respondent: {} },
    { ...replyArchive, respondent: null },
    { ...replyArchive, respondent: " " },
  ]) {
    assert.equal(toReplyCaseView(archive), null);
  }
});

test("department filtering is exact, deterministic, and does not mutate cases", () => {
  const cases = [
    toReplyCaseView(replyArchive),
    toReplyCaseView({
      ...replyArchive,
      id: "reply-2",
      participatingDepartments: ["兵部"],
    }),
  ].filter((item) => item !== null);

  assert.deepEqual(filterReplyCasesByDepartment(cases, "户部"), [cases[0]]);
  assert.deepEqual(filterReplyCasesByDepartment(cases, ""), cases);
  assert.notEqual(filterReplyCasesByDepartment(cases, ""), cases);
  assert.deepEqual(cases.map((item) => item.id), ["reply-1", "reply-2"]);
});
