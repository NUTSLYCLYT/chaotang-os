import assert from "node:assert/strict";
import test from "node:test";
import { buildBoardPath, parseBoardPath, boardPathFromQuery, createSceneBoardController, visibleMissions } from "./sceneBoardController.ts";
import type { SceneMission, SceneRun } from "./types.ts";
const mission = (id = "a", extra: Partial<SceneMission> = {}): SceneMission => ({
  missionId: id, runId: "run-" + id, packSlug: "contract-cashflow-risk", packName: "合同", title: "Task " + id,
  owner: "户部", stage: "todo", riskGrade: "high", nextMilestone: "补齐", dueAt: "待定", pinned: false,
  createdAt: "2026-09-05", updatedAt: "2026-09-05", ...extra,
});
const run = (id = "a", extra: Partial<SceneRun> = {}): SceneRun => ({
  missionId: id, runId: "run-" + id, packSlug: "contract-cashflow-risk", status: "blocked", verdict: "HOLD",
  verdictText: "待核", confidence: 10, riskGrade: "high", opportunityGrade: "low", missingItems: [], nextActions: [],
  evidenceRefs: [], summaryForUser: "待核", canProceed: false, demo: true, details: {}, ...extra,
});
const path = (id: string) => buildBoardPath({mission: id, filter: "all", panel: "detail"});
function deferred<T>() { let resolve!: (v: T) => void; let reject!: (e: unknown) => void; const promise = new Promise<T>((a,b) => { resolve=a; reject=b; }); return {promise,resolve,reject}; }
const tick = async () => { await Promise.resolve(); await Promise.resolve(); };
test("URL parser is closed and canonical, never repairs unsafe destinations", () => {
  for (const bad of ["https://evil.example", "//evil.example", "/junjichu/scene-board/../study",
    "/junjichu/scene-board#x", "/junjichu/scene-board?", "/junjichu/scene-board?mission=",
    "/junjichu/scene-board?mission=a&mission=b", "/junjichu/scene-board?mission=a&%6dission=b",
    "/junjichu/scene-board?mission=%", "/junjichu/scene-board?mission=%FF",
    "/junjichu/scene-board?mission=a/b", "/junjichu/scene-board?panel=detail",
    "/junjichu/scene-board?filter=unknown", "/junjichu/scene-board?extra=1",
    "/junjichu/scene-board?mission=" + "a".repeat(129)]) assert.equal(parseBoardPath(bad), null, bad);
  assert.deepEqual(parseBoardPath("/junjichu/scene-board"), {mission:null,filter:"all",panel:"list"});
  assert.deepEqual(parseBoardPath("/junjichu/scene-board?mission=a"), {mission:"a",filter:"all",panel:"detail"});
  const nav = {mission:"a", filter:"high" as const, panel:"list" as const};
  assert.deepEqual(parseBoardPath(buildBoardPath(nav)), nav);
  assert.equal(boardPathFromQuery({mission:["a","b"]}), "invalid");
});
test("refresh rebinds the selected mission to fresh data and run; no default or missing-ID fallback", async () => {
  let version = 0; const c=createSceneBoardController({list:async()=>[mission("a",{title:String(++version),runId:"r"+version})],
    detail:async id=>run("a",{runId:id}), patch:async()=>mission()});
  await c.start("/junjichu/scene-board"); assert.equal(c.getSnapshot().selected,null);
  await c.navigate(path("missing")); assert.equal(c.getSnapshot().selected,null); assert.equal(c.getSnapshot().detail,"unavailable");
  await c.navigate(path("a")); const old=c.getSnapshot().selected;
  await c.refresh(); assert.notEqual(c.getSnapshot().selected,old);
  assert.equal(c.getSnapshot().selected?.title,"4"); assert.equal(c.getSnapshot().run?.runId,"r4");
});
test("latest list wins; stale failure cannot clear a newer list", async () => {
  const first=deferred<SceneMission[]>(); let calls=0;
  const c=createSceneBoardController({list:()=>++calls===1?first.promise:Promise.resolve([mission("b")]), detail:async()=>run("b"),patch:async()=>mission()});
  const stale=c.start(path("a")); await c.navigate(path("b")); first.reject(new Error("old")); await stale;
  assert.equal(c.getSnapshot().selected?.missionId,"b"); assert.equal(c.getSnapshot().run?.missionId,"b");
});
test("switch immediately hides old run; late detail cannot overwrite the new selection", async () => {
  const a=deferred<SceneRun>(), b=deferred<SceneRun>();
  const c=createSceneBoardController({list:async()=>[mission(),mission("b")],detail:id=>id==="run-a"?a.promise:b.promise,patch:async()=>mission()});
  const old=c.start(path("a")); await tick();
  const next=c.navigate(path("b")); assert.equal(c.getSnapshot().run,null); await tick();
  b.resolve(run("b")); await next; a.resolve(run()); await old;
  assert.equal(c.getSnapshot().run?.missionId,"b");
});
test("PATCH single-flight survives navigation and old success cannot steal selection", async () => {
  const pending=deferred<SceneMission>(); let writes=0;
  const c=createSceneBoardController({list:async()=>[mission(),mission("b")],detail:async id=>run(id.slice(4)),patch:()=>{writes++;return pending.promise;}});
  await c.start(path("a")); const write=c.mark("done"); const duplicate=c.mark("done");
  await c.navigate(path("b")); await c.mark("done"); assert.equal(writes,1); assert.equal(c.getSnapshot().busy,true);
  pending.resolve(mission("a",{stage:"done"})); await write; await duplicate;
  assert.equal(c.getSnapshot().selected?.missionId,"b"); assert.equal(c.getSnapshot().selected?.stage,"todo"); assert.equal(c.getSnapshot().busy,false);
});
test("PATCH failure is unconfirmed, no optimistic success and no replay", async () => {
  let writes=0; const c=createSceneBoardController({list:async()=>[mission()],detail:async()=>run(),patch:async()=>{writes++;throw new Error("private exception");}});
  await c.start(path("a")); await c.mark("done");
  assert.equal(writes,1); assert.equal(c.getSnapshot().write,"unconfirmed"); assert.equal(c.getSnapshot().selected?.stage,"todo");
});
test("PATCH response tuple mismatch fails closed", async () => {
  const c=createSceneBoardController({list:async()=>[mission()],detail:async()=>run(),patch:async()=>mission("a",{runId:"different",stage:"done"})});
  await c.start(path("a"));await c.mark("done");assert.equal(c.getSnapshot().write,"unconfirmed");assert.equal(c.getSnapshot().selected?.stage,"todo");
});
test("401 clears data; no write can proceed", async () => {
  let writes=0; const c=createSceneBoardController({list:async()=>[mission()],detail:async()=>{throw Object.assign(new Error(),{status:401});},patch:async()=>{writes++;return mission();}});
  await c.start(path("a")); await c.mark("done");assert.deepEqual(c.getSnapshot().missions,[]);assert.equal(c.getSnapshot().run,null);assert.equal(c.getSnapshot().authExpired,true);assert.equal(writes,0);
});
test("identity mismatch, duplicate list and explicit list panel never expose a run", async () => {
  for (const bad of [run("other"),run("a",{packSlug:"other"}),run("a",{runId:"other"})]) {
    const c=createSceneBoardController({list:async()=>[mission()],detail:async()=>bad,patch:async()=>mission()});
    await c.start(path("a"));assert.equal(c.getSnapshot().run,null);assert.equal(c.getSnapshot().detail,"unavailable");
  }
  const c=createSceneBoardController({list:async()=>[mission(),mission()],detail:async()=>run(),patch:async()=>mission()});
  await c.start(path("a"));assert.equal(c.getSnapshot().list,"error");
  let reads=0;const list=createSceneBoardController({list:async()=>[mission()],detail:async()=>{reads++;return run();},patch:async()=>mission()});
  await list.start("/junjichu/scene-board?mission=a&panel=list");assert.equal(reads,0);assert.equal(list.getSnapshot().selected?.missionId,"a");assert.equal(list.getSnapshot().run,null);
});
test("two instances and disposal isolate pending work and listeners", async () => {
  const late=deferred<SceneMission[]>();let notices=0;
  const a=createSceneBoardController({list:()=>late.promise,detail:async()=>run(),patch:async()=>mission()});
  a.subscribe(()=>notices++);const p=a.start(path("a"));a.dispose();const count=notices;
  const b=createSceneBoardController({list:async()=>[mission("b")],detail:async()=>run("b"),patch:async()=>mission("b")});
  await b.start(path("b"));late.resolve([mission()]);await p;
  assert.equal(notices,count);assert.equal(b.getSnapshot().run?.missionId,"b");assert.equal(a.getSnapshot().run,null);
});
test("overlapping filters count loaded items without inventing a total", () => {
  const items=[mission("a",{stage:"blocked"}),mission("b",{stage:"done",riskGrade:"low"})];
  assert.equal(visibleMissions(items,"awaiting").length,1);assert.equal(visibleMissions(items,"high").length,1);
  assert.equal(visibleMissions(items,"done").length,1);assert.equal(visibleMissions(items,"all").length,2);
});

