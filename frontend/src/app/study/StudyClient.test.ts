import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("StudyClient keeps decree controls inside the Shangshufang workspace", async () => {
  const source = await readFile(new URL("./StudyClient.tsx", import.meta.url), "utf8");

  assert.match(source, /ChaotangHeader currentLabel="上书房"/);
  assert.match(source, /EdictScrollShell/);
  assert.match(source, /className=\{styles\.background\}/);
  assert.doesNotMatch(source, /styles\.workspace|styles\.flow|styles\.courtNote/);
  assert.match(source, /data-testid="decree-fee-notice"/);
  assert.match(source, /data-testid="decree-textarea"/);
  assert.match(source, /data-testid="submit-decree-button"/);
  assert.match(source, /data-testid="decree-status"/);
  assert.match(source, /fetch\("\/api\/decrees\/chancellor"/);
});

test("Study background uses the dev Shangshufang scene asset", async () => {
  const styles = await readFile(new URL("./study.module.css", import.meta.url), "utf8");

  assert.match(styles, /url\("\/shangshufang\/bg-shangshufang-scene\.webp"\)/);
  assert.doesNotMatch(styles, /bg-shangshufang-full\.webp/);
});
