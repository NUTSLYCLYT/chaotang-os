import assert from "node:assert/strict";
import test from "node:test";
import type { SceneMission, SceneRun } from "./types.ts";
import { buildV4Presentation, riskText, stageText, runStatusText } from "./sceneBoardV4Presentation.ts";

const mission: SceneMission = {
  missionId:"mission-a",runId:"run-a",packSlug:"contract-cashflow-risk",packName:"合同与回款",
  title:"测试案卷",owner:"户部",stage:"done",riskGrade:"high",nextMilestone:"补充材料",
  dueAt:"待确认",pinned:false,createdAt:"2026-09-05",updatedAt:"2026-09-05",
};
const run: SceneRun = {
  missionId:"mission-a",runId:"run-a",packSlug:"contract-cashflow-risk",status:"completed",
  verdict:"HOLD",verdictText:"需要核验",confidence:99,riskGrade:"high",opportunityGrade:"low",
  missingItems:["缺签章"],nextActions:[{title:"补签章",ownerDept:"户部",priority:"P0",dueHint:"待确认"}],
  evidenceRefs:[{claim:"付款条款",sourceLabel:"用户声明",sourceType:"USER",capturedAt:"2026-09-05",reliability:"low"}],
  summaryForUser:"尚待核验",canProceed:true,demo:true,details:{},
};
test("V4 requires the complete selected mission/run binding and no default task", () => {
  assert.equal(buildV4Presentation(null,run),null);
  assert.equal(buildV4Presentation(mission,null),null);
  for(const patch of [{missionId:"other"},{runId:"other"},{packSlug:"other"},{missionId:undefined}])
    assert.equal(buildV4Presentation(mission,{...run,...patch}),null);
  assert.equal(buildV4Presentation({...mission,missionId:""}, {...run,missionId:""}),null);
});
test("V4 preserves user-facing facts but never turns generated/manual state into acceptance", () => {
  const p=buildV4Presentation(mission,run)!;
  assert.equal(p.title,mission.title);assert.equal(p.summary,run.summaryForUser);
  assert.equal(p.stageLabel,"已标记完成");assert.equal(p.statusLabel,"生成完成");
  assert.match(p.realityLabel,/示例结果/);
  assert.deepEqual(p.missingItems,run.missingItems);assert.deepEqual(p.evidenceRefs,run.evidenceRefs);
  assert.equal("progressPercent" in p,false);assert.equal("approved" in p,false);
  assert.equal("confidence" in p,false);assert.equal("canProceed" in p,false);
});
test("untrusted details cannot add files, links, approval or HTML execution to the projection", () => {
  const hostile={...run,details:{html:"<img onerror=evil()>",downloadUrl:"javascript:evil()",approved:true,progress:100}};
  assert.deepEqual(buildV4Presentation(mission,hostile),buildV4Presentation(mission,run));
  const p=buildV4Presentation(mission,{...run,summaryForUser:"<script>not-executed</script>"})!;
  assert.equal(p.summary,"<script>not-executed</script>");
  assert.equal("downloadUrl" in p,false);
});
test("empty evidence and missing items remain empty, never synthesized as verified", () => {
  const p=buildV4Presentation(mission,{...run,evidenceRefs:[],missingItems:[],nextActions:[],demo:false})!;
  assert.deepEqual(p.evidenceRefs,[]);assert.deepEqual(p.missingItems,[]);assert.deepEqual(p.nextActions,[]);
  assert.match(p.realityLabel,/不表示事实已独立核验/);
});
test("identity keys cannot collide and separate new results for one mission", () => {
  const p=buildV4Presentation(mission,run)!;
  const next=buildV4Presentation({...mission,runId:"run-b"},{...run,runId:"run-b"})!;
  assert.notEqual(p.identityKey,next.identityKey);
  assert.equal(buildV4Presentation({...mission,runId:"run/a"},{...run,runId:"run/a"}),null);
});
test("unknown lifecycle/risk values are not silently promoted or labelled high", () => {
  assert.equal(stageText("alien"),"未知");
  assert.equal(runStatusText("alien"),"未知");
  assert.equal(riskText("alien"),"未知");
  assert.equal(riskText("low"),"低");assert.equal(riskText("medium"),"中");assert.equal(riskText("high"),"高");
});
test("projection owns nested arrays and preserves long text without mutating source", () => {
  const p=buildV4Presentation(mission,{...run,summaryForUser:"长".repeat(4096)})!;
  assert.equal(p.summary.length,4096);
  p.missingItems.push("local");p.nextActions[0].title="local";p.evidenceRefs[0].claim="local";
  assert.deepEqual(run.missingItems,["缺签章"]);assert.equal(run.nextActions[0].title,"补签章");
  assert.equal(run.evidenceRefs[0].claim,"付款条款");
});
