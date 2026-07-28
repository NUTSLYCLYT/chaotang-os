import assert from "node:assert/strict";
import test from "node:test";

import {
  createJunjichuController,
  decodeJunjichuCasesPayload,
  type JunjichuControllerState,
} from "./junjichuController.ts";

const ACTIVE_CASE = {
  id: "case-active",
  decreeText: "请议边防粮饷",
  departments: ["兵部", "户部"],
  status: "COUNCIL_REVIEWING",
  processingPath: ["丞相分流", "军机处会审"],
  completedMinistryOpinions: [{ department: "兵部", bureauOpinions: [], opinion: "兵部意见" }],
  councilVerdict: null,
  replyId: null,
  failureReason: null,
  createdAt: "2026-07-28T00:00:00+00:00",
  updatedAt: "2026-07-28T00:02:00+00:00",
};
const ARCHIVED_CASE = {
  ...ACTIVE_CASE,
  id: "case-archived",
  decreeText: "请议河工",
  status: "ARCHIVED",
  councilVerdict: "会审结论",
  replyId: "reply-1",
  updatedAt: "2026-07-27T00:02:00+00:00",
};
const FAILED_CASE = {
  ...ACTIVE_CASE,
  id: "case-failed",
  decreeText: "请议失效的河工方案",
  status: "FAILED",
  failureReason: "processing_failed",
  updatedAt: "2026-07-26T00:02:00+00:00",
};

const okResponse = (cases: unknown[]) =>
  new Response(JSON.stringify({ status: "ok", cases }), { status: 200 });
const settle = () => new Promise<void>((resolve) => setImmediate(resolve));

function harness(fetch: typeof globalThis.fetch) {
  const states: JunjichuControllerState[] = [];
  const redirects: string[] = [];
  const controller = createJunjichuController({
    fetch,
    redirect: (location) => redirects.push(location),
  });
  const disconnect = controller.connect((state) => states.push(state));
  return { controller, disconnect, states, redirects };
}

test("decoder accepts only strict owner-free Grand Council cases", () => {
  assert.deepEqual(decodeJunjichuCasesPayload({ status: "ok", cases: [ACTIVE_CASE] }), [ACTIVE_CASE]);
  for (const payload of [
    null,
    { status: "ok", cases: [{ ...ACTIVE_CASE, ownerId: "owner-1" }] },
    { status: "ok", cases: [{ ...ACTIVE_CASE, replyId: 42 }] },
    { status: "error", cases: [] },
  ]) assert.equal(decodeJunjichuCasesPayload(payload), null);
});

test("controller projects active cases before archived cases and keeps selection through filters", async () => {
  const view = harness(async () => okResponse([ARCHIVED_CASE, FAILED_CASE, ACTIVE_CASE]));
  view.controller.start();
  await settle();

  assert.equal(view.controller.state.status, "ready");
  assert.ok(view.controller.state.activeCases);
  assert.ok(view.controller.state.archivedCases);
  assert.ok(view.controller.state.failedCases);
  assert.deepEqual(view.controller.state.activeCases.map((item) => item.id), ["case-active"]);
  assert.deepEqual(view.controller.state.archivedCases.map((item) => item.id), ["case-archived"]);
  assert.deepEqual(view.controller.state.failedCases.map((item) => item.id), ["case-failed"]);
  assert.equal(view.controller.state.selectedId, "case-active");

  view.controller.selectCase("case-archived");
  view.controller.selectDepartment("兵部");
  assert.equal(view.controller.state.selectedId, "case-archived");
  view.controller.selectKeyword("河工");
  assert.equal(view.controller.state.selectedId, "case-archived");
  assert.deepEqual(view.controller.state.activeCases, []);
});

test("controller projects a successful empty ledger into three empty case groups", async () => {
  const view = harness(async () => okResponse([]));
  view.controller.start();
  await settle();

  assert.equal(view.controller.state.status, "empty");
  assert.deepEqual(view.controller.state.activeCases, []);
  assert.deepEqual(view.controller.state.archivedCases, []);
  assert.deepEqual(view.controller.state.failedCases, []);
  assert.equal(view.controller.state.selectedId, null);
});

test("controller clears selection only when the active filter excludes it", async () => {
  const view = harness(async () => okResponse([ACTIVE_CASE, ARCHIVED_CASE]));
  view.controller.start();
  await settle();
  view.controller.selectCase("case-archived");
  view.controller.selectStatus("COUNCIL_REVIEWING");
  assert.equal(view.controller.state.selectedId, "case-active");
  assert.ok(view.controller.state.archivedCases);
  assert.equal(view.controller.state.archivedCases.length, 0);
});

test("controller uses only the protected Grand Council BFF and redirects on 401", async () => {
  const calls: Array<{ input: string; init?: RequestInit }> = [];
  const view = harness(async (input, init) => {
    calls.push({ input: String(input), init });
    return new Response(null, { status: 401 });
  });
  view.controller.start();
  await settle();
  await settle();
  assert.equal(calls[0]?.input, "/api/junjichu/cases");
  assert.equal(calls[0]?.init?.cache, "no-store");
  assert.deepEqual(view.redirects, ["/login?next=%2Fjunjichu"]);
});
