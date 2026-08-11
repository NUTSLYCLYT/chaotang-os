import assert from "node:assert/strict";
import test from "node:test";

import type { ShiguanArchive } from "../../lib/backendClient.ts";
import {
  resetToCurrentReply,
  resolveSelectedArchive,
  selectArchivedReply,
} from "./studyReplyPresentation.ts";

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
    decisionStatus: null,
    evidenceReferences: [],
  };
}

const REPLY_ONE = reply("reply-1");
const REPLY_TWO = reply("reply-2");

test("selected archive remains separate from decree state and resolves only from the current strict list", () => {
  const presentation = selectArchivedReply("reply-2");
  assert.deepEqual(presentation, { source: "archive", archiveId: "reply-2" });
  assert.equal(resolveSelectedArchive(presentation, [REPLY_ONE, REPLY_TWO]), REPLY_TWO);
  assert.equal(resolveSelectedArchive(presentation, [REPLY_ONE]), null);
  assert.deepEqual(resetToCurrentReply(), { source: "current" });
});
