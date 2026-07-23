import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("CourtShell provides the visual protected-court frame without client or network dependencies", async () => {
  const source = await readFile(new URL("./CourtShell.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("./CourtShell.module.css", import.meta.url), "utf8");

  assert.match(source, /ChaotangHeader/);
  assert.match(source, /data-court-shell/);
  assert.match(source, /data-court-content/);
  assert.doesNotMatch(source, /"use client"|fetch\(|useEffect|useState|localStorage|sessionStorage/);
  assert.match(css, /min-height: 100dvh/);
  assert.match(css, /overflow-y: auto/);
  assert.match(css, /#04060e/);
  assert.match(css, /background-image/);
});
