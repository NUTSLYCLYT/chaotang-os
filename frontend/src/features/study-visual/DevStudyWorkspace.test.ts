import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

test("failed stage discloses the cause before offering a secondary recovery action", async () => {
  const source = await readFile(new URL("./DevStudyWorkspace.tsx", import.meta.url), "utf8");
  const error = source.slice(source.indexOf(') : props.uiState.phase === "error" ? ('), source.indexOf(') : ["enqueueing", "queued", "running"].includes'));
  assert.match(error, /<details[^>]*data-testid="decree-failure-details"/);
  assert.match(error, /<summary[^>]*>查看原因与下一步<\/summary>/);
  assert.ok(error.indexOf("<summary") < error.indexOf("onClick={props.onRetryProgress}"));
  assert.match(error, /className=\{styles\.recoverySecondary\}/);
});

test("daily status retry cannot compete with an active goal or onboarding", async () => {
  const source = await readFile(new URL("./DevStudyWorkspace.tsx", import.meta.url), "utf8");
  const retry = source.slice(source.indexOf('(props.dailyMemorialState.phase === "failed"'), source.indexOf('(props.dailyMemorialState.phase === "failed"') + 700);
  assert.match(retry, /action\.stage === "EMPTY"/);
  assert.match(retry, /!props\.decreeText\.trim\(\)/);
  assert.match(retry, /actionSurfaceReady/);
  assert.match(source, /const actionSurfaceReady = showFirstVisit !== null && !welcomeVisible/);
  assert.match(source, /useState<boolean \| null>\(null\)/);
});

