import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  createStudyArtifactConfirmationController,
  parseStudyArtifactConfirmationSnapshot,
  projectStudyArtifactConfirmation,
  projectStudyArtifactConfirmationUi,
} from "./StudyArtifactLinks.ts";

const READY_SNAPSHOT = {
  workProductId: "wp-1",
  version: 1,
  runId: "run-1",
  capabilityId: "accounting_management_report",
  workStatus: "READY_FOR_HUMAN_CONFIRMATION",
  confirmationStatus: "PENDING",
  artifactState: "PUBLISHED",
  decision: "ready",
  facts: [],
  assumptions: [],
  recommendations: [],
  evidenceUsed: [],
  missingEvidence: [],
  conflicts: [],
  riskRegister: [],
  artifactManifest: [],
  artifactGate: {
    status: "PASSED",
    reasonCodes: [],
    missingKinds: [],
    unexpectedKinds: [],
  },
  contentDigest: "a".repeat(64),
  createdAt: "2026-08-05T08:00:00Z",
  artifactId: "report 甲/2025",
  confirmationReceipts: [],
} as const;

test("confirmation projection exposes only a server-provided reply identifier", () => {
  const snapshot = parseStudyArtifactConfirmationSnapshot(READY_SNAPSHOT);
  assert.equal(projectStudyArtifactConfirmationUi({ phase: "ready", snapshot, message: null, verifiedReplyId: "reply-1" }).replyId, "reply-1");
  const legacy = parseStudyArtifactConfirmationSnapshot({ ...READY_SNAPSHOT, replyId: undefined });
  assert.equal(projectStudyArtifactConfirmationUi({ phase: "ready", snapshot: legacy, message: null, verifiedReplyId: null }).replyId, null);
});

