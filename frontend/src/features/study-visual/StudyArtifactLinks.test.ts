import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { StudyArtifactLinks } from "./StudyArtifactLinks.ts";
import type { ReportArtifact } from "../../lib/backendClient.ts";

const REPORT: ReportArtifact = {
  artifactId: "report 甲/2025",
  kind: "ACCOUNTING_MANAGEMENT_REPORT_XLSX",
  displayName: "2025年度财务管理报告",
  periodStart: 2025,
  periodEnd: 2025,
  generatedAt: "2026-07-29T08:00:00Z",
};

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
    assert.equal(fetchCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
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
