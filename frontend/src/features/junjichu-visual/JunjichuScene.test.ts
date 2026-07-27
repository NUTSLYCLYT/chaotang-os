import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

test("junjichu renders complete archived REPLY fields and honest states", async () => {
  const source = await readFile(new URL("./JunjichuScene.tsx", import.meta.url), "utf8");
  await access(new URL("../../../public/assets/junjichu/war-room-full.webp", import.meta.url));
  for (const field of [
    "selected.title",
    "selected.departments",
    "selected.process",
    "selected.conclusion",
    "selected.repliedAt",
    "selected.respondent",
  ]) {
    assert.match(source, new RegExp(field.replace(".", "\\.")));
  }
  for (const state of ["loading", "error", "empty", "ready"]) {
    assert.match(source, new RegExp(`data-junjichu-state="${state}"`));
  }
  assert.doesNotMatch(source, /bureauOpinions|ownerId|BACKEND_BASE_URL|mock/);
  assert.match(source, /projectJunjichuFacts/);
  assert.doesNotMatch(source, /大臣|参与官署|真\s*·\s*LIVE|筹备中/);
});

test("junjichu actually imports and renders both shared edict forms", async () => {
  const source = await readFile(new URL("./JunjichuScene.tsx", import.meta.url), "utf8");
  const sharedImport = source.match(
    /import\s+\{([\s\S]*?)\}\s+from\s+"..\/court-visuals\/edict\/EdictStage"/,
  )?.[1];
  assert.ok(sharedImport);
  assert.match(sharedImport, /\bEdictStage\b/);
  assert.match(sharedImport, /\bCollapsedEdictScroll\b/);
  assert.match(source, /<EdictStage[\s\S]*?theme="secret"/);
  assert.match(source, /<CollapsedEdictScroll\b/);
  assert.match(source, /title=\{item\.title\}/);
  assert.doesNotMatch(source, /styles\.(?:mainScroll|scrollFinial|scrollBody|secretSeal)/);
});

test("junjichu keeps read-only capability buttons without fake writes", async () => {
  const source = await readFile(new URL("./JunjichuScene.tsx", import.meta.url), "utf8");
  const shell = await readFile(
    new URL("../court-visuals/ImmersiveCourtShell.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /CourtCapabilityButton/);
  assert.match(source, /capability="unavailable"/);
  assert.match(source, /ImmersiveCourtShell/);
  assert.match(shell, /CourtQuickDock/);
  for (const action of ["adopt", "request_evidence", "recheck", "reject", "followup"]) {
    assert.match(source, new RegExp(`id: "${action}"`));
  }
  assert.doesNotMatch(
    source,
    /onDecision|onDispatch|onApprove|onExecute|method:\s*"(POST|PUT|PATCH|DELETE)"/,
  );
});

test("junjichu client delegates abort, retry, stale and 401 behavior to its controller", async () => {
  const source = await readFile(new URL("./JunjichuClient.tsx", import.meta.url), "utf8");
  const controller = await readFile(new URL("./junjichuController.ts", import.meta.url), "utf8");
  assert.match(source, /createJunjichuController/);
  assert.match(source, /controller\.connect/);
  assert.match(source, /controller\.start/);
  assert.match(source, /controller\.retry/);
  assert.doesNotMatch(source, /fetch\(|response\.json|AbortController/);
  assert.match(controller, /\/api\/shiguan\/archives\?type=REPLY&limit=100/);
  assert.match(controller, /response\.status === 401/);
  assert.match(controller, /AbortController/);
  assert.doesNotMatch(`${source}\n${controller}`, /EventSource|setInterval|ownerId|BACKEND_BASE_URL/);
});

test("junjichu remains usable for long text, focus and narrow screens", async () => {
  const css = await readFile(new URL("./JunjichuScene.module.css", import.meta.url), "utf8");
  assert.match(css, /overflow-wrap:\s*anywhere/);
  assert.match(css, /white-space:\s*pre-wrap/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /@media \(max-width: 820px\)/);
  assert.doesNotMatch(css, /line-clamp/);
});

test("junjichu preserves the dev desktop columns and safe mobile overflow", async () => {
  const css = await readFile(new URL("./JunjichuScene.module.css", import.meta.url), "utf8");
  assert.match(
    css,
    /\.workspace\s*\{[\s\S]*?grid-template-columns:\s*300px\s+minmax\(520px,\s*1fr\)\s+330px\s*;/,
  );
  assert.match(
    css,
    /\.workspace\s*\{[\s\S]*?grid-template-rows:\s*clamp\(400px,\s*45dvh,\s*540px\)\s+auto\s+auto\s*;/,
  );
  assert.match(css, /\.scene\s*\{[\s\S]*?overflow-x:\s*hidden\s*;/);
  assert.match(
    css,
    /@media \(max-width: 820px\)[\s\S]*?\.caseList\s*\{[\s\S]*?padding-right:\s*28px[\s\S]*?overflow-x:\s*auto/,
  );
  assert.match(
    css,
    /@media \(max-width: 820px\)[\s\S]*?\.caseList::after\s*\{[\s\S]*?flex:\s*0\s+0\s+20px/,
  );
});