test("confirmed replies expose a truthful史馆结果反馈入口 without writing from the study card", () => {
  const source = readFileSync(new URL("./StudyArtifactConfirmation.tsx", import.meta.url), "utf8");
  assert.match(source, /aria-label="史馆结果反馈"/);
  assert.match(source, /data-testid="study-record-outcome"/);
  assert.match(source, /记录结果反馈/);
  assert.match(source, /\/shiguan\?replyId=/);
  assert.doesNotMatch(source, /createShiguanOutcome|recordOutcome\(/);
});

test("confirmation projection keeps machine and human axes separate", () => {
  const cases = [
    [
      "READY_FOR_HUMAN_CONFIRMATION",
      "PENDING",
      "机器校验通过，待人工确认",
      true,
    ],
    ["READY_FOR_HUMAN_CONFIRMATION", "CONFIRMED", "已人工确认", false],
    ["REVISION_REQUIRED", "REVISION_REQUIRED", "已退回修改", false],
    ["READY_FOR_HUMAN_CONFIRMATION", "ESCALATED", "已升级处理", false],
    ["NEEDS_DATA", "PENDING", "机器校验未完成：需要补充数据", false],
    ["NEEDS_REVIEW", "PENDING", "机器校验未完成：需要复核", false],
    ["BLOCKED", "PENDING", "机器校验已阻断", false],
    ["REVISION_REQUIRED", "PENDING", "机器校验要求修改", false],
  ] as const;
  for (const [workStatus, confirmationStatus, label, showControls] of cases) {
    assert.deepEqual(
      projectStudyArtifactConfirmation({ workStatus, confirmationStatus }),
      { label, showControls },
    );
  }
});

test("browser snapshot parser refuses published or receipts as confirmation substitutes", () => {
  assert.equal(
    parseStudyArtifactConfirmationSnapshot({
      artifactState: "PUBLISHED",
      replyId: null,
      confirmationReceipts: [{ decision: "CONFIRMED" }],
    }),
    null,
  );
  assert.equal(
    parseStudyArtifactConfirmationSnapshot({
      workStatus: "READY_FOR_HUMAN_CONFIRMATION",
      artifactState: "PUBLISHED",
    }),
    null,
  );
  assert.deepEqual(
    parseStudyArtifactConfirmationSnapshot({
      workStatus: "READY_FOR_HUMAN_CONFIRMATION",
      confirmationStatus: "PENDING",
        artifactState: "PUBLISHED",
      replyId: null,
    }),
    {
      workStatus: "READY_FOR_HUMAN_CONFIRMATION",
      confirmationStatus: "PENDING",
      artifactState: "PUBLISHED",
      replyId: null,
    },
  );
});

test("controller starts with zero fetches and performs an explicit encoded same-origin GET", async () => {
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  const controller = createStudyArtifactConfirmationController({
    artifactId: "report 甲/2025",
    fetchImpl: async (input, init) => {
      requests.push({ url: String(input), init });
      return Response.json(READY_SNAPSHOT);
    },
  });
  assert.equal(requests.length, 0);
  assert.deepEqual(projectStudyArtifactConfirmationUi(controller.getState()), {
    label: null,
    showLookupButton: true,
    showControls: false,
    downloadOnly: false,
    replyId: null,
  });
  await controller.load();
  assert.equal(requests.length, 1);
  assert.equal(
    requests[0].url,
    "/api/report-artifacts/report%20%E7%94%B2%2F2025/work-product",
  );
  assert.equal(requests[0].init?.method, "GET");
  assert.equal(
    projectStudyArtifactConfirmationUi(controller.getState()).showControls,
    true,
  );
  assert.equal(
    projectStudyArtifactConfirmationUi(controller.getState()).label,
    "机器校验通过，待人工确认",
  );
});

test("a real legacy artifact 404 permanently becomes download-only without a confirmation entry", async () => {
  let calls = 0;
  const controller = createStudyArtifactConfirmationController({
    artifactId: "legacy-report-2024",
    fetchImpl: async () => {
      calls += 1;
      return Response.json(
        { status: "error", reason: "not_found" },
        { status: 404 },
      );
    },
  });
  await controller.load();
  assert.equal(calls, 1);
  assert.deepEqual(projectStudyArtifactConfirmationUi(controller.getState()), {
    label: "此成果仅支持下载",
    showLookupButton: false,
    showControls: false,
    downloadOnly: true,
    replyId: null,
  });
  await controller.load();
  assert.equal(calls, 1);
});

test("controller emits each allowed POST body and never calls for a blank reason", async () => {
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  const controller = createStudyArtifactConfirmationController({
    artifactId: "report-1",
    fetchImpl: async (input, init) => {
      requests.push({ url: String(input), init });
      return Response.json(READY_SNAPSHOT);
    },
  });
  await controller.load();
  await controller.submit("CONFIRMED", "   ");
  assert.equal(requests.length, 1);
  for (const decision of [
    "CONFIRMED",
    "REVISION_REQUIRED",
    "ESCALATED",
  ] as const) {
    await controller.submit(decision, `理由 ${decision}`);
  }
  assert.deepEqual(
    requests.slice(1).map((entry) => ({
      url: entry.url,
      method: entry.init?.method,
      body: JSON.parse(String(entry.init?.body)),
    })),
    [
      {
        url: "/api/report-artifacts/report-1/confirmation",
        method: "POST",
        body: {
          decision: "CONFIRMED",
          structured_reason: "理由 CONFIRMED",
        },
      },
      {
        url: "/api/report-artifacts/report-1/confirmation",
        method: "POST",
        body: {
          decision: "REVISION_REQUIRED",
          structured_reason: "理由 REVISION_REQUIRED",
        },
      },
      {
        url: "/api/report-artifacts/report-1/confirmation",
        method: "POST",
        body: {
          decision: "ESCALATED",
          structured_reason: "理由 ESCALATED",
        },
      },
    ],
  );
});

test("failed or malformed confirmation responses preserve the last server snapshot", async () => {
  let responseIndex = 0;
  const responses = [
    Response.json(READY_SNAPSHOT),
    Response.json({ status: "error" }, { status: 503 }),
    Response.json({
      artifactState: "PUBLISHED",
      confirmationReceipts: [{ decision: "CONFIRMED" }],
    }),
  ];
  const controller = createStudyArtifactConfirmationController({
    artifactId: "report-1",
    fetchImpl: async () => responses[responseIndex++],
  });
  await controller.load();
  const before = controller.getState().snapshot;
  await controller.submit("CONFIRMED", "第一次");
  assert.deepEqual(controller.getState().snapshot, before);
  await controller.submit("CONFIRMED", "第二次");
  assert.deepEqual(controller.getState().snapshot, before);
});

test("only the returned server snapshot changes the displayed confirmation status", async () => {
  let calls = 0;
  const controller = createStudyArtifactConfirmationController({
    artifactId: "report-1",
    fetchImpl: async () => {
      calls += 1;
      return Response.json(
        calls === 1
          ? READY_SNAPSHOT
          : { ...READY_SNAPSHOT, confirmationStatus: "ESCALATED" },
      );
    },
  });
  await controller.load();
  await controller.submit("CONFIRMED", "请求确认但以服务端返回为准");
  assert.equal(controller.getState().snapshot?.confirmationStatus, "ESCALATED");
  assert.equal(
    projectStudyArtifactConfirmationUi(controller.getState()).label,
    "已升级处理",
  );
});
