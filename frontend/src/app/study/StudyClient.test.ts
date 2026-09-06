import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

export function buildStudyBrowserFixture(kind: "client" | "ui"): string {
  const root = fileURLToPath(new URL("../../../", import.meta.url));
  const require = createRequire(path.join(root, "package.json"));
  const modules: Record<string, { code: string; deps: Record<string, string> }> = {};
  function visit(file: string): string {
    if (modules[file]) return file;
    const entry = modules[file] = { code: '', deps: {} as Record<string, string> };
    if (file.endsWith('.css')) {
      entry.code = 'module.exports = new Proxy({}, {get: (_, key) => key});';
      return file;
    }
    let code = fs.readFileSync(file, 'utf8');
    if (/\.tsx?$/.test(file)) code = ts.transpileModule(code, { compilerOptions: {
      module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020,
    }}).outputText;
    entry.code = code;
    for (const match of code.matchAll(/require\(["']([^"']+)["']\)/g)) {
      const spec = match[1];
      let resolved;
      if (spec === 'next/link') resolved = '@link';
      else if (spec.includes('ImmersiveCourtShell')) resolved = '@shell';
      else if (spec.includes('court-visuals/edict/EdictStage')) resolved = '@edict';
      else if (spec.endsWith('/StudySideDrawers')) resolved = '@drawers';
      else if (spec.endsWith('/StudyArtifactLinks') || spec.endsWith('/StudyArtifactConfirmation')) resolved = '@artifacts';
      else if (kind === 'client' && spec.endsWith('/DevStudyWorkspace')) resolved = '@probe';
      else if (spec.startsWith('.')) {
        const target = path.resolve(path.dirname(file), spec);
        resolved = ['', '.ts', '.tsx', '.js', '/index.js'].map(s => target + s).find(f => fs.existsSync(f) && fs.statSync(f).isFile());
        if (!resolved) throw new Error('Unresolved ' + spec + ' in ' + file);
      } else resolved = createRequire(file).resolve(spec);
      entry.deps[spec] = resolved;
      if (!resolved.startsWith('@')) visit(resolved);
    }
    return file;
  }
  const react = visit(require.resolve('react'));
  const dom = visit(require.resolve('react-dom/client'));
  const source = visit(path.join(root, kind === 'client' ? 'src/app/study/StudyClient.tsx' : 'src/features/study-visual/DevStudyWorkspace.tsx'));
  return `const process={env:{NODE_ENV:'development'}};const modules=${JSON.stringify(modules)};const cache={};
  function load(id){if(cache[id])return cache[id].exports;
    if(id.startsWith('@')) {const R=load(${JSON.stringify(react)});const h=R.createElement;
      if(id==='@probe')return {DevStudyWorkspace:p=>{window.p1Props=p;return h('div',null,h('h1',null,'SYNTHETIC React integration fixture'),h('pre',{id:'probe'},JSON.stringify({canSubmit:p.canSubmit,goal:p.decreeText,draft:p.draftResult,understanding:p.understanding})));}};
      if(id==='@link')return {default:p=>h('a',p,p.children)};
      if(id==='@shell')return {ImmersiveCourtShell:p=>h('main',null,p.quickDockCenter,p.children,p.overlay)};
      if(id==='@edict')return {EdictStage:p=>h('section',null,p.children),CollapsedEdictScroll:p=>h('button',{onClick:p.onOpen},'展卷')};
      if(id==='@drawers')return {StudySideDrawers:()=>null};
      if(id==='@artifacts')return {StudyArtifactLinks:()=>null,StudyArtifactConfirmation:()=>null};
      throw Error(id);
    }
    const m=cache[id]={exports:{}};const data=modules[id];if(!data)throw Error(id);
    new Function('require','module','exports','process',data.code)(s=>load(data.deps[s]),m,m.exports,process);return m.exports;
  }
  const R=load(${JSON.stringify(react)});const app=load(${JSON.stringify(source)});const root=load(${JSON.stringify(dom)}).createRoot(document.getElementById('root'));
  window.calls=[];window.recoveryCalls=0;window.dailyCalls=0;
  window.fetch=async(url,init)=>{calls.push({url:String(url),body:init?.body});
    if(String(url).includes('chancellor-consult'))return Response.json({reply:'合成复述：生成报价草案，缺少认证与成本证据，不进行真实报价。'});
    if(String(url).includes('/drafts/chancellor'))return Response.json({status:'DRAFT_READY',version:1,fingerprint:'a'.repeat(64),understanding:'合成理解',expert_example:'合成草案',recommendation_reason:'合成',assumptions:[],revision_prompt:'修改',decree_text:'合成报价草案，不执行外部动作。',draft:{objective:'合成目标',scope:['合成范围'],exclusions:[],input_materials:['合成输入'],material_gaps:[],key_questions:['合成问题'],departments:[{department:'户部',bureaus:['会计司'],role:'主办',reason:'合成',responsibility:'合成',expected_output:'合成'}],execution_steps:['合成步骤'],deliverables:['草案'],completion_criteria:['人工确认'],permissions_and_limits:['不部署'],current_status:'DRAFT_READY'}});
    return Response.json({status:'error'}, {status:503});};
  const syntheticFetch=window.fetch;window.fetch=async(...args)=>{const response=await syntheticFetch(...args);if(String(args[0]).includes('/drafts/chancellor')){const body=await response.json();body.expert_example=body.decree_text;return Response.json(body);}return response;};
  localStorage.setItem('courtos.onboarded','1');sessionStorage.clear();
  const defaults={decreeText:'合成目标',uiState:{phase:'idle'},canEdit:true,canSubmit:false,draftResult:null,draftPending:false,draftError:null,understanding:null,onDecreeTextChange:()=>{},onRestate:()=>{},onDraft:()=>{},onSubmit:()=>{},onRetryProgress:()=>window.recoveryCalls++,canRetryProgress:true,retryProgressLabel:'重新拟旨',retryProgressHint:null,recentReplies:{phase:'idle',generation:0,archives:[],expandedIds:[]},onOpenRecentReplies:()=>{},onRetryRecentReplies:()=>{},onSelectRecentReply:()=>{},selectedArchivedReply:null,onReturnToCurrentReply:()=>{},consultMessages:[],consultPending:false,consultError:null,onConsultSend:async()=>false,dailyMemorialState:{phase:'no_facts',draft:null,message:'没有合成事实'},onConfirmDailyMemorial:()=>{},onRetryDailyMemorial:()=>window.dailyCalls++};
  window.renderOwner=userId=>root.render(R.createElement(app.StudyClient,{userId}));
  window.renderUi=patch=>root.render(R.createElement(app.DevStudyWorkspace,{...defaults,...patch}));
  ${kind === 'client' ? "window.renderOwner('synthetic-a');" : 'window.renderUi({});'}
  `;
}

