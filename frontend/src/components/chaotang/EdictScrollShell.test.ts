import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("EdictScrollShell contains the dev-derived scroll structure without business dependencies", async () => {
  const source = await readFile(new URL("./EdictScrollShell.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("./EdictScrollShell.module.css", import.meta.url), "utf8");

  assert.match(source, /aria-label="圣旨展示面板"/);
  assert.match(source, /styles\.rollerLeft/);
  assert.match(source, /styles\.paper/);
  assert.match(source, /styles\.seal/);
  assert.match(source, /styles\.sealRing/);
  assert.match(source, /styles\.innerRailLeft/);
  assert.match(css, /width: 34px/);
  assert.match(css, /left: -16px/);
  assert.match(css, /radial-gradient\(circle at 34% 26%/);
  assert.match(css, /@media \(max-width: 767px\)/);
  assert.match(css, /@keyframes sealDrop/);
  assert.match(css, /@keyframes sealRing/);
  assert.doesNotMatch(source, /fetch\(|useEffect|useState|lucide|swr|@\//);
});
