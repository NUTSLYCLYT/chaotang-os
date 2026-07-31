import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("formal forecast is explicit and renders the full decision record", async () => {
  const source = await readFile(new URL("./QintianPanel.tsx", import.meta.url), "utf8");
  assert.match(source, /"发起正式推演"/);
  assert.match(source, /state\.forecast\.scenarios\.map/);
  assert.match(source, /probabilityInterval/);
  assert.match(source, /置信依据/);
  assert.match(source, /关键假设/);
  assert.match(source, /证据与更新时间/);
  assert.match(source, /反事实/);
  assert.match(source, /最坏情况/);
  assert.match(source, /人工签字/);
  assert.match(source, /复核日期/);
});

test("due review exposes all four decisions and never submits a decree", async () => {
  const source = await readFile(new URL("./QintianPanel.tsx", import.meta.url), "utf8");
  for (const decision of ["KEEP", "INVALIDATE", "REQUEST_RERUN", "ESCALATE_TO_CHANCELLOR"]) {
    assert.match(source, new RegExp(`value: "${decision}"`));
  }
  assert.match(source, /reviewQintianForecastFromBrowser/);
  assert.match(source, /aria-label="实际新观察"/);
  assert.match(source, /judgmentInvalidated/);
  assert.match(source, /triggerId: trigger\.id/);
  assert.match(source, /待核信号定义/);
  assert.doesNotMatch(source, /新信号：/);
  assert.doesNotMatch(source, /decrees\/chancellor/);
});

test("qintian chat stays independent without a decree-prefill control or layout gap", async () => {
  const [source, css] = await Promise.all([
    readFile(new URL("./QintianPanel.tsx", import.meta.url), "utf8"),
    readFile(new URL("./QintianPanel.module.css", import.meta.url), "utf8"),
  ]);
  assert.match(source, /consultQintianFromBrowser/);
  assert.match(source, /问钦天监/);
  assert.match(source, /发起正式推演/);
  assert.doesNotMatch(source, /转为拟旨/);
  assert.doesNotMatch(source, /onClick=\{\(\) => onPrefillDecree/);
  assert.doesNotMatch(css, /\.secondary\s*\{/);
  assert.match(source, /服务暂不可用，未生成正式推演/);
});

test("workspace binds qintian to archive, current reply, draft or decree", async () => {
  const source = await readFile(new URL("./DevStudyWorkspace.tsx", import.meta.url), "utf8");
  assert.match(source, /createQintianContext/);
  assert.match(source, /archivedReply/);
  assert.match(source, /currentReply/);
  assert.match(source, /draft:/);
  assert.match(source, /onPrefillDecree=\{props\.onDecreeTextChange\}/);
});

test("qintian panel uses a compact notebook workspace and a pinned conversation zone", async () => {
  const [source, css] = await Promise.all([
    readFile(new URL("./QintianPanel.tsx", import.meta.url), "utf8"),
    readFile(new URL("./QintianPanel.module.css", import.meta.url), "utf8"),
  ]);

  assert.match(source, /className=\{styles\.workspace\}/);
  assert.match(source, /className=\{styles\.notebook\}/);
  assert.match(source, /className=\{styles\.conversation\}/);
  assert.match(source, /<details className=\{styles\.forecastDisclosure\}/);
  assert.match(css, /\.workspace\s*\{[^}]*padding:\s*6px;/);
  assert.match(css, /\.conversation\s*\{[^}]*height:\s*100%;[^}]*min-height:\s*0;[^}]*overflow:\s*hidden;/);
  assert.match(css, /\.notebook\s*\{[^}]*border-left:\s*2px solid rgba\(126, 200, 227, \.42\);/);
});

test("qintian conversation mirrors the chancellor avatar bubbles and keyboard submission", async () => {
  const [source, css] = await Promise.all([
    readFile(new URL("./QintianPanel.tsx", import.meta.url), "utf8"),
    readFile(new URL("./QintianPanel.module.css", import.meta.url), "utf8"),
  ]);

  assert.match(source, /import Image from "next\/image"/);
  assert.match(source, /\/shangshufang\/portrait-wang\.webp/);
  assert.match(source, /\/shangshufang\/portrait-qintian\.webp/);
  assert.match(source, /className=\{styles\.messageRow\}/);
  assert.match(source, /className=\{styles\.messageBubble\}/);
  assert.match(source, /shouldSubmitConsultKey/);
  assert.match(source, /event\.nativeEvent\.isComposing/);
  assert.match(source, /advisorStyles\.composerButton/);
  assert.match(css, /\.messageRow\[data-role="user"\]\s*\{[^}]*flex-direction:\s*row-reverse;/);
  assert.match(css, /\.chatForm\s*\{[^}]*flex:\s*0 0 auto;/);
});

test("qintian and chancellor import the exact same composer primitives", async () => {
  const [qintianSource, drawerSource, shellCss] = await Promise.all([
    readFile(new URL("./QintianPanel.tsx", import.meta.url), "utf8"),
    readFile(new URL("./StudySideDrawers.tsx", import.meta.url), "utf8"),
    readFile(new URL("./AdvisorDrawerShell.module.css", import.meta.url), "utf8"),
  ]);
  for (const source of [qintianSource, drawerSource]) {
    assert.match(source, /advisorStyles\.composerInput/);
    assert.match(source, /advisorStyles\.composerButton/);
  }
  assert.match(shellCss, /\.composerInput:focus,[\s\S]*var\(--chat-accent\) 52%/);
  assert.match(shellCss, /\.composerInput:focus-visible\s*\{[\s\S]*outline:\s*none\s*!important;/);
  assert.match(shellCss, /\.composerButton:disabled\s*\{[^}]*cursor:\s*default;/);
});
