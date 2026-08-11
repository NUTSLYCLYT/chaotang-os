import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

test("Grand Council main stage uses the approved case ledger and honest states", async () => {
  const source = await readFile(new URL("./JunjichuScene.tsx", import.meta.url), "utf8");
  await access(new URL("../../../public/assets/junjichu/junjichu.webp", import.meta.url));
  assert.match(source, /backgroundImage="\/assets\/junjichu\/junjichu\.webp"/);
  for (const state of ["loading", "error", "empty", "ready"]) {
    assert.match(source, new RegExp(`data-junjichu-state="${state}"`));
  }
  assert.match(source, /activeCases/);
  assert.match(source, /archivedCases/);
  assert.match(source, /failedCases/);
  assert.match(source, /办理失败/);
  assert.match(source, /replyId/);
  assert.match(source, /completedMinistryOpinions/);
  assert.match(source, /court-visuals\/edict\/EdictStage/);
  assert.match(source, /<EdictStage\b/);
  assert.doesNotMatch(source, /theme="secret"/);
  assert.doesNotMatch(source, /只读会审主舞台/);
  assert.doesNotMatch(source, /ownerId|BACKEND_BASE_URL|mock|adopt|reject|request_evidence|dispatch/);
});

test("Grand Council keeps the left ledger, central path, and fixed six-ministry projection", async () => {
  const source = await readFile(new URL("./JunjichuScene.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("./JunjichuScene.module.css", import.meta.url), "utf8");
  assert.match(source, /SIX_MINISTRIES/);
  assert.match(source, /processingPath/);
  assert.match(source, /currentStage/);
  assert.match(source, /未参与/);
  assert.match(source, /办理中/);
  assert.match(source, /已完成/);
  assert.match(source, /\/shiguan\?archive=/);
  assert.match(css, /grid-template-columns:\s*300px\s+minmax\(520px,\s*1fr\)\s+330px/);
  assert.match(css, /\.caseDeck,\s*\.intelligenceDeck\s*\{[\s\S]*?min-height:\s*580px/);
  assert.match(css, /\.edictScroll\s*\{\s*min-height:\s*580px;\s*\}/);
  assert.match(css, /@media \(max-width: 1280px\)/);
  assert.match(css, /@media \(max-width: 820px\)[\s\S]*?\.caseDeck,\s*\.intelligenceDeck,\s*\.edictScroll\s*\{\s*min-height:\s*auto;\s*\}/);
  assert.match(css, /overflow-wrap:\s*anywhere/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /\.scene button:focus-visible, \.scene select:focus-visible/);
  assert.doesNotMatch(css, /(?:^|\n)button:focus-visible/);
});

test("Grand Council keeps the complete three-column stage when the successful ledger is empty", async () => {
  const source = await readFile(new URL("./JunjichuScene.tsx", import.meta.url), "utf8");
  assert.match(source, /等待下旨后进入会审/);
  assert.match(source, /没有进行中案卷/);
  assert.match(source, /没有已归档案卷/);
  assert.match(source, /没有办理失败案卷/);
  assert.match(source, /SIX_MINISTRIES\.map/);
  assert.match(source, /未参与/);
  assert.doesNotMatch(source, /isEmptyLedger/);
  assert.doesNotMatch(source, /暂无匹配案卷/);
});

test("junjichu client delegates protected reads to its controller", async () => {
  const source = await readFile(new URL("./JunjichuClient.tsx", import.meta.url), "utf8");
  const controller = await readFile(new URL("./junjichuController.ts", import.meta.url), "utf8");
  assert.match(source, /createJunjichuController/);
  assert.doesNotMatch(source, /fetch\(|ownerId|BACKEND_BASE_URL/);
  assert.match(controller, /\/api\/junjichu\/cases/);
  assert.match(controller, /AbortController/);
  assert.doesNotMatch(controller, /EventSource|setInterval|ownerId|REPLY_ARCHIVES_URL/);
});

test("Grand Council scrollbars are hidden while its scroll containers remain available", async () => {
  const source = await readFile(new URL("./JunjichuScene.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("./JunjichuScene.module.css", import.meta.url), "utf8");
  assert.match(source, /hideScrollbar/);
  assert.match(css, /\.caseDeck,\s*\.intelligenceDeck\s*\{[\s\S]*?scrollbar-width:\s*none/);
  assert.match(css, /\.caseDeck::-webkit-scrollbar,\s*\.intelligenceDeck::-webkit-scrollbar\s*\{\s*display:\s*none/);
});
