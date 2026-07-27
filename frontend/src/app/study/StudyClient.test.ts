import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("StudyClient delegates presentation while preserving the real decree state contract", async () => {
  const source = await readFile(new URL("./StudyClient.tsx", import.meta.url), "utf8");

  assert.match(source, /import \{ DevStudyWorkspace \}/);
  assert.match(source, /<DevStudyWorkspace/);
  assert.match(source, /decreeText=\{decreeText\}/);
  assert.match(source, /uiState=\{uiState\}/);
  assert.match(source, /canEdit=\{canEdit\}/);
  assert.match(source, /canSubmit=\{canSubmit\}/);
  assert.match(source, /onDecreeTextChange=\{setDecreeText\}/);
  assert.match(source, /onSubmit=\{\(\) => void handleSubmitDecree\(\)\}/);
  assert.doesNotMatch(source, /ChaotangHeader|EdictScrollShell|data-testid="decree-textarea"/);
});

test("StudyClient retains one user-triggered same-origin chancellor POST and 401 redirect", async () => {
  const source = await readFile(new URL("./StudyClient.tsx", import.meta.url), "utf8");

  assert.equal([...source.matchAll(/\bfetch\s*\(/g)].length, 1);
  assert.match(source, /fetch\("\/api\/decrees\/chancellor"/);
  assert.match(source, /method: "POST"/);
  assert.match(source, /JSON\.stringify\(\{ decreeText \}\)/);
  assert.match(source, /if \(!canSubmit\)/);
  assert.match(source, /setUiState\(SUBMITTING_UI_STATE\)/);
  assert.match(source, /response\.status === 401/);
  assert.match(source, /window\.location\.assign\("\/login\?next=%2Fstudy"\)/);
  assert.doesNotMatch(source, /useEffect|SWR|EventSource|subscribeCourtStream|jiqun/);
  assert.doesNotMatch(source, /fetch\(\s*["']https?:|process\.env\.BACKEND_BASE_URL/);
});

test("StudyClient keeps strict response parsing and friendly error mapping", async () => {
  const source = await readFile(new URL("./StudyClient.tsx", import.meta.url), "utf8");

  assert.match(source, /parseChancellorSuccessResponse\(body\)/);
  assert.match(source, /mapSubmitDecreeResultToUiState/);
  assert.match(source, /isKnownErrorKind\(error\.reason\)/);
  assert.match(source, /响应体不是合法 JSON/);
  assert.match(source, /响应体不符合预期契约/);
});
