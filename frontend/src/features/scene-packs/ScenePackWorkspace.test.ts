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
