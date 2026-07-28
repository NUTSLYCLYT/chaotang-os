import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  createCourtExplanationId,
  resolveCourtCapabilityButtonState,
} from "./types.ts";

function extractCssBlock(source: string, header: string): string {
  const blockHeader = `${header} {`;
  const headerIndex = source.indexOf(blockHeader);
  assert.notEqual(headerIndex, -1, `missing CSS block: ${header}`);

  const openingBrace = source.indexOf("{", headerIndex);
  assert.notEqual(openingBrace, -1, `missing opening brace for: ${header}`);

  let depth = 0;
  for (let index = openingBrace; index < source.length; index += 1) {
    if (source[index] === "{") {
      depth += 1;
    } else if (source[index] === "}") {
      depth -= 1;
      if (depth === 0) {
        return source.slice(openingBrace + 1, index);
      }
    }
  }

  assert.fail(`missing closing brace for: ${header}`);
}

test("immersive shell exposes scene and background without network code", async () => {
  const source = await readFile(
    new URL("./ImmersiveCourtShell.tsx", import.meta.url),
    "utf8",
  );
  const css = await readFile(
    new URL("./ImmersiveCourtShell.module.css", import.meta.url),
    "utf8",
  );
  assert.match(source, /data-court-scene/);
  assert.match(source, /backgroundImage/);
  assert.doesNotMatch(source, /fetch\(|BACKEND_BASE_URL|ownerId/);
  assert.match(
    css,
    /\.shell\s*\{[^}]*position: fixed;[^}]*inset: 0;[^}]*box-sizing: border-box;[^}]*height: 100dvh;/,
  );
  assert.match(
    css,
    /@media \(max-width: 767px\)[\s\S]*?\.shell\s*\{[^}]*overflow-y: auto;/,
  );

  const contentRule = css.match(/\.content\s*\{([^}]*)\}/)?.[1];
  assert.ok(contentRule, "immersive shell must define a scoped content rule");
  assert.match(contentRule, /width: min\(100%, 1600px\)/);
  assert.match(
    contentRule,
    /margin-inline:\s*auto/,
    "capped court content must remain centered in ultrawide viewports",
  );
  assert.match(contentRule, /box-sizing: border-box/);
  assert.match(contentRule, /env\(safe-area-inset-right\)/);
  assert.match(contentRule, /env\(safe-area-inset-left\)/);
  assert.match(
    css,
    /\.contentFullBleed\s*\{[^}]*overflow:\s*clip/,
    "full-bleed scenes must not expose a content scrollbar",
  );
});

test("immersive shell forwards an optional React element to the quick dock", async () => {
  const css = await readFile(
    new URL("./ImmersiveCourtShell.module.css", import.meta.url),
    "utf8",
  );
  const typesSource = await readFile(
    new URL("./types.ts", import.meta.url),
    "utf8",
  );
  const shellSource = await readFile(
    new URL("./ImmersiveCourtShell.tsx", import.meta.url),
    "utf8",
  );
  const dockSource = await readFile(
    new URL("./CourtQuickDock.tsx", import.meta.url),
    "utf8",
  );

  assert.match(typesSource, /import type \{[^}]*ReactElement[^}]*\} from "react"/);
  assert.match(
    typesSource,
    /quickDockCenter\?: ReactElement \| null;/,
    "shell props must expose an element-only optional center slot",
  );
  assert.match(typesSource, /fullBleedContent\?: boolean;/);
  assert.match(typesSource, /hideScrollbar\?: boolean;/);
  assert.match(typesSource, /showQuickDockHandle\?: boolean;/);
  assert.match(shellSource, /\bquickDockCenter\b/);
  assert.match(shellSource, /\bfullBleedContent\b/);
  assert.match(shellSource, /\bhideScrollbar\b/);
  assert.match(shellSource, /\bshowQuickDockHandle\b/);
  assert.match(
    shellSource,
    /<CourtQuickDock centerSlot=\{quickDockCenter\} showHandle=\{showQuickDockHandle\} \/>/,
    "the shell must pass its optional center slot and handle visibility through to the dock",
  );
  assert.match(css, /\.contentScrollbarHidden\s*\{[^}]*scrollbar-width:\s*none/);
  assert.match(css, /\.contentScrollbarHidden::-webkit-scrollbar\s*\{\s*display:\s*none/);

  assert.match(dockSource, /centerSlot\?: ReactElement \| null;/);
  assert.match(dockSource, /showHandle\?: boolean;/);
  assert.match(dockSource, /showHandle \? <Link/);
  assert.match(dockSource, /resolveCourtQuickDockLayout\(centerSlot\)/);
  assert.match(dockSource, /styles\.dockWithoutCenter/);
  assert.match(dockSource, /styles\.dockWithCenter/);
  assert.match(
    dockSource,
    /\?\s*\(\s*<[^>]+data-court-dock-center/,
    "the center wrapper must be conditionally rendered",
  );
});

