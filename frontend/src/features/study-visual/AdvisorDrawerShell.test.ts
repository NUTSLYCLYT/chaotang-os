import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("shared advisor shell owns portrait header, scrolling body and optional pinned footer", async () => {
  const source = await readFile(new URL("./AdvisorDrawerShell.tsx", import.meta.url), "utf8");
  assert.match(source, /data-advisor-side=\{side\}/);
  assert.match(source, /data-advisor-region="header"/);
  assert.match(source, /data-advisor-region="body"/);
  assert.match(source, /data-advisor-region="footer"/);
  assert.match(source, /role="img"/);
  assert.match(source, /aria-label=\{`\$\{name\} 立像`\}/);
  assert.doesNotMatch(source, /\bfetch\s*\(/);
  assert.doesNotMatch(source, /onClose|closeButtonRef|className=\{styles\.close\}/);
});

test("shell copies the dev edge drawer and portrait values exactly", async () => {
  const css = await readFile(new URL("./AdvisorDrawerShell.module.css", import.meta.url), "utf8");
  const portraitMask = "radial-gradient(118% 94% at 50% 30%, #000 50%, rgba(0,0,0,.4) 72%, transparent 90%)";
  const portraitRule = css.match(/\.portraitImage\s*\{([^}]*)\}/)?.[1] ?? "";
  assert.match(css, /width:\s*44vw;/);
  assert.match(css, /max-width:\s*100vw;/);
  assert.match(css, /top:\s*64px;/);
  assert.match(css, /bottom:\s*calc\(64px \+ env\(safe-area-inset-bottom\)\);/);
  assert.match(css, /z-index:\s*220;/);
  assert.match(css, /linear-gradient\(180deg,\s*rgba\(7,\s*9,\s*16,\s*0\.94\),\s*rgba\(4,\s*6,\s*12,\s*0\.90\)\)/);
  assert.match(css, /box-shadow:\s*0 -18px 54px rgba\(0,\s*0,\s*0,\s*0\.38\),\s*inset 0 1px 0 rgba\(255,\s*255,\s*255,\s*0\.06\);/);
  assert.match(css, /backdrop-filter:\s*blur\(18px\);/);
  assert.match(css, /animation-duration:\s*var\(--advisor-drawer-open-duration\);/);
  assert.match(css, /animation-timing-function:\s*var\(--advisor-drawer-easing\);/);
  assert.match(css, /\.portrait\s*\{[^}]*width:\s*90px;[^}]*height:\s*96px;/);
  assert.match(css, /\.header\s*\{[^}]*padding:\s*4px 16px 3px;/);
  assert.doesNotMatch(css, /@media \(min-width:\s*1280px\)[^}]*\.portrait/);
  assert.ok(portraitRule.includes(`-webkit-mask-image: ${portraitMask};`));
  assert.ok(portraitRule.includes(`mask-image: ${portraitMask};`));
  assert.match(css, /@media \(min-width:\s*640px\)[\s\S]*width:\s*260px;/);
  assert.match(css, /@media \(min-width:\s*1024px\)[\s\S]*width:\s*300px;/);
  assert.match(css, /@media \(prefers-reduced-motion:\s*reduce\)/);
});

test("only the shell body scrolls while header and footer remain fixed", async () => {
  const css = await readFile(new URL("./AdvisorDrawerShell.module.css", import.meta.url), "utf8");
  assert.match(css, /\.shell\s*\{[^}]*display:\s*flex;[^}]*flex-direction:\s*column;/);
  assert.match(css, /\.header\s*\{[^}]*flex:\s*0 0 auto;/);
  assert.match(css, /\.body\s*\{[^}]*flex:\s*1 1 0;[^}]*min-height:\s*0;[^}]*overflow-y:\s*auto;/);
  assert.match(css, /\.footer\s*\{[^}]*flex:\s*1 1 0;[^}]*min-height:\s*0;/);
});

test("shell uses real directional enter and close animations", async () => {
  const [source, css] = await Promise.all([
    readFile(new URL("./AdvisorDrawerShell.tsx", import.meta.url), "utf8"),
    readFile(new URL("./AdvisorDrawerShell.module.css", import.meta.url), "utf8"),
  ]);
  assert.match(source, /phase:\s*"opening"\s*\|\s*"closing"/);
  assert.match(source, /data-advisor-phase=\{phase\}/);
  for (const name of ["drawerFromLeft", "drawerFromRight", "drawerToLeft", "drawerToRight"]) {
    assert.match(css, new RegExp(`@keyframes ${name}`));
  }
  assert.match(css, /animation-duration:\s*var\(--advisor-drawer-open-duration\)/);
  assert.match(css, /\[data-advisor-phase="closing"\][^}]*animation-duration:\s*var\(--advisor-drawer-close-duration\)/);
});

test("shell accepts measured content bounds and keeps a safe fallback", async () => {
  const source = await readFile(new URL("./AdvisorDrawerShell.tsx", import.meta.url), "utf8");
  assert.match(source, /bounds\?:\s*\{\s*top:\s*number;\s*height:\s*number/);
  assert.match(source, /bounds\s*\?\s*\{\s*top:\s*bounds\.top,\s*height:\s*bounds\.height\s*\}/);
});

test("shared composer exactly mirrors the dev global edict input", async () => {
  const css = await readFile(new URL("./AdvisorDrawerShell.module.css", import.meta.url), "utf8");
  assert.match(css, /\.composerInput\s*\{[^}]*height:\s*32px;/);
  assert.match(css, /border:\s*1px solid rgba\(240,\s*198,\s*106,\s*\.16\)/);
  assert.match(css, /background:\s*linear-gradient\(180deg,\s*rgba\(255,255,255,\.035\),\s*rgba\(0,0,0,\.16\)\)/);
  assert.match(css, /box-shadow:\s*inset 0 1px 0 rgba\(245,233,201,\.035\)/);
  assert.match(css, /\.composerInput:hover\s*\{/);
  assert.match(css, /var\(--chat-accent\) 52%/);
  assert.match(css, /0 0 14px color-mix\(in srgb,\s*var\(--chat-accent\) 14%,\s*transparent\)/);
});

test("shell keeps a stable header and bounded equal body/footer layout", async () => {
  const css = await readFile(new URL("./AdvisorDrawerShell.module.css", import.meta.url), "utf8");
  assert.match(css, /\.body\s*\{[^}]*flex:\s*1 1 0;[^}]*min-height:\s*0;[^}]*overflow-y:\s*auto;/);
  assert.match(css, /\.footer\s*\{[^}]*flex:\s*1 1 0;[^}]*min-height:\s*0;[^}]*overflow:\s*hidden;/);
  assert.match(css, /-webkit-backdrop-filter:\s*blur\(18px\)/);
});

test("shell header has no duplicate close-control styles", async () => {
  const css = await readFile(new URL("./AdvisorDrawerShell.module.css", import.meta.url), "utf8");
  assert.doesNotMatch(css, /\.close(?::|\s|\{)/);
});

test("shell exposes a real DOM id target for its controlling edge toggle", async () => {
  const source = await readFile(new URL("./AdvisorDrawerShell.tsx", import.meta.url), "utf8");
  assert.match(source, /id\?: string/);
  assert.match(source, /id=\{id\}/);
});
