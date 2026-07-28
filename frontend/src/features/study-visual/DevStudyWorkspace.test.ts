import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

test("DevStudyWorkspace supersedes the unused sibling workspace", async () => {
  await Promise.all(
    [
      "./StudyWorkspace.tsx",
      "./StudyWorkspace.module.css",
      "./StudyWorkspace.test.ts",
    ].map((path) =>
      assert.rejects(access(new URL(path, import.meta.url)), { code: "ENOENT" }),
    ),
  );
});

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

test("dev study workspace keeps one polished decree action without secret modes", async () => {
  const [source, css] = await Promise.all([
    readFile(new URL("./DevStudyWorkspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("./DevStudyWorkspace.module.css", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(source, /真实任务库暂不可读/);
  assert.doesNotMatch(source, /styles\.warning/);
  assert.match(source, /今日圣旨/);
  assert.match(source, /收卷看殿/);
  assert.doesNotMatch(source, /DecreeMode|decree-mode-order|decree-mode-secret|setMode|密旨|下密旨/);
  assert.match(source, /data-testid="decree-polish-inline"/);
  assert.match(source, /data-testid="decree-evidence-upload"/);
  assert.match(source, /data-testid="decree-textarea"/);
  assert.match(source, /data-testid="submit-decree-button"/);
  assert.match(source, /\? "办理中" : "下旨"/);
  assert.doesNotMatch(source, /data-testid="decree-fee-notice"|下旨会触发真实司议、部议、军机处会审与丞相汇总，并可能产生多次模型调用费用；请确认后提交。|模型调用费用/);
  assert.doesNotMatch(source, /费用提示/);
  assert.doesNotMatch(css, /\.feeNotice\s*\{/);
  assert.match(source, /onClick=\{props\.onSubmit\}/);
  assert.match(source, /disabled=\{!props\.canSubmit\}/);
  assert.match(source, /getStudyDepartmentCountLabel\(props\.uiState\)/);
  assert.doesNotMatch(source, /countLabel="1 部门"/);
});

test("study places the decree composer in the quick dock center slot", async () => {
  const source = await readFile(new URL("./DevStudyWorkspace.tsx", import.meta.url), "utf8");

  assert.match(source, /const composer = \(/);
  assert.match(source, /<ImmersiveCourtShell[\s\S]*?quickDockCenter=\{composer\}/);
  assert.match(source, /<section className=\{styles\.composer\}[\s\S]*?data-testid="decree-textarea"/);
  assert.match(source, /data-testid="submit-decree-button"/);
});

test("study renders exactly one decree composer instance", async () => {
  const source = await readFile(new URL("./DevStudyWorkspace.tsx", import.meta.url), "utf8");

  const countMatches = (pattern: RegExp) => (source.match(pattern) ?? []).length;

  assert.equal(countMatches(/data-testid="decree-textarea"/g), 1);
  assert.equal(countMatches(/data-testid="submit-decree-button"/g), 1);
  assert.equal(countMatches(/aria-label="御前下旨"/g), 1);
});

test("study composer uses a minimal text-first visual treatment", async () => {
  const [source, css] = await Promise.all([
    readFile(new URL("./DevStudyWorkspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("./DevStudyWorkspace.module.css", import.meta.url), "utf8"),
  ]);
  const composerRule = css.match(/\.composer \{([^}]*)\}/)?.[1] ?? "";

  assert.match(source, />上传附件<input type="file"/);
  assert.match(composerRule, /border: 1px solid rgba\(240, 198, 106, 0\.28\);/);
  assert.doesNotMatch(composerRule, /linear-gradient|box-shadow: (?!none)|backdrop-filter: (?!none)/);
  assert.doesNotMatch(css, /\.submit \{[^}]*linear-gradient|\.submit:not\(:disabled\):hover/);
  assert.match(css, /\.submit \{[^}]*border-color: #a77c35;[^}]*color: #a77c35;/);
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
  assert.doesNotMatch(css, /\.warning(?:\s|\{)/);
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
