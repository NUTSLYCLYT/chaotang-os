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

test("side drawer background matches the court bottom dock", async () => {
  const [drawerCss, dockCss] = await Promise.all([
    readFile(new URL("./StudySideDrawers.module.css", import.meta.url), "utf8"),
    readFile(new URL("../court-visuals/CourtQuickDock.module.css", import.meta.url), "utf8"),
  ]);
  const drawerRule = drawerCss.match(/\.drawer\s*\{([^}]*)\}/)?.[1] ?? "";
  const dockRule = dockCss.match(/\.dock\s*\{([^}]*)\}/)?.[1] ?? "";
  const background = (rule: string) =>
    rule.match(/background:\s*([^;]+);/)?.[1].replace(/\s+/g, " ").trim();

  assert.equal(background(drawerRule), background(dockRule));
});

test("side drawers preserve the dev responsive width tiers", async () => {
  const css = await readFile(
    new URL("./StudySideDrawers.module.css", import.meta.url),
    "utf8",
  );

  assert.match(
    css,
    /\.drawer\s*\{[\s\S]*?width:\s*44vw;[\s\S]*?max-width:\s*100vw;/,
  );
  assert.match(
    css,
    /@media \(min-width:\s*640px\)\s*\{\s*\.drawer\s*\{\s*width:\s*260px;\s*\}\s*\}/,
  );
  assert.match(
    css,
    /@media \(min-width:\s*1024px\)\s*\{\s*\.drawer\s*\{\s*width:\s*300px;\s*\}\s*\}/,
  );
  assert.match(
    css,
    /@media \(max-width:\s*360px\)\s*\{\s*\.drawer\s*\{\s*padding:\s*12px 0 0;\s*\}\s*\}/,
  );
});

test("left drawer renders at most three archived replies", async () => {
  const source = await readFile(new URL("./StudySideDrawers.tsx", import.meta.url), "utf8");

  assert.match(source, /最近三次下旨回奏/);
  assert.doesNotMatch(source, /DecreeSessionRecord|本次页面会话/);
  assert.match(source, /recentReplies\.archives\.slice\(0,\s*3\)\.map/);
  assert.match(source, /archive\.sourceText/);
  assert.match(source, /archive\.participatingDepartments/);
  assert.match(source, /archive\.replyTime/);
});

test("recent replies render as archived decree slips without inline reply details", async () => {
  const source = await readFile(new URL("./StudySideDrawers.tsx", import.meta.url), "utf8");

  assert.match(source, /className=\{styles\.decreeSlip\}/);
  assert.match(source, /className=\{styles\.bindingLine\}/);
  assert.match(source, /className=\{styles\.replySeal\}/);
  assert.match(source, /展卷阅奏/);
  assert.doesNotMatch(source, /className=\{styles\.recordDetail\}/);
  assert.doesNotMatch(source, /aria-expanded=/);
  assert.match(
    source,
    /props\.onSelectRecentReply\(archive\.id\);[\s\S]*close\("left", false\)/,
  );
});

test("left drawer keeps explicit loading, empty, error and retry states", async () => {
  const source = await readFile(new URL("./StudySideDrawers.tsx", import.meta.url), "utf8");

  assert.match(source, /正在读取最近回奏/);
  assert.match(source, /尚无已归档回奏/);
  assert.match(source, /onRetryRecentReplies/);
  assert.match(source, />重试</);
  assert.match(source, /props\.recentReplies\.message/);
  assert.match(source, />与丞相对话</);
  assert.match(source, /暂未开放/);
});

test("recent reply decree slips have dedicated styles without changing drawer tiers", async () => {
  const css = await readFile(new URL("./StudySideDrawers.module.css", import.meta.url), "utf8");

  assert.match(css, /\.decreeSlip\s*\{/);
  assert.match(css, /\.bindingLine\s*\{/);
  assert.match(css, /\.decreeSlipButton\s*\{/);
  assert.match(css, /\.openReply\s*\{/);
  assert.match(css, /\.replySeal\s*\{/);
  assert.match(css, /\.recordMeta\s*\{/);
  assert.match(css, /\.recordState\s*\{/);
  assert.match(css, /\.retryButton\s*\{/);
});

test("archived decree slips expose a concise visual summary and accessible selection intent", async () => {
  const [source, css] = await Promise.all([
    readFile(new URL("./StudySideDrawers.tsx", import.meta.url), "utf8"),
    readFile(new URL("./StudySideDrawers.module.css", import.meta.url), "utf8"),
  ]);

  assert.match(source, /className=\{styles\.recordSummary\}/);
  assert.match(source, /aria-label=\{`展卷阅奏：\$\{archive\.sourceText\}`\}/);
  assert.match(css, /\.recordSummary\s*\{[\s\S]*?line-clamp:\s*2;/);
});

test("drawer test assertions remain compatible with the ES2017 TypeScript target", async () => {
  const testSource = await readFile(new URL("./StudySideDrawers.test.ts", import.meta.url), "utf8");

  assert.doesNotMatch(testSource, /\/[dgimsuvy]*s[dgimsuvy]*[),;]/);
});

test("chancellor consultation uses opposing avatar bubbles without the disclaimer", async () => {
  const [source, css] = await Promise.all([
    readFile(new URL("./StudySideDrawers.tsx", import.meta.url), "utf8"),
    readFile(new URL("./StudySideDrawers.module.css", import.meta.url), "utf8"),
  ]);

  assert.match(source, /\/shangshufang\/portrait-chancellor\.webp/);
  assert.match(source, /\/shangshufang\/portrait-wang\.webp/);
  assert.match(source, /className=\{styles\.messageRow\}/);
  assert.match(source, /className=\{styles\.messageBubble\}/);
  assert.match(source, /data-role=\{message\.role\}/);
  assert.match(css, /\.messageRow\[data-role="user"\] \.avatar\s*\{[^}]*object-position:\s*center top;/);
  assert.doesNotMatch(source, /仅提供咨询，不代表下旨、审批、执行或归档/);
});

test("consultation messages scroll above a compact bottom composer", async () => {
  const css = await readFile(new URL("./StudySideDrawers.module.css", import.meta.url), "utf8");

  assert.match(css, /\.messages\s*\{[\s\S]*?flex:\s*1;[\s\S]*?overflow-y:\s*auto;/);
  assert.match(css, /\.chat form\s*\{[\s\S]*?flex:\s*0 0 auto;/);
  assert.match(css, /\.chat textarea\s*\{[\s\S]*?height:\s*36px;[\s\S]*?resize:\s*none;/);
});

test("compact consultation typography keeps dialogue visually secondary", async () => {
  const css = await readFile(new URL("./StudySideDrawers.module.css", import.meta.url), "utf8");

  assert.match(css, /\.messageAuthor\s*\{[^}]*font-size:\s*10px;/);
  assert.match(css, /\.messageBubble\s*\{[^}]*font-size:\s*12px;/);
  assert.match(css, /\.chat textarea\s*\{[^}]*font-size:\s*12px;/);
});

test("side drawers overlap only the quick dock top border", async () => {
  const css = await readFile(new URL("./StudySideDrawers.module.css", import.meta.url), "utf8");

  assert.match(css, /\.drawer\s*\{[^}]*z-index:\s*216;[^}]*bottom:\s*63px;/);
  assert.match(
    css,
    /@media \(max-width:\s*767px\)\s*\{[\s\S]*?\.drawer\s*\{[^}]*bottom:\s*calc\(55px \+ env\(safe-area-inset-bottom\)\);/,
  );
});

test("composer area keeps only the input height", async () => {
  const css = await readFile(new URL("./StudySideDrawers.module.css", import.meta.url), "utf8");

  assert.match(css, /\.drawer\s*\{[^}]*padding:\s*18px 0 0;/);
  assert.match(
    css,
    /\.chat form\s*\{[^}]*align-items:\s*center;[^}]*padding:\s*5px 0 0;[^}]*border-top:\s*1px solid rgba\(240,198,106,.25\);/,
  );
  assert.match(
    css,
    /@media \(max-width:\s*360px\)\s*\{\s*\.drawer\s*\{\s*padding:\s*12px 0 0;/,
  );
});

test("chat flexes to the drawer bottom instead of using percentage height math", async () => {
  const css = await readFile(new URL("./StudySideDrawers.module.css", import.meta.url), "utf8");

  assert.match(css, /\.drawer\s*\{[^}]*display:\s*flex;[^}]*flex-direction:\s*column;/);
  assert.match(css, /\.records\s*\{[^}]*flex:\s*0 0 38%;/);
  assert.match(css, /\.chat\s*\{[^}]*height:\s*auto;[^}]*flex:\s*1;/);
  assert.doesNotMatch(css, /\.chat\s*\{[^}]*height:\s*calc\(62% - 72px\)/);
});

test("consult composer matches the dock input and uses an accessible paper-plane icon", async () => {
  const [source, css] = await Promise.all([
    readFile(new URL("./StudySideDrawers.tsx", import.meta.url), "utf8"),
    readFile(new URL("./StudySideDrawers.module.css", import.meta.url), "utf8"),
  ]);

  assert.match(css, /\.chat textarea\s*\{[^}]*height:\s*36px;[^}]*padding:\s*8px 12px;[^}]*border:\s*1px solid rgba\(167,124,53,.2\);[^}]*border-radius:\s*0;[^}]*background:\s*rgba\(2,4,8,.58\);/);
  assert.match(css, /\.chat textarea:focus\s*\{[^}]*border-color:\s*#a77c35;[^}]*box-shadow:\s*none;/);
  assert.match(source, /className=\{styles\.sendButton\}/);
  assert.match(source, /aria-label="发送"/);
  assert.match(source, /<svg[\s\S]*?aria-hidden="true"/);
  assert.doesNotMatch(source, />发送<\/button>/);
});

test("consult composer sends on Enter without intercepting Shift+Enter or IME composition", async () => {
  const source = await readFile(new URL("./StudySideDrawers.tsx", import.meta.url), "utf8");

  assert.match(source, /shouldSubmitConsultKey/);
  assert.match(source, /event\.nativeEvent\.isComposing/);
  assert.match(source, /event\.preventDefault\(\)/);
});
