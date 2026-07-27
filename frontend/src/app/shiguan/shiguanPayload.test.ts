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

const STATISTICS = {
  total: 5,
  achieved: 2,
  notAchieved: 1,
  partial: 1,
  observing: 0,
  pendingReview: 1,
  successRate: 0.5,
};

test("strict Shiguan payload decoders accept complete legal payloads and preserve PARTIAL", () => {
  const parsedArchive = parseArchivesPayload({ status: "ok", archives: [ARCHIVE] })?.[0];
  assert.equal(parsedArchive?.reviewStatus?.status, "PARTIAL");
  assert.deepEqual(parsedArchive?.evidenceReferences, [EVIDENCE_REFERENCE]);
  assert.deepEqual(
    parseStatisticsPayload({
      status: "ok",
      statistics: STATISTICS,
    }),
    STATISTICS,
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

test("statistics decoder enforces totals, denominator, and backend success-rate semantics", () => {
  const decode = (statistics: unknown) =>
    parseStatisticsPayload({ status: "ok", statistics });

  assert.deepEqual(decode(STATISTICS), STATISTICS);
  assert.notEqual(
    decode({ ...STATISTICS, successRate: 0.5000000000005 }),
    null,
  );
  assert.equal(decode({ ...STATISTICS, total: 6 }), null);
  assert.equal(
    decode({
      ...STATISTICS,
      total: 2,
      achieved: 3,
      notAchieved: 0,
      partial: 0,
      observing: 0,
      pendingReview: 0,
      successRate: 1,
    }),
    null,
  );
  assert.equal(
    decode({
      total: 1,
      achieved: 0,
      notAchieved: 0,
      partial: 0,
      observing: 1,
      pendingReview: 0,
      successRate: 0,
    }),
    null,
  );
  assert.equal(decode({ ...STATISTICS, successRate: 0.4 }), null);
});

test("archive decoder requires complete timezone-aware ISO datetimes", () => {
  const decode = (archive: unknown) =>
    parseArchivesPayload({ status: "ok", archives: [archive] });
  for (const createdAt of [
    "2026-07-24",
    "2026-07-24T08:00:00",
    "0",
    "2026-02-30T08:00:00Z",
  ]) {
    assert.equal(decode({ ...ARCHIVE, createdAt }), null);
  }
  assert.equal(
    decode({ ...ARCHIVE, replyTime: "0" }),
    null,
  );
  for (const field of ["asOf", "publishedAt", "retrievedAt"] as const) {
    assert.equal(
      decode({
        ...ARCHIVE,
        evidenceReferences: [{
          ...EVIDENCE_REFERENCE,
          snapshot: {
            ...EVIDENCE_REFERENCE.snapshot,
            [field]: "2026-07-24T08:00:00",
          },
        }],
      }),
      null,
    );
  }
  for (const [field, invalid] of [
    ["asOf", "2026-07-24"],
    ["publishedAt", "2026-07-24"],
    ["retrievedAt", "0"],
  ] as const) {
    assert.equal(
      decode({
        ...ARCHIVE,
        evidenceReferences: [{
          ...EVIDENCE_REFERENCE,
          snapshot: {
            ...EVIDENCE_REFERENCE.snapshot,
            [field]: invalid,
          },
        }],
      }),
      null,
    );
  }
  assert.equal(
    decode({
      ...ARCHIVE,
      reviewStatus: { ...REVIEW, reviewedAt: "0" },
    }),
    null,
  );
});
