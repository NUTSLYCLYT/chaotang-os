import assert from "node:assert/strict";
import test from "node:test";

import type {
  JinyiweiAdoption,
  JinyiweiEvidence,
  JinyiweiRequiredFact,
} from "../../lib/backendClient.ts";
import {
  buildFactDispatchRows,
  dispatchStatusLabel,
  type FactDispatchInput,
} from "./jinyiweiDispatch.ts";

function fact(key: string, description = `${key} 说明`): JinyiweiRequiredFact {
  return {
    key,
    description,
    category: "ENTITY_REFERENCE",
    dataScope: "EXTERNAL_PUBLIC",
    subject: "subject",
    jurisdiction: null,
    expectedUnit: null,
    expectedShape: null,
    marketMetric: null,
  };
}

function evidence(evidenceId: string, factKey: string): JinyiweiEvidence {
  return {
    evidenceId,
    factKey,
    value: "verified",
    unit: null,
    asOf: "2026-10-07T00:00:00Z",
    publishedAt: null,
    retrievedAt: "2026-10-07T00:00:00Z",
    sourceUrl: "https://example.test/source",
    publisher: "source",
    sourceType: "PUBLIC_WEB",
    coverage: null,
    licenseNote: null,
    quality: "AUTHORITATIVE",
    stance: "SUPPORTS",
    excerpt: "verified",
    contentHash: "a".repeat(64),
    confidence: 0.9,
    accessUrl: null,
    accessMetadata: null,
  };
}

function adoption(evidenceId: string, replyId: string): JinyiweiAdoption {
  return {
    evidenceId,
    replyId,
    status: "CONFIRMED",
    createdAt: "2026-10-07T00:00:00Z",
    updatedAt: "2026-10-07T00:01:00Z",
    confirmedAt: "2026-10-07T00:01:00Z",
  };
}

function detail(overrides: Partial<FactDispatchInput> = {}): FactDispatchInput {
  return {
    request: { requiredFacts: [fact("owner"), fact("budget")] } as FactDispatchInput["request"],
    evidenceByFact: {
      owner: [evidence("e-owner", "owner")],
      budget: [],
    },
    resolvedFacts: ["owner"],
    adoptions: [adoption("e-owner", "reply-1"), adoption("e-owner", "reply-1")],
    ...overrides,
  };
}

test("事实分发视图按服务端事实顺序显示核验、证据和回奏数量", () => {
  assert.deepEqual(buildFactDispatchRows(detail()), [
    {
      factKey: "owner",
      description: "owner 说明",
      evidenceCount: 1,
      relatedReplyCount: 1,
      status: "RESOLVED",
    },
    {
      factKey: "budget",
      description: "budget 说明",
      evidenceCount: 0,
      relatedReplyCount: 0,
      status: "NO_EVIDENCE",
    },
  ]);
});

test("有证据但未列入 resolvedFacts 时保持待核验，不推断为已解决", () => {
  const rows = buildFactDispatchRows(detail({
    evidenceByFact: { owner: [evidence("e-owner", "owner")], budget: [evidence("e-budget", "budget")] },
    resolvedFacts: [],
  }));
  assert.equal(rows[0]?.status, "PENDING");
  assert.equal(rows[1]?.status, "PENDING");
});

test("缺少事实键的证据不会被挪到另一条分发记录", () => {
  const rows = buildFactDispatchRows(detail({ evidenceByFact: { other: [evidence("e-other", "other")] } }));
  assert.equal(rows[0]?.evidenceCount, 0);
  assert.equal(rows[0]?.status, "NO_EVIDENCE");
});

test("事实分发状态文案保持与朝堂界面一致", () => {
  assert.deepEqual(
    [dispatchStatusLabel("RESOLVED"), dispatchStatusLabel("PENDING"), dispatchStatusLabel("NO_EVIDENCE")],
    ["已核验", "待核验", "尚无证据"],
  );
});
