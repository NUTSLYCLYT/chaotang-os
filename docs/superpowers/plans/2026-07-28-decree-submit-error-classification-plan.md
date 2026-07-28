# 下旨失败原因分类 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `subagent-driven-development` to execute each task sequentially, with a fresh implementer and reviewer gate for every task.

**Goal:** 将上书房下旨请求的本地超时与真实后端不可达分开呈现，避免把超时误报为后端未启动。

**Architecture:** `backendClient.ts` 是唯一与 FastAPI 通讯的前端服务端客户端，因此在它的 `AbortController` 边界识别“本地计时器触发的中止”，并返回稳定 `timeout` 分类。Next.js BFF 仅把该分类映射成 504 和脱敏响应；上书房纯函数模块再映射为用户文案。

**Tech Stack:** Next.js App Router、TypeScript、Node `node:test`、原生 `fetch` / `AbortController`。

## Global Constraints

- 不改变 ADR 0028 定义的下旨业务流、请求路径、成功响应契约或 120 秒超时值。
- `timeout` 只表示本客户端计时器导致的请求中止；其他 `fetch` 异常必须保持为 `network`。
- 错误响应不得泄露后端原始错误、会话值或模型细节。
- 测试必须通过注入的 `fetchImpl` 和计时器运行；不得触发真实模型调用。
- 仅修改任务卡列出的前端和文档路径；不提交、不推送或部署。

---

### Task 1: 客户端超时分类

**Files:**
- Modify: `frontend/src/lib/backendClient.ts: SubmitDecreeResult, submitDecree()`
- Modify: `frontend/src/lib/backendClient.test.ts: submitDecree failure-path tests`

**Interfaces:**
- Produces: `SubmitDecreeResult` failure `kind` union containing `"timeout"`.
- Produces: `submitDecree()` returns `{ ok: false, kind: "timeout", error: "请求超时" }` only after its own scheduled abort fires.
- Preserves: injected `TypeError("injected network failure")` returns `kind: "network"`.

- [ ] **Step 1: Write the failing timeout test**

In `frontend/src/lib/backendClient.test.ts`, replace the existing abort test assertion with:

```ts
assert.equal(result.ok, false);
if (!result.ok) {
  assert.equal(result.kind, "timeout");
  assert.equal(result.error, "请求超时");
}
```

Keep its injected `fetchImpl` waiting for `init.signal` to abort so the test proves the client timer, rather than a server response, selected the classification.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- src/lib/backendClient.test.ts`

Expected: FAIL because current code returns `kind: "network"` for the injected abort.

- [ ] **Step 3: Implement the minimal timeout marker**

In `submitDecree()`, declare `let didTimeout = false` before scheduling. Replace the timeout callback with:

```ts
const timer = scheduleTimeout(() => {
  didTimeout = true;
  controller.abort();
}, timeoutMs);
```

Replace the `catch` return with:

```ts
if (didTimeout) {
  return { ok: false, kind: "timeout", error: "请求超时" };
}
return { ok: false, kind: "network", error: describeError(error) };
```

Add `"timeout"` to the `SubmitDecreeResult` failure-kind union only; do not alter `describeError()` or the timeout duration.

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run: `npm test -- src/lib/backendClient.test.ts`

Expected: PASS, including the existing injected network failure test returning `network`.

### Task 2: BFF、浏览器提交边界与上书房错误映射

**Files:**
- Modify: `frontend/src/app/api/decrees/chancellor/route.ts: ChancellorErrorReason, HTTP_STATUS_BY_KIND, FRIENDLY_MESSAGE_BY_KIND`
- Modify: `frontend/src/app/api/decrees/chancellor/route.test.ts: failure-kind mapping table`
- Modify: `frontend/src/app/study/decreeStatus.ts: DecreeErrorKind, FRIENDLY_MESSAGE_BY_KIND`
- Modify: `frontend/src/app/study/decreeStatus.test.ts: ERROR_KINDS coverage`
- Modify: `frontend/src/app/study/studySubmission.ts: KNOWN_ERROR_KINDS`
- Modify: `frontend/src/app/study/studySubmission.test.ts: BFF error consumption coverage`

**Interfaces:**
- Consumes: Task 1 `SubmitDecreeResult` with `kind: "timeout"`.
- Produces: `POST /api/decrees/chancellor` returns 504 with `{ status: "error", reason: "timeout", message: "下旨处理超时，请稍后重试。" }`.
- Produces: `mapSubmitDecreeResultToUiState({ ok: false, kind: "timeout", error: "" })` returns error message `下旨处理超时，请稍后重试。`.
- Produces: `requestStudySubmission()` preserves BFF `{ reason: "timeout" }` and returns the same timeout UI state.

- [ ] **Step 1: Write the failing BFF and UI tests**

In `route.test.ts`, add `["timeout", 504]` to the existing failure mapping table. In `decreeStatus.test.ts`, include `"timeout"` in `ERROR_KINDS` and add this exact assertion:

```ts
const state = mapSubmitDecreeResultToUiState({ ok: false, kind: "timeout", error: "请求超时" });
assert.deepEqual(state, { phase: "error", message: "下旨处理超时，请稍后重试。" });
```

In `studySubmission.test.ts`, add a case whose `fetchImpl` returns `Response.json({ status: "error", reason: "timeout", message: "internal" }, { status: 504 })`; expect the same timeout UI state and no redirect.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npm test -- src/app/api/decrees/chancellor/route.test.ts src/app/study/decreeStatus.test.ts`

