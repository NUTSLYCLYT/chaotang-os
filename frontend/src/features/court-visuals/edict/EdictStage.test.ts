import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function readSource(relativePath: string): Promise<string> {
  try {
    return await readFile(new URL(relativePath, import.meta.url), "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return "";
    }
    throw error;
  }
}

test("shared edict module exposes the expanded and collapsed visual shells", async () => {
  const source = await readSource("./EdictStage.tsx");

  assert.match(source, /export function EdictStage\b/);
  assert.match(source, /export function CollapsedEdictScroll\b/);
  assert.match(source, /function SideRoller\b/);
  assert.match(source, /function BrocadeBorder\b/);
});

test("expanded edict preserves the dev roller, brocade, paper, seal, and motion contract", async () => {
  const source = await readSource("./EdictStage.tsx");
  const css = await readSource("./EdictStage.module.css");

  assert.match(source, /<SideRoller side="left"\s*\/>/);
  assert.match(source, /<SideRoller side="right"\s*\/>/);
  assert.match(source, /styles\.rollerJadeTop/);
  assert.match(source, /styles\.rollerJadeBottom/);
  assert.match(source, /<BrocadeBorder edge="top"\s*\/>/);
  assert.match(source, /<BrocadeBorder edge="bottom"\s*\/>/);
  assert.match(source, /styles\.paper/);
  assert.match(source, /styles\.sealRing/);
  assert.match(source, /styles\.seal/);

  assert.match(css, /\.stage\s*\{[\s\S]*?max-width:\s*920px/);
  assert.match(css, /@media\s*\(min-width:\s*1536px\)[\s\S]*?\.stage\s*\{[\s\S]*?max-width:\s*960px/);
  assert.match(css, /\.sideRoller\s*\{[\s\S]*?top:\s*0[\s\S]*?bottom:\s*0[\s\S]*?width:\s*34px/);
  assert.match(css, /\.rollerJadeTop\s*,\s*\.rollerJadeBottom\s*\{[\s\S]*?width:\s*40px[\s\S]*?height:\s*40px/);
  assert.match(css, /\.brocadeTop\b/);
  assert.match(css, /\.brocadeBottom\b/);
  assert.match(css, /data:image\/svg\+xml/);
  assert.match(css, /\.paper::before\b/);
  assert.match(css, /background-size:\s*47px 53px,\s*61px 67px,\s*100% 100%/);
  assert.match(css, /repeating-linear-gradient\(26deg/);
  assert.match(css, /\.seal\s*\{[\s\S]*?width:\s*200px[\s\S]*?height:\s*200px/);
  assert.match(css, /\.sealRing\s*\{[\s\S]*?width:\s*210px[\s\S]*?height:\s*210px/);
  assert.match(css, /@keyframes scroll-unfurl/);
  assert.match(css, /@keyframes row-rise/);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
});

test("collapsed edict owns the dev 900px and 64px shell", async () => {
  const source = await readSource("./EdictStage.tsx");
  const css = await readSource("./EdictStage.module.css");

  assert.match(source, /data-testid="collapsed-edict-scroll"/);
  assert.match(source, /styles\.collapsedEdict/);
  assert.match(css, /\.collapsedEdict\s*\{[\s\S]*?max-width:\s*900px[\s\S]*?height:\s*64px/);
});

test("study parent adopts the architected responsive collapsed-edict width", async () => {
  const studyCss = await readSource("../../study-visual/DevStudyWorkspace.module.css");

  assert.match(
    studyCss,
    /max-width:\s*min\(\s*1180px\s*,\s*max\(\s*640px\s*,\s*calc\(\s*100vw\s*-\s*760px\s*\)\s*\)\s*\)/,
  );
});

test("study uses shared EdictStage", async () => {
  const source = await readSource("../../study-visual/DevStudyWorkspace.tsx");
  assert.match(source, /court-visuals\/edict\/EdictStage/);
  assert.match(source, /<(?:EdictStage|CollapsedEdictScroll)\b/);
});

test("shared edict layer remains presentation-only", async () => {
  const source = await readSource("./EdictStage.tsx");

  assert.doesNotMatch(
    source,
    /\b(?:fetch|EventSource|SWR)\b|BACKEND_BASE_URL/,
  );
});
