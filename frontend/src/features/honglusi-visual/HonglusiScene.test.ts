import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Honglusi scene reuses the immersive court shell and exposes the complete gateway hierarchy", async () => {
  const source = await readFile(new URL("./HonglusiScene.tsx", import.meta.url), "utf8");

  assert.match(source, /^"use client";/);
  assert.match(source, /ImmersiveCourtShell/);
  assert.match(source, /currentLabel="鸿胪寺"/);
  assert.match(source, /currentPath="\/honglusi"/);
  assert.match(source, /scene="honglusi"/);
  assert.match(source, /quickDockCenter=\{composer\}/);
  assert.match(source, /发生什么/);
  assert.match(source, /需要朕决定什么/);
  assert.match(source, /朝堂下一步替你做什么/);
  for (const label of ["国门总览", "外部能力", "准入审查", "联盟路由"]) {
    assert.match(source, new RegExp(label));
  }
  assert.match(source, /aria-label="鸿胪寺研判视角"/);
  assert.match(source, /aria-pressed=\{view === tab\.id\}/);
  assert.doesNotMatch(source, /role="tab(?:list)?"|aria-selected=/);
  assert.match(source, /aria-pressed=/);
  assert.match(source, /能力护照/);
  assert.match(source, /预警与待决/);
  assert.equal(source.match(/是否允许进入受限沙箱？/g)?.length, 1);
  assert.match(source, /\{selected\.risk\.level\}风险 · DEMO/);
  assert.match(source, /<section className=\{styles\.gatewayStage\}/);
  assert.doesNotMatch(source, /<main className=\{styles\.gatewayStage\}/);
  assert.match(source, /setReply\(`演示回复：已切换至\$\{capability\.name\}/);
  assert.match(source, /待接入真实事实源/);
  assert.match(source, /DEMO/);
  assert.equal(source.match(/data-honglusi-primary-action/g)?.length, 1);
});

test("Honglusi scene provides local-only dialogue and no external execution surface", async () => {
  const source = await readFile(new URL("./HonglusiScene.tsx", import.meta.url), "utf8");

  assert.match(source, /<form[^>]+onSubmit=/);
  assert.match(source, /value=\{draft\}/);
  assert.match(source, /draft\.trim\(\)/);
  assert.match(source, /演示回复/);
  assert.doesNotMatch(source, /fetch\(|BACKEND_BASE_URL|https?:\/\/|localStorage|sessionStorage/);
  assert.doesNotMatch(source, /method\s*:\s*["'](?:POST|PUT|PATCH|DELETE)/);
  assert.doesNotMatch(source, /type=["'](?:password|file)["']/);
});

test("Honglusi styling has an intentional gate composition and responsive fallbacks", async () => {
  const css = await readFile(new URL("./HonglusiScene.module.css", import.meta.url), "utf8");

  assert.match(css, /\.gatewayGrid\s*\{/);
  assert.match(css, /grid-template-columns:/);
  assert.match(css, /\.gateOrbit\s*\{/);
  assert.match(css, /@media \(max-width: 1024px\)/);
  assert.match(css, /@media \(max-width: 640px\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.doesNotMatch(css, /\.composerReply\s*\{\s*display:\s*none/);
  assert.doesNotMatch(css, /\.demoStamp\s*\{\s*display:\s*none/);
  assert.doesNotMatch(css, /linear-gradient|radial-gradient/);
});