Expected: FAIL because `timeout` is not part of the BFF or UI error-kind unions.

- [ ] **Step 3: Implement the minimal BFF and UI mapping**

Add `timeout` to both error-kind unions. In `route.ts`, add `timeout: 504` to `HTTP_STATUS_BY_KIND` and `timeout: "下旨处理超时，请稍后重试。"` to `FRIENDLY_MESSAGE_BY_KIND`. In `decreeStatus.ts`, add the identical timeout message to its `FRIENDLY_MESSAGE_BY_KIND`. In `studySubmission.ts`, add `"timeout"` to `KNOWN_ERROR_KINDS`.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `npm test -- src/app/api/decrees/chancellor/route.test.ts src/app/study/decreeStatus.test.ts src/app/study/studySubmission.test.ts`

Expected: PASS; existing validation/config/model/network/unknown mappings remain green.

### Task 3: 独立验收与交付记录

**Files:**
- Modify: `docs/product/tasks/2026-07-28-decree-submit-error-classification.md: Technical Plan, Implementation Report, Acceptance Review`

**Interfaces:**
- Consumes: Task 1 and Task 2 source and test evidence.
- Produces: independently recorded pass/fail evidence without issuing a real decree.

- [ ] **Step 1: Run static and focused verification**

Run:

```powershell
Set-Location frontend
npm test -- src/lib/backendClient.test.ts src/app/api/decrees/chancellor/route.test.ts src/app/study/decreeStatus.test.ts src/app/study/studySubmission.test.ts
npm run lint
npm run typecheck
```

Expected: all commands exit 0.

- [ ] **Step 2: Verify the live health chain without a decree**

Run:

```powershell
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8000/health
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:3000/health
```

Expected: both return HTTP 200; no request is sent to either decree POST endpoint.

- [ ] **Step 3: Record acceptance**

Update the task card with the executed commands, their results, the independent-review conclusion, and any unrelated suite failures. Mark the task `Implemented` only if all change-related verification passes; leave `Acceptance Review` for the final Codex acceptance pass.

### Task 4: 移除上书房静态费用提示

**Files:**
- Modify: `frontend/src/features/study-visual/DevStudyWorkspace.tsx: both composer markup blocks`
- Modify: `frontend/src/features/study-visual/DevStudyWorkspace.module.css: feeNotice rules`
- Modify: `frontend/src/features/study-visual/DevStudyWorkspace.test.ts: composer source contract`

**Interfaces:**
- Preserves: `data-testid="submit-decree-button"` and `? "办理中" : "下旨"` remain unchanged.
- Produces: neither composer markup block contains `data-testid="decree-fee-notice"` or the removed Chinese fee text.

- [ ] **Step 1: Write the failing source-contract test**

In `DevStudyWorkspace.test.ts`, replace the existing `assert.match(source, /data-testid="decree-fee-notice"/)` with:

```ts
assert.doesNotMatch(source, /data-testid="decree-fee-notice"|下旨会触发真实司议|模型调用费用/);
assert.doesNotMatch(css, /\.feeNotice\s*\{/);
```

Ensure this test reads both the workspace TSX source and module CSS source.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- src/features/study-visual/DevStudyWorkspace.test.ts`

Expected: FAIL because both composer markup blocks and the CSS still contain the removed notice.

- [ ] **Step 3: Implement the smallest removal**

Delete both `<p className={styles.feeNotice} data-testid="decree-fee-notice">…</p>` blocks from `DevStudyWorkspace.tsx`. Delete the base `.feeNotice` rule and its responsive rule from `DevStudyWorkspace.module.css`. Do not modify submit button behavior, `localNotice`, or composer layout.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `npm test -- src/features/study-visual/DevStudyWorkspace.test.ts`

Expected: PASS while preserving the existing submit-button source assertions.