test("effect cleanup then restart preserves the active external-store subscriber", async () => {
  const c=createSceneBoardController({list:async()=>[mission(),mission("b")],detail:async id=>run(id.slice(4)),patch:async()=>mission()});
  let rendered: string | undefined;
  const unsubscribe=c.subscribe(()=>{rendered=c.getSnapshot().run?.missionId;});
  await c.start(path("a")); assert.equal(rendered,"a");
  c.dispose();
  await c.start(path("b"));
  assert.equal(rendered,"b");
  unsubscribe();
  await c.navigate(path("a")); assert.equal(rendered,"b");
  c.dispose();
});

test("detail transport and 5xx failures are readable errors, not access-denied states", async () => {
  for (const error of [new Error("network"),Object.assign(new Error(),{status:503})]) {
    const c=createSceneBoardController({list:async()=>[mission()],detail:async()=>{throw error;},patch:async()=>mission()});
    await c.start(path("a"));
    assert.equal(c.getSnapshot().detail,"error"); assert.equal(c.getSnapshot().run,null);
    c.dispose();
  }
});

test("403 and 404 keep the same not-viewable state without identity fallback", async () => {
  for (const status of [403,404]) {
    const c=createSceneBoardController({list:async()=>[mission()],detail:async()=>{throw Object.assign(new Error(),{status});},patch:async()=>mission()});
    await c.start(path("a"));
    assert.equal(c.getSnapshot().detail,"unavailable"); assert.equal(c.getSnapshot().run,null);
    assert.deepEqual(c.getSnapshot().missions,[]); assert.equal(c.getSnapshot().selected,null);
    assert.equal(c.getSnapshot().list,"unavailable");
    c.dispose();
  }
});

