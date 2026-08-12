import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

function cssBlock(source: string, header: string): string {
  const headerStart = source.indexOf(header);
  assert.notEqual(headerStart, -1, `CSS block must exist: ${header}`);

  const blockStart = source.indexOf("{", headerStart + header.length);
  assert.notEqual(blockStart, -1, `CSS block must open: ${header}`);

  let depth = 1;
  for (let cursor = blockStart + 1; cursor < source.length; cursor += 1) {
    if (source[cursor] === "{") depth += 1;
    if (source[cursor] === "}") depth -= 1;
    if (depth === 0) return source.slice(blockStart + 1, cursor);
  }

  assert.fail(`CSS block must close: ${header}`);
}

test("root welcome renders the V5 palace gate transition and two direct login routes", async () => {
  const component = await readFile(new URL("./WelcomeGate.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("./welcome.module.css", import.meta.url), "utf8");
  const sceneRule = cssBlock(css, ".scene");
  const reducedMotionRule = cssBlock(css, "@media (prefers-reduced-motion: reduce)");
  const narrowRule = cssBlock(css, "@media (max-width: 720px)");
  const narrowActionsRule = cssBlock(narrowRule, ".actions");
  const narrowAttendRule = cssBlock(narrowRule, ".attend");

  assert.match(component, /启 朝/);
  assert.match(component, /朕只需下一道旨，群臣 Agent 自会办结/);
  assert.equal(component.match(/href="\/login"/g)?.length, 2);
  assert.match(component, /"上朝"/);
  assert.match(component, /已有朝堂？登录/);
  assert.match(component, /跳过仪式/);
  assert.match(component, /["']use client["']/);
  assert.match(component, /\/assets\/v5-pre-auth\/welcome-gate-opening\.mp4/);
  assert.match(component, /preload="auto"/);
  assert.match(component, /onCanPlay=\{markMediaReady\}/);
  assert.match(component, /video\s*&&\s*video\.readyState\s*>=\s*HTMLMediaElement\.HAVE_FUTURE_DATA/);
  assert.match(component, /phase === "waiting" \? "宫门准备中…" : "上朝"/);
  assert.match(component, /WELCOME_FALLBACK_MS\s*=\s*4_000/);
  assert.match(component, /clearTimeout/);
  assert.match(component, /aria-hidden="true"/);
  assert.match(component, /disablePictureInPicture/);
  assert.match(component, /controlsList="nodownload nofullscreen noremoteplayback"/);
  assert.match(component, /draggable=\{false\}/);
  assert.doesNotMatch(component, /\scontrols(?:\s|=|>)/);
  assert.match(component, /onEnded=\{completeOpening\}/);
  assert.match(component, /onError=\{failOpening\}/);
  assert.match(component, /router\.replace\("\/login"\)/);
  assert.doesNotMatch(component, /\bopened\b/);
  assert.doesNotMatch(component, /welcome-gate-open\.png/);
  assert.match(component, /setTimeout/);
  assert.doesNotMatch(component, /disabled=/);
  assert.doesNotMatch(component, /router\.(?:push|replace)\("\/register"\)/);
  assert.doesNotMatch(component, /\b(?:onSubmit|preventDefault|setSubmitted|demo)\b/i);

  assert.match(reducedMotionRule, /\.hero\s*,\s*\.actions\s*\{[^}]*animation:\s*none\s*;/);
  assert.match(narrowActionsRule, /\binset:\s*auto\s+16px\s+7%\s*;/);
  assert.match(narrowAttendRule, /\bwidth:\s*min\(100%,\s*280px\)\s*;/);
  assert.match(narrowAttendRule, /\bmin-width:\s*0\s*;/);

  assert.equal(css.match(/\.scene\s*\{/g)?.length, 1);
  assert.equal(component.match(/styles\.scene/g)?.length, 1);
  assert.match(css, /\/assets\/v5-pre-auth\/welcome-gate-closed\.webp/);
  assert.doesNotMatch(css, /\/assets\/v5-pre-auth\/welcome-gate-open\.png/);
  assert.doesNotMatch(css, /\/assets\/v5-pre-auth\/palace-gate\.png/);
  assert.match(sceneRule, /pointer-events:\s*none/);
  assert.doesNotMatch(sceneRule, /\b(?:animation|transform|transition)\s*:/);
  assert.doesNotMatch(css, /\.scene(?::|::)[^{]*\{/);
});
