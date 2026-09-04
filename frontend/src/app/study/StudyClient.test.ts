import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

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
  assert.match(source, /refresh: loadLatestDailyMemorial/);
  assert.doesNotMatch(source, /useEffect\([\s\S]{0,400}?requestDailyMemorialConfirmation/);
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
  assert.match(client, /messages:\s*sendingState\.messages\.slice\(-18\)/);
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
    /const canIssue = !\["enqueueing", "queued", "running"\]\.includes\(uiState\.phase\) &&\s*canIssueChancellorDraft\(draftResult\)/,
  );
  assert.doesNotMatch(
    source,
    /const canIssue = canSubmit && canIssueChancellorDraft\(draftResult\)/,
  );
  assert.match(source, /decreeText: draftResult\?\.decree_text \?\? ""/);
});

test("first decree passes explicit source text into the real Chancellor draft request", async () => {
  const source = await readFile(new URL("./StudyClient.tsx", import.meta.url), "utf8");
  const draftHandler = source.slice(
    source.indexOf("async function handleDraft"),
    source.indexOf("async function handleRetryProgress"),
  );

  assert.match(draftHandler, /async function handleDraft\(sourceText: string\)/);
  assert.match(draftHandler, /const normalizedSource = sourceText\.trim\(\)/);
  assert.match(draftHandler, /decreeTextRef\.current = normalizedSource/);
  assert.match(draftHandler, /setDecreeText\(normalizedSource\)/);
  assert.match(draftHandler, /request: \(text\) => requestChancellorDraft\(/);
  assert.doesNotMatch(draftHandler, /setTimeout/);
  assert.match(source, /onDraft=\{\(sourceText\) => void handleDraft\(sourceText\)\}/);
});

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
