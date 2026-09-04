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
    progressFreshness: "current",
    recoveryMode: "redraft",
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
    progressFreshness: "stale",
    recoveryMode: "redraft",
  };
  const staleModelState: DecreeUiState = modelState.phase === "error"
    ? { ...modelState, progressFreshness: "stale", recoveryMode: "redraft" }
    : modelState;
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
      staleModelState,
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
  const queuedSnapshot = { jobId, state: "QUEUED", stage: "QUEUED", attemptCount: 0, providerRequestCount: 0, cancelRequested: false, result: null, error: null, createdAt: "2026-08-07T00:00:00Z", updatedAt: "2026-08-07T00:00:00Z" };
  const runningSnapshot = { jobId, state: "RUNNING", stage: "RUNNING", attemptCount: 1, providerRequestCount: 1, cancelRequested: false, result: null, error: null, createdAt: "2026-08-07T00:00:00Z", updatedAt: "2026-08-07T00:00:01Z" };
  const succeededSnapshot = { jobId, state: "SUCCEEDED", stage: "SUCCEEDED", attemptCount: 1, providerRequestCount: 1, cancelRequested: false, result: VALID_SUCCESS_BODY, error: null, createdAt: "2026-08-07T00:00:00Z", updatedAt: "2026-08-07T00:00:02Z" };
  const jobStates = [queuedSnapshot, runningSnapshot, succeededSnapshot];
  const progress: Array<{ phase: string; jobId: string; snapshot: unknown }> = [];
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
    onProgress: (phase, progressJobId, snapshot) => progress.push({
      phase,
      jobId: progressJobId,
      snapshot,
    }),
  });

  assert.equal(maxActive, 1);
  assert.deepEqual(progress, [
    { phase: "queued", jobId, snapshot: undefined },
    {
      phase: "queued",
      jobId,
      snapshot: {
        jobId,
        state: "QUEUED",
        stage: "QUEUED",
        attemptCount: 0,
        providerRequestCount: 0,
        createdAt: "2026-08-07T00:00:00Z",
        updatedAt: "2026-08-07T00:00:00Z",
      },
    },
    {
      phase: "running",
      jobId,
      snapshot: {
        jobId,
        state: "RUNNING",
        stage: "RUNNING",
        attemptCount: 1,
        providerRequestCount: 1,
        createdAt: "2026-08-07T00:00:00Z",
        updatedAt: "2026-08-07T00:00:01Z",
      },
    },
  ]);
  assert.equal(state.phase, "success");
  if (state.phase === "success") {
    assert.deepEqual(state.jobProgress, {
      jobId,
      state: "SUCCEEDED",
      stage: "SUCCEEDED",
      attemptCount: 1,
      providerRequestCount: 1,
      createdAt: "2026-08-07T00:00:00Z",
      updatedAt: "2026-08-07T00:00:02Z",
    });
  }
  assert.equal(requests.length, 4);
});

test("terminal failure keeps the latest validated public job snapshot", async () => {
  const jobId = "9".repeat(32);
  const queued = {
    jobId,
    state: "QUEUED",
    stage: "RETRY_WAIT",
    attemptCount: 1,
    providerRequestCount: 2,
    cancelRequested: false,
    result: null,
    error: null,
    createdAt: "2026-08-26T01:00:00Z",
    updatedAt: "2026-08-26T01:01:00Z",
  };
  const failed = {
    ...queued,
    state: "FAILED",
    stage: "FAILED",
    error: { code: "provider_failed", stage: "model", category: "provider" },
    updatedAt: "2026-08-26T01:02:00Z",
  };
  const responses = [
    Response.json({
      jobId,
      state: "QUEUED",
      statusUrl: `/api/decree-jobs/${jobId}`,
      cancelUrl: `/api/decree-jobs/${jobId}/cancel`,
      acceptedAt: "2026-08-26T01:00:00Z",
      replayed: false,
    }, { status: 202 }),
    Response.json(queued),
    Response.json(failed),
  ];

  const state = await requestStudySubmission("preserve progress", {
    fetchImpl: async () => responses.shift()!,
    scheduleRedirect: () => assert.fail("must not redirect"),
    wait: async () => {},
  });

  assert.equal(state.phase, "error");
  if (state.phase === "error") {
    assert.equal(state.progressFreshness, "current");
    assert.equal(state.recoveryMode, "redraft");
    assert.deepEqual(state.lastVerifiedProgress, {
      jobId,
      state: "FAILED",
      stage: "FAILED",
      attemptCount: 1,
      providerRequestCount: 2,
      createdAt: "2026-08-26T01:00:00Z",
      updatedAt: "2026-08-26T01:02:00Z",
    });
  }
});

