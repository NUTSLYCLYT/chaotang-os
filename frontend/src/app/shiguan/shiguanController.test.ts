import assert from "node:assert/strict";
import test from "node:test";

import type {
  ArchiveDecision,
  ReviewStatusValue,
  ShiguanArchive,
  ShiguanRecallMatch,
  ShiguanReviewStatus,
  ShiguanStatistics,
} from "../../lib/backendClient.ts";
import {
  ShiguanController,
  ShiguanUiError,
} from "./shiguanController.ts";
import { requestShiguanJson } from "./shiguanRequest.ts";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function archive(id: string, title = id): ShiguanArchive {
  return {
    id,
    type: "REPLY",
    title,
    content: `${title}正文`,
    matterType: "漕运",
    department: "户部",
    relatedArchiveIds: [],
    evidence: [],
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
    reviewStatus: null,
    decisionStatus: null,
    evidenceReferences: [],
  };
}

function decision(value: ArchiveDecision["decision"], decidedAt = "2026-08-09T02:00:00Z"): ArchiveDecision {
  return { decision: value, decidedAt };
}

test("decision is non-optimistic, suppresses duplicate clicks, and survives a stale archive refresh", async () => {
  const decisionRequest = deferred<ArchiveDecision>();
  const staleArchives = deferred<ShiguanArchive[]>();
  let listCalls = 0;
  let decisionCalls = 0;
  const controller = new ShiguanController({
    listArchives: () => listCalls++ === 0 ? Promise.resolve([archive("a-1")]) : staleArchives.promise,
    getStatistics: async () => statistics(1),
    recall: async () => [],
    review: async () => review("OBSERVING", "2026-08-09T01:00:00Z"),
    decide: () => {
      decisionCalls += 1;
      return decisionRequest.promise;
    },
  });
  controller.start();
  await settle();

  assert.equal(controller.decideArchive("a-1", "ADOPTED"), true);
  assert.equal(controller.decideArchive("a-1", "RETURNED_FOR_RECONSIDERATION"), false);
  assert.equal(decisionCalls, 1);
  assert.equal(controller.state.decisionState.status, "loading");
  assert.equal(controller.state.archives[0].decisionStatus, null);

  controller.retryArchives();
  decisionRequest.resolve(decision("ADOPTED"));
  await settle();
  staleArchives.resolve([archive("a-1", "stale copy")]);
  await settle();

  assert.deepEqual(controller.state.archives[0].decisionStatus, decision("ADOPTED"));
  assert.equal(controller.state.decisionState.status, "ready");
  assert.match(controller.state.decisionState.message, /已采纳/);
  assert.equal(controller.decideArchive("a-1", "ADOPTED"), false);
});

test("decision conflict keeps the last confirmed archive value and exposes retry guidance", async () => {
  const existing = { ...archive("a-1"), decisionStatus: decision("REJECTED") };
  const controller = new ShiguanController({
    listArchives: async () => [existing],
    getStatistics: async () => statistics(1),
    recall: async () => [],
    review: async () => review("OBSERVING", "2026-08-09T01:00:00Z"),
    decide: async () => { throw new ShiguanUiError("conflict", "请刷新查看已归档结果"); },
  });
  controller.start();
  await settle();

  assert.equal(controller.decideArchive("a-1", "APPROVED"), false);
  assert.equal(controller.state.archives[0].decisionStatus?.decision, "REJECTED");

  const pendingController = new ShiguanController({
    listArchives: async () => [archive("a-2")],
    getStatistics: async () => statistics(1),
    recall: async () => [],
    review: async () => review("OBSERVING", "2026-08-09T01:00:00Z"),
    decide: async () => { throw new ShiguanUiError("conflict", "请刷新查看已归档结果"); },
  });
  pendingController.start();
  await settle();
  assert.equal(pendingController.decideArchive("a-2", "ADOPTED"), true);
  await settle();
  assert.equal(pendingController.state.decisionState.errorKind, "conflict");
  assert.equal(pendingController.state.archives[0].decisionStatus, null);
});