test("an unconfirmed update requires a successful read before another manual update", async () => {
  let writes=0;
  const c=createSceneBoardController({list:async()=>[mission()],detail:async()=>run(),patch:async()=>{writes++;throw new Error("response lost");}});
  await c.start(path("a")); await c.mark("done"); await c.mark("done");
  assert.equal(writes,1);
  await c.refresh(); await c.mark("done"); assert.equal(writes,2);
  c.dispose();
});

test("PATCH access denial purges all old identity data and requires a fresh read", async () => {
  for (const status of [403,404]) {
    let writes=0;
    const c=createSceneBoardController({list:async()=>[mission(),mission("b")],detail:async()=>run(),
      patch:async()=>{writes++;throw Object.assign(new Error(),{status});}});
    await c.start(path("a"));
    assert.equal(c.getSnapshot().run?.missionId,"a");
    await c.mark("done");
    assert.deepEqual(c.getSnapshot().missions,[]);
    assert.equal(c.getSnapshot().selected,null); assert.equal(c.getSnapshot().run,null);
    assert.equal(c.getSnapshot().list,"unavailable"); assert.equal(c.getSnapshot().detail,"unavailable");
    assert.equal(c.getSnapshot().busy,false); assert.equal(c.getSnapshot().authExpired,false);
    await c.mark("done"); assert.equal(writes,1);
    c.dispose();
  }
});

test("late denied PATCH cannot clear a newer identity-bound read", async () => {
  const pending=deferred<SceneMission>();
  const c=createSceneBoardController({list:async()=>[mission(),mission("b")],detail:async id=>run(id.slice(4)),patch:()=>pending.promise});
  await c.start(path("a"));const write=c.mark("done");
  await c.navigate(path("b"));pending.reject(Object.assign(new Error(),{status:404}));await write;
  assert.equal(c.getSnapshot().run?.missionId,"b");assert.equal(c.getSnapshot().busy,false);
  c.dispose();
});
