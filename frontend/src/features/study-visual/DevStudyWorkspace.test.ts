import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("dev study workspace exposes the latest named workspace contract", async () => {
  const source = await readFile(new URL("./DevStudyWorkspace.tsx", import.meta.url), "utf8");

  assert.match(source, /export function DevStudyWorkspace\b/);
  assert.doesNotMatch(source, /export function StudyWorkspace\b/);
});

test("dev study workspace restores the first-court ritual as local-only interaction", async () => {
  const source = await readFile(new URL("./DevStudyWorkspace.tsx", import.meta.url), "utf8");

  assert.match(source, /courtos\.onboarded/);
  assert.match(source, /courtos\.ruler\.style/);
  assert.match(source, /陛下御极 · 开朝仪轨/);
  assert.match(source, /严政陛下/);
  assert.match(source, /仁政陛下/);
  assert.match(source, /勤政陛下/);
  assert.match(source, /跳过 · 直接进朝堂/);
  assert.match(source, /下一步 · 亲下第一道旨/);
  assert.doesNotMatch(source, /fetch\s*\(|EventSource|SWR|useRouter/);
});

test("dev study workspace preserves real decree controls while restoring dev local affordances", async () => {
  const source = await readFile(new URL("./DevStudyWorkspace.tsx", import.meta.url), "utf8");

  assert.match(source, /真实任务库暂不可读/);
  assert.match(source, /今日圣旨/);
  assert.match(source, /收卷看殿/);
  assert.match(source, /data-testid="decree-mode-order"/);
  assert.match(source, /data-testid="decree-mode-secret"/);
  assert.match(source, /data-testid="decree-polish-inline"/);
  assert.match(source, /data-testid="decree-evidence-upload"/);
  assert.match(source, /data-testid="decree-textarea"/);
  assert.match(source, /data-testid="submit-decree-button"/);
  assert.match(source, /onClick=\{props\.onSubmit\}/);
  assert.match(source, /disabled=\{!props\.canSubmit\}/);
});

test("dev study workspace renders parchment only for a real successful reply", async () => {
  const source = await readFile(new URL("./DevStudyWorkspace.tsx", import.meta.url), "utf8");

  assert.match(source, /props\.uiState\.phase === "success" \? \(/);
  assert.match(source, /<EdictStage\b/);
  assert.match(source, /styles\.emptyExpanded/);
  assert.match(source, /暂无奏折，陛下可下达新旨。/);
  assert.match(source, /props\.uiState\.rationale/);
  assert.match(source, /props\.uiState\.processingPath/);
  assert.match(source, /props\.uiState\.ministryOpinions/);
  assert.match(source, /props\.uiState\.councilVerdict/);
  assert.match(source, /props\.uiState\.finalVerdict/);
  assert.match(source, /props\.uiState\.recommendations/);
  assert.doesNotMatch(source, /当前没有展开的回奏。拟旨期间不会调用模型或后端办理流程。/);
});

test("dev study uses the shared dev-derived scroll shells", async () => {
  const source = await readFile(new URL("./DevStudyWorkspace.tsx", import.meta.url), "utf8");

  assert.match(
    source,
    /import\s*\{\s*CollapsedEdictScroll\s*,\s*EdictStage\s*,?\s*\}\s*from\s*"\.\.\/court-visuals\/edict\/EdictStage"/,
  );
  assert.match(source, /<CollapsedEdictScroll\b/);
  assert.match(source, /<EdictStage\b/);
  assert.doesNotMatch(source, /styles\.(?:collapsedScroll|roller|scrollPaper)\b/);
});

test("dev study CSS owns the responsive parent slot instead of redrawing the scroll", async () => {
  const css = await readFile(new URL("./DevStudyWorkspace.module.css", import.meta.url), "utf8");

  assert.match(css, /\.stage\s*\{[\s\S]*?grid-template-rows:\s*auto auto/);
  assert.match(css, /\.stage\s*\{[\s\S]*?align-content:\s*start/);
  assert.match(css, /\.warning\s*\{/);
  assert.match(
    css,
    /\.edictSlot\s*\{[\s\S]*?max-width:\s*min\(1180px,\s*max\(640px,\s*calc\(100vw - 760px\)\)\)/,
  );
  assert.match(
    css,
    /@media \(min-width: 1280px\)\s*\{[\s\S]*?\.edictSlot\s*\{[\s\S]*?padding-inline:\s*8px/,
  );
  assert.match(
    css,
    /\.expandedSlot\s*\{[\s\S]*?height:\s*clamp\(420px,\s*calc\(100dvh - 260px\),\s*660px\)/,
  );
  assert.match(css, /\.collapsedSlot\s*\{[\s\S]*?margin-top:\s*52px/);
  assert.match(
    css,
    /@media \(max-width: 700px\)\s*\{[\s\S]*?\.edictSlot\s*\{[\s\S]*?max-width:\s*100%[\s\S]*?padding-inline:\s*0[\s\S]*?\.collapsedSlot\s*\{[\s\S]*?margin-top:\s*377px/,
  );
  assert.match(
    css,
    /@media \(max-width: 700px\)\s*\{[\s\S]*?\.collapsedSlot\s+:global\(\[data-testid="collapsed-edict-scroll"\]\)\s*\{[\s\S]*?height:\s*58px/,
  );
  assert.match(css, /\.emptyExpanded\s*\{/);
  assert.match(css, /\.composer\s*\{[\s\S]*?grid-template-columns:/);
  assert.match(css, /\.onboardingBackdrop\s*\{/);
  assert.match(css, /\.styleGrid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(3/);
  assert.match(css, /@media \(max-width: 700px\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.doesNotMatch(css, /\.(?:collapsedScroll|roller|scrollPaper)\s*\{/);
  assert.doesNotMatch(css, /\.expanded::(?:before|after)/);
});
