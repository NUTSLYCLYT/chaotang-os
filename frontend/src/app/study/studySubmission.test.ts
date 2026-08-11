import assert from "node:assert/strict";
import test from "node:test";

import {
  requestStudySubmission,
  resumeStudySubmission,
  submitStudyDecree,
  type StudyFetch,
} from "./studySubmission.ts";
import {
  loadActiveJob,
  saveActiveJob,
} from "./decreeJobPolling.ts";
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
  deliveryKind: "accounting_report",
  deliveryPeriod: { startYear: 2025, endYear: 2025 },
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
    idempotencyKey: "submission-1",
  });

  assert.equal(requests.length, 1);
  assert.equal(requests[0].input, "/api/decrees/chancellor");
  assert.equal(requests[0].init?.method, "POST");
  assert.equal(requests[0].init?.headers && new Headers(requests[0].init.headers).get("content-type"), "application/json");
  assert.equal(requests[0].init?.body, JSON.stringify({
    decreeText: "修筑河工",
    draftVersion: 3,
    draftFingerprint: "c".repeat(64),
    idempotencyKey: "submission-1",
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

test("202 acceptance is polled sequentially through success", async () => {
  const jobId = "a".repeat(32);
  const requests: string[] = [];
  const jobStates = [
    { jobId, state: "QUEUED", stage: "QUEUED", attemptCount: 0, providerRequestCount: 0, cancelRequested: false, result: null, error: null, createdAt: "2026-08-07T00:00:00Z", updatedAt: "2026-08-07T00:00:00Z" },
    { jobId, state: "RUNNING", stage: "RUNNING", attemptCount: 1, providerRequestCount: 1, cancelRequested: false, result: null, error: null, createdAt: "2026-08-07T00:00:00Z", updatedAt: "2026-08-07T00:00:01Z" },
    { jobId, state: "SUCCEEDED", stage: "SUCCEEDED", attemptCount: 1, providerRequestCount: 1, cancelRequested: false, result: VALID_SUCCESS_BODY, error: null, createdAt: "2026-08-07T00:00:00Z", updatedAt: "2026-08-07T00:00:02Z" },
  ];
  const progress: string[] = [];
  let active = 0;
  let maxActive = 0;

  const state = await requestStudySubmission("async decree", {
    idempotencyKey: "submission-async",
    fetchImpl: async (input) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      requests.push(String(input));
      const response = requests.length === 1
        ? Response.json({ jobId, state: "QUEUED", statusUrl: `/api/decree-jobs/${jobId}`, cancelUrl: `/api/decree-jobs/${jobId}/cancel`, acceptedAt: "2026-08-07T00:00:00Z", replayed: false }, { status: 202 })
        : Response.json(jobStates.shift());
      active -= 1;
      return response;
    },
    scheduleRedirect: () => assert.fail("must not redirect"),
    wait: async () => {},
    onProgress: (phase) => progress.push(phase),
  });

  assert.equal(maxActive, 1);
  assert.deepEqual(progress, ["queued", "queued", "running"]);
  assert.equal(state.phase, "success");
  assert.equal(requests.length, 4);
});

test("polling retries bounded transient status failures and preserves sequencing", async () => {
  const jobId = "e".repeat(32);
  const waits: number[] = [];
  let calls = 0;
  const state = await requestStudySubmission("async decree", {
    idempotencyKey: "submission-retry",
    fetchImpl: async () => {
      calls += 1;
      if (calls === 1) {
        return Response.json({ jobId, state: "QUEUED", statusUrl: `/api/decree-jobs/${jobId}`, cancelUrl: `/api/decree-jobs/${jobId}/cancel`, acceptedAt: "2026-08-07T00:00:00Z", replayed: false }, { status: 202 });
      }
      if (calls === 2) throw new Error("temporary disconnect");
      if (calls === 3) return Response.json({ status: "error" }, { status: 503 });
      return Response.json({ jobId, state: "SUCCEEDED", stage: "SUCCEEDED", attemptCount: 1, providerRequestCount: 1, cancelRequested: false, result: VALID_SUCCESS_BODY, error: null, createdAt: "2026-08-07T00:00:00Z", updatedAt: "2026-08-07T00:00:02Z" });
    },
    scheduleRedirect: () => assert.fail("must not redirect"),
    wait: async (milliseconds) => void waits.push(milliseconds),
  });

  assert.equal(state.phase, "success");
  assert.deepEqual(waits, [1000, 2000]);
  assert.equal(calls, 4);
});

test("a lost 202 response reuses the owner-scoped pending idempotency key", async () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
    removeItem: (key: string) => void values.delete(key),
  } as Storage;
  const bodies: Array<Record<string, unknown>> = [];
  const dependencies = {
    userId: "owner-a",
    storage,
    draftVersion: 3,
    draftFingerprint: "d".repeat(64),
    scheduleRedirect: () => assert.fail("must not redirect"),
    fetchImpl: async (_input: RequestInfo | URL, init?: RequestInit) => {
      bodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
      throw new Error("response lost after backend acceptance");
    },
  };

  await requestStudySubmission("same decree", dependencies);
  await requestStudySubmission("same decree", dependencies);

  assert.equal(bodies.length, 2);
  assert.equal(bodies[0].idempotencyKey, bodies[1].idempotencyKey);
  assert.match(String(bodies[0].idempotencyKey), /^[0-9a-f-]{36}$/);
});

test("an owner switch stops an old resume loop without clearing that owner's job", async () => {
  const jobId = "f".repeat(32);
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
    removeItem: (key: string) => void values.delete(key),
  } as Storage;
  saveActiveJob(storage, "owner-a", { jobId, idempotencyKey: "owner-a-key" });
  let current = true;
  let calls = 0;

  const state = await resumeStudySubmission(jobId, {
    userId: "owner-a",
    storage,
    fetchImpl: async () => {
      calls += 1;
      return Response.json({ jobId, state: "QUEUED", stage: "QUEUED", attemptCount: 0, providerRequestCount: 0, cancelRequested: false, result: null, error: null, createdAt: "2026-08-07T00:00:00Z", updatedAt: "2026-08-07T00:00:00Z" });
    },
    scheduleRedirect: () => assert.fail("stale owner must not redirect"),
    wait: async () => { current = false; },
    isCurrent: () => current,
  });

  assert.deepEqual(state, { phase: "idle" });
  assert.equal(calls, 1);
  assert.deepEqual(loadActiveJob(storage, "owner-a"), {
    jobId,
    idempotencyKey: "owner-a-key",
  });
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
