import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

function countMatches(source: string, pattern: RegExp): number {
  return [...source.matchAll(pattern)].length;
}

function extractBlock(source: string, marker: string, occurrence = 1): string {
  let markerIndex = -1;
  for (let found = 0; found < occurrence; found += 1) {
    markerIndex = source.indexOf(marker, markerIndex + 1);
  }
  assert.notEqual(markerIndex, -1, `missing block marker: ${marker}`);

  const openingBrace = source.indexOf("{", markerIndex);
  assert.notEqual(openingBrace, -1, `missing opening brace after: ${marker}`);

  let depth = 0;
  for (let index = openingBrace; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) {
      const block = source.slice(openingBrace + 1, index).trim();
      assert.notEqual(block, "", `empty block after: ${marker}`);
      return block;
    }
  }

  assert.fail(`unterminated block after: ${marker}`);
}

function assertSuspenseWrapsForm(source: string, formName: string): void {
  assert.equal(countMatches(source, /<Suspense\b/g), 1);
  assert.equal(countMatches(source, /<\/Suspense>/g), 1);

  const openingTag = source.match(/<Suspense\b[^>]*>/);
  assert.ok(openingTag?.index !== undefined, "missing Suspense opening tag");
  const contentStart = openingTag.index + openingTag[0].length;
  const contentEnd = source.indexOf("</Suspense>", contentStart);
  assert.notEqual(contentEnd, -1, "missing Suspense closing tag");

  const suspenseContent = source.slice(contentStart, contentEnd).trim();
  assert.notEqual(suspenseContent, "", "Suspense content must not be empty");
  const formPattern = new RegExp(`<${formName}\\s*\\/>`, "g");
  assert.equal(countMatches(source, formPattern), 1);
  assert.equal(
    countMatches(suspenseContent, new RegExp(`<${formName}\\s*\\/>`, "g")),
    1,
    `${formName} must be rendered inside Suspense`,
  );
}

test("public entry shells use the V5 palace visual language without replacing live entry contracts", async () => {
  const [shell, authCss, loginPage, registerPage] = await Promise.all([
    readFile(new URL("./PreAuthShell.tsx", import.meta.url), "utf8"),
    readFile(new URL("./preAuth.module.css", import.meta.url), "utf8"),
    readFile(new URL("../../app/login/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../../app/register/page.tsx", import.meta.url), "utf8"),
  ]);
  const pageRule = extractBlock(authCss, ".page {");
  const topbarRule = extractBlock(authCss, ".topbar {");
  const frameRule = extractBlock(authCss, ".frame {");
  const footerRule = extractBlock(authCss, ".siteFooter {", 2);
  const inputFocusRule = extractBlock(authCss, ".input:focus-visible {");
  const buttonFocusRule = extractBlock(authCss, ".button:focus-visible {");
  const narrowRules = extractBlock(authCss, "@media (max-width: 720px)");
  const reducedMotionRules = extractBlock(authCss, "@media (prefers-reduced-motion: reduce)");

  assert.match(shell, /href="\/"/);
  assert.match(shell, /href="\/login"/);
  assert.match(shell, /href="\/register"/);
  assert.match(shell, /data-public-entry-shell/);
  assert.match(shell, /chaotang-os · 数字朝堂/);
  assert.match(shell, /独立朝堂 · Agent 自动办理 · v5/);
  assert.equal(countMatches(authCss, /\/assets\/v5-pre-auth\/palace-(?:login|gate)\.png/g), 1);
  assert.match(pageRule, /min-height:\s*100svh\s*;/);
  assert.match(pageRule, /grid-template-rows:\s*72px\s+minmax\(0,\s*1fr\)\s+64px\s*;/);
  assert.match(pageRule, /url\("\/assets\/v5-pre-auth\/palace-(?:login|gate)\.png"\)\s+center\s*\/\s*cover\s+no-repeat/);
  assert.match(pageRule, /overflow-y:\s*auto\s*;/);
  assert.match(topbarRule, /min-height:\s*72px\s*;/);
  assert.match(footerRule, /min-height:\s*64px\s*;/);
  assert.match(frameRule, /grid-template-columns:\s*minmax\(0,\s*1fr\)\s+minmax\(390px,\s*450px\)\s*;/);
  assert.match(narrowRules, /\.frame\s*\{[\s\S]*?grid-template-columns:\s*1fr\s*;/);
  assert.match(narrowRules, /width:\s*min\(calc\(100%\s*-\s*32px\),\s*450px\)\s*;/);
  assert.doesNotMatch(narrowRules, /overflow-y:\s*hidden/);
  assert.match(reducedMotionRules, /animation-duration:\s*\.01ms\s*!important\s*;/);
  assert.match(reducedMotionRules, /transition-duration:\s*\.01ms\s*!important\s*;/);
  assert.match(reducedMotionRules, /scroll-behavior:\s*auto\s*!important\s*;/);
  assert.match(authCss, /#9a6a34/i);
  assert.match(inputFocusRule, /border-color:\s*#c38b4b\s*;/i);
  assert.match(inputFocusRule, /outline:\s*none\s*;/i);
  assert.doesNotMatch(inputFocusRule, /outline-offset|box-shadow/);
  assert.match(buttonFocusRule, /outline:\s*2px\s+solid\s+#efd7a9\s*;/i);
  assert.doesNotMatch(shell, /fetch\(|localStorage|sessionStorage|backendClient|useRouter/);

  assertSuspenseWrapsForm(loginPage, "LoginForm");
  assert.equal(countMatches(loginPage, /href="\/register"/g), 1);
  assert.match(loginPage, /title="重入朝堂，续理万机"/);
  assert.match(loginPage, /description="登录后只进入属于您的独立朝堂；案卷、Agent 轨迹与史馆归档彼此隔离。"/);

  assertSuspenseWrapsForm(registerPage, "RegisterForm");
  assert.equal(countMatches(registerPage, /href="\/login"/g), 1);
  assert.match(registerPage, /title="创建朝堂，开启万机"/);
  assert.match(registerPage, /description="注册后将拥有彼此隔离的案卷、Agent 轨迹与史馆归档，安心开始您的数字朝堂。"/);
});
