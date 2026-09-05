import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
test("V4 keeps a single A1 state source and isolates its presentation", () => {
  const src=readFileSync(new URL("./SceneBoard.tsx",import.meta.url),"utf8");
  assert.match(src,/SceneBoardV4\.module\.css/);
  assert.match(src,/buildV4Presentation/);
  assert.match(src,/key=\{presentation\.identityKey\}/);
  assert.match(src,/项目案卷/);
  assert.match(src,/已加载任务/);
  assert.match(src,/成果与证据/);
  assert.doesNotMatch(src,/dangerouslySetInnerHTML|localStorage|download=|fetch\(/);
});
test("board uses isolated controller and separates generated status from manual stage", () => {
  const src=readFileSync(new URL("./SceneBoard.tsx",import.meta.url),"utf8");
  assert.match(src,/useState\(\(\) => createSceneBoardController/);
  assert.match(src,/useSyncExternalStore/);assert.match(src,/controller.dispose\(\)/);
  assert.match(src,/生成状态/);assert.match(src,/不等于业务验收/);assert.match(src,/标记看板阶段/);
  assert.doesNotMatch(src,/JSON.stringify|保存到军机处|标记高风险阻断/);
});
test("only board-scoped responsive styling is added", () => {
  const src=readFileSync(new URL("./scenePacks.module.css",import.meta.url),"utf8");
  assert.match(src,/\.boardWorkspace\[data-panel="detail"\] \.boardList/);
  assert.match(src,/\.boardWorkspace button:focus-visible/);
});

test("browser entry validates actual location before reading and observes fragment navigation", () => {
  const src=readFileSync(new URL("./SceneBoard.tsx",import.meta.url),"utf8");
  assert.match(src,/useSyncExternalStore\(subscribeBrowserPath, readBrowserPath, serverBrowserPath\)/);
  assert.match(src,/window.location.href.includes\("#"\)/);
  assert.match(src,/addEventListener\("hashchange", notify\)/);
  assert.match(src,/removeEventListener\("hashchange", notify\)/);
  assert.match(src,/controller.start\(browserPath\)/);
  assert.doesNotMatch(src,/controller.start\(initialPath\)/);
});
