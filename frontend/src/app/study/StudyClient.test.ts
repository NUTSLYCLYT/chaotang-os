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

test("StudyClient uses the executable submission boundary and orchestration", async () => {
  const source = await readFile(new URL("./StudyClient.tsx", import.meta.url), "utf8");

  assert.match(source, /import \{[\s\S]*?requestStudySubmission[\s\S]*?submitStudyDecree[\s\S]*?\} from "\.\/studySubmission"/);
  assert.match(source, /submitStudyDecree\(\{/);
  assert.match(source, /requestStudySubmission\(text,\s*\{/);
  assert.match(source, /fetchImpl: window\.fetch\.bind\(window\)/);
  assert.match(source, /scheduleRedirect:/);
  assert.match(source, /window\.location\.assign\(path\)/);
  assert.doesNotMatch(source, /useEffect|SWR|EventSource|subscribeCourtStream|jiqun/);
  assert.doesNotMatch(source, /fetch\(\s*["']|process\.env\.BACKEND_BASE_URL/);
});
