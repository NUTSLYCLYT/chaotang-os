import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  createStudyArtifactConfirmationController,
  StudyArtifactLinks,
  type StudyArtifactConfirmationSnapshot,
} from "./StudyArtifactLinks.ts";
import type { ReportArtifact } from "../../lib/backendClient.ts";

const REPORT: ReportArtifact = {
  artifactId: "report 甲/2025",
  kind: "ACCOUNTING_MANAGEMENT_REPORT_XLSX",
  displayName: "2025年度财务管理报告",
  periodStart: 2025,
  periodEnd: 2025,
  generatedAt: "2026-07-29T08:00:00Z",
};

const READY_SNAPSHOT: StudyArtifactConfirmationSnapshot = {
  workStatus: "READY_FOR_HUMAN_CONFIRMATION",
  confirmationStatus: "PENDING",
  artifactState: "PENDING",
  replyId: null,
};

function deferredResponse() {
  let resolve!: (response: Response) => void;
  const promise = new Promise<Response>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}

function parseAnchors(html: string) {
  return [...html.matchAll(/<a\s+([^>]*)>([\s\S]*?)<\/a>/g)].map((match) => {
    const attributes = Object.fromEntries(
      [...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map((attribute) => [
        attribute[1],
        attribute[2].replaceAll("&quot;", '"').replaceAll("&amp;", "&"),
      ]),
    );
    const text = match[2].replace(/<[^>]+>/g, "").replaceAll("&amp;", "&");
    return { tagName: "a", attributes, text };
  });
}

test("artifact links render zero anchors for an ordinary reply and perform zero fetches", () => {
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = async () => {
    fetchCalls += 1;
    return new Response();
  };
  try {
    const html = renderToStaticMarkup(createElement(StudyArtifactLinks, { artifacts: [] }));
    assert.deepEqual(parseAnchors(html), []);
    assert.doesNotMatch(html, /生成.*财务报表|财务报表.*已生成/);
    assert.equal(fetchCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("confirmation snapshot retains a reply deep link only after the server supplies it", () => {
  const parsed = createStudyArtifactConfirmationController({ artifactId: "report-1" });
  assert.equal(parsed.getState().snapshot, null);
});

test("artifact link preserves the raw test id and encodes a dangerous artifact ID", () => {
  const html = renderToStaticMarkup(createElement(StudyArtifactLinks, { artifacts: [REPORT] }));
  const anchors = parseAnchors(html);

  assert.equal(anchors.length, 1);
  assert.equal(anchors[0].tagName, "a");
  assert.equal(anchors[0].attributes["data-testid"], `decree-artifact-${REPORT.artifactId}`);
  assert.equal(anchors[0].attributes.href, "/api/report-artifacts/report%20%E7%94%B2%2F2025");
  assert.match(anchors[0].text, /下载财务报告/);
  assert.match(anchors[0].text, /2025年度财务管理报告/);
  assert.match(anchors[0].text, /2025.*2025/);
});

test("artifact links render exactly one accessible anchor per artifact without fetching", () => {
  const reports: ReportArtifact[] = [
    REPORT,
    { ...REPORT, artifactId: "report two/2024 2025", displayName: "跨年度报告", periodStart: 2024 },
  ];
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = async () => {
    fetchCalls += 1;
    return new Response();
  };
  try {
    const anchors = parseAnchors(
      renderToStaticMarkup(createElement(StudyArtifactLinks, { artifacts: reports })),
    );
    assert.equal(anchors.length, reports.length);
    assert.deepEqual(anchors.map((anchor) => anchor.attributes.href), [
      "/api/report-artifacts/report%20%E7%94%B2%2F2025",
      "/api/report-artifacts/report%20two%2F2024%202025",
    ]);
    assert.deepEqual(anchors.map((anchor) => anchor.attributes["data-testid"]), reports.map(
      (artifact) => `decree-artifact-${artifact.artifactId}`,
    ));
    assert.equal(fetchCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("study workspace minimally wires the controller-backed confirmation component", () => {
  const workspaceSource = readFileSync(
    new URL("./DevStudyWorkspace.tsx", import.meta.url),
    "utf8",
  );
  const componentSource = readFileSync(
    new URL("./StudyArtifactConfirmation.tsx", import.meta.url),
    "utf8",
  );
  assert.match(workspaceSource, /StudyArtifactConfirmation/);
  assert.match(workspaceSource, /artifactId=\{artifact\.artifactId\}/);
  assert.match(workspaceSource, /StudyArtifactLinks artifacts=\{artifactView\}/);
  assert.match(componentSource, /createStudyArtifactConfirmationController/);
  assert.doesNotMatch(componentSource, /\bfetch\s*\(/);
  assert.doesNotMatch(
    `${workspaceSource}\n${componentSource}`,
    /review_status|owner_user_id/,
  );
});

test("confirmation controller synchronously rejects a duplicate submit", async () => {
  const pendingPost = deferredResponse();
  let postCalls = 0;
  const controller = createStudyArtifactConfirmationController({
    artifactId: REPORT.artifactId,
    fetchImpl: async (_input, init) => {
      if (init?.method === "POST") {
        postCalls += 1;
        return pendingPost.promise;
      }
      return Response.json(READY_SNAPSHOT);
    },
  });
  await controller.load();

  const first = controller.submit("CONFIRMED", "first decision");
  const duplicate = controller.submit("ESCALATED", "late duplicate");

  assert.equal(postCalls, 1);
  assert.equal((await duplicate).phase, "submitting");
  pendingPost.resolve(
    Response.json({
      ...READY_SNAPSHOT,
      confirmationStatus: "CONFIRMED",
      artifactState: "PUBLISHED",
    }),
  );
  assert.equal((await first).snapshot?.confirmationStatus, "CONFIRMED");
});

test("disposed controller cannot overwrite a newer artifact with an inverse response", async () => {
  const oldPost = deferredResponse();
  const newPost = deferredResponse();
  const visibleStatuses: string[] = [];
  const publishVisibleStatus = (state: {
    snapshot: StudyArtifactConfirmationSnapshot | null;
  }) => {
    if (state.snapshot) visibleStatuses.push(state.snapshot.confirmationStatus);
  };
  const oldController = createStudyArtifactConfirmationController({
    artifactId: "old-artifact",
    fetchImpl: async (_input, init) =>
      init?.method === "POST" ? oldPost.promise : Response.json(READY_SNAPSHOT),
    onStateChange: publishVisibleStatus,
  });
  await oldController.load();
  const oldSubmit = oldController.submit("CONFIRMED", "old decision");
  oldController.dispose();

  const newController = createStudyArtifactConfirmationController({
    artifactId: "new-artifact",
    fetchImpl: async (_input, init) =>
      init?.method === "POST" ? newPost.promise : Response.json(READY_SNAPSHOT),
    onStateChange: publishVisibleStatus,
  });
  await newController.load();
  const newSubmit = newController.submit("ESCALATED", "new decision");
  newPost.resolve(
    Response.json({ ...READY_SNAPSHOT, confirmationStatus: "ESCALATED" }),
  );
  await newSubmit;
  oldPost.resolve(
    Response.json({ ...READY_SNAPSHOT, confirmationStatus: "CONFIRMED" }),
  );
  await oldSubmit;

  assert.equal(visibleStatuses.at(-1), "ESCALATED");
  assert.equal(visibleStatuses.includes("CONFIRMED"), false);
});


test("C01A unavailable reply can be retried without resubmitting confirmation", async () => {
  let replyReads = 0;
  const controller = createStudyArtifactConfirmationController({ artifactId: "report-1", fetchImpl: async (url) => {
    if (String(url).includes("/api/shiguan/")) {
      return ++replyReads === 1 ? new Response(null, { status: 503 }) : Response.json({ status: "ok", archive: { id: "reply-1", type: "REPLY" } });
    }
    return Response.json({ ...READY_SNAPSHOT, replyId: "reply-1" });
  } });
  await controller.load();
  assert.equal(controller.getState().verifiedReplyId, null);
  await controller.load();
  assert.equal(replyReads, 2);
  assert.equal(controller.getState().verifiedReplyId, "reply-1");
});

test("C01A confirmation 401 clears the previously visible private snapshot", async () => {
  const controller = createStudyArtifactConfirmationController({ artifactId: "report-1", fetchImpl: async (_url, init) =>
    init?.method === "POST" ? new Response(null, { status: 401 }) : Response.json(READY_SNAPSHOT)
  });
  await controller.load(); await controller.submit("CONFIRMED", "reviewed");
  assert.equal(controller.getState().snapshot, null);
  assert.equal(controller.getState().verifiedReplyId, null);
});

for (const unauthorizedStage of ["work-product", "reply", "confirmation"]) {
  test(`current ${unauthorizedStage} 401 clears state and requests login`, async () => {
    let redirects = 0;
    const controller = createStudyArtifactConfirmationController({
      artifactId: "auth-test",
      onUnauthorized: () => { redirects += 1; },
      fetchImpl: async (input) => {
        const url = String(input);
        if ((unauthorizedStage === "work-product" && url.endsWith("work-product")) ||
            (unauthorizedStage === "reply" && url.includes("/archives/")) ||
            (unauthorizedStage === "confirmation" && url.endsWith("confirmation"))) {
          return new Response(null, { status: 401 });
        }
        if (url.includes("/archives/")) return Response.json({ archive: { id: "reply-auth", type: "REPLY" } });
        return Response.json({ workStatus: "READY_FOR_HUMAN_CONFIRMATION", confirmationStatus: "PENDING", artifactState: "PUBLISHED", replyId: "reply-auth" });
      },
    });
    await controller.load();
    if (unauthorizedStage === "confirmation") await controller.submit("CONFIRMED", "reviewed");
    assert.equal(redirects, 1);
    assert.equal(controller.getState().snapshot, null);
    assert.equal(controller.getState().verifiedReplyId, null);
  });
}