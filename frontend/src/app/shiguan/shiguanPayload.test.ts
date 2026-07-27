import assert from "node:assert/strict";
import test from "node:test";

import {
  parseArchivesPayload,
  parseRecallPayload,
  parseReviewPayload,
  parseStatisticsPayload,
} from "./shiguanPayload.ts";

const REVIEW = {
  status: "PARTIAL",
  reviewedAt: "2026-07-24T09:00:00Z",
  note: "仍需观察",
};

const EVIDENCE_REFERENCE = {
  packId: "pack-1",
  investigationId: "investigation-1",
  evidenceId: "evidence-1",
  ordinal: 0,
  snapshotHash: "a".repeat(64),
  snapshot: {
    evidenceId: "evidence-1",
    factKey: "last_price",
    value: 302.5,
    unit: "CNY",
    asOf: "2026-07-24T07:55:00Z",
    publishedAt: "2026-07-24T07:55:00Z",
    retrievedAt: "2026-07-24T08:00:00Z",
    sourceUrl: "https://example.invalid/evidence",
    publisher: "交易所",
    sourceType: "MCP",
    coverage: ["CN"],
    licenseNote: "仅供审计",
    quality: "AUTHORITATIVE",
    stance: "SUPPORTS",
    excerpt: "收盘价 302.5 元",
    contentHash: "b".repeat(64),
    confidence: 0.98,
    accessUrl: "https://example.invalid/audit",
    accessMetadata: { serverId: "westock", toolName: "data_quote" },
    category: "MARKET_QUOTE",
    dataScope: "EXTERNAL_PUBLIC",
    subject: "002594.SZ",
    jurisdiction: "CN",
  },
};

const ARCHIVE = {
  id: "reply-1",
  type: "REPLY",
  title: "漕运回奏",
  content: "完整正文",
  matterType: "漕运",
  department: "户部",
  relatedArchiveIds: [],
  evidence: [{ source: "本地证据", realityLabel: "LIVE", note: null }],
  createdAt: "2026-07-24T08:00:00Z",
  lessonsLearned: null,
  pitfalls: null,
  sourceKind: "DECREE",
  sourceText: "核定漕运",
  participatingDepartments: ["户部"],
  replyProcess: "丞相 → 户部 → 丞相",
  replyConclusion: "准予施行",
  replyTime: "2026-07-24T09:00:00Z",
  respondent: "丞相",
  reviewStatus: REVIEW,
  evidenceReferences: [EVIDENCE_REFERENCE],
};

test("strict Shiguan payload decoders accept complete legal payloads and preserve PARTIAL", () => {
  const parsedArchive = parseArchivesPayload({ status: "ok", archives: [ARCHIVE] })?.[0];
  assert.equal(parsedArchive?.reviewStatus?.status, "PARTIAL");
  assert.deepEqual(parsedArchive?.evidenceReferences, [EVIDENCE_REFERENCE]);
  assert.deepEqual(
    parseStatisticsPayload({
      status: "ok",
      statistics: {
        total: 1,
        achieved: 0,
        notAchieved: 0,
        partial: 1,
        observing: 0,
        pendingReview: 0,
        successRate: null,
      },
    }),
    {
      total: 1,
      achieved: 0,
      notAchieved: 0,
      partial: 1,
      observing: 0,
      pendingReview: 0,
      successRate: null,
    },
  );
  assert.equal(
    parseRecallPayload({
      status: "ok",
      matches: [{
        archiveId: "reply-1",
        matchReason: "事项类型一致",
        historicalConclusion: "准予施行",
        evidenceLabels: ["LIVE"],
        reviewStatus: REVIEW,
        lessonsLearned: null,
        pitfalls: null,
      }],
    })?.[0]?.evidenceLabels[0],
    "LIVE",
  );
  assert.equal(
    parseReviewPayload({ status: "ok", reviewStatus: REVIEW })?.status,
    "PARTIAL",
  );
});

test("strict Shiguan payload decoders reject malformed nested 200 bodies", () => {
  const archiveWithoutEvidence = Object.fromEntries(
    Object.entries(ARCHIVE).filter(([key]) => key !== "evidence"),
  );
  assert.equal(
    parseArchivesPayload({ status: "ok", archives: [archiveWithoutEvidence] }),
    null,
  );
  assert.equal(
    parseArchivesPayload({
      status: "ok",
      archives: [{ ...ARCHIVE, participatingDepartments: ["户部", 9] }],
    }),
    null,
  );
  assert.equal(
    parseRecallPayload({
      status: "ok",
      matches: [{
        archiveId: "reply-1",
        matchReason: "事项类型一致",
        historicalConclusion: "准予施行",
        evidenceLabels: ["INVENTED"],
        reviewStatus: null,
        lessonsLearned: null,
        pitfalls: null,
      }],
    }),
    null,
  );
  assert.equal(
    parseReviewPayload({
      status: "ok",
      reviewStatus: {
        status: "PASS",
        reviewedAt: "2026-07-24T09:00:00Z",
        note: null,
      },
    }),
    null,
  );
  assert.equal(
    parseStatisticsPayload({
      status: "ok",
      statistics: {
        total: 1,
        achieved: 0,
        notAchieved: 0,
        partial: Number.NaN,
        observing: 0,
        pendingReview: 0,
        successRate: null,
      },
    }),
    null,
  );
});


test("strict Shiguan archive decoder rejects malformed immutable evidence references", () => {
  const decode = (evidenceReferences: unknown) =>
    parseArchivesPayload({
      status: "ok",
      archives: [{ ...ARCHIVE, evidenceReferences }],
    });

  assert.equal(decode([{ ...EVIDENCE_REFERENCE, extra: true }]), null);
  assert.equal(
    decode([{ ...EVIDENCE_REFERENCE, snapshot: { ...EVIDENCE_REFERENCE.snapshot, extra: true } }]),
    null,
  );
  for (const [field, value] of [
    ["category", "MARKET_DATA"],
    ["dataScope", "PUBLIC"],
    ["sourceType", "UNAPPROVED"],
  ] as const) {
    assert.equal(
      decode([{ ...EVIDENCE_REFERENCE, snapshot: { ...EVIDENCE_REFERENCE.snapshot, [field]: value } }]),
      null,
    );
  }
  assert.equal(decode([{ ...EVIDENCE_REFERENCE, snapshotHash: "not-a-sha256" }]), null);
  assert.equal(decode([{ ...EVIDENCE_REFERENCE, evidenceId: "evidence-other" }]), null);
  assert.equal(decode(undefined), null);
});
