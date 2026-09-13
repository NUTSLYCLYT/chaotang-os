import assert from "node:assert/strict";
import test from "node:test";
import {
  fetchSceneMissions,
  fetchSceneRun,
  parseS4RuleAnalysis,
  runScenePack,
  scenePrincipalUnchanged,
  sceneRequestFingerprint,
  s4CategoryText,
  s4FieldText,
  updateSceneMission,
} from "./client.ts";

const requestKey = "123e4567-e89b-42d3-a456-426614174000";

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


const s4RuleAnalysis = {
  ruleVersion: "s4-keyword-v1",
  matchedCategories: ["warranty", "penalty"],
  anchors: [
    {category: "warranty", field: "customerRequirement", excerpt: "含质保条款"},
    {category: "penalty", field: "rfqFile", excerpt: "penalty excluded"},
  ],
};
const s4Completed = () => ({
  ...run(), packSlug: "proposal-quotation-tender", status: "completed", verdict: "S4_RULE_ANALYSIS", riskGrade: "medium",
  details: {ruleAnalysis: s4RuleAnalysis},
});

test("S4 RED: closed rule metadata accepts only the ordered five-category contract", () => {
  const available = parseS4RuleAnalysis(s4Completed());
  assert.deepEqual(available, {state: "available", ...s4RuleAnalysis});
  const bad = [
    {...s4RuleAnalysis, extra: true},
    {...s4RuleAnalysis, ruleVersion: "other"},
    {...s4RuleAnalysis, matchedCategories: ["penalty", "warranty"]},
    {...s4RuleAnalysis, matchedCategories: ["warranty", "warranty"], anchors: [{category: "warranty", field: "customerRequirement", excerpt: "x"}]},
    {...s4RuleAnalysis, anchors: [{category: "warranty", field: "customerRequirement", excerpt: "x", extra: true}]},
    {...s4RuleAnalysis, anchors: [{category: "warranty", field: "unknown", excerpt: "x"}]},
    {...s4RuleAnalysis, anchors: [{category: "warranty", field: "customerRequirement", excerpt: "x".repeat(241)}]},
  ];
  for (const ruleAnalysis of bad) assert.deepEqual(
    parseS4RuleAnalysis({...s4Completed(), details: {ruleAnalysis}}), {state: "unavailable"},
  );
  const astral = "😀".repeat(240);
  assert.equal(parseS4RuleAnalysis({...s4Completed(), details: {ruleAnalysis: {
    ...s4RuleAnalysis, anchors: [{category: "warranty", field: "customerRequirement", excerpt: astral}, {category: "penalty", field: "rfqFile", excerpt: "penalty"}],
  }}}).state, "available");
  assert.equal(parseS4RuleAnalysis({...s4Completed(), details: {ruleAnalysis: {
    ...s4RuleAnalysis, anchors: [{category: "warranty", field: "customerRequirement", excerpt: "😀".repeat(241)}, {category: "penalty", field: "rfqFile", excerpt: "penalty"}],
  }}}).state, "unavailable");
});

test("S4 RED: POST completed requires valid metadata but GET retains a readable legacy result", async (t) => {
  const legacy = {...s4Completed(), details: {}};
  t.mock.method(globalThis, "fetch", async () => Response.json({sceneRun: legacy}));
  await assert.rejects(() => runScenePack("proposal-quotation-tender", {projectName: "项目", customerRequirement: "需求"}, true, requestKey));
  t.mock.restoreAll();
  t.mock.method(globalThis, "fetch", async () => Response.json({sceneRun: legacy}));
  assert.equal((await fetchSceneRun(legacy.runId)).runId, legacy.runId);
  t.mock.restoreAll();
  t.mock.method(globalThis, "fetch", async () => Response.json({sceneRun: s4Completed()}));
  assert.equal((await runScenePack("proposal-quotation-tender", {projectName: "项目", customerRequirement: "需求"}, true, requestKey)).packSlug, "proposal-quotation-tender");
});


test("S4 RED: POST preserves 401 and 422 for workspace recovery without a replay", async (t) => {
  for (const status of [401, 422]) {
    let calls = 0;
    t.mock.method(globalThis, "fetch", async () => { calls++; return new Response(null, {status}); });
    await assert.rejects(
      () => runScenePack("proposal-quotation-tender", {projectName: "项目", customerRequirement: "需求"}, false, requestKey),
      (error: unknown) => error instanceof Error && "status" in error && error.status === status,
    );
    assert.equal(calls, 1);
    t.mock.restoreAll();
  }
});


test("S4 RED: user-facing rule captions translate only validated internal identifiers", () => {
  assert.equal(s4CategoryText("warranty"), "质保/保修提示");
  assert.equal(s4CategoryText("acceptance"), "验收提示");
  assert.equal(s4FieldText("customerRequirement"), "客户需求");
  assert.equal(s4FieldText("rfqFile"), "询价资料");
});


test("S4 refuses metadata inconsistent with lifecycle or rule level", () => {
  for (const patch of [{riskGrade: "high"}, {riskGrade: "low"}, {status: "blocked"}, {status: "failed"}])
    assert.deepEqual(parseS4RuleAnalysis({...s4Completed(), ...patch}), {state: "unavailable"});
});