test("decision transient failure remains pending and the same action retries successfully", async () => {
  let calls = 0;
  const controller = new ShiguanController({
    listArchives: async () => [archive("a-1")],
    getStatistics: async () => statistics(1),
    recall: async () => [],
    review: async () => review("OBSERVING", "2026-08-09T01:00:00Z"),
    decide: async () => {
      calls += 1;
      if (calls === 1) throw new ShiguanUiError("network", "首次失败，请重试");
      return decision("ADOPTED", "2026-08-09T03:00:00Z");
    },
  });
  controller.start();
  await settle();

  assert.equal(controller.decideArchive("a-1", "ADOPTED"), true);
  await settle();
  assert.equal(controller.state.decisionState.status, "error");
  assert.equal(controller.state.archives[0].decisionStatus, null);

  assert.equal(controller.decideArchive("a-1", "ADOPTED"), true);
  await settle();
  assert.equal(calls, 2);
  assert.equal(controller.state.decisionState.status, "ready");
  assert.deepEqual(
    controller.state.archives[0].decisionStatus,
    decision("ADOPTED", "2026-08-09T03:00:00Z"),
  );
});

test("final disconnect aborts an in-flight decision and ignores its late completion", async () => {
  const decisionRequest = deferred<ArchiveDecision>();
  let decisionSignal: AbortSignal | undefined;
  let notifications = 0;
  const controller = new ShiguanController({
    listArchives: async () => [archive("a-1")],
    getStatistics: async () => statistics(1),
    recall: async () => [],
    review: async () => review("OBSERVING", "2026-08-09T01:00:00Z"),
    decide: (_archiveId, _decision, signal) => {
      decisionSignal = signal;
      return decisionRequest.promise;
    },
  });
  const disconnect = controller.connect(() => { notifications += 1; });
  controller.start();
  await settle();
  assert.equal(controller.decideArchive("a-1", "ADOPTED"), true);
  const notificationsBeforeDisconnect = notifications;

  disconnect();
  await settle();
  assert.equal(decisionSignal?.aborted, true);
  decisionRequest.resolve(decision("ADOPTED"));
  await settle();

  assert.equal(controller.state.archives[0].decisionStatus, null);
  assert.equal(notifications, notificationsBeforeDisconnect);
});

function statistics(total: number, partial = 0): ShiguanStatistics {
  return {
    total,
    achieved: 0,
    notAchieved: 0,
    partial,
    observing: 0,
    pendingReview: total - partial,
    successRate: null,
  };
}

function review(status: ReviewStatusValue, reviewedAt: string): ShiguanReviewStatus {
  return { status, reviewedAt, note: `${status} note` };
}

