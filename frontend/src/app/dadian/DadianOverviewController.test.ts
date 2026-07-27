import assert from "node:assert/strict";
import test from "node:test";

import type { DadianOverview } from "../../lib/backendClient.ts";
import { createDadianOverviewController } from "./DadianOverviewController.ts";

function overview(
  replyCount: number,
  departments: DadianOverview["departmentCounts"],
  title: string,
): DadianOverview {
  return {
    replyCount,
    departmentCounts: departments,
    pendingReviewCount: 0,
    todayFocus: "核对真实回奏",
    recentReplies: replyCount === 0
      ? []
      : [{
          id: `reply-${replyCount}`,
          title,
          participatingDepartments: [departments[0]?.department ?? "户部"],
          replyConclusion: `${title}的完整结论`,
          replyTime: "2026-07-24T08:00:00Z",
          createdAt: "2026-07-24T08:00:01Z",
          respondent: "丞相",
        }],
  };
}

function successResponse(data: DadianOverview): Response {
  return Response.json({ status: "ok", overview: data });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

test("controller encodes filters and preserves unfiltered real department options", async () => {
  const requests: string[] = [];
  const baselineDepartments = [
    { department: "户部", count: 3 },
    { department: "兵部", count: 2 },
  ];
  const responses = [
    overview(5, baselineDepartments, "全量"),
    overview(3, [{ department: "户部", count: 3 }], "户部"),
  ];
  const controller = createDadianOverviewController({
    fetch: async (input) => {
      requests.push(String(input));
      return successResponse(responses.shift()!);
    },
    navigate: () => assert.fail("successful requests must not navigate"),
    onStateChange: () => undefined,
  });

  await controller.loadInitial();
  await controller.selectDepartment("户 部/度支");

  assert.deepEqual(requests, [
    "/api/dadian/overview",
    "/api/dadian/overview?department=%E6%88%B7%20%E9%83%A8%2F%E5%BA%A6%E6%94%AF",
  ]);
  assert.equal(controller.getState().department, "户 部/度支");
  assert.equal(controller.getState().overview?.recentReplies[0]?.title, "户部");
  assert.deepEqual(
    controller.getState().overview?.departmentCounts,
    baselineDepartments,
    "a filtered response must not replace the unfiltered options",
  );
});

test("controller aborts rapid switches and accepts only the latest response", async () => {
  const requests: Array<{
    signal: AbortSignal;
    response: ReturnType<typeof deferred<Response>>;
  }> = [];
  const controller = createDadianOverviewController({
    fetch: async (_input, init) => {
      const response = deferred<Response>();
      requests.push({ signal: init?.signal as AbortSignal, response });
      return response.promise;
    },
    navigate: () => assert.fail("successful requests must not navigate"),
    onStateChange: () => undefined,
  });

  const first = controller.selectDepartment("户部");
  const second = controller.selectDepartment("兵部");
  assert.equal(requests[0]?.signal.aborted, true);
  assert.equal(requests[1]?.signal.aborted, false);

  requests[1]!.response.resolve(
    successResponse(overview(1, [{ department: "兵部", count: 1 }], "最新兵部")),
  );
  await second;
  requests[0]!.response.resolve(
    successResponse(overview(1, [{ department: "户部", count: 1 }], "过期户部")),
  );
  await first;

  assert.equal(controller.getState().department, "兵部");
  assert.equal(controller.getState().overview?.recentReplies[0]?.title, "最新兵部");
});

test("controller retries the current filter and sends a backend 401 to login", async () => {
  const requests: string[] = [];
  const navigations: string[] = [];
  let attempt = 0;
  const controller = createDadianOverviewController({
    fetch: async (input) => {
      requests.push(String(input));
      attempt += 1;
      if (attempt === 1) throw new Error("offline");
      if (attempt === 2) {
        return successResponse(
          overview(1, [{ department: "礼部", count: 1 }], "重试成功"),
        );
      }
      return Response.json(
        { status: "error", reason: "unauthenticated" },
        { status: 401 },
      );
    },
    navigate: (location) => navigations.push(location),
    onStateChange: () => undefined,
  });

  await controller.selectDepartment("礼部");
  assert.match(controller.getState().error ?? "", /暂时不可用/);

  await controller.retry();
  assert.equal(controller.getState().overview?.recentReplies[0]?.title, "重试成功");
  assert.deepEqual(requests.slice(0, 2), [
    "/api/dadian/overview?department=%E7%A4%BC%E9%83%A8",
    "/api/dadian/overview?department=%E7%A4%BC%E9%83%A8",
  ]);

  await controller.selectDepartment("兵部");
  assert.deepEqual(navigations, ["/login?next=%2Fdadian"]);
});

test("controller keeps the last known good overview when a refresh fails", async () => {
  let attempt = 0;
  const knownGood = overview(
    2,
    [{ department: "户部", count: 2 }],
    "上次有效回奏",
  );
  const controller = createDadianOverviewController({
    fetch: async () => {
      attempt += 1;
      if (attempt === 1) return successResponse(knownGood);
      throw new Error("offline");
    },
    navigate: () => assert.fail("network failure must not navigate"),
    onStateChange: () => undefined,
  });

  await controller.loadInitial();
  await controller.selectDepartment("户部");

  assert.equal(controller.getState().department, "户部");
  assert.equal(
    controller.getState().overview?.recentReplies[0]?.title,
    "上次有效回奏",
  );
  assert.match(controller.getState().error ?? "", /暂时不可用/);
});

test("controller redirects only an exact 401 response", async () => {
  const navigations: string[] = [];
  const controller = createDadianOverviewController({
    fetch: async () =>
      Response.json(
        { status: "error", reason: "forbidden" },
        { status: 403 },
      ),
    navigate: (location) => navigations.push(location),
    onStateChange: () => undefined,
  });

  await controller.loadInitial();

  assert.deepEqual(navigations, []);
  assert.match(controller.getState().error ?? "", /暂时不可用/);
});

test("controller fails closed when a 200 overview contains malformed nested data", async () => {
  const valid = overview(1, [{ department: "户部", count: 1 }], "合法回奏");
  const malformed: unknown[] = [
    { ...valid, replyCount: -1 },
    { ...valid, pendingReviewCount: 1.5 },
    { ...valid, todayFocus: 42 },
    { ...valid, departmentCounts: [{ department: "户部", count: Number.NaN }] },
    { ...valid, recentReplies: {} },
    { ...valid, recentReplies: [{ ...valid.recentReplies[0], respondent: null }] },
    {
      ...valid,
      recentReplies: [{
        ...valid.recentReplies[0],
        participatingDepartments: ["户部", 7],
      }],
    },
  ];

  for (const candidate of malformed) {
    const controller = createDadianOverviewController({
      fetch: async () => Response.json({ status: "ok", overview: candidate }),
      navigate: () => assert.fail("malformed success must not navigate"),
      onStateChange: () => undefined,
    });

    await controller.loadInitial();

    assert.equal(controller.getState().overview, null);
    assert.match(controller.getState().error ?? "", /暂时不可用/);
  }
});
