import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("EdictScrollShell contains the dev-derived scroll structure without business dependencies", async () => {
  const source = await readFile(new URL("./EdictScrollShell.tsx", import.meta.url), "utf8");

  assert.match(source, /aria-label="圣旨展示面板"/);
  assert.match(source, /styles\.rollerLeft/);
  assert.match(source, /styles\.paper/);
  assert.match(source, /styles\.seal/);
  assert.doesNotMatch(source, /fetch\(|useEffect|useState|lucide|swr|@\//);
});