// Executed by the external browser verifier; node:test does not pretend to run a DOM.
export const STUDY_OWNER_ROUND_TRIP_BROWSER_TEST = "async (page) => { await page.goto('http://127.0.0.1:18995/client'); await page.waitForFunction(()=>!!window.p1Props); await page.evaluate(()=>p1Props.onDecreeTextChange('合成铭硕报价草案')); await page.waitForFunction(()=>p1Props.decreeText==='合成铭硕报价草案'); await page.evaluate(()=>p1Props.onRestate('合成铭硕报价草案')); await page.waitForFunction(()=>!!p1Props.understanding); await page.evaluate(()=>p1Props.onDraft('合成铭硕报价草案')); await page.waitForFunction(()=>p1Props.canSubmit); await page.evaluate(()=>{window.staleSubmit=p1Props.onSubmit;window.callCount=calls.length;renderOwner('synthetic-b');}); await page.waitForFunction(()=>p1Props.decreeText===''); await page.evaluate(()=>renderOwner('synthetic-a')); await page.waitForTimeout(100); await page.evaluate(()=>staleSubmit()); const result=await page.evaluate(()=>({canSubmit:p1Props.canSubmit,draft:!!p1Props.draftResult,understanding:!!p1Props.understanding,goal:p1Props.decreeText,noStaleRequest:calls.length===callCount})); if(result.canSubmit||result.draft||result.understanding||result.goal||!result.noStaleRequest)throw Error(JSON.stringify(result));return {green:true,result}; }";

test("retained browser fixture compiles the real StudyClient and React runtime", () => {
  const fixture = buildStudyBrowserFixture("client");
  assert.ok(fixture.includes("react-dom-client"));
  assert.ok(fixture.includes("function StudyClient"));
  assert.ok(fixture.includes("SYNTHETIC React integration fixture"));
});