async function settle(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

test("archives and statistics settle independently and preserve stale last-known-good data", async () => {
  const archiveRequests = [
    deferred<ShiguanArchive[]>(),
    deferred<ShiguanArchive[]>(),
  ];
  const statisticsRequests = [
    deferred<ShiguanStatistics>(),
    deferred<ShiguanStatistics>(),
  ];
  let archiveCall = 0;
  let statisticsCall = 0;
  let listImplementation = () => archiveRequests[archiveCall++].promise;
  const controller = new ShiguanController({
    listArchives: () => listImplementation(),
    getStatistics: () => statisticsRequests[statisticsCall++].promise,
    recall: async () => [],
    review: async () => review("OBSERVING", "2026-07-24T09:00:00Z"),
    decide: async () => decision("ADOPTED"),
  });

  controller.start();
  archiveRequests[0].resolve([archive("a-1")]);
  statisticsRequests[0].reject(new ShiguanUiError("network", "统计暂不可用"));
  await settle();

  assert.deepEqual(controller.state.archives.map((item) => item.id), ["a-1"]);
  assert.equal(controller.state.archiveState.status, "ready");
  assert.equal(controller.state.statisticsState.status, "error");
  assert.equal(controller.state.statistics, null);

  controller.retryStatistics();
  statisticsRequests[1].resolve(statistics(1));
  await settle();
  assert.equal(controller.state.statisticsState.status, "ready");
  assert.equal(
    (controller.state.statistics as ShiguanStatistics | null)?.total,
    1,
  );

  const failingArchives = deferred<ShiguanArchive[]>();
  listImplementation = () => failingArchives.promise;
  controller.filter({ type: "REPLY", matterType: "漕运", department: "户部" });
  failingArchives.reject(new ShiguanUiError("validation", "筛选条件有误"));
  await settle();
  assert.equal(controller.state.archiveState.status, "error");
  assert.equal(controller.state.archiveState.stale, true);
  assert.deepEqual(controller.state.archives.map((item) => item.id), ["a-1"]);

  const retriedArchives = deferred<ShiguanArchive[]>();
  listImplementation = () => retriedArchives.promise;
  controller.retryArchives();
  retriedArchives.resolve([archive("a-2")]);
  await settle();
  assert.equal(controller.state.archiveState.status, "ready");
  assert.equal(controller.state.selectedArchiveId, "a-2");
});

test("latest archive and statistics generations win filtered request races", async () => {
  const archivesOld = deferred<ShiguanArchive[]>();
  const archivesNew = deferred<ShiguanArchive[]>();
  const statsOld = deferred<ShiguanStatistics>();
  const statsNew = deferred<ShiguanStatistics>();
  let archiveCall = 0;
  let statsCall = 0;
  const controller = new ShiguanController({
    listArchives: () => [archivesOld, archivesNew][archiveCall++].promise,
    getStatistics: () => [statsOld, statsNew][statsCall++].promise,
    recall: async () => [],
    review: async () => review("OBSERVING", "2026-07-24T09:00:00Z"),
    decide: async () => decision("ADOPTED"),
  });

  controller.start();
  controller.filter({ type: "REPLY", matterType: "新案", department: "" });
  archivesNew.resolve([archive("new")]);
  statsNew.resolve(statistics(2));
  await settle();
  archivesOld.resolve([archive("old")]);
  statsOld.resolve(statistics(99));
  await settle();

  assert.deepEqual(controller.state.archives.map((item) => item.id), ["new"]);
  assert.equal(controller.state.selectedArchiveId, "new");
  assert.equal(controller.state.statistics?.total, 2);
});

test("recall exposes validation, not-found and unauthenticated errors with explicit retry state", async () => {
  const errors = [
    new ShiguanUiError("validation", "至少填写一个条件"),
    new ShiguanUiError("not_found", "未找到对应旧案"),
    new ShiguanUiError("unauthenticated", "authentication required"),
  ];
  let calls = 0;
  let navigations = 0;
  const controller = new ShiguanController(
    {
      listArchives: async () => [],
      getStatistics: async () => statistics(0),
      recall: async () => {
        throw errors[calls++];
      },
      review: async () => review("OBSERVING", "2026-07-24T09:00:00Z"),
      decide: async () => decision("ADOPTED"),
    },
    { onUnauthorized: () => { navigations += 1; } },
  );

  controller.recall({ matterType: "", department: "" });
  await settle();
  assert.deepEqual(
    {
      status: controller.state.recallState.status,
      kind: controller.state.recallState.errorKind,
    },
    { status: "error", kind: "validation" },
  );

  controller.retryRecall();
  await settle();
  assert.equal(controller.state.recallState.errorKind, "not_found");

  controller.retryRecall();
  await settle();
  assert.equal(controller.state.recallState.errorKind, "unauthenticated");
  assert.equal(navigations, 1);
});

test("unauthenticated response clears all expired state and navigates once", async () => {
  let recallFails = false;
  let navigations = 0;
  const match: ShiguanRecallMatch = {
    archiveId: "a-1",
    matchReason: "事项类型一致",
    historicalConclusion: "准予施行",
    evidenceLabels: ["LIVE"],
    reviewStatus: null,
    lessonsLearned: null,
    pitfalls: null,
  };
  const controller = new ShiguanController(
    {
      listArchives: async () => [archive("a-1")],
      getStatistics: async () => statistics(1),
      recall: async () => {
        if (recallFails) {
          throw new ShiguanUiError("unauthenticated", "会话已过期");
        }
        return [match];
      },
      review: async () => review("OBSERVING", "2026-07-24T09:00:00Z"),
      decide: async () => decision("ADOPTED"),
    },
    { onUnauthorized: () => { navigations += 1; } },
  );

  controller.start();
  controller.recall({ matterType: "漕运", department: "" });
  await settle();
  assert.equal(controller.state.archives.length, 1);
  assert.equal(controller.state.statistics?.total, 1);
  assert.equal(controller.state.matches.length, 1);

  recallFails = true;
  controller.retryRecall();
  await settle();

  assert.deepEqual(controller.state.archives, []);
  assert.equal(controller.state.statistics, null);
  assert.deepEqual(controller.state.matches, []);
  assert.equal(controller.state.selectedArchiveId, null);
  assert.equal(controller.state.recallState.errorKind, "unauthenticated");
  assert.equal(navigations, 1);

  controller.retryRecall();
  await settle();
  assert.equal(navigations, 1);
});

test("real empty and HTML 401 responses clear controller state and navigate once", async () => {
  for (const responseBody of [null, "<html>expired</html>"]) {
    let expired = false;
    let navigations = 0;
    const controller = new ShiguanController(
      {
        listArchives: async () => [archive("a-1")],
        getStatistics: async () => statistics(1),
        recall: async () => {
          if (!expired) return [];
          return requestShiguanJson(
            "/api/shiguan/recall",
            {},
            () => [],
            async () => new Response(responseBody, {
              status: 401,
              headers: responseBody === null
                ? undefined
                : { "content-type": "text/html" },
            }),
          );
        },
        review: async () => review("OBSERVING", "2026-07-24T09:00:00Z"),
        decide: async () => decision("ADOPTED"),
      },
      { onUnauthorized: () => { navigations += 1; } },
    );

    controller.start();
    await settle();
    expired = true;
    controller.recall({ matterType: "漕运", department: "" });
    await settle();
    await settle();

    assert.deepEqual(controller.state.archives, []);
    assert.equal(controller.state.statistics, null);
    assert.equal(controller.state.selectedArchiveId, null);
    assert.equal(controller.state.recallState.errorKind, "unauthenticated");
    assert.equal(navigations, 1);
  }
});

test("review disables duplicate submit, ignores stale responses, and preserves PARTIAL exactly", async () => {
  const firstReview = deferred<ShiguanReviewStatus>();
  const secondReview = deferred<ShiguanReviewStatus>();
  let calls = 0;
  const controller = new ShiguanController({
    listArchives: async () => [archive("a-1"), archive("a-2")],
    getStatistics: async () => statistics(2),
    recall: async () => [],
    review: () => [firstReview, secondReview][calls++].promise,
    decide: async () => decision("ADOPTED"),
  });
  controller.start();
  await settle();

  assert.equal(
    controller.reviewArchive("a-1", { status: "ACHIEVED", note: "first" }),
    true,
  );
  assert.equal(
    controller.reviewArchive("a-1", { status: "PARTIAL", note: "duplicate" }),
    false,
  );
  assert.equal(calls, 1);
  assert.equal(controller.state.reviewState.status, "loading");

  controller.selectArchive("a-2");
  assert.equal(
    controller.reviewArchive("a-2", { status: "PARTIAL", note: "latest" }),
    true,
  );
  secondReview.resolve(review("PARTIAL", "2026-07-24T10:00:00Z"));
  await settle();
  firstReview.resolve(review("ACHIEVED", "2026-07-24T09:00:00Z"));
  await settle();

  assert.equal(controller.state.reviewState.status, "ready");
  assert.equal(controller.state.reviewState.archiveId, "a-2");
  assert.equal(
    controller.state.archives.find((item) => item.id === "a-2")?.reviewStatus?.status,
    "PARTIAL",
  );
  assert.equal(
    controller.state.archives.find((item) => item.id === "a-1")?.reviewStatus,
    null,
  );
});

test("review success survives stale archive and pre-review statistics responses", async () => {
  const initialArchives = deferred<ShiguanArchive[]>();
  const filteredArchives = deferred<ShiguanArchive[]>();
  const initialStats = deferred<ShiguanStatistics>();
  const filteredStats = deferred<ShiguanStatistics>();
  const refreshedStats = deferred<ShiguanStatistics>();
  let archiveCall = 0;
  let statsCall = 0;
  const controller = new ShiguanController({
    listArchives: () => [initialArchives, filteredArchives][archiveCall++].promise,
    getStatistics: () => [initialStats, filteredStats, refreshedStats][statsCall++].promise,
    recall: async () => [],
    review: async () => review("PARTIAL", "2026-07-24T11:00:00Z"),
    decide: async () => decision("ADOPTED"),
  });

  controller.start();
  initialArchives.resolve([archive("a-1")]);
  initialStats.resolve(statistics(1));
  await settle();

  controller.filter({ type: "REPLY", matterType: "", department: "" });
  controller.reviewArchive("a-1", { status: "PARTIAL", note: "confirmed" });
  await settle();
  filteredArchives.resolve([archive("a-1", "stale server copy")]);
  filteredStats.resolve(statistics(1));
  refreshedStats.resolve(statistics(1, 1));
  await settle();

  assert.equal(controller.state.archives[0].reviewStatus?.status, "PARTIAL");
  assert.equal(controller.state.statistics?.partial, 1);
  assert.equal(controller.state.reviewState.status, "ready");
});

test("Strict Mode replay reuses one start and final disconnect disposes every request", async () => {
  const archiveRequest = deferred<ShiguanArchive[]>();
  const statisticsRequest = deferred<ShiguanStatistics>();
  const recallRequest = deferred<ShiguanRecallMatch[]>();
  const reviewRequest = deferred<ShiguanReviewStatus>();
  const signals: AbortSignal[] = [];
  let archiveCalls = 0;
  let statisticsCalls = 0;
  let recallCalls = 0;
  let reviewCalls = 0;
  let unauthorized = 0;
  let notifications = 0;

  const controller = new ShiguanController(
    {
      listArchives: (_input, signal) => {
        archiveCalls += 1;
        signals.push(signal);
        return archiveRequest.promise;
      },
      getStatistics: (signal) => {
        statisticsCalls += 1;
        signals.push(signal);
        return statisticsRequest.promise;
      },
      recall: (_input, signal) => {
        recallCalls += 1;
        signals.push(signal);
        return recallRequest.promise;
      },
      review: (_id, _input, signal) => {
        reviewCalls += 1;
        signals.push(signal);
        return reviewRequest.promise;
      },
      decide: async () => decision("ADOPTED"),
    },
    { onUnauthorized: () => { unauthorized += 1; } },
  );

  const firstCleanup = controller.connect(() => { notifications += 1; });
  controller.start();
  firstCleanup();
  const finalCleanup = controller.connect(() => { notifications += 1; });
  controller.start();

  assert.equal(archiveCalls, 1);
  assert.equal(statisticsCalls, 1);

  controller.recall({ matterType: "漕运", department: "" });
  controller.reviewArchive("a-1", { status: "PARTIAL", note: "pending" });
  assert.equal(recallCalls, 1);
  assert.equal(reviewCalls, 1);

  finalCleanup();
  await settle();
  assert.equal(signals.length, 4);
  assert.equal(signals.every((signal) => signal.aborted), true);

  const notificationsAfterDispose = notifications;
  archiveRequest.reject(new ShiguanUiError("unauthenticated", "late archives"));
  statisticsRequest.reject(new ShiguanUiError("unauthenticated", "late stats"));
  recallRequest.reject(new ShiguanUiError("unauthenticated", "late recall"));
  reviewRequest.resolve(review("PARTIAL", "2026-07-24T12:00:00Z"));
  await settle();

  assert.equal(notifications, notificationsAfterDispose);
  assert.equal(unauthorized, 0);
  assert.equal(statisticsCalls, 1);

  let recreatedArchiveCalls = 0;
  const recreated = new ShiguanController({
    listArchives: async () => {
      recreatedArchiveCalls += 1;
      return [];
    },
    getStatistics: async () => statistics(0),
    recall: async () => [],
    review: async () => review("OBSERVING", "2026-07-24T12:00:00Z"),
    decide: async () => decision("ADOPTED"),
  });
  const recreatedCleanup = recreated.connect(() => undefined);
  recreated.start();
  await settle();
  assert.equal(recreatedArchiveCalls, 1);
  recreatedCleanup();
  await settle();
});

test("last disconnect synchronously pauses queued continuations before deferred disposal", async () => {
  const recallRequest = deferred<ShiguanRecallMatch[]>();
  let unauthorized = 0;
  let notifications = 0;
  const recallController = new ShiguanController(
    {
      listArchives: async () => [],
      getStatistics: async () => statistics(0),
      recall: () => recallRequest.promise,
      review: async () => review("OBSERVING", "2026-07-24T12:00:00Z"),
      decide: async () => decision("ADOPTED"),
    },
    { onUnauthorized: () => { unauthorized += 1; } },
  );
  const disconnectRecall = recallController.connect(() => { notifications += 1; });
  recallController.start();
  await settle();
  recallController.recall({ matterType: "漕运", department: "" });
  const notificationsBeforeRecallDisconnect = notifications;

  recallRequest.reject(new ShiguanUiError("unauthenticated", "queued recall"));
  disconnectRecall();
  await settle();

  assert.equal(unauthorized, 0);
  assert.equal(notifications, notificationsBeforeRecallDisconnect);

  const reviewRequest = deferred<ShiguanReviewStatus>();
  let statisticsCalls = 0;
  let reviewNotifications = 0;
  const reviewController = new ShiguanController({
    listArchives: async () => [archive("a-1")],
    getStatistics: async () => {
      statisticsCalls += 1;
      return statistics(1);
    },
    recall: async () => [],
    review: () => reviewRequest.promise,
    decide: async () => decision("ADOPTED"),
  });
  const disconnectReview = reviewController.connect(() => {
    reviewNotifications += 1;
  });
  reviewController.start();
  await settle();
  reviewController.reviewArchive("a-1", { status: "PARTIAL", note: "queued" });
  const notificationsBeforeReviewDisconnect = reviewNotifications;

  reviewRequest.resolve(review("PARTIAL", "2026-07-24T12:30:00Z"));
  disconnectReview();
  await settle();

  assert.equal(statisticsCalls, 1);
  assert.equal(reviewNotifications, notificationsBeforeReviewDisconnect);
});

test("immediate reconnect restores active continuations without repeating initial requests", async () => {
  const archiveRequest = deferred<ShiguanArchive[]>();
  const statisticsRequest = deferred<ShiguanStatistics>();
  let archiveCalls = 0;
  let statisticsCalls = 0;
  const controller = new ShiguanController({
    listArchives: () => {
      archiveCalls += 1;
      return archiveRequest.promise;
    },
    getStatistics: () => {
      statisticsCalls += 1;
      return statisticsRequest.promise;
    },
    recall: async () => [],
    review: async () => review("OBSERVING", "2026-07-24T12:00:00Z"),
    decide: async () => decision("ADOPTED"),
  });

  const firstDisconnect = controller.connect(() => undefined);
  controller.start();
  firstDisconnect();
  const finalDisconnect = controller.connect(() => undefined);
  controller.start();

  archiveRequest.resolve([archive("a-1")]);
  statisticsRequest.resolve(statistics(1));
  await settle();

  assert.equal(archiveCalls, 1);
  assert.equal(statisticsCalls, 1);
  assert.equal(controller.state.archiveState.status, "ready");
  assert.equal(controller.state.statisticsState.status, "ready");

  finalDisconnect();
  await settle();
});
