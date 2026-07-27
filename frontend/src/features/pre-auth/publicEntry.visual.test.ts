import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("public entry shells use the dev court visual language without replacing live entry contracts", async () => {
  const shell = await readFile(new URL("./PreAuthShell.tsx", import.meta.url), "utf8");
  const authCss = await readFile(new URL("./preAuth.module.css", import.meta.url), "utf8");
  const welcomeCss = await readFile(new URL("../welcome/welcome.module.css", import.meta.url), "utf8");

  assert.match(shell, /href="\/"/);
  assert.match(shell, /href="\/login"/);
  assert.match(shell, /href="\/register"/);
  assert.match(shell, /data-public-entry-shell/);
  assert.match(authCss, /url\("\/shangshufang\/bg-shangshufang-scene\.webp"\)/);
  assert.match(authCss, /backdrop-filter: blur/);
  assert.match(authCss, /linear-gradient\(90deg, rgba\(4, 6, 14/);
  assert.match(welcomeCss, /welcome-lightning|axis/);
  assert.match(welcomeCss, /backdrop-filter/);
  assert.doesNotMatch(shell, /fetch\(|localStorage|sessionStorage|backendClient|useRouter/);
});