test("owner transition clears rendered confirmation and draft, and submit rechecks the live source", async () => {
  const source = await readFile(new URL("./StudyClient.tsx", import.meta.url), "utf8");
  const reset = source.slice(source.indexOf("if (currentIntent.ownerId !== userId)"), source.indexOf("function commitDailyMemorial"));
  assert.match(reset, /setCurrentIntent\(/);
  assert.match(reset, /setUnderstanding\(null\)/);
  assert.match(reset, /setConfirmedIntent\(null\)/);
  assert.match(reset, /setOwnerScopedDraftComposer\(/);
  assert.match(reset, /EMPTY_CHANCELLOR_DRAFT_COMPOSER_STATE/);
  const submit = source.slice(source.indexOf("async function handleSubmitDecree"), source.indexOf("async function handleDraft"));
  assert.ok(submit.indexOf("isStudyIntentCurrent(confirmedIntent, intentRef.current)") >= 0);
  assert.ok(submit.indexOf("isStudyIntentCurrent(confirmedIntent, intentRef.current)") < submit.indexOf("runStudyDecreeSubmission("));
});

import {
  EMPTY_STUDY_RECENT_REPLIES_STATE,
  beginStudyRecentRepliesLoad,
  invalidateStudyRecentReplies,
  resolveStudyRecentReplies,
  type StudyRecentRepliesResult,
  type StudyRecentRepliesState,
} from "./studyRecentReplies.ts";

type RecentRepliesLoader = (options: {
  stateRef: { current: StudyRecentRepliesState };
  setState(state: StudyRecentRepliesState): void;
  request(): Promise<StudyRecentRepliesResult>;
  scheduleRedirect(path: string): void;
}) => Promise<void>;

type DecreeSubmissionRunner = (options: {
  canSubmit: boolean;
  resetPresentation(): void;
  submit(): Promise<void>;
}) => Promise<boolean>;

type DecreeUiStateCommitter = (options: {
  state: { phase: "success" } | { phase: "error"; message: string };
  setUiState(state: { phase: "success" } | { phase: "error"; message: string }): void;
  clearDraft(): void;
  invalidateRecentReplies(): void;
}) => void;

type DraftRequestRunner = (options: {
  requestId: number;
  sourceText: string;
  getLatestRequestId(): number;
  getCurrentSourceText(): string;
  isCurrentOwner?(): boolean;
  isCurrentSource?(): boolean;
  request(sourceText: string): Promise<
    | { ok: true; draft: { status: "DRAFT_READY"; decree_text: string } }
    | { ok: false; unauthenticated: boolean }
  >;
  setPending(pending: boolean): void;
  setError(error: string | null): void;
  setDraft(draft: { status: "DRAFT_READY"; decree_text: string }): void;
  clearStaleOwnerPending?(): void;
  scheduleRedirect(path: string): void;
}) => Promise<boolean>;

interface DraftComposerEnvelope {
  ownerId: string;
  value: {
    decreeText: string;
    draftResult: null;
    draftPending: boolean;
    draftError: string | null;
  };
}

type ClearOwnerDraftPending = (
  envelope: DraftComposerEnvelope,
  ownerId: string,
) => DraftComposerEnvelope;

async function loadExecutableRecentRepliesLoader(): Promise<RecentRepliesLoader> {
  const source = await readFile(new URL("./StudyClient.tsx", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2017,
    },
  }).outputText;
  const compiledModule = { exports: {} as Record<string, unknown> };
  const taskOne = {
    beginStudyRecentRepliesLoad,
    resolveStudyRecentReplies,
  };
  const requireModule = (specifier: string) =>
    specifier === "./studyRecentReplies" ? taskOne : {};

  Function("require", "module", "exports", compiled)(
    requireModule,
    compiledModule,
    compiledModule.exports,
  );
  return compiledModule.exports.loadStudyRecentReplies as RecentRepliesLoader;
}

async function loadExecutableDecreeSubmissionRunner(): Promise<DecreeSubmissionRunner> {
  const source = await readFile(new URL("./StudyClient.tsx", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2017,
    },
  }).outputText;
  const compiledModule = { exports: {} as Record<string, unknown> };

  Function("require", "module", "exports", compiled)(
    () => ({}),
    compiledModule,
    compiledModule.exports,
  );
  return compiledModule.exports.runStudyDecreeSubmission as DecreeSubmissionRunner;
}

async function loadExecutableDecreeUiStateCommitter(): Promise<DecreeUiStateCommitter> {
  const source = await readFile(new URL("./StudyClient.tsx", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2017,
    },
  }).outputText;
  const compiledModule = { exports: {} as Record<string, unknown> };

  Function("require", "module", "exports", compiled)(
    () => ({}),
    compiledModule,
    compiledModule.exports,
  );
  return compiledModule.exports.commitStudyDecreeUiState as DecreeUiStateCommitter;
}

async function loadExecutableDraftRequestRunner(): Promise<DraftRequestRunner> {
  const source = await readFile(new URL("./StudyClient.tsx", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2017,
    },
  }).outputText;
  const compiledModule = { exports: {} as Record<string, unknown> };

  Function("require", "module", "exports", compiled)(
    () => ({}),
    compiledModule,
    compiledModule.exports,
  );
  return compiledModule.exports.runChancellorDraftRequest as DraftRequestRunner;
}

async function loadExecutableDraftRecoveryTools(): Promise<{
  runDraftRequest: DraftRequestRunner;
  clearOwnerDraftPending: ClearOwnerDraftPending;
}> {
  const source = await readFile(new URL("./StudyClient.tsx", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2017,
    },
  }).outputText;
  const compiledModule = { exports: {} as Record<string, unknown> };

  Function("require", "module", "exports", compiled)(
    () => ({}),
    compiledModule,
    compiledModule.exports,
  );
  return {
    runDraftRequest: compiledModule.exports.runChancellorDraftRequest as DraftRequestRunner,
    clearOwnerDraftPending: compiledModule.exports.clearOwnerDraftPending as ClearOwnerDraftPending,
  };
}

