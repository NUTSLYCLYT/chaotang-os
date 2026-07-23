import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("ChaotangHeader provides semantic navigation without client-side side effects", async () => {
  const source = await readFile(new URL("./ChaotangHeader.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("./ChaotangHeader.module.css", import.meta.url), "utf8");

  assert.match(source, /aria-label="朝堂主导航"/);
  assert.match(source, /data-three-axis-topnav/);
  assert.match(source, /上值朝 · AI 智能办公/);
  assert.match(source, /朝堂 OS/);
  assert.match(source, /aria-current=\{active \? "page" : undefined\}/);
  for (const href of ["/dadian", "/study", "/junjichu", "/liubu", "/zhuanshu", "/shiguan"]) {
    assert.match(source, new RegExp(`href: "${href}"`));
  }
  for (const label of ["大殿", "上书房", "军机处", "六部", "专署", "史馆"]) {
    assert.match(source, new RegExp(label));
  }
  assert.match(source, /item\.label\.length >= 3 \? styles\.navWide : undefined/);
  assert.match(source, /currentPath === item\.href/);
  assert.doesNotMatch(source, /fetch\(|localStorage|sessionStorage|useEffect|useState/);
  assert.match(css, /@media \(max-width: 1023px\)/);
  assert.match(css, /\.nav a\[aria-current="page"\]::after/);
  assert.match(css, /width: 74px/);
  assert.match(css, /\.navWide \{ width: 88px; \}/);
  assert.match(css, /linear-gradient\(180deg, rgba\(6, 9, 20, 0\.92\)/);
});
