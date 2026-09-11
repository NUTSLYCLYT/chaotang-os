import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import {resultTaskPath} from "./sceneBoardController.ts";
import type {SceneRun} from "./types.ts";
test("result link only opens the already returned matching task", () => {
  const result={missionId:"m-a",packSlug:"contract-cashflow-risk",demo:false} as SceneRun;
  assert.equal(resultTaskPath(result,result.packSlug,false,false),"/junjichu/scene-board?mission=m-a&filter=all&panel=detail");
  for(const [value,slug,demo,running] of [[null,result.packSlug,false,false],[result,"wrong",false,false],[result,result.packSlug,true,false],
    [result,result.packSlug,false,true],[{...result,missionId:"../a"},result.packSlug,false,false]] as const) {
    assert.equal(resultTaskPath(value,slug,demo,running),null);
  }
});
test("workspace navigation is guarded without changing the generation action", () => {
  const src=readFileSync(new URL("./ScenePackWorkspace.tsx",import.meta.url),"utf8");
  assert.match(src,/disabled=\{!taskPath\}/);assert.match(src,/if \(taskPath\) router.push\(taskPath\)/);
  assert.match(src,/查看这份结果的任务/);assert.doesNotMatch(src,/保存到军机处/);
  assert.match(src,/runScenePack\(slug, normalizeSceneInputs\(values\), demo\)/);
});


test("S4 RED: workspace distinguishes validation, expired session, and unconfirmed result without replay", () => {
  const src=readFileSync(new URL("./ScenePackWorkspace.tsx",import.meta.url),"utf8");
  assert.match(src,/检查字段类型、格式或长度/);
  assert.match(src,/会话已失效/);
  assert.match(src,/本次结果尚未确认/);
  assert.match(src,/parseS4RuleAnalysis/);
  assert.match(src,/setResult\(null\)/);
  assert.doesNotMatch(src,/setTimeout\([^]*runScenePack/);
});


test("S4 RED: workspace gives an actionable unconfirmed path and guards a pending duplicate submit", () => {
  const src=readFileSync(new URL("./ScenePackWorkspace.tsx",import.meta.url),"utf8");
  assert.match(src,/本次结果尚未确认。请到任务列表核对后再决定是否重新提交。/);
  assert.match(src,/前往任务列表核对/);
  assert.match(src,/useRef/);assert.match(src,/submitting\.current/);
  assert.match(src,/field === "customerRequirement"/);assert.match(src,/field === "rfqFile"/);
});


test("S4 RED: workspace identifies pasted RFQ material and gives bounded input and analysis limits", () => {
  const src=readFileSync(new URL("./ScenePackWorkspace.tsx",import.meta.url),"utf8");
  assert.match(src,/询价资料（粘贴文本）/);
  assert.match(src,/材料文本最多 20000 字符/);
  assert.match(src,/填写 JSON 对象，至少包含 profitMargin/);
  assert.match(src,/不含模型分析或校准概率/);
});
