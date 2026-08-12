import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

import {
  projectDraftConfirmation,
  type ChancellorDraftResult,
} from "../../app/study/chancellorDraft.ts";

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

test("dev study workspace renders distinct async decree progress without dropping daily memorial", async () => {
  const source = await readFile(new URL("./DevStudyWorkspace.tsx", import.meta.url), "utf8");

  assert.match(source, /\["enqueueing", "queued", "running"\]\.includes\(props\.uiState\.phase\)/);
  assert.match(source, /phase === "enqueueing"[\s\S]*?圣旨正在入队/);
  assert.match(source, /phase === "queued"[\s\S]*?圣旨已入队/);
  assert.match(source, /phase === "running"[\s\S]*?正在办理圣旨/);
  assert.doesNotMatch(source, /phase === "submitting"/);
  assert.match(source, /<h2 id="daily-memorial-title">每日奏折<\/h2>/);
});

test("daily memorial uses the sole main scroll with truthful status and confirmation", async () => {
  const [source, css] = await Promise.all([
    readFile(new URL("./DevStudyWorkspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("./DevStudyWorkspace.module.css", import.meta.url), "utf8"),
  ]);
  assert.match(source, /dailyMemorialState: DailyMemorialUiState/);
  assert.equal((source.match(/<EdictStage/g) ?? []).length, 4);
  assert.doesNotMatch(source, /styles\.dailyMemorialCard/);
  assert.match(source, /title: "每日奏折"/);
  assert.match(source, /bodyLabel="每日奏折摘要"/);
  assert.match(source, /<h2 id="daily-memorial-title">每日奏折<\/h2>/);
  assert.match(source, /aria-live="polite"/);
  assert.match(source, /39\/39 司/);
  assert.match(source, /6\/6 部/);
  assert.match(source, /确认上奏并归档为奏折/);
  assert.match(source, /onClick=\{props\.onConfirmDailyMemorial\}/);
  assert.match(source, /phase === "no_facts"[\s\S]*?没有可用的受控事实/);
  assert.match(source, /phase === "failed"[\s\S]*?onRetryDailyMemorial/);
  assert.doesNotMatch(source, /REPLY|回奏已生成|圣旨已下|已批准|已执行/);
  assert.match(css, /\.dailyMemorialConfirm:focus-visible/);
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
  assert.match(source, /role="dialog"/);
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
  assert.match(source, /data-testid="draft-edict-button"/);
  assert.match(source, /"拟旨"/);
  assert.match(source, /data-testid="chancellor-draft-result"/);
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

test("composer only drafts while the completed draft scroll owns the sole issue action", async () => {
  const source = await readFile(
    new URL("./DevStudyWorkspace.tsx", import.meta.url),
    "utf8",
  );
  const composerStart = source.indexOf("const composer = (");
  const composerEnd = source.indexOf("const drawers = (");
  const composer = source.slice(composerStart, composerEnd);
  const draftBranch = source.slice(source.indexOf("props.draftResult ? ("));

  assert.match(composer, /data-testid="draft-edict-button"/);
  assert.doesNotMatch(composer, /data-testid="submit-decree-button"/);
  assert.equal(
    (source.match(/data-testid="submit-decree-button"/g) ?? []).length,
    1,
  );
  assert.match(draftBranch, /即将下旨的草案/);
  assert.ok(
    draftBranch.indexOf("即将下旨的草案") <
      draftBranch.indexOf('data-testid="submit-decree-button"'),
  );
  assert.doesNotMatch(
    draftBranch,
    /JSON\.stringify\(props\.draftResult\.draft|<pre>/,
  );
});

test("ready draft only presents participating departments and the edict about to be issued", async () => {
  const source = await readFile(new URL("./DevStudyWorkspace.tsx", import.meta.url), "utf8");
  const draftBranch = source.slice(
    source.indexOf(") : props.draftResult ? ("),
    source.indexOf(") : archivedReply ? ("),
  );

  assert.match(draftBranch, /参与部门/);
  assert.match(draftBranch, /必选承办司/);
  assert.match(draftBranch, /角色/);
  assert.match(draftBranch, /参与原因/);
  assert.match(draftBranch, /负责事项/);
  assert.match(draftBranch, /预计产出/);
  assert.match(draftBranch, /即将下旨的草案/);
  assert.match(draftBranch, /draftConfirmation\?\.visibleCanonicalText/);
  assert.match(draftBranch, /draftConfirmation\?\.showIssueAction/);
  assert.match(draftBranch, /draftDepartmentDisplayRows\(props\.draftResult\.draft\.departments\)\.map/);
  assert.match(draftBranch, /item\.department/);
  assert.match(draftBranch, /item\.bureaus/);
  assert.match(draftBranch, /item\.role/);
  assert.match(draftBranch, /item\.reason/);
  assert.match(draftBranch, /item\.responsibility/);
  assert.match(draftBranch, /item\.expectedOutput/);
  assert.doesNotMatch(draftBranch, /\{item\.department\} · \{item\.role\}/);
  assert.match(draftBranch, /当前状态/);
  assert.match(draftBranch, /草案完整，可以直接下旨/);
  assert.doesNotMatch(
    draftBranch,
    /臣对您的理解|大神级拟旨草案|丞相为什么这样补全|丞相建议与暂定边界|任务目标|执行范围|不包含|输入材料|材料缺口|重点问题|执行步骤|最终交付物|完成标准|权限与限制/,
  );
  assert.doesNotMatch(
    draftBranch,
    /props\.draftResult\.(understanding|recommendation_reason|assumptions)|props\.draftResult\.draft\.(objective|scope|exclusions|input_materials|material_gaps|key_questions|execution_steps|deliverables|completion_criteria|permissions_and_limits)/,
  );
});

test("periodless draft shows canonical 2025 before confirmation while NEEDS_INPUT exposes no decree action", async () => {
  const ready: ChancellorDraftResult = {
    status: "DRAFT_READY",
    version: 1,
    fingerprint: "a".repeat(64),
    understanding: "生成上一完整年度财务报表",
    expert_example: "请户部会计司生成2025年财务报表并提供下载。",
    recommendation_reason: "采用上一完整年度",
    assumptions: ["上一完整年度为2025年"],
    revision_prompt: "可直接下旨",
    draft: {
      objective: "生成财务报表",
      scope: ["2025年"], exclusions: [], input_materials: [], material_gaps: [],
      key_questions: ["数据是否完整"],
      departments: [{
        department: "户部", bureaus: ["会计司"], role: "主办", reason: "财务报表",
        responsibility: "生成报表", expected_output: "XLSX",
      }],
      execution_steps: ["核验数据"], deliverables: ["XLSX"],
      completion_criteria: ["可下载"], permissions_and_limits: ["只读"],
      current_status: "DRAFT_READY",
    },
    decree_text: "请户部会计司生成2025年财务报表并提供下载。",
  };
  const needsInput: ChancellorDraftResult = {
    ...ready,
    status: "NEEDS_INPUT",
    draft: null,
    decree_text: null,
    expert_example: "上一完整年度（2025年）的财务数据当前不可用。",
  };

  assert.deepEqual(projectDraftConfirmation(ready), {
    visibleCanonicalText: "请户部会计司生成2025年财务报表并提供下载。",
    showIssueAction: true,
  });
  assert.deepEqual(projectDraftConfirmation(needsInput), {
    visibleCanonicalText: "上一完整年度（2025年）的财务数据当前不可用。",
    showIssueAction: false,
  });

  const source = await readFile(new URL("./DevStudyWorkspace.tsx", import.meta.url), "utf8");
  assert.match(source, /projectDraftConfirmation\(props\.draftResult\)/);
  assert.match(source, /draftConfirmation\?\.visibleCanonicalText/);
  assert.match(source, /draftConfirmation\?\.showIssueAction/);
});

test("draft pending and failure are visible in the central scroll", async () => {
  const source = await readFile(new URL("./DevStudyWorkspace.tsx", import.meta.url), "utf8");

  assert.match(
    source,
    /const showScroll = [^;]*props\.draftPending[^;]*props\.draftError/,
  );
  assert.match(source, /props\.draftPending \? \(/);
  assert.match(source, /丞相正在揣摩上意并整理拟旨草案/);
  assert.match(source, /props\.draftError \? \(/);
  assert.match(source, /拟旨未能完成/);
});

test("submission failure is visible even while the approved draft is retained", async () => {
  const source = await readFile(new URL("./DevStudyWorkspace.tsx", import.meta.url), "utf8");

  const errorBranch = source.indexOf('props.uiState.phase === "error"');
  const draftBranch = source.indexOf("props.draftResult ? (");
  assert.ok(errorBranch >= 0);
  assert.ok(errorBranch < draftBranch);
  assert.match(source, /办理未能完成/);
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
  assert.equal(countMatches(/aria-label="御前拟旨"/g), 1);
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

test("study composer keeps the textarea flexible beside the draft action", async () => {
  const [source, css] = await Promise.all([
    readFile(new URL("./DevStudyWorkspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("./DevStudyWorkspace.module.css", import.meta.url), "utf8"),
  ]);

  assert.match(
    source,
    /className=\{styles\.draftAction\}[\s\S]*?data-testid="draft-edict-button"/,
  );
  assert.match(
    css,
    /\.composerRow\s*\{[^}]*grid-template-columns:\s*auto minmax\(0,\s*1fr\) auto;/,
  );
  assert.match(
    css,
    /@media \(max-width: 700px\)[\s\S]*?\.composerRow\s*\{[^}]*grid-template-columns:\s*auto minmax\(0,\s*1fr\) auto;/,
  );
  assert.doesNotMatch(css, /\.draftAction\s*\{[^}]*display:\s*none;/);
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

test("dev study workspace renders an archived reply in the central scroll without a dialog", async () => {
  const source = await readFile(new URL("./DevStudyWorkspace.tsx", import.meta.url), "utf8");
  const archivedBranch = source.match(
    /\) : archivedReply \? \(([\s\S]*?)\) : props\.uiState\.phase === "success"/,
  )?.[1];

  assert.ok(archivedBranch);
  assert.match(source, /selectedArchivedReply/);
  assert.match(archivedBranch, /data-testid="archived-reply-scroll"/);
  assert.match(archivedBranch, /bodyLabel="史馆归档回奏"/);
  assert.match(archivedBranch, /原旨正文/);
  assert.match(archivedBranch, /办理过程/);
  assert.match(archivedBranch, /参与部门/);
  assert.match(archivedBranch, /回奏结论/);
  assert.match(archivedBranch, /回奏时间/);
  assert.match(archivedBranch, /责任主体/);
  assert.doesNotMatch(archivedBranch, /role="dialog"/);
});

test("archive id changes schedule scroll expansion and focus with cleanup", async () => {
  const source = await readFile(new URL("./DevStudyWorkspace.tsx", import.meta.url), "utf8");
  const effect = source.match(
    /useEffect\(\(\) => \{\s*if \(!archivedReplyId\)[\s\S]*?\}, \[archivedReplyId\]\);/,
  )?.[0];

  assert.ok(effect);
  assert.match(effect, /window\.setTimeout\(\(\) => \{/);
  assert.match(effect, /setExpanded\(true\)/);
  assert.match(effect, /archivedReplyRef\.current\?\.focus\(\)/);
  assert.match(effect, /return \(\) => window\.clearTimeout\(timer\)/);
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
  assert.match(css, /\.collapsedSlot\s*\{[\s\S]*?margin-top:\s*12px/);
  assert.match(
    css,
    /@media \(max-width: 700px\)\s*\{[\s\S]*?\.edictSlot\s*\{[\s\S]*?max-width:\s*100%[\s\S]*?padding-inline:\s*0[\s\S]*?\.collapsedSlot\s*\{[\s\S]*?margin-top:\s*12px/,
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

test("dev study workspace passes recent reply state and callbacks to the drawer", async () => {
  const source = await readFile(new URL("./DevStudyWorkspace.tsx", import.meta.url), "utf8");

  assert.match(source, /recentReplies: StudyRecentRepliesState/);
  assert.match(source, /recentReplies=\{props\.recentReplies\}/);
  assert.match(source, /onOpenRecentReplies=\{props\.onOpenRecentReplies\}/);
  assert.match(source, /onRetryRecentReplies=\{props\.onRetryRecentReplies\}/);
  assert.match(source, /onSelectRecentReply=\{props\.onSelectRecentReply\}/);
  assert.doesNotMatch(source, /DecreeSessionRecord|decreeSessionRecords/);
});

test("study mounts side drawers in the shell overlay layer", async () => {
  const source = await readFile(new URL("./DevStudyWorkspace.tsx", import.meta.url), "utf8");

  assert.match(source, /projectQintianDecisionRadar/);
  assert.match(source, /const qintianRadar = projectQintianDecisionRadar\(/);
  assert.match(source, /qintianRadar=\{qintianRadar\}/);
  assert.match(source, /const drawers = \(\s*<StudySideDrawers/);
  assert.match(source, /<ImmersiveCourtShell[\s\S]*?overlay=\{drawers\}/);
  assert.equal((source.match(/<StudySideDrawers/g) ?? []).length, 1);
});

test("successful reply delegates artifact rendering after the three recommendations", async () => {
  const source = await readFile(new URL("./DevStudyWorkspace.tsx", import.meta.url), "utf8");
  const successStart = source.indexOf('props.uiState.phase === "success" ? (');
  const successEnd = source.indexOf(") : (", successStart);
  const successBranch = source.slice(successStart, successEnd);

  assert.match(source, /import \{ StudyArtifactLinks \} from "\.\/StudyArtifactLinks"/);
  assert.match(source, /projectStudyArtifacts\(props\.uiState\)/);
  assert.match(successBranch, /<StudyArtifactLinks artifacts=\{artifactView\} className=\{styles\.artifact\} \/>/);
  assert.ok(successBranch.indexOf("decree-recommendations") < successBranch.indexOf("<StudyArtifactLinks"));
});
