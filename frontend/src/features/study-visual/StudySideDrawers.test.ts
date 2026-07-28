import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("side drawers expose accessible triggers, close controls, Escape and no fetch", async () => {
  const source = await readFile(new URL("./StudySideDrawers.tsx", import.meta.url), "utf8");
  assert.match(source, /aria-label="打开上书房左侧抽屉"/);
  assert.match(source, /aria-label="打开上书房右侧抽屉"/);
  assert.match(source, /event\.key === "Escape"/);
  assert.match(source, />关闭</);
  assert.doesNotMatch(source, /\bfetch\s*\(/);
});

test("right drawer is blank and responsive motion is optional", async () => {
  const [source, css] = await Promise.all([
    readFile(new URL("./StudySideDrawers.tsx", import.meta.url), "utf8"),
    readFile(new URL("./StudySideDrawers.module.css", import.meta.url), "utf8"),
  ]);
  assert.match(source, /暂未开放/);
  assert.match(css, /@media \(max-width: 360px\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /overflow: auto/);
});