test("accounting source blocker shows the missing input and next step", async () => {
  const jobId = "b".repeat(32);
  const states = [
    Response.json({ jobId, state: "QUEUED", statusUrl: `/api/decree-jobs/${jobId}`, cancelUrl: `/api/decree-jobs/${jobId}/cancel`, acceptedAt: "2026-08-07T00:00:00Z", replayed: false }, { status: 202 }),
    Response.json({
      jobId,
      state: "SUCCEEDED",
      stage: "SUCCEEDED",
      attemptCount: 1,
      providerRequestCount: 0,
      cancelRequested: false,
      result: {
        status: "blocked",
        deliveryKind: "accounting_report",
        departments: ["户部"],
        finalVerdict: "系统内财务数据当前无法通过格式或主体身份校验。",
        recommendations: ["请管理员修正受控财务数据源后重新下旨。"],
        artifacts: [],
      },
      error: null,
      createdAt: "2026-08-07T00:00:00Z",
      updatedAt: "2026-08-07T00:00:01Z",
    }),
  ];

  const state = await requestStudySubmission("accounting decree", {
    fetchImpl: async () => states.shift()!,
    scheduleRedirect: () => assert.fail("must not redirect"),
    wait: async () => {},
  });

  assert.equal(state.phase, "error");
  if (state.phase === "error") {
    assert.equal(state.message, "回奏受阻：系统内财务数据当前无法通过格式或主体身份校验。请管理员修正受控财务数据源后重新下旨；本次未生成 Excel 文件。");
    assert.equal(state.progressFreshness, "current");
    assert.equal(state.recoveryMode, "redraft");
    assert.equal(state.lastVerifiedProgress?.state, "SUCCEEDED");
    assert.equal(state.lastVerifiedProgress?.stage, "SUCCEEDED");
  }
});

test("failed format job does not claim a model failure", async () => {
  const jobId = "c".repeat(32);
  const states = [
    Response.json({ jobId, state: "QUEUED", statusUrl: `/api/decree-jobs/${jobId}`, cancelUrl: `/api/decree-jobs/${jobId}/cancel`, acceptedAt: "2026-08-07T00:00:00Z", replayed: false }, { status: 202 }),
    Response.json({
      jobId,
      state: "FAILED",
      stage: "FAILED",
      attemptCount: 1,
      providerRequestCount: 0,
      cancelRequested: false,
      result: null,
      error: { code: "format_unrecognized", stage: "bureau_tool", category: "format" },
      createdAt: "2026-08-07T00:00:00Z",
      updatedAt: "2026-08-07T00:00:01Z",
    }),
  ];

  const state = await requestStudySubmission("accounting decree", {
    fetchImpl: async () => states.shift()!,
    scheduleRedirect: () => assert.fail("must not redirect"),
    wait: async () => {},
  });

  assert.equal(state.phase, "error");
  if (state.phase === "error") {
    assert.equal(state.message, "会计司未能识别现有数据格式，已尝试替代读取策略。");
    assert.equal(state.message.includes("模型"), false);
    assert.equal(state.progressFreshness, "current");
    assert.equal(state.recoveryMode, "redraft");
    assert.equal(state.lastVerifiedProgress?.state, "FAILED");
  }
});

