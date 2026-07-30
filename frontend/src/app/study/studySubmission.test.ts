import assert from "node:assert/strict";
import test from "node:test";

import {
  requestStudySubmission,
  submitStudyDecree,
  type StudyFetch,
} from "./studySubmission.ts";
import {
  SUBMITTING_UI_STATE,
  mapSubmitDecreeResultToUiState,
  parseChancellorSuccessResponse,
  type DecreeUiState,
} from "./decreeStatus.ts";
import { projectStudyArtifacts } from "../../features/study-visual/studyWorkspaceState.ts";

const VALID_SUCCESS_BODY = {
  status: "ok",
  chancellor: "丞相",
  routeType: "single",
  rationale: "交由户部办理。",
  processingPath: ["上书房", "丞相", "户部", "丞相"],
  departments: ["户部"],
  ministryOpinions: [
    {
      department: "户部",
      bureauOpinions: [{ bureau: "预算司", opinion: "预算可控。" }],
      opinion: "分期拨付。",
    },
  ],
  councilVerdict: null,
  finalVerdict: "准行。",
  recommendations: ["核定预算", "分期拨付", "设置审计节点"],
  artifacts: [{
    artifactId: "report 甲/2025",
    kind: "ACCOUNTING_MANAGEMENT_REPORT_XLSX",
    displayName: "2025年度财务管理报告",
    periodStart: 2025,
    periodEnd: 2025,
    generatedAt: "2026-07-29T08:00:00Z",
  }],
};

test("importing the Study submission boundary performs zero requests", async () => {
  const originalFetch = globalThis.fetch;
  let requestCount = 0;
  globalThis.fetch = async () => {
    requestCount += 1;
    return new Response();
  };

  try {
    const boundaryModulePath =
      "./studySubmission.ts?zero-fetch-import-boundary";
    const importedBoundary = await import(boundaryModulePath);

    assert.equal(typeof importedBoundary.requestStudySubmission, "function");
    assert.equal(typeof importedBoundary.submitStudyDecree, "function");
    assert.equal(requestCount, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("one submission sends exactly one same-origin POST with the decree body", async () => {
  const requests: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
  const fetchImpl: StudyFetch = async (input, init) => {
    requests.push({ input, init });
    return Response.json(VALID_SUCCESS_BODY);
  };

  const state = await requestStudySubmission("修筑河工", {
    fetchImpl,
    scheduleRedirect: () => assert.fail("success must not redirect"),
    draftVersion: 3,
    draftFingerprint: "c".repeat(64),
  });

  assert.equal(requests.length, 1);
  assert.equal(requests[0].input, "/api/decrees/chancellor");
  assert.equal(requests[0].init?.method, "POST");
  assert.equal(requests[0].init?.headers && new Headers(requests[0].init.headers).get("content-type"), "application/json");
  assert.equal(requests[0].init?.body, JSON.stringify({
    decreeText: "修筑河工",
    draftVersion: 3,
    draftFingerprint: "c".repeat(64),
  }));
  assert.equal(state.phase, "success");
  if (state.phase === "success") {
    const parsed = parseChancellorSuccessResponse(VALID_SUCCESS_BODY);
    assert.ok(parsed);
    assert.deepEqual(parsed.artifacts, VALID_SUCCESS_BODY.artifacts);
    assert.deepEqual(state.departments, ["户部"]);
    assert.equal(state.finalVerdict, "准行。");
    assert.deepEqual(state.artifacts, VALID_SUCCESS_BODY.artifacts);
    assert.deepEqual(projectStudyArtifacts(state), VALID_SUCCESS_BODY.artifacts);
  }
});

test("401 schedules only the allowlisted Study login redirect", async () => {
  const redirects: string[] = [];

  const state = await requestStudySubmission("修筑河工", {
    fetchImpl: async () => new Response(null, { status: 401 }),
    scheduleRedirect: (path) => redirects.push(path),
  });

  assert.deepEqual(redirects, ["/login?next=%2Fstudy"]);
  assert.deepEqual(state, {
    phase: "error",
    message: "会话已过期，正在返回登录页。",
  });
});

test("invalid JSON, invalid success data, known errors, and network failures map to stable states", async () => {
  const unknownState = mapSubmitDecreeResultToUiState({
    ok: false,
    kind: "unknown",
    error: "",
  });
  const networkState = mapSubmitDecreeResultToUiState({
    ok: false,
    kind: "network",
    error: "",
  });
  const modelState = mapSubmitDecreeResultToUiState({
    ok: false,
    kind: "model",
    error: "",
  });
  const timeoutState: DecreeUiState = {
    phase: "error",
    message: "下旨处理超时，请稍后重试。",
  };
  const cases: Array<[string, StudyFetch, DecreeUiState]> = [
    [
      "invalid JSON",
      async () => new Response("{", { status: 200 }),
      unknownState,
    ],
    [
      "invalid success data",
      async () => Response.json({ status: "ok" }),
      unknownState,
    ],
    [
      "invalid error response",
      async () => Response.json(null, { status: 500 }),
      unknownState,
    ],
    [
      "known route error",
      async () => Response.json(
        { status: "error", reason: "model", message: "internal" },
        { status: 502 },
      ),
      modelState,
    ],
    [
      "timeout route error",
      async () => Response.json(
        { status: "error", reason: "timeout", message: "internal" },
        { status: 504 },
      ),
      timeoutState,
    ],
    [
      "network failure",
      async () => {
        throw new Error("offline");
      },
      networkState,
    ],
  ];

  for (const [name, fetchImpl, expected] of cases) {
    const redirects: string[] = [];
    const actual = await requestStudySubmission("修筑河工", {
      fetchImpl,
      scheduleRedirect: (path) => redirects.push(path),
    });
    assert.deepEqual(actual, expected, name);
    assert.deepEqual(redirects, [], `${name} must not redirect`);
  }
});

test("submission orchestration gates requests when canSubmit is false", async () => {
  const states: DecreeUiState[] = [];
  let requestCount = 0;

  await submitStudyDecree({
    decreeText: "修筑河工",
    canSubmit: false,
    setUiState: (state) => states.push(state),
    requestSubmission: async () => {
      requestCount += 1;
      return { phase: "error", message: "unexpected" };
    },
  });

  assert.equal(requestCount, 0);
  assert.deepEqual(states, []);
});

test("submission orchestration publishes SUBMITTING before the terminal state", async () => {
  const states: DecreeUiState[] = [];
  const terminal: DecreeUiState = { phase: "error", message: "stable terminal" };

  await submitStudyDecree({
    decreeText: "修筑河工",
    canSubmit: true,
    setUiState: (state) => states.push(state),
    requestSubmission: async (decreeText) => {
      assert.equal(decreeText, "修筑河工");
      return terminal;
    },
  });

  assert.deepEqual(states, [SUBMITTING_UI_STATE, terminal]);
});