test("POST rejects malformed success, mismatched slug/demo, and network failure without replay", async (t) => {
  for (const sceneRun of [{}, {...s4Completed(), packSlug: "another-scene"}, {...s4Completed(), demo: false}, {...s4Completed(), nextActions: [{}]}]) {
    let calls = 0;
    t.mock.method(globalThis, "fetch", async () => { calls++; return Response.json({sceneRun}); });
    await assert.rejects(() => runScenePack("proposal-quotation-tender", {}, true, requestKey));
    assert.equal(calls, 1);
    t.mock.restoreAll();
  }
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => { calls++; throw new TypeError("network unavailable"); });
  await assert.rejects(() => runScenePack("proposal-quotation-tender", {}, true, requestKey));
  assert.equal(calls, 1);
});

test("POST classifies error status without reading an untrusted error body", async (t) => {
  for (const status of [401, 422]) {
    const response = new Response(null, {status});
    let reads = 0;
    t.mock.method(response, "json", async () => { reads++; throw new Error("body must not be read"); });
    t.mock.method(globalThis, "fetch", async () => response);
    await assert.rejects(() => runScenePack("proposal-quotation-tender", {}, false, requestKey), (e: unknown) => e instanceof Error && "status" in e && e.status === status);
    assert.equal(reads, 0);
    t.mock.restoreAll();
  }
});

test("truth request uses the existing JSON body and accepts unscored precheck", async (t) => {
  let body: Record<string, unknown> | null = null;
  t.mock.method(globalThis, "fetch", async (_url: string | URL | Request, init?: RequestInit) => {
    body = JSON.parse(String(init?.body));
    return Response.json({sceneRun: {
      ...run(), packSlug: "single-product-export-diagnosis", status: "completed",
      verdict: "PRECHECK_ONLY", confidence: null, riskGrade: "medium",
      opportunityGrade: "low", canProceed: false, demo: false,
      details: {demo: false, canProceed: false, truthContract: "mingshuo.scene.precheck.v1", verificationGaps: [], blockedReason: "verification_required"},
      boardMission: {title: "补齐资料", stage: "awaiting_input", nextMilestone: "人工核验"},
    }});
  });
  const result = await runScenePack("single-product-export-diagnosis", {productName: "test"}, false, requestKey);
  assert.equal(result.confidence, null);
  assert.deepEqual(body, {
    packSlug: "single-product-export-diagnosis", inputs: {productName: "test"},
    attachments: [], demo: false, requestKey,
  });
});

test("truth request rejects every forged business-ready or commercial response", async (t) => {
  const safe = {
    ...run(), packSlug: "single-product-export-diagnosis", status: "completed",
    verdict: "PRECHECK_ONLY", confidence: null, riskGrade: "medium",
    opportunityGrade: "low", canProceed: false, demo: false,
    details: {demo: false, canProceed: false, truthContract: "mingshuo.scene.precheck.v1", verificationGaps: [], blockedReason: "verification_required"},
    boardMission: {title: "补齐资料", stage: "awaiting_input", nextMilestone: "人工核验"},
  };
  const unsafe = [
    {...safe, verdict: "CONDITIONAL_GO"},
    {...safe, canProceed: true},
    {...safe, riskGrade: "low"},
    {...safe, opportunityGrade: "high"},
    {...safe, boardMission: {...safe.boardMission, stage: "done"}},
    {...safe, recommendedReply: "立即成交"},
    {...safe, leadScore: 99},
    {...safe, details: {...safe.details, recommendedMarkets: ["DE"]}},
    {...safe, details: {...safe.details, truthContract: undefined}},
    {...safe, details: {...safe.details, verificationGaps: undefined}},
    {...safe, details: {...safe.details, truthContract: "forged"}},
  ];
  for (const sceneRun of unsafe) {
    t.mock.method(globalThis, "fetch", async () => Response.json({sceneRun}));
    await assert.rejects(() => runScenePack(
      "single-product-export-diagnosis", {productName: "test"}, false, requestKey,
    ));
    t.mock.restoreAll();
  }
});

test("a scene response is accepted only while all principal observations stay identical", () => {
  assert.equal(scenePrincipalUnchanged("user-a", "user-a", "user-a"), true);
  assert.equal(scenePrincipalUnchanged("user-a", "user-b", "user-a"), false);
  assert.equal(scenePrincipalUnchanged("user-a", "user-a", "user-b"), false);
  assert.equal(scenePrincipalUnchanged("user-a", null, "user-a"), false);
});

test("409 is preserved as a non-replayable identity conflict", async (t) => {
  t.mock.method(globalThis, "fetch", async () => new Response(null, {status: 409}));
  await assert.rejects(
    () => runScenePack("single-product-export-diagnosis", {}, false, requestKey),
    (error: unknown) => error instanceof Error && "status" in error && error.status === 409,
  );
});

test("client revision fingerprint is NFC-equivalent but not NFKC-equivalent", async () => {
  const decomposed = await sceneRequestFingerprint(
    "single-product-export-diagnosis", {productName: "Cafe\u0301 Pack"}, false,
  );
  const composed = await sceneRequestFingerprint(
    "single-product-export-diagnosis", {productName: "Caf\u00e9 Pack"}, false,
  );
  const compatibilityChanged = await sceneRequestFingerprint(
    "single-product-export-diagnosis", {productName: "Ｃaf\u00e9 Pack"}, false,
  );
  assert.equal(decomposed, composed);
  assert.notEqual(composed, compatibilityChanged);
  assert.match(composed, /^sha256:[0-9a-f]{64}$/);
});