test("all mutating primary actions wait for onboarding resolution", async () => {
  const source = await readFile(new URL("./DevStudyWorkspace.tsx", import.meta.url), "utf8");
  assert.match(source, /actionSurfaceReady && \(action\.stage === "EMPTY"/);
  assert.match(source, /actionSurfaceReady && action\.stage === "DRAFT_READY"/);
  assert.match(source, /actionSurfaceReady && action\.stage === "DAILY_MEMORIAL_REVIEW_ONLY"/);
  assert.match(source, /disabled=\{!actionSurfaceReady \|\| !props\.canRetryProgress\}/);
});

test("every business CTA uses one stage allowlist and onboarding cannot directly draft", async () => {
  const source = await readFile(new URL("./DevStudyWorkspace.tsx", import.meta.url), "utf8");
  assert.match(source, /projectStudyPrimaryAction\(/);
  assert.doesNotMatch(source, /onStartDraft=\{props\.onDraft\}/);
  assert.match(source, /onRestate=\{props\.onRestate\}/);
  assert.match(source, /action\.stage === "DAILY_MEMORIAL_REVIEW_ONLY"/);
  assert.match(source, /action\.stage === "DRAFT_READY"/);
});

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

test("first visit shows only the Chancellor, one blank goal input, and one primary action", async () => {
  const [source, css] = await Promise.all([
    readFile(new URL("./DevStudyWorkspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("./DevStudyWorkspace.module.css", import.meta.url), "utf8"),
  ]);
  const firstVisit = source.slice(
    source.indexOf("function FirstDecreeWelcome"),
    source.indexOf("export function DevStudyWorkspace"),
  );

  assert.match(source, /courtos\.onboarded/);
  assert.match(firstVisit, /丞相/);
  assert.match(firstVisit, /aria-label="第一旨目标"/);
  assert.match(firstVisit, /useState\(""\)/);
  assert.match(firstVisit, /请丞相复述/);
  assert.match(firstVisit, /LOCAL/);
  assert.equal((firstVisit.match(/<textarea/g) ?? []).length, 1);
  assert.equal((firstVisit.match(/<button/g) ?? []).length, 1);
  assert.doesNotMatch(source, /courtos\.ruler\.style|RULER_STYLES|FIRST_DECREE/);
  assert.doesNotMatch(source, /严政陛下|仁政陛下|勤政陛下|开朝仪轨|STEP [123]|跳过/);
  assert.match(source, /role="dialog"/);
  assert.doesNotMatch(source, /fetch\s*\(|EventSource|SWR|useRouter/);
  assert.match(firstVisit, /onRestate\(normalizedTarget\)/);
  assert.match(firstVisit, /textareaRef\.current\?\.focus\(\)/);
  assert.match(firstVisit, /event\.key !== "Tab"/);
  assert.match(firstVisit, /onKeyDown=\{trapFocus\}/);
  assert.match(css, /\.firstDraft:focus-visible\s*\{/);
});

test("first decree requests restatement and composer drafts only at the confirmation stage", async () => {
  const source = await readFile(new URL("./DevStudyWorkspace.tsx", import.meta.url), "utf8");
  const firstVisit = source.slice(
    source.indexOf("function FirstDecreeWelcome"),
    source.indexOf("function AcceptanceText"),
  );
  const composer = source.slice(
    source.indexOf("const composer = ("),
    source.indexOf("const drawers = ("),
  );

  assert.match(firstVisit, /onRestate\(normalizedTarget\)/);
  assert.doesNotMatch(firstVisit, /onUseDraft/);
  assert.match(composer, /action\.stage === "UNDERSTANDING_READY"/);
  assert.match(composer, /if \(action\.stage === "EMPTY"\) props\.onRestate\(props\.decreeText\);\s*else props\.onDraft\(props\.decreeText\)/);
});

test("dev study workspace keeps one polished decree action without secret modes", async () => {
  const [source, css] = await Promise.all([
    readFile(new URL("./DevStudyWorkspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("./DevStudyWorkspace.module.css", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(source, /真实任务库暂不可读/);
  assert.doesNotMatch(source, /styles\.warning/);
  assert.match(source, /每日奏折/);
  assert.match(source, /收卷看殿/);
  assert.doesNotMatch(source, /DecreeMode|decree-mode-order|decree-mode-secret|setMode|密旨|下密旨/);
  assert.match(source, /data-testid="draft-edict-button"/);
  assert.match(source, /\{action\.label\}/);
  assert.match(source, /data-testid="chancellor-draft-result"/);
  assert.match(source, /data-testid="decree-evidence-upload"/);
  assert.match(source, /data-testid="decree-textarea"/);
  assert.match(source, /data-testid="submit-decree-button"/);
  assert.match(source, /确认下旨 · 开始办理/);
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

test("ready draft presents every existing DraftEdict acceptance field", async () => {
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
  assert.match(draftBranch, /任务目标/);
  assert.match(draftBranch, /执行范围/);
  assert.match(draftBranch, /不包含/);
  assert.match(draftBranch, /输入材料/);
  assert.match(draftBranch, /材料缺口/);
  assert.match(draftBranch, /重点问题/);
  assert.match(draftBranch, /执行步骤/);
  assert.match(draftBranch, /最终交付物/);
  assert.match(draftBranch, /完成标准/);
  assert.match(draftBranch, /权限与限制/);
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
  assert.match(draftBranch, /cockpit\.acceptance/);
  assert.doesNotMatch(draftBranch, /暂无验收|默认验收/);
});

test("missing and empty acceptance values render truthful field-specific absence labels", async () => {
  const source = await readFile(new URL("./DevStudyWorkspace.tsx", import.meta.url), "utf8");
  const acceptanceText = source.slice(
    source.indexOf("function AcceptanceText"),
    source.indexOf("function AcceptanceList"),
  );
  const acceptanceList = source.slice(
    source.indexOf("function AcceptanceList"),
    source.indexOf("function VerifiedJobProgress"),
  );
  const emptyBranch = acceptanceList.slice(
    acceptanceList.indexOf("if (values.length === 0)"),
    acceptanceList.indexOf("  return (", acceptanceList.indexOf("if (values.length === 0)")),
  );

  assert.match(acceptanceText, /value === undefined[\s\S]*?未提供/);
  assert.match(acceptanceList, /values === undefined[\s\S]*?未提供/);
  assert.match(acceptanceList, /values\.length === 0/);
  assert.match(emptyBranch, /emptyLabel/);
  assert.doesNotMatch(emptyBranch, /<ul>/);
  assert.match(source, /label="不包含"[\s\S]*?emptyLabel="无排除项"/);
  assert.match(source, /label="材料缺口"[\s\S]*?emptyLabel="无已知材料缺口"/);
});

test("study shows explicit LOCAL/API_LIVE modes and only verified job progress fields", async () => {
  const source = await readFile(new URL("./DevStudyWorkspace.tsx", import.meta.url), "utf8");

  assert.match(source, /SOURCE_MODE_LABELS/);
  assert.match(source, /cockpit\.sourceMode/);
  assert.match(source, /jobId/);
  assert.match(source, /stage/);
  assert.match(source, /attemptCount/);
  assert.match(source, /providerRequestCount/);
  assert.match(source, /createdAt/);
  assert.match(source, /updatedAt/);
  assert.doesNotMatch(source, /\b(?:percent|percentage|eta)\b|预计完成|完成度/i);
  assert.match(source, /aria-live="polite"/);
});

test("composer labels current browser input LOCAL regardless of historical API facts", async () => {
  const source = await readFile(new URL("./DevStudyWorkspace.tsx", import.meta.url), "utf8");
  const composer = source.slice(
    source.indexOf("const composer = ("),
    source.indexOf("const drawers = ("),
  );

  assert.match(composer, /SOURCE_MODE_LABELS\.LOCAL/);
  assert.doesNotMatch(composer, /cockpit\.sourceMode/);
});

test("task fact branches render their projected provenance instead of hardcoding API_LIVE", async () => {
  const source = await readFile(new URL("./DevStudyWorkspace.tsx", import.meta.url), "utf8");
  const centralFlow = source.slice(
    source.indexOf(') : props.uiState.phase === "error" ? ('),
    source.indexOf(') : (props.uiState.phase as string) === "idle" ? ('),
  );

  assert.ok((centralFlow.match(/SOURCE_MODE_LABELS\[cockpit\.sourceMode\]/g) ?? []).length >= 3);
  assert.ok((centralFlow.match(/data-source-mode=\{cockpit\.sourceMode\}/g) ?? []).length >= 3);
  assert.doesNotMatch(centralFlow, /SOURCE_MODE_LABELS\.API_LIVE|data-source-mode="API_LIVE"/);
});

test("verified job progress keeps machine timestamps semantic and business-formatted", async () => {
  const source = await readFile(new URL("./DevStudyWorkspace.tsx", import.meta.url), "utf8");
  const progressView = source.slice(
    source.indexOf("function VerifiedJobProgress"),
    source.indexOf("export function DevStudyWorkspace"),
  );

  assert.match(
    progressView,
    /<time dateTime=\{progress\.createdAt\}>\{formatBusinessTime\(progress\.createdAt\)\}<\/time>/,
  );
  assert.match(
    progressView,
    /<time dateTime=\{progress\.updatedAt\}>\{formatBusinessTime\(progress\.updatedAt\)\}<\/time>/,
  );
  assert.doesNotMatch(progressView, /<dd>\{progress\.(?:createdAt|updatedAt)\}<\/dd>/);
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

  const errorBranch = source.indexOf(') : props.uiState.phase === "error" ? (');
  const draftBranch = source.indexOf("props.draftResult ? (");
  assert.ok(errorBranch >= 0);
  assert.ok(errorBranch < draftBranch);
  assert.match(source, /办理未能完成/);
  const errorContent = source.slice(errorBranch, draftBranch);
  assert.match(source, /最后一次已验证任务进度/);
  assert.match(source, /当前状态不可用/);
  assert.match(errorContent, /freshness=\{props\.uiState\.progressFreshness/);
  assert.match(source, /freshness === "stale"/);
  assert.match(errorContent, /data-testid="retry-decree-progress"/);
  assert.match(errorContent, /onClick=\{props\.onRetryProgress\}/);
  assert.match(errorContent, /disabled=\{!actionSurfaceReady \|\| !props\.canRetryProgress\}/);
  assert.match(errorContent, /props\.retryProgressLabel/);
  assert.match(errorContent, /props\.retryProgressHint/);
  assert.equal((errorContent.match(/<button/g) ?? []).length, 1);
});

test("job progress relies on its parent live region instead of nesting announcements", async () => {
  const source = await readFile(new URL("./DevStudyWorkspace.tsx", import.meta.url), "utf8");
  const progressView = source.slice(
    source.indexOf("function VerifiedJobProgress"),
    source.indexOf("export function DevStudyWorkspace"),
  );

  assert.doesNotMatch(progressView, /aria-live=/);
});

test("submission failure leaves the recovery button as the only enabled draft action", async () => {
  const source = await readFile(new URL("./DevStudyWorkspace.tsx", import.meta.url), "utf8");
  const composer = source.slice(
    source.indexOf("const composer = ("),
    source.indexOf("const drawers = ("),
  );

  assert.match(
    composer,
    /action\.stage === "EMPTY" \|\| action\.stage === "UNDERSTANDING_READY"/,
  );
  assert.match(composer, /disabled=\{!props\.canEdit \|\| !props\.decreeText\.trim\(\)\}/);
});

test("a blocked draft shows exactly one recovery control and leaves the issue action unchanged", async () => {
  const source = await readFile(new URL("./DevStudyWorkspace.tsx", import.meta.url), "utf8");
  const composer = source.slice(
    source.indexOf("const composer = ("),
    source.indexOf("const drawers = ("),
  );

  assert.match(composer, /actionSurfaceReady && action\.stage === "DRAFT_BLOCKED"/);
  assert.match(composer, /data-testid="draft-blocked-recovery"/);
  assert.match(composer, /onClick=\{props\.onRetryProgress\}/);
  assert.match(composer, /disabled=\{!props\.canRetryProgress\}/);
  assert.match(composer, /\{action\.label\}/);
  assert.equal((composer.match(/props\.onRetryProgress/g) ?? []).length, 1);
  assert.equal((composer.match(/data-testid="draft-edict-button"/g) ?? []).length, 1);
  assert.equal((source.match(/data-testid="submit-decree-button"/g) ?? []).length, 1);
  assert.match(source, /actionSurfaceReady && action\.stage === "DRAFT_READY"/);
});

test("verified enqueueing, queued, and running progress outranks a retained draft", async () => {
  const source = await readFile(new URL("./DevStudyWorkspace.tsx", import.meta.url), "utf8");
  const centralFlow = source.slice(
    source.indexOf(') : props.uiState.phase === "error" ? ('),
    source.indexOf(") : archivedReply ? ("),
  );
  const activeJobBranch = centralFlow.indexOf(
    '["enqueueing", "queued", "running"].includes(props.uiState.phase) ? (',
  );
  const retainedDraftBranch = centralFlow.indexOf("props.draftResult ? (");

  assert.ok(activeJobBranch >= 0, "active job branch must exist");
  assert.ok(retainedDraftBranch >= 0, "retained draft branch must exist");
  assert.ok(activeJobBranch < retainedDraftBranch, "active job progress must render before the retained draft");
  assert.match(centralFlow.slice(activeJobBranch, retainedDraftBranch), /VerifiedJobProgress/);
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
  assert.match(css, /\.submit \{[^}]*border-color: #734516;[^}]*background: #3b2814;[^}]*color: #f6e9c9;/);
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
    /@media \(max-width: 700px\)[\s\S]*?\.composerRow\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\) auto;/,
  );
  assert.doesNotMatch(css, /\.draftAction\s*\{[^}]*display:\s*none;/);
});

test("desktop composer fits the fixed 48px dock and keeps its source label outside the controls", async () => {
  const css = await readFile(new URL("./DevStudyWorkspace.module.css", import.meta.url), "utf8");
  const composerRule = css.match(/\.composer \{([^}]*)\}/)?.[1] ?? "";

  assert.match(composerRule, /min-height:\s*48px/);
  assert.match(composerRule, /(?:^|[;\s])height:\s*48px/);
  assert.match(composerRule, /padding-top:\s*0/);
  assert.match(composerRule, /grid-template-rows:\s*minmax\(0,\s*1fr\)/);
  const label = css.match(/\.composer > \.sourceMode \{([^}]*)\}/)?.[1] ?? "";
  assert.match(label, /position:\s*absolute/);
  assert.match(label, /bottom:\s*calc\(100% \+ 5px\)/);
  assert.match(css, /\.composerRow\s*\{[^}]*height:\s*100%;[^}]*box-sizing:\s*border-box;/);
});

test("mobile composer fits the 48px quick dock without overlapping controls", async () => {
  const css = await readFile(new URL("./DevStudyWorkspace.module.css", import.meta.url), "utf8");
  const mobile = css.slice(css.indexOf("@media (max-width: 700px)"));

  assert.match(mobile, /\.composer\s*\{[^}]*height:\s*48px;[^}]*min-height:\s*48px;[^}]*padding-top:\s*0;/);
  assert.match(mobile, /\.composer\s*>\s*\.sourceMode\s*\{[^}]*position:\s*absolute;[^}]*bottom:\s*calc\(100% \+ \d+px\);/);
  assert.match(mobile, /\.attach\s*\{[^}]*display:\s*none;/);
  assert.match(mobile, /\.composerRow\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\) auto;[^}]*height:\s*100%;[^}]*box-sizing:\s*border-box;/);
  assert.doesNotMatch(mobile, /\.composerRow\s*\{[^}]*grid-template-columns:\s*auto minmax\(0,\s*1fr\) auto;/);
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
  assert.doesNotMatch(css, /\.styleGrid\s*\{|\.hintGrid\s*\{/);
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

// Solid control surfaces keep small confirmation text readable on textured paper.
// Paired with real-browser computed-style and screenshot checks.
function paperControlColors(css: string, selector: string) {
  const declarations: Record<string, string> = {};
  for (const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!match[1].split(",").some((part) => part.trim() === selector)) continue;
    for (const declaration of match[2].split(";")) {
      const colon = declaration.indexOf(":");
      if (colon < 0) continue;
      declarations[declaration.slice(0, colon).trim()] = declaration.slice(colon + 1).trim();
    }
  }
  const foreground = declarations.color;
  const background = declarations["background-color"] ?? declarations.background;
  assert.match(foreground ?? "", /^#[0-9a-f]{6}$/i, selector + " needs an explicit opaque text color");
  assert.match(background ?? "", /^#[0-9a-f]{6}$/i, selector + " needs its own opaque background on textured paper");
  return { foreground, background };
}

function relativeLuminance(hex: string) {
  const channels = [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255)
    .map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

for (const selector of [".submit", ".dailyMemorialConfirm", ".dailyMemorialRetry"]) {
  test("paper action contrast: " + selector + " maintains readable small text independently of paper texture", async () => {
    const css = await readFile(new URL("./DevStudyWorkspace.module.css", import.meta.url), "utf8");
    const colors = paperControlColors(css, selector);
    const first = relativeLuminance(colors.foreground);
    const second = relativeLuminance(colors.background);
    const ratio = (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
    assert.ok(ratio >= 4.5, selector + " text contrast " + ratio.toFixed(2) + " is below 4.5:1");
  });
}

test("daily memorial content states require a real draft before auto-expanding the existing scroll", async () => {
  const source = await readFile(new URL("./DevStudyWorkspace.tsx", import.meta.url), "utf8");
  const predicate = source.match(/const hasDailyMemorialDraft = ([\s\S]*?);/)?.[1];
  assert.ok(predicate, "daily memorial needs its own content availability predicate");
  for (const phase of ["ready", "confirming", "confirmed"]) {
    assert.ok(predicate.includes('props.dailyMemorialState.phase === "' + phase + '"'));
  }
  assert.match(predicate, /&& props\.dailyMemorialState\.draft !== null/);
});

test("daily memorial arrival schedules expansion once per availability change without confirming anything", async () => {
  const source = await readFile(new URL("./DevStudyWorkspace.tsx", import.meta.url), "utf8");
  const effect = source.match(/useEffect\(\(\) => \{\s*if \(!hasDailyMemorialDraft\)[\s\S]*?\}, \[hasDailyMemorialDraft\]\);/)?.[0];
  assert.ok(effect, "expand only when draft content becomes available, not every render");
  assert.match(effect, /window\.setTimeout\(\(\) => \{\s*setExpanded\(true\);\s*\}, 0\)/);
  assert.match(effect, /return \(\) => window\.clearTimeout\(timer\)/);
  assert.doesNotMatch(effect, /props\.on|fetch\(|dispatch\(|localStorage|\.focus\(/);
});

test("daily memorial manual collapse uses the existing collapsed scroll rather than clipping full content", async () => {
  const source = await readFile(new URL("./DevStudyWorkspace.tsx", import.meta.url), "utf8");
  assert.match(source, /\) : !showScroll && \(props\.uiState\.phase !== "idle" \|\| hasDailyMemorialDraft\) \? \(/);
  const branch = source.slice(source.indexOf(") : !showScroll"), source.indexOf(") : props.draftPending ? ("));
  assert.match(branch, /<CollapsedEdictScroll/);
  assert.match(branch, /onOpen=\{\(\) => setExpanded\(true\)\}/);
  assert.doesNotMatch(branch, /props\.onConfirm|props\.onSubmit|fetch\(/);
});
