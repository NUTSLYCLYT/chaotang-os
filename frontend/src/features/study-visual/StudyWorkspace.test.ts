import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

function extractBlock(source: string, marker: string): string {
  const markerIndex = source.indexOf(marker);
  assert.notEqual(markerIndex, -1, `missing block marker: ${marker}`);
  const openIndex = source.indexOf("{", markerIndex);
  assert.notEqual(openIndex, -1, `missing opening brace for: ${marker}`);

  let depth = 0;
  for (let index = openIndex; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(openIndex + 1, index);
    }
  }
  assert.fail(`missing closing brace for: ${marker}`);
}

function extractRule(source: string, selector: string): string {
  return extractBlock(source, `${selector} {`);
}

test("study workspace keeps the real decree contract and removes old APIs", async () => {
  const source = await readFile(new URL("./StudyWorkspace.tsx", import.meta.url), "utf8");

  assert.match(source, /decree-ministry-opinions/);
  assert.match(source, /decree-council-verdict/);
  assert.match(source, /decree-recommendations/);
  assert.doesNotMatch(source, /SWR|subscribeCourtStream|jiqun|chaotang\./);
});

test("study workspace uses the shared immersive shell and the full legacy scene", async () => {
  const source = await readFile(new URL("./StudyWorkspace.tsx", import.meta.url), "utf8");

  assert.match(source, /ImmersiveCourtShell/);
  assert.match(source, /currentLabel="上书房"/);
  assert.match(source, /currentPath="\/study"/);
  assert.match(source, /backgroundImage="\/shangshufang\/bg-shangshufang-full\.webp"/);
  assert.match(source, /scene="study"/);
  assert.match(source, /portrait-wang\.webp/);
  assert.match(source, /portrait-chancellor\.webp/);
  assert.doesNotMatch(source, /fetch\s*\(/);
});

test("study workspace preserves decree controls, fee warning, and honest phases", async () => {
  const source = await readFile(new URL("./StudyWorkspace.tsx", import.meta.url), "utf8");

  assert.match(source, /data-testid="decree-fee-notice"/);
  assert.match(source, /data-testid="decree-textarea"/);
  assert.match(source, /data-testid="submit-decree-button"/);
  assert.match(source, /data-testid="decree-status"/);
  assert.match(source, /data-phase=\{props\.uiState\.phase\}/);
  assert.match(source, /phase === "idle"/);
  assert.match(source, /phase === "submitting"/);
  assert.match(source, /phase === "success"/);
  assert.match(source, /phase === "error"/);
  assert.match(source, /disabled=\{!props\.canEdit\}/);
  assert.match(source, /disabled=\{!props\.canSubmit\}/);
});

test("study workspace CSS keeps the desktop three-axis composition and scoped breakpoints", async () => {
  const css = await readFile(new URL("./StudyWorkspace.module.css", import.meta.url), "utf8");
  const desktopWorkspace = extractRule(css, ".workspace");
  const tablet = extractBlock(css, "@media (max-width: 1050px)");
  const tabletWorkspace = extractRule(tablet, ".workspace");
  const tabletRightRail = extractRule(tablet, ".rightRail");
  const mobile = extractBlock(css, "@media (max-width: 767px)");
  const mobileWorkspace = extractRule(mobile, ".workspace");
  const mobileScroll = extractRule(mobile, ".scroll");
  const mobileComposer = extractRule(mobile, ".composer");

  assert.match(desktopWorkspace, /display:\s*grid/);
  assert.match(
    desktopWorkspace,
    /grid-template-columns:\s*minmax\(190px,\s*0\.72fr\)\s+minmax\(420px,\s*1\.8fr\)\s+minmax\(190px,\s*0\.72fr\)/,
  );
  assert.match(tabletWorkspace, /grid-template-columns:\s*minmax\(155px,\s*0\.65fr\)\s+minmax\(390px,\s*1\.7fr\)/);
  assert.match(tabletRightRail, /grid-column:\s*1\s*\/\s*-1/);
  assert.match(mobileWorkspace, /display:\s*flex/);
  assert.match(mobileWorkspace, /flex-direction:\s*column/);
  assert.match(mobileScroll, /order:\s*2/);
  assert.match(mobileScroll, /width:\s*100%/);
  assert.match(mobileComposer, /position:\s*static/);
});

test("study workspace CSS wraps long real replies without clipping or widening grid tracks", async () => {
  const css = await readFile(new URL("./StudyWorkspace.module.css", import.meta.url), "utf8");
  const scroll = extractRule(css, ".scroll");
  const returnContent = extractRule(css, ".returnContent");
  const ministryItem = extractRule(css, ".ministryList > li");
  const mobile = extractBlock(css, "@media (max-width: 767px)");
  const mobileScroll = extractRule(mobile, ".scroll");

  assert.match(scroll, /min-width:\s*0/);
  assert.match(returnContent, /min-width:\s*0/);
  assert.match(returnContent, /overflow-wrap:\s*anywhere/);
  assert.match(ministryItem, /min-width:\s*0/);
  assert.match(ministryItem, /overflow-wrap:\s*anywhere/);
  assert.match(mobileScroll, /min-width:\s*0/);
  assert.doesNotMatch(returnContent, /overflow:\s*hidden|text-overflow|white-space:\s*nowrap/);
});

test("legacy portrait assets stay decorative instead of inventing an identity", async () => {
  const source = await readFile(new URL("./StudyWorkspace.tsx", import.meta.url), "utf8");

  assert.match(
    source,
    /src="\/shangshufang\/portrait-wang\.webp"[\s\S]*?alt=""[\s\S]*?width=\{160\}/,
  );
  assert.match(
    source,
    /src="\/shangshufang\/portrait-chancellor\.webp"[\s\S]*?alt=""[\s\S]*?width=\{160\}/,
  );
  assert.doesNotMatch(source, /王公公立像/);
});