test("StudyClient delegates presentation while preserving the real decree state contract", async () => {
  const source = await readFile(new URL("./StudyClient.tsx", import.meta.url), "utf8");

  assert.match(source, /import \{ DevStudyWorkspace \}/);
  assert.match(source, /<DevStudyWorkspace/);
  assert.match(source, /decreeText=\{decreeText\}/);
  assert.match(source, /uiState=\{uiState\}/);
  assert.match(source, /canEdit=\{canEdit\}/);
  assert.match(source, /canSubmit=\{canIssue\}/);
  assert.match(source, /setDraftResult\(null\)/);
  assert.match(source, /requestChancellorDraft/);
  assert.match(source, /onSubmit=\{\(\) => void handleSubmitDecree\(\)\}/);
  assert.doesNotMatch(source, /ChaotangHeader|EdictScrollShell|data-testid="decree-textarea"/);
  assert.match(source, /dailyMemorialState=\{dailyMemorialState\}/);
  assert.match(source, /onConfirmDailyMemorial=/);
  assert.match(source, /onRetryDailyMemorial=/);
});

test("StudyClient resumes one owner-scoped async job and invalidates stale owner callbacks", async () => {
  const source = await readFile(new URL("./StudyClient.tsx", import.meta.url), "utf8");

  assert.match(source, /resumeStudySubmission/);
  assert.match(source, /loadActiveJob\(window\.sessionStorage, userId\)/);
  assert.match(source, /const resumeKey = `\$\{encodeURIComponent\(userId\)\}:\$\{active\.jobId\}`/);
  assert.match(source, /resumedJobRef\.current = null/);
  assert.match(source, /isCurrent: \(\) => currentOwner && activeOwnerRef\.current === userId/);
  assert.match(source, /onProgress: \(phase, jobId, jobProgress\) =>/);
  assert.match(source, /value: \{ phase, jobId, jobProgress \}/);
  assert.match(source, /const submittingOwner = userId/);
  assert.match(source, /activeOwnerRef\.current !== submittingOwner/);
  assert.match(source, /userId: submittingOwner/);
  assert.match(source, /isCurrent: \(\) => activeOwnerRef\.current === submittingOwner/);
  assert.match(source, /setUiState\(\{ phase, jobId, jobProgress \}\)/);
  assert.match(source, /useState<OwnerScopedDecreeUiState>/);
  assert.match(source, /resolveOwnerScopedDecreeUiState\(ownerScopedUiState, userId\)/);
  assert.match(source, /setOwnerScopedUiState\(\{ ownerId: userId, value: state \}\)/);
  assert.match(source, /useLayoutEffect\(\(\) => \{\s*activeOwnerRef\.current = userId/);
  assert.doesNotMatch(source, /setTimeout\([\s\S]{0,200}?setUiState\(IDLE_UI_STATE\)/);
  assert.match(source, /useState<OwnerScopedChancellorDraftComposerState>/);
  assert.match(
    source,
    /resolveOwnerScopedChancellorDraftComposerState\(\s*ownerScopedDraftComposer,\s*userId,\s*\)/,
  );
  assert.match(source, /const draftingOwner = userId/);
  assert.match(source, /isCurrentOwner: \(\) => activeOwnerRef\.current === draftingOwner/);
});

test("daily memorial 401 redirects and 409 refreshes without retrying stale POST", async () => {
  const source = await readFile(new URL("./StudyClient.tsx", import.meta.url), "utf8");

  assert.match(source, /\/login\?next=%2Fstudy/);
  assert.match(source, /runDailyMemorialConfirmation\(\{/);
  assert.ok(source.includes("refresh: (message) => loadLatestDailyMemorial(message, confirmingOwner, confirmingEpoch)"));
  assert.ok(source.includes("isCurrentDailyMemorialOwner(confirmingOwner, confirmingEpoch)"));
  assert.doesNotMatch(source, /useEffect\([\s\S]{0,400}?requestDailyMemorialConfirmation/);
});

test("StudyClient fail-closes reply and daily state across owner transitions", async () => {
  const source = await readFile(new URL("./StudyClient.tsx", import.meta.url), "utf8");

  for (const marker of [
    "recentRepliesOwnerEpochRef.current += 1",
    "recentRepliesRef.current = EMPTY_STUDY_RECENT_REPLIES_STATE",
    "setReplyPresentation(CURRENT_REPLY_PRESENTATION)",
    "dailyMemorialOwnerEpochRef.current += 1",
    "dailyMemorialRef.current = beginDailyMemorialLoad()",
    "const loadingOwner = userId",
    "const loadingEpoch = recentRepliesOwnerEpochRef.current",
    "if (!isCurrentRecentRepliesOwner()) return",
    "const confirmingOwner = userId",
    "const confirmingEpoch = dailyMemorialOwnerEpochRef.current",
    "if (!isCurrentDailyMemorialOwner(ownerId, epoch)) return",
  ]) assert.ok(source.includes(marker), marker);
});

test("Study page scopes consult browser persistence to the authenticated user", async () => {
  const [page, client] = await Promise.all([
    readFile(new URL("./page.tsx", import.meta.url), "utf8"),
    readFile(new URL("./StudyClient.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(page, /const user = await requireUser\("\/study"\)/);
  assert.match(page, /<StudyClient userId=\{user\.id\}/);
  assert.match(client, /loadChancellorConsultMessages\(userId,\s*window\.localStorage\)/);
  assert.match(client, /saveChancellorConsultMessages\(userId,\s*result\.state\.messages,\s*window\.localStorage\)/);
  assert.match(client, /messages = \[\.\.\.sendingState\.messages\.slice\(-18\)/);
});

test("StudyClient uses the executable submission boundary and orchestration", async () => {
  const source = await readFile(new URL("./StudyClient.tsx", import.meta.url), "utf8");

  assert.match(source, /import \{[\s\S]*?requestStudySubmission[\s\S]*?submitStudyDecree[\s\S]*?\} from "\.\/studySubmission"/);
  assert.match(source, /submitStudyDecree\(\{/);
  assert.match(source, /requestStudySubmission\(text,\s*\{/);
  assert.match(source, /fetchImpl: window\.fetch\.bind\(window\)/);
  assert.match(source, /scheduleRedirect:/);
  assert.match(source, /window\.location\.assign\(path\)/);
  assert.doesNotMatch(source, /SWR|EventSource|subscribeCourtStream|jiqun/);
  assert.doesNotMatch(source, /fetch\(\s*["']|process\.env\.BACKEND_BASE_URL/);
});

test("StudyClient loads recent replies only from explicit drawer callbacks", async () => {
  const source = await readFile(new URL("./StudyClient.tsx", import.meta.url), "utf8");

  assert.match(source, /useState<StudyRecentRepliesState>\(EMPTY_STUDY_RECENT_REPLIES_STATE\)/);
  assert.match(source, /function handleOpenRecentReplies\(\)/);
  assert.match(source, /loadStudyRecentReplies\(\{/);
  assert.match(source, /stateRef: recentRepliesRef/);
  assert.match(source, /requestStudyRecentReplies\(window\.fetch\.bind\(window\)\)/);
  assert.match(source, /onOpenRecentReplies=\{handleOpenRecentReplies\}/);
  assert.match(source, /onRetryRecentReplies=\{handleOpenRecentReplies\}/);
  assert.doesNotMatch(source, /useEffect\(\(\) => \{\s*void handleOpenRecentReplies/);
});

test("recent reply loader redirects an unauthenticated read only to the study login", async () => {
  const loadRecentReplies = await loadExecutableRecentRepliesLoader();
  const stateRef = { current: EMPTY_STUDY_RECENT_REPLIES_STATE };
  const redirects: string[] = [];

  await loadRecentReplies({
    stateRef,
    setState: () => {},
    request: async () => ({
      ok: false,
      kind: "unauthenticated",
      message: "会话已过期，请重新登录",
    }),
    scheduleRedirect: (path) => redirects.push(path),
  });

  assert.deepEqual(redirects, ["/login?next=%2Fstudy"]);
  assert.equal(stateRef.current.phase, "error");
});

test("StudyClient invalidates recent replies only after a successful decree", async () => {
  const source = await readFile(new URL("./StudyClient.tsx", import.meta.url), "utf8");

  assert.match(
    source,
    /if \(state\.phase !== "success"\) return;[\s\S]*?invalidateStudyRecentReplies/,
  );
  assert.doesNotMatch(source, /appendDecreeSessionRecord|DecreeSessionRecord/);
  assert.match(source, /recentReplies=\{recentReplies\}/);
  assert.match(source, /onSelectRecentReply=/);
});

test("successful decree state clears the draft before invalidating recent replies", async () => {
  const commitUiState = await loadExecutableDecreeUiStateCommitter();
  const events: string[] = [];

  commitUiState({
    state: { phase: "success" },
    setUiState: (state) => events.push(`state:${state.phase}`),
    clearDraft: () => events.push("clear-draft"),
    invalidateRecentReplies: () => events.push("invalidate-replies"),
  });

  assert.deepEqual(events, [
    "state:success",
    "clear-draft",
    "invalidate-replies",
  ]);
});

test("failed decree state preserves the confirmed draft for retry", async () => {
  const commitUiState = await loadExecutableDecreeUiStateCommitter();
  const events: string[] = [];

  commitUiState({
    state: { phase: "error", message: "retry" },
    setUiState: (state) => events.push(`state:${state.phase}`),
    clearDraft: () => events.push("clear-draft"),
    invalidateRecentReplies: () => events.push("invalidate-replies"),
  });

  assert.deepEqual(events, ["state:error"]);
});

test("StudyClient keeps archived presentation separate from decree UI state", async () => {
  const source = await readFile(new URL("./StudyClient.tsx", import.meta.url), "utf8");

  assert.match(source, /useState<StudyReplyPresentation>/);
  assert.match(source, /selectArchivedReply\(archiveId\)/);
  assert.match(
    source,
    /resolveSelectedArchive\(replyPresentation,\s*recentReplies\.archives\)/,
  );
  assert.match(source, /setReplyPresentation\(resetToCurrentReply\(\)\)/);
  assert.match(
    source,
    /setReplyPresentation\(resetToCurrentReply\(\)\)[\s\S]*?submitStudyDecree\(\{/,
  );
  assert.doesNotMatch(
    source,
    /onSelectRecentReply[\s\S]*?setUiState[\s\S]*?selectArchivedReply/,
  );
});

test("invalid decree submission preserves archived presentation and does not submit", async () => {
  const runSubmission = await loadExecutableDecreeSubmissionRunner();
  const events: string[] = [];

  const started = await runSubmission({
    canSubmit: false,
    resetPresentation: () => events.push("reset"),
    submit: async () => {
      events.push("submit");
    },
  });

  assert.equal(started, false);
  assert.deepEqual(events, []);
});

test("valid decree submission resets presentation before invoking submission", async () => {
  const runSubmission = await loadExecutableDecreeSubmissionRunner();
  const events: string[] = [];

  const started = await runSubmission({
    canSubmit: true,
    resetPresentation: () => events.push("reset"),
    submit: async () => {
      events.push("submit");
    },
  });

  assert.equal(started, true);
  assert.deepEqual(events, ["reset", "submit"]);
});

test("StudyClient gates issuing on the confirmed decree text, not the source input", async () => {
  const source = await readFile(new URL("./StudyClient.tsx", import.meta.url), "utf8");

  assert.match(
    source,
    /const canIssue = !\["enqueueing", "queued", "running"\]\.includes\(uiState\.phase\) &&\s*confirmedSourceCurrent && canIssueChancellorDraft\(draftResult\)/,
  );
  assert.doesNotMatch(
    source,
    /const canIssue = canSubmit && canIssueChancellorDraft\(draftResult\)/,
  );
  assert.match(source, /decreeText: draftResult\?\.decree_text \?\? ""/);
});

test("first decree sends only a current factory-confirmed snapshot to the draft boundary", async () => {
  const source = await readFile(new URL("./StudyClient.tsx", import.meta.url), "utf8");
  const draftHandler = source.slice(
    source.indexOf("async function handleDraft"),
    source.indexOf("async function handleRetryProgress"),
  );

  assert.match(draftHandler, /async function handleDraft\(sourceText: string\)/);
  assert.match(draftHandler, /const normalizedSource = sourceText\.trim\(\)/);
  assert.match(draftHandler, /decreeTextRef\.current = normalizedSource/);
  assert.match(draftHandler, /setDecreeText\(normalizedSource\)/);
  assert.match(draftHandler, /confirmStudyIntent\(snapshot, intentRef\.current\)/);
  assert.match(draftHandler, /request: \(\) => requestChancellorDraft\(\s*confirmed,/);
  assert.match(draftHandler, /isCurrentSource: \(\) => isStudyIntentCurrent/);
  assert.doesNotMatch(draftHandler, /setTimeout/);
  assert.match(source, /onDraft=\{\(sourceText\) => void handleDraft\(sourceText\)\}/);
});

async function loadExecutableConsultRunner() {
  const source = await readFile(new URL("./StudyClient.tsx", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: {
    jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017,
  } }).outputText;
  type Result = { ok: true; reply: string } | { ok: false; unauthenticated?: boolean };
  type Runner = (options: { isCurrent(): boolean; request(): Promise<Result>;
    accept(reply: string): void; fail(): void; scheduleRedirect(path: string): void }) => Promise<boolean>;
  const loaded = { exports: {} as { runStudyConsultRequest: Runner } };
  Function("require", "module", "exports", compiled)(() => ({}), loaded, loaded.exports);
  return loaded.exports.runStudyConsultRequest;
}

for (const drift of ["owner switch", "goal edit", "context edit", "newer consultation", "owner A-B-A"]) {
  for (const response of [{ ok: true as const, reply: "old private reply" }, { ok: false as const, unauthenticated: true }]) {
    test(`consultation ${drift} suppresses stale ${response.ok ? "success" : "401"} and all effects`, async () => {
      const run = await loadExecutableConsultRunner();
      let currentGeneration = 1;
      let resolve!: (value: typeof response) => void;
      const deferred = new Promise<typeof response>((done) => { resolve = done; });
      const effects: string[] = [];
      const pending = run({ isCurrent: () => currentGeneration === 1, request: () => deferred,
        accept: () => effects.push("messages,pending,error,confirmation,storage"),
        fail: () => effects.push("pending,error"), scheduleRedirect: () => effects.push("redirect") });
      currentGeneration = 2;
      resolve(response);
      assert.equal(await pending, false);
      assert.deepEqual(effects, []);
    });
  }
}

test("a current successful consultation commits once; a stale request never starts", async () => {
  const run = await loadExecutableConsultRunner();
  const effects: string[] = [];
  const options = { isCurrent: () => true, request: async () => ({ ok: true as const, reply: "exact reply" }),
    accept: (reply: string) => effects.push(reply), fail: () => effects.push("failure"),
    scheduleRedirect: () => effects.push("redirect") };
  assert.equal(await run(options), true);
  assert.deepEqual(effects, ["exact reply"]);
  assert.equal(await run({ ...options, isCurrent: () => false, request: async () => { throw new Error("must not run"); } }), false);
  assert.deepEqual(effects, ["exact reply"]);
});

for (const drift of ["context", "new-consultation", "owner-A-B-A-generation"]) {
  test(`pending draft ignores ${drift} drift even if owner and goal return to the same values`, async () => {
    const run = await loadExecutableDraftRequestRunner();
    let current = true;
    let resolve!: (value: { ok: false; unauthenticated: boolean }) => void;
    const response = new Promise<{ ok: false; unauthenticated: boolean }>((done) => { resolve = done; });
    const effects: string[] = [];
    const pending = run({
      requestId: 1, sourceText: "same goal", getLatestRequestId: () => 1,
      getCurrentSourceText: () => "same goal", isCurrentOwner: () => true,
      isCurrentSource: () => current, request: () => response,
      setPending: () => effects.push("pending"), setError: () => effects.push("error"),
      setDraft: () => effects.push("draft"), scheduleRedirect: () => effects.push("redirect"),
    });
    current = false;
    resolve({ ok: false, unauthenticated: true });
    assert.equal(await pending, false);
    assert.deepEqual(effects, []);
  });
}

test("progress recovery resumes the owner-scoped active job before falling back to redraft", async () => {
  const source = await readFile(new URL("./StudyClient.tsx", import.meta.url), "utf8");
  const recovery = source.slice(
    source.indexOf("async function handleRetryProgress"),
    source.indexOf("async function handleOpenRecentReplies"),
  );

  assert.match(recovery, /loadActiveJob\(window\.sessionStorage, userId\)/);
  assert.match(recovery, /if \(active === null\)/);
  assert.match(recovery, /const fallbackSourceText = decreeText\.trim\(\) \|\|\s*draftResult\?\.decree_text\?\.trim\(\) \|\| ""/);
  assert.match(recovery, /if \(!fallbackSourceText\)/);
  assert.match(recovery, /请先输入目标/);
  assert.match(recovery, /await handleDraft\(fallbackSourceText\)/);
  assert.match(recovery, /resumeStudySubmission\(active\.jobId/);
  assert.match(recovery, /initialProgress: lastVerifiedProgress/);
  assert.match(recovery, /isCurrent: \(\) => activeOwnerRef\.current === recoveringOwner/);
  assert.doesNotMatch(recovery, /saveActiveJob|sessionStorage\.setItem/);
  assert.match(source, /onRetryProgress=\{\(\) => void handleRetryProgress\(\)\}/);
  assert.match(source, /retryProgressLabel=/);
  assert.match(source, /canRetryProgress=/);
});

test("recovery action is named from stale status plus an owner-scoped active job", async () => {
  const source = await readFile(new URL("./StudyClient.tsx", import.meta.url), "utf8");
  const recoveryPresentation = source.slice(
    source.indexOf("const recoverySourceText"),
    source.indexOf("  return (", source.indexOf("const recoverySourceText")),
  );

  assert.match(recoveryPresentation, /loadActiveJob\(window\.sessionStorage, userId\)/);
  assert.match(recoveryPresentation, /uiState\.progressFreshness === "stale"/);
  assert.match(recoveryPresentation, /uiState\.recoveryMode === "resume"/);
  assert.match(recoveryPresentation, /activeRecoveryJob !== null/);
  assert.match(recoveryPresentation, /canResumeProgress \? "恢复办理" : "重新拟旨"/);
  assert.match(recoveryPresentation, /canRetryProgress = canResumeProgress \|\| recoverySourceText\.length > 0/);
});

test("owner A stale draft response clears only A pending so A can retry after A to B to A", async () => {
  const { runDraftRequest, clearOwnerDraftPending } = await loadExecutableDraftRecoveryTools();
  let envelope: DraftComposerEnvelope = {
    ownerId: "owner-a",
    value: {
      decreeText: "A 的目标",
      draftResult: null,
      draftPending: true,
      draftError: null,
    },
  };

  await runDraftRequest({
    requestId: 1,
    sourceText: "A 的目标",
    getLatestRequestId: () => 1,
    getCurrentSourceText: () => "A 的目标",
    isCurrentOwner: () => false,
    request: async () => ({
      ok: true,
      draft: { status: "DRAFT_READY", decree_text: "A 的旧拟旨" },
    }),
    setPending: () => assert.fail("stale owner must not write through the current owner setter"),
    setError: () => assert.fail("stale owner must not expose an error to B"),
    setDraft: () => assert.fail("stale owner must not expose A draft to B"),
    clearStaleOwnerPending: () => {
      envelope = clearOwnerDraftPending(envelope, "owner-a");
    },
    scheduleRedirect: () => assert.fail("stale owner must not redirect"),
  });

  assert.equal(envelope.ownerId, "owner-a");
  assert.equal(envelope.value.draftPending, false);

  const ownerBEnvelope: DraftComposerEnvelope = {
    ownerId: "owner-b",
    value: { ...envelope.value, decreeText: "B 的目标", draftPending: true },
  };
  assert.equal(clearOwnerDraftPending(ownerBEnvelope, "owner-a"), ownerBEnvelope);
});

test("editing the source while a draft request is pending ignores the stale response", async () => {
  const runDraftRequest = await loadExecutableDraftRequestRunner();
  let latestRequestId = 1;
  let currentSourceText = "事项 A";
  let resolveDraft!: (result: {
    ok: true;
    draft: { status: "DRAFT_READY"; decree_text: string };
  }) => void;
  const installedDrafts: Array<{ status: "DRAFT_READY"; decree_text: string }> = [];
  const pendingStates: boolean[] = [];
  const errors: Array<string | null> = [];

  const pending = runDraftRequest({
    requestId: 1,
    sourceText: currentSourceText,
    getLatestRequestId: () => latestRequestId,
    getCurrentSourceText: () => currentSourceText,
    request: () => new Promise((resolve) => {
      resolveDraft = resolve;
    }),
    setPending: (value) => pendingStates.push(value),
    setError: (value) => errors.push(value),
    setDraft: (draft) => installedDrafts.push(draft),
    scheduleRedirect: () => {
      assert.fail("stale success must not redirect");
    },
  });

  currentSourceText = "事项 B";
  latestRequestId += 1;
  resolveDraft({
    ok: true,
    draft: { status: "DRAFT_READY", decree_text: "事项 A 的旧拟旨" },
  });

  assert.equal(await pending, false);
  assert.deepEqual(installedDrafts, []);
  assert.deepEqual(pendingStates, []);
  assert.deepEqual(errors, []);
});

test("a pending A draft response cannot install after switching to owner B", async () => {
  const runDraftRequest = await loadExecutableDraftRequestRunner();
  let currentOwner = "owner-a";
  let resolveDraft!: (result: {
    ok: true;
    draft: { status: "DRAFT_READY"; decree_text: string };
  }) => void;
  const installedDrafts: Array<{ status: "DRAFT_READY"; decree_text: string }> = [];
  const pendingStates: boolean[] = [];
  const errors: Array<string | null> = [];

  const pending = runDraftRequest({
    requestId: 1,
    sourceText: "owner A source",
    getLatestRequestId: () => 1,
    getCurrentSourceText: () => "owner A source",
    isCurrentOwner: () => currentOwner === "owner-a",
    request: () => new Promise((resolve) => { resolveDraft = resolve; }),
    setPending: (value) => pendingStates.push(value),
    setError: (value) => errors.push(value),
    setDraft: (draft) => installedDrafts.push(draft),
    scheduleRedirect: () => assert.fail("stale owner response must not redirect"),
  });

  currentOwner = "owner-b";
  resolveDraft({
    ok: true,
    draft: { status: "DRAFT_READY", decree_text: "owner A private decree" },
  });

  assert.equal(await pending, false);
  assert.deepEqual(installedDrafts, []);
  assert.deepEqual(pendingStates, []);
  assert.deepEqual(errors, []);
});

test("recent reply loader atomically suppresses two opens before React commits", async () => {
  const loadRecentReplies = await loadExecutableRecentRepliesLoader();
  const stateRef = { current: EMPTY_STUDY_RECENT_REPLIES_STATE };
  let requestCount = 0;
  let finishRequest!: (result: StudyRecentRepliesResult) => void;
  const request = () => {
    requestCount += 1;
    return new Promise<StudyRecentRepliesResult>((resolve) => {
      finishRequest = resolve;
    });
  };

  const first = loadRecentReplies({
    stateRef,
    setState: () => {},
    request,
    scheduleRedirect: () => {},
  });
  const second = loadRecentReplies({
    stateRef,
    setState: () => {},
    request,
    scheduleRedirect: () => {},
  });

  assert.equal(requestCount, 1);
  finishRequest({ ok: true, archives: [] });
  await Promise.all([first, second]);
  assert.equal(stateRef.current.phase, "empty");
});

test("recent reply loader cannot overwrite an invalidation while its request is pending", async () => {
  const loadRecentReplies = await loadExecutableRecentRepliesLoader();
  const stateRef = { current: EMPTY_STUDY_RECENT_REPLIES_STATE };
  let finishRequest!: (result: StudyRecentRepliesResult) => void;
  const pending = loadRecentReplies({
    stateRef,
    setState: () => {},
    request: () => new Promise((resolve) => {
      finishRequest = resolve;
    }),
    scheduleRedirect: () => {},
  });

  stateRef.current = invalidateStudyRecentReplies(stateRef.current);
  finishRequest({ ok: true, archives: [] });
  await pending;

  assert.equal(stateRef.current.generation, 1);
  assert.equal(stateRef.current.stale, true);
  assert.equal(stateRef.current.phase, "idle");
});
