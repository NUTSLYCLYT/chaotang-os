import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("shiguan visual keeps archive, detail, and recall columns", async () => {
  const source = await readFile(new URL("./ShiguanWorkspace.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("./ShiguanWorkspace.module.css", import.meta.url), "utf8");

  assert.match(source, /data-shiguan-index/);
  assert.match(source, /data-shiguan-detail/);
  assert.match(source, /data-shiguan-recall/);
  assert.match(source, /ImmersiveCourtShell/);
  assert.match(source, /打开史馆说明/);
  assert.match(source, /role="dialog"/);
  assert.match(css, /grid-template-columns:\s*320px minmax\(520px,\s*1fr\) 360px/);
  assert.doesNotMatch(source, /KnowledgeGraph|PROMO|DECISION/);
});

test("shiguan renders archive content inside the shared dev-derived imperial edict", async () => {
  const source = await readFile(new URL("./ShiguanWorkspace.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("./ShiguanWorkspace.module.css", import.meta.url), "utf8");

  assert.match(
    source,
    /import\s+\{[\s\S]*?\bCollapsedEdictScroll\b[\s\S]*?\bEdictStage\b[\s\S]*?\}\s+from\s+"..\/court-visuals\/edict\/EdictStage"/,
  );
  assert.match(source, /<CollapsedEdictScroll\b/);
  assert.match(source, /<EdictStage[\s\S]*?theme="imperial"/);
  assert.match(source, /document=\{archiveDocument\}/);
  assert.match(source, /<ShiguanArchiveDetail[\s\S]*?archive=\{props\.selectedArchive\}/);
  assert.doesNotMatch(
    source,
    /styles\.(?:scrollStage|scrollRodTop|scrollRodBottom|scrollWatermark|scroll)\b/,
  );
  assert.doesNotMatch(
    css,
    /\.(?:scrollStage|scrollRodTop|scrollRodBottom|scrollWatermark|scroll)\s*(?=[{,:])/,
  );
});

test("shiguan desktop edict keeps the measured dev width and 60vh height", async () => {
  const css = await readFile(new URL("./ShiguanWorkspace.module.css", import.meta.url), "utf8");
  const detailColumn = css.match(/\.detailColumn\s*\{([^}]*)\}/)?.[1] ?? "";

  assert.match(detailColumn, /height:\s*clamp\(520px,\s*60dvh,\s*620px\)/);
  assert.match(detailColumn, /padding:\s*0/);
  assert.doesNotMatch(detailColumn, /padding:\s*18px 24px/);
});

test("shiguan visual is a local interaction layer with honest states", async () => {
  const [workspace, detail, css] = await Promise.all([
    readFile(new URL("./ShiguanWorkspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("./ShiguanArchiveDetail.tsx", import.meta.url), "utf8"),
    readFile(new URL("./ShiguanWorkspace.module.css", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(workspace, /fetch\(|BACKEND_BASE_URL|ownerId|useSWR|EventSource|setInterval/);
  assert.doesNotMatch(detail, /fetch\(|BACKEND_BASE_URL|ownerId/);
  assert.match(workspace, /archiveState/);
  assert.match(workspace, /statisticsState/);
  assert.match(workspace, /recallState/);
  assert.match(workspace, /reviewState/);
  assert.match(workspace, /onRetryArchives/);
  assert.match(workspace, /onRetryStatistics/);
  assert.match(workspace, /onRetryRecall/);
  assert.doesNotMatch(workspace, /\.test\(message\)/);
  assert.match(workspace, /type="submit"/);
  assert.match(workspace, /aria-current/);
  assert.match(workspace, /key=\{props\.selectedArchive\?\.id \?\? "empty"\}/);
  assert.match(workspace, /reviewStatus\.reviewedAt/);
  assert.match(workspace, /当前结果 · 奏折/);
  assert.match(workspace, /当前结果 · 回奏/);
  assert.match(detail, /"PARTIAL"/);
  assert.match(detail, /reviewState\.status === "loading"/);
  assert.match(detail, /role=\{reviewState\.status === "error" \? "alert" : "status"\}/);
  assert.match(css, /white-space:\s*pre-wrap/);
  assert.match(css, /overflow-wrap:\s*anywhere/);
  assert.match(css, /grid-template-columns:/);
  assert.match(css, /@media \(max-width: 1080px\)/);
  assert.match(css, /@media \(max-width: 700px\)/);
  assert.match(css, /:focus-visible/);
});