test("malformed legacy failure uses unknown fallback rather than model", async () => {
  const jobId = "d".repeat(32);
  const states = [
    Response.json({ jobId, state: "QUEUED", statusUrl: `/api/decree-jobs/${jobId}`, cancelUrl: `/api/decree-jobs/${jobId}/cancel`, acceptedAt: "2026-08-07T00:00:00Z", replayed: false }, { status: 202 }),
    Response.json({ jobId, state: "FAILED", stage: "FAILED", attemptCount: 1,
      providerRequestCount: 0, cancelRequested: false, result: null,
      error: { code: "legacy-private" }, createdAt: "2026-08-07T00:00:00Z",
      updatedAt: "2026-08-07T00:00:01Z" }),
  ];
  const state = await requestStudySubmission("accounting decree", {
    fetchImpl: async () => states.shift()!, scheduleRedirect: () => {}, wait: async () => {},
  });
  assert.equal(state.phase, "error");
  if (state.phase === "error") {
    assert.equal(state.message, "发生未知错误，请稍后重试。");
    assert.equal(state.progressFreshness, "current");
    assert.equal(state.recoveryMode, "redraft");
    assert.equal(state.lastVerifiedProgress?.state, "FAILED");
  }
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

test("resume preserves the last verified snapshot through bootstrap and exhausted network retries", async () => {
  const jobId = "8".repeat(32);
  const initialProgress = {
    jobId,
    state: "QUEUED" as const,
    stage: "RETRY_WAIT",
    attemptCount: 2,
    providerRequestCount: 4,
    createdAt: "2026-08-26T01:00:00Z",
    updatedAt: "2026-08-26T01:05:00Z",
  };
  const progress: unknown[] = [];
  let calls = 0;

  const state = await resumeStudySubmission(jobId, {
    initialProgress,
    fetchImpl: async () => {
      calls += 1;
      throw new Error("still offline");
    },
    scheduleRedirect: () => assert.fail("must not redirect"),
    wait: async () => {},
    onProgress: (phase, progressJobId, snapshot) => {
      progress.push({ phase, jobId: progressJobId, snapshot });
    },
  });

  assert.equal(calls, 4);
  assert.deepEqual(progress, [{ phase: "queued", jobId, snapshot: initialProgress }]);
  assert.deepEqual(state, {
    phase: "error",
    message: "无法连接朝堂后端，请确认后端服务已启动后重试。",
    lastVerifiedProgress: initialProgress,
    progressFreshness: "stale",
    recoveryMode: "resume",
  });
});

test("a 401 after a verified snapshot keeps the snapshot but marks it stale", async () => {
  const jobId = "9".repeat(32);
  const verifiedProgress = {
    jobId,
    state: "RUNNING" as const,
    stage: "RUNNING",
    attemptCount: 1,
    providerRequestCount: 2,
    createdAt: "2026-08-26T02:00:00Z",
    updatedAt: "2026-08-26T02:01:00Z",
  };
  const redirects: string[] = [];
  let calls = 0;

  const state = await requestStudySubmission("核验经营目标", {
    fetchImpl: async () => {
      calls += 1;
      if (calls === 1) {
        return Response.json({ state: "QUEUED", jobId }, { status: 202 });
      }
      if (calls === 2) return Response.json(verifiedProgress);
      return new Response(null, { status: 401 });
    },
    scheduleRedirect: (path) => redirects.push(path),
    wait: async () => {},
  });

  assert.equal(calls, 3);
  assert.deepEqual(redirects, ["/login?next=%2Fstudy"]);
  assert.deepEqual(state, {
    phase: "error",
    message: "会话已过期，正在返回登录页。",
    lastVerifiedProgress: verifiedProgress,
    progressFreshness: "stale",
    recoveryMode: "redraft",
  });
});

for (const [name, invalidProgress] of [
  ["RUNNING with terminal FAILED stage", { state: "RUNNING", stage: "FAILED" }],
  ["QUEUED with running ARCHIVING stage", { state: "QUEUED", stage: "ARCHIVING" }],
  ["unparseable createdAt", { createdAt: "not-a-date" }],
  ["timezone-free createdAt", { createdAt: "2026-08-26T03:00:00" }],
  ["overflow createdAt", { createdAt: "2026-02-30T03:00:00Z" }],
  ["invalid updatedAt timezone", { updatedAt: "2026-08-26T03:00:00+24:00" }],
] as const) {
  test(`browser job parser rejects ${name}`, async () => {
    const jobId = "7".repeat(32);
    let calls = 0;
    const state = await requestStudySubmission("核验经营目标", {
      fetchImpl: async () => {
        calls += 1;
        if (calls === 1) {
          return Response.json({ state: "QUEUED", jobId }, { status: 202 });
        }
        if (calls > 2) return Response.json({}, { status: 404 });
        return Response.json(Object.assign({
          jobId,
          state: "RUNNING",
          stage: "RUNNING",
          attemptCount: 1,
          providerRequestCount: 2,
          createdAt: "2026-08-26T03:00:00Z",
          updatedAt: "2026-08-26T03:01:00Z",
        }, invalidProgress));
      },
      scheduleRedirect: () => assert.fail("invalid progress must not redirect"),
      wait: async () => {},
    });

    assert.equal(calls, 2);
    assert.deepEqual(state, {
      phase: "error",
      message: "发生未知错误，请稍后重试。",
      progressFreshness: "stale",
      recoveryMode: "resume",
    });
  });
}

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