test("immersive shell renders overlays outside the content stacking context", async () => {
  const [typesSource, shellSource] = await Promise.all([
    readFile(new URL("./types.ts", import.meta.url), "utf8"),
    readFile(new URL("./ImmersiveCourtShell.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(typesSource, /overlay\?: ReactNode;/);
  assert.match(
    shellSource,
    /<\/main>\s*\{overlay\}\s*<CourtQuickDock/,
    "fixed overlays must be siblings of the dock instead of descendants of the z-indexed content",
  );
});

test("quick dock fills two columns by default and aligns the right entry to the safe edge", async () => {
  const css = await readFile(
    new URL("./CourtQuickDock.module.css", import.meta.url),
    "utf8",
  );
  const withoutCenterRule = extractCssBlock(css, ".dockWithoutCenter");
  const adviserRule = extractCssBlock(css, ".adviser");
  const astronomerRule = extractCssBlock(css, ".astronomer");
  const centeredAstronomerRule = extractCssBlock(
    css,
    ".dockWithCenter .astronomer",
  );

  assert.match(
    withoutCenterRule,
    /grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/,
  );
  assert.match(
    adviserRule,
    /box-sizing:\s*border-box/,
    "full-width dock links must include their padding in the grid track",
  );
  assert.match(astronomerRule, /grid-column:\s*2/);
  assert.match(astronomerRule, /justify-self:\s*stretch/);
  assert.match(astronomerRule, /justify-content:\s*flex-end/);
  assert.match(
    astronomerRule,
    /padding:\s*6px\s+max\(16px,\s*env\(safe-area-inset-right\)\)\s+6px\s+16px/,
    "desktop content must retain only the right safe-area padding",
  );
  assert.doesNotMatch(
    astronomerRule,
    /padding[^;]*40px/,
    "the legacy 40px right inset must not return",
  );
  assert.match(centeredAstronomerRule, /grid-column:\s*3/);
});

test("quick dock adds and compacts the center column at explicit breakpoints", async () => {
  const css = await readFile(
    new URL("./CourtQuickDock.module.css", import.meta.url),
    "utf8",
  );
  const withCenterRule = extractCssBlock(css, ".dockWithCenter");
  const compactMedia = extractCssBlock(css, "@media (max-width: 959px)");
  const compactCenterRule = extractCssBlock(
    compactMedia,
    ".dockWithCenter",
  );
  const compactSecondaryTextRule = extractCssBlock(
    compactMedia,
    ".dockWithCenter .adviser small",
  );
  const mobileMedia = extractCssBlock(css, "@media (max-width: 767px)");
  const mobileWithoutCenterRule = extractCssBlock(
    mobileMedia,
    ".dockWithoutCenter",
  );
  const mobileAstronomerRule = extractCssBlock(
    mobileMedia,
    ".astronomer",
  );
  const narrowMedia = extractCssBlock(css, "@media (max-width: 420px)");

  assert.match(
    withCenterRule,
    /grid-template-columns:\s*minmax\(0,\s*1fr\)\s+minmax\(240px,\s*40vw\)\s+minmax\(0,\s*1fr\)/,
  );
  assert.match(
    compactCenterRule,
    /grid-template-columns:\s*minmax\(0,\s*1fr\)\s+minmax\(84px,\s*28vw\)\s+minmax\(0,\s*1fr\)/,
  );
  assert.match(compactSecondaryTextRule, /display:\s*none/);
  assert.match(
    mobileWithoutCenterRule,
    /grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/,
  );
  assert.match(
    mobileAstronomerRule,
    /padding-inline:\s*4px\s+max\(8px,\s*env\(safe-area-inset-right\)\)/,
  );
  assert.doesNotMatch(
    narrowMedia,
    /\.astronomer\s*\{[^}]*padding-right:\s*8px/,
    "the 420px override must not discard the right safe-area inset",
  );
});

test("capability button uses a unique React id without replacing existing descriptions", async () => {
  const source = await readFile(
    new URL("./CourtCapabilityButton.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /useId\(\)/);
  assert.match(source, /createCourtExplanationId/);
  assert.match(source, /aria-describedby/);
  assert.doesNotMatch(source, /buttonProps\.id/);

  const firstId = createCourtExplanationId(":r0:");
  const secondId = createCourtExplanationId(":r1:");
  assert.notEqual(firstId, secondId);

  const state = resolveCourtCapabilityButtonState(
    "enabled",
    firstId,
    false,
    "caller-description",
  );
  assert.equal(state.disabled, false);
  assert.equal(state.ariaDescribedBy, `caller-description ${firstId}`);
});

test("enabled, readonly, and unavailable capabilities have explicit disabled semantics", () => {
  const explanationId = createCourtExplanationId(":r2:");

  assert.equal(
    resolveCourtCapabilityButtonState("enabled", explanationId).disabled,
    false,
  );
  assert.equal(
    resolveCourtCapabilityButtonState("enabled", explanationId, true).disabled,
    true,
  );
  assert.equal(
    resolveCourtCapabilityButtonState("readonly", explanationId).disabled,
    true,
  );
  assert.equal(
    resolveCourtCapabilityButtonState("unavailable", explanationId).disabled,
    true,
  );
});
