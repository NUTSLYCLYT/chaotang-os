import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("ChaotangHeader provides semantic navigation without client-side side effects", async () => {
  const source = await readFile(new URL("./ChaotangHeader.tsx", import.meta.url), "utf8");

  assert.match(source, /aria-label="朝堂主导航"/);
  assert.match(source, /data-three-axis-topnav/);
  assert.match(source, /上值朝 · AI 智能办公/);
  assert.match(source, /朝堂 OS/);
  assert.match(source, /aria-current="page"/);
  assert.match(source, /href="\/study"/);
  assert.match(source, /href="\/shiguan"/);
  assert.doesNotMatch(source, /fetch\(|localStorage|sessionStorage|useEffect|useState/);
});
