import assert from "node:assert/strict";
import test from "node:test";
import { fetchSceneMissions, fetchSceneRun, updateSceneMission } from "./client.ts";

export const mission = (id = "mission-a") => ({
  missionId: id, runId: "run-" + id, packSlug: "contract-cashflow-risk",
  packName: "合同风险", title: "检查交付节点", owner: "户部", stage: "todo" as const,
  riskGrade: "high" as const, nextMilestone: "补齐资料", dueAt: "待人工安排", pinned: false,
  createdAt: "2026-09-05", updatedAt: "2026-09-05",
});
export const run = (id = "mission-a") => ({
  runId: "run-" + id, missionId: id, packSlug: "contract-cashflow-risk", status: "blocked",
  verdict: "HOLD", verdictText: "待补齐", confidence: 20, riskGrade: "high", opportunityGrade: "low",
  missingItems: ["付款节点"], nextActions: [{ title: "补充", ownerDept: "户部", priority: "P1", dueHint: "待定" }],
  evidenceRefs: [{claim: "用户材料", sourceLabel: "用户输入", sourceType: "USER", capturedAt: "2026-09-05", reliability: "low"}],
  summaryForUser: "需要人工核实", canProceed: false, demo: true, details: {},
});
test("A1 RED: missions reject missing/blank title and duplicate identities", async (t) => {
  for (const items of [[{...mission(), title: ""}], [{...mission(), title: undefined}], [mission(), mission()]]) {
    t.mock.method(globalThis, "fetch", async () => Response.json({missions: items}));
    await assert.rejects(() => fetchSceneMissions());
    t.mock.restoreAll();
  }
});
test("A1 RED: detail rejects a different run identity and invalid fields", async (t) => {
  for (const item of [{...run(), runId: "wrong"}, {...run(), evidenceRefs: [{}]}, {...run(), demo: "true"}]) {
    t.mock.method(globalThis, "fetch", async () => Response.json({sceneRun: item}));
    await assert.rejects(() => fetchSceneRun("run-mission-a"));
    t.mock.restoreAll();
  }
});
test("A1 RED: PATCH rejects a different mission and never replays", async (t) => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => { calls++; return Response.json({mission: mission("wrong")}); });
  await assert.rejects(() => updateSceneMission("mission-a", {stage: "done"}));
  assert.equal(calls, 1);
});

test("priority must be a literal string, never an array or coerced object", async (t) => {
  for (const priority of [["P0"],["P1"],{},null,0]) {
    const item=run();
    t.mock.method(globalThis,"fetch",async()=>Response.json({sceneRun:{...item,nextActions:[{...item.nextActions[0],priority}]}}));
    await assert.rejects(()=>fetchSceneRun("run-mission-a"));
    t.mock.restoreAll();
  }
});

test("board GET and PATCH have bounded waiting even if transport ignores abort", async (t) => {
  t.mock.timers.enable({apis:["setTimeout"]});
  const calls=[()=>fetchSceneMissions(),()=>fetchSceneRun("run-mission-a"),()=>updateSceneMission("mission-a",{stage:"done"})];
  for (const call of calls) {
    let count=0,failed=false;
    t.mock.method(globalThis,"fetch",()=>{count++;return new Promise<Response>(()=>{});});
    void call().catch(()=>{failed=true;});
    t.mock.timers.tick(30_000);
    for(let i=0;i<12;i++) await Promise.resolve();
    assert.equal(failed,true,"unresponsive request must settle as failure");
    assert.equal(count,1,"deadline must not replay the request");
    t.mock.restoreAll();
  }
});

test("response body stalls obey the same deadline", async (t) => {
  t.mock.timers.enable({apis:["setTimeout"]});
  const response=Response.json({missions:[mission()]});
  t.mock.method(response,"json",()=>new Promise(()=>{}));
  t.mock.method(globalThis,"fetch",async()=>response);
  let failed=false;
  void fetchSceneMissions().catch(()=>{failed=true;});
  for(let i=0;i<8;i++) await Promise.resolve();
  t.mock.timers.tick(30_000);
  for(let i=0;i<12;i++) await Promise.resolve();
  assert.equal(failed,true);
});

test("401 is preserved immediately even if the error body never finishes", async (t) => {
  const response=new Response(null,{status:401});
  t.mock.method(response,"json",()=>new Promise(()=>{}));
  t.mock.method(globalThis,"fetch",async()=>response);
  const abort=new AbortController();
  let status: number | undefined;
  const settled=fetchSceneMissions({},abort.signal).catch(error=>{status=error.status;});
  for(let i=0;i<12;i++) await Promise.resolve();
  const observed=status;
  abort.abort(); await settled;
  assert.equal(observed,401);
});

test("already aborted board read performs no network request", async (t) => {
  let calls=0;
  t.mock.method(globalThis,"fetch",async()=>{calls++;return Response.json({missions:[]});});
  const abort=new AbortController();abort.abort();
  await assert.rejects(()=>fetchSceneMissions({},abort.signal));
  assert.equal(calls,0);
});
