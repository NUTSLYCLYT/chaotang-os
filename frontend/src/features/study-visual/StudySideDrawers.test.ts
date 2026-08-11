import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("both adviser drawers use the same shared visual shell", async () => {
  const source = await readFile(new URL("./StudySideDrawers.tsx", import.meta.url), "utf8");
  assert.match(source, /import \{ AdvisorDrawerShell \}/);
  assert.equal((source.match(/<AdvisorDrawerShell/g) ?? []).length, 2);
  assert.match(source, /side="left"/);
  assert.match(source, /side="right"/);
});

test("side drawers expose accessible triggers, close controls, Escape and no fetch", async () => {
  const source = await readFile(new URL("./StudySideDrawers.tsx", import.meta.url), "utf8");
  assert.match(source, /event\.key === "Escape"/);
  assert.match(source, /aria-label=\{leftToggleLabel\}/);
  assert.match(source, /aria-label=\{rightToggleLabel\}/);
  assert.doesNotMatch(source, /closeButtonRef=|onClose=\{\(\) => close/);
  assert.doesNotMatch(source, /\bfetch\s*\(/);
});

test("right drawer keeps responsive motion after becoming available", async () => {
  const shellCss = await readFile(new URL("./AdvisorDrawerShell.module.css", import.meta.url), "utf8");
  const panel = await readFile(new URL("./QintianPanel.tsx", import.meta.url), "utf8");
  assert.match(panel, /data-qintian-workspace-mode/);
  assert.match(shellCss, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(shellCss, /overflow-y: auto/);
});

test("side drawer background matches the court bottom dock", async () => {
  const [drawerCss, dockCss] = await Promise.all([
    readFile(new URL("./AdvisorDrawerShell.module.css", import.meta.url), "utf8"),
    readFile(new URL("../court-visuals/CourtQuickDock.module.css", import.meta.url), "utf8"),
  ]);
  const drawerRule = drawerCss.match(/\.shell\s*\{([^}]*)\}/)?.[1] ?? "";
  const dockRule = dockCss.match(/\.dock\s*\{([^}]*)\}/)?.[1] ?? "";
  const background = (rule: string) =>
    rule.match(/background:\s*([^;]+);/)?.[1].replace(/\s+/g, " ").trim();

  assert.equal(
    background(drawerRule)?.replace("0.90", "0.9"),
    background(dockRule),
  );
});

test("right drawer renders the qintian decision radar with provenance", async () => {
  const source = await readFile(new URL("./StudySideDrawers.tsx", import.meta.url), "utf8");
  assert.match(source, /qintianRadar: QintianDecisionRadarView/);
  assert.match(source, /<QintianPanel/);
  assert.match(source, /radar=\{props\.qintianRadar\}/);
  assert.match(source, /renderLayout=\{\(body, footer\)/);
});

test("side drawers preserve the dev responsive width tiers", async () => {
  const shellCss = await readFile(
    new URL("./AdvisorDrawerShell.module.css", import.meta.url),
    "utf8",
  );
  const triggerCss = await readFile(
    new URL("./StudySideDrawers.module.css", import.meta.url),
    "utf8",
  );

  assert.match(shellCss, /\.shell\s*\{[^}]*--advisor-drawer-width:\s*44vw;/);
  assert.match(triggerCss, /\.trigger\s*\{[^}]*--advisor-drawer-width:\s*44vw;/);
  assert.match(
    shellCss,
    /\.shell\s*\{[\s\S]*?width:\s*var\(--advisor-drawer-width\);[\s\S]*?max-width:\s*100vw;/,
  );
  for (const css of [shellCss, triggerCss]) {
    assert.match(
      css,
      /@media \(min-width:\s*640px\)[^{]*\{[\s\S]*?--advisor-drawer-width:\s*260px;/,
    );
    assert.match(
      css,
      /@media \(min-width:\s*1024px\)[^{]*\{[\s\S]*?--advisor-drawer-width:\s*300px;/,
    );
  }
});

test("left drawer renders at most three archived replies", async () => {
  const source = await readFile(new URL("./StudySideDrawers.tsx", import.meta.url), "utf8");

  assert.match(source, /最近三次下旨回奏/);
  assert.doesNotMatch(source, /DecreeSessionRecord|本次页面会话/);
  assert.match(source, /recentReplies\.archives\.slice\(0,\s*3\)\.map/);
  assert.match(source, /archive\.sourceText/);
  assert.match(source, /archive\.participatingDepartments/);
  assert.match(source, /formatBusinessTime\(archive\.replyTime\)/);
});

test("recent replies render as archived decree slips without inline reply details", async () => {
  const source = await readFile(new URL("./StudySideDrawers.tsx", import.meta.url), "utf8");

  assert.match(source, /className=\{styles\.decreeSlip\}/);
  assert.match(source, /className=\{styles\.bindingLine\}/);
  assert.match(source, /className=\{styles\.replySeal\}/);
  assert.match(source, /展卷阅奏/);
  assert.doesNotMatch(source, /className=\{styles\.recordDetail\}/);
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
  assert.match(source, /context=\{props\.qintianContext\}/);
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

  assert.match(source, /\/heroes\/character-roster\/v5-command-center-zhuge-liang\.webp/);
  assert.match(source, /\/shangshufang\/portrait-wang\.webp/);
  assert.match(source, /className=\{styles\.messageRow\}/);
  assert.match(source, /className=\{styles\.messageBubble\}/);
  assert.match(source, /data-role=\{message\.role\}/);
  assert.match(css, /\.messageRow\[data-role="user"\] \.avatar\s*\{[^}]*object-position:\s*center top;/);
  assert.doesNotMatch(source, /仅提供咨询，不代表下旨、审批、执行或归档/);
});

test("consultation messages scroll above a compact bottom composer", async () => {
  const [css, shellCss] = await Promise.all([
    readFile(new URL("./StudySideDrawers.module.css", import.meta.url), "utf8"),
    readFile(new URL("./AdvisorDrawerShell.module.css", import.meta.url), "utf8"),
  ]);

  assert.match(css, /\.messages\s*\{[^}]*min-height:\s*0;[^}]*flex:\s*1 1 auto;[^}]*overflow-y:\s*auto;/);
  assert.match(css, /\.chat form\s*\{[\s\S]*?flex:\s*0 0 auto;/);
  assert.match(shellCss, /\.composerInput\s*\{[^}]*height:\s*32px;[^}]*resize:\s*none;/);
});

test("compact consultation typography keeps dialogue visually secondary", async () => {
  const css = await readFile(new URL("./StudySideDrawers.module.css", import.meta.url), "utf8");

  assert.match(css, /\.messageAuthor\s*\{[^}]*font-size:\s*10px;/);
  assert.match(css, /\.messageBubble\s*\{[^}]*font-size:\s*12px;/);
  const shellCss = await readFile(new URL("./AdvisorDrawerShell.module.css", import.meta.url), "utf8");
  assert.match(shellCss, /\.composerInput\s*\{[^}]*font-size:\s*12px;/);
});

test("chat fills the bounded shell footer without percentage height math", async () => {
  const css = await readFile(new URL("./StudySideDrawers.module.css", import.meta.url), "utf8");
  assert.match(css, /\.chat\s*\{[^}]*height:\s*100%;[^}]*min-height:\s*0;[^}]*flex-direction:\s*column;/);
  assert.doesNotMatch(css, /height:\s*calc\(/);
});

test("consult composer matches the dock input and uses an accessible paper-plane icon", async () => {
  const [source, css] = await Promise.all([
    readFile(new URL("./StudySideDrawers.tsx", import.meta.url), "utf8"),
    readFile(new URL("./AdvisorDrawerShell.module.css", import.meta.url), "utf8"),
  ]);

  assert.match(css, /\.composerInput\s*\{[^}]*height:\s*32px;[^}]*border:\s*1px solid rgba\(240,198,106,.16\);/);
  assert.match(css, /\.composerInput:focus,[\s\S]*var\(--chat-accent\) 52%/);
  assert.match(source, /advisorStyles\.composerButton/);
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

test("qintian drawer opens from the shared dock hash target", async () => {
  const [drawerSource, dockSource] = await Promise.all([
    readFile(new URL("./StudySideDrawers.tsx", import.meta.url), "utf8"),
    readFile(new URL("../court-visuals/CourtQuickDock.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(dockSource, /href="\/study#qintian"/);
  assert.match(drawerSource, /window\.location\.hash === "#qintian"/);
  assert.match(drawerSource, /window\.addEventListener\("hashchange"/);
});

test("both advisers use the shared portrait header and two-zone drawer rhythm", async () => {
  const [source, shell] = await Promise.all([
    readFile(new URL("./StudySideDrawers.tsx", import.meta.url), "utf8"),
    readFile(new URL("./AdvisorDrawerShell.tsx", import.meta.url), "utf8"),
  ]);

  assert.equal((source.match(/<AdvisorDrawerShell/g) ?? []).length, 2);
  assert.match(source, /footer=\{footer\}/);
  assert.match(shell, /data-advisor-region="body"/);
  assert.match(shell, /data-advisor-region="footer"/);
});

test("drawer controller retains closing panels and measures the app content region", async () => {
  const source = await readFile(new URL("./StudySideDrawers.tsx", import.meta.url), "utf8");
  assert.match(source, /closing/);
  assert.match(source, /onAnimationEnd=\{\(\) => finishClose/);
  assert.match(source, /document\.querySelector<HTMLElement>\('\[data-layout-region="content"\]'\)/);
  assert.match(source, /getBoundingClientRect\(\)/);
  assert.match(source, /new ResizeObserver\(measureBounds\)/);
  assert.match(source, /window\.addEventListener\("resize", measureBounds\)/);
  assert.match(source, /bounds=\{drawerBounds\}/);
});

test("edge toggles consume the drawer lifecycle and reverse direction while active", async () => {
  const source = await readFile(new URL("./StudySideDrawers.tsx", import.meta.url), "utf8");
  assert.match(source, /const leftActive = rendered === "left"/);
  assert.match(source, /const rightActive = rendered === "right"/);
  assert.match(source, /data-drawer-side="left"/);
  assert.match(source, /data-drawer-side="right"/);
  assert.match(source, /data-drawer-phase=\{leftActive \? phase : "closed"\}/);
  assert.match(source, /data-drawer-phase=\{rightActive \? phase : "closed"\}/);
  assert.equal((source.match(/className=\{styles\.triggerArrow\}/g) ?? []).length, 2);
  assert.match(source, /leftOpen \? \(\) => close\("left"\) :/);
  assert.match(source, /rightOpen \? \(\) => close\("right"\) :/);
});

test("edge toggles share drawer widths and directional animation timings", async () => {
  const [shellCss, drawerCss] = await Promise.all([
    readFile(new URL("./AdvisorDrawerShell.module.css", import.meta.url), "utf8"),
    readFile(new URL("./StudySideDrawers.module.css", import.meta.url), "utf8"),
  ]);
  assert.match(shellCss, /--advisor-drawer-width:\s*44vw/);
  assert.match(shellCss, /width:\s*var\(--advisor-drawer-width\)/);
  assert.match(shellCss, /@media \(min-width:\s*640px\)[^}]*--advisor-drawer-width:\s*260px/);
  assert.match(shellCss, /@media \(min-width:\s*1024px\)[^}]*--advisor-drawer-width:\s*300px/);
  assert.match(drawerCss, /@keyframes toggleFromLeft/);
  assert.match(drawerCss, /@keyframes toggleFromRight/);
  assert.match(drawerCss, /@keyframes toggleToLeft/);
  assert.match(drawerCss, /@keyframes toggleToRight/);
  assert.match(drawerCss, /animation-duration:\s*var\(--advisor-drawer-open-duration\)/);
  assert.match(drawerCss, /\[data-drawer-phase="closing"\][^}]*animation-duration:\s*var\(--advisor-drawer-close-duration\)/);
  assert.match(drawerCss, /var\(--advisor-drawer-width\)/);
});

test("both edge toggles share the measured drawer vertical center with a 50 percent fallback", async () => {
  const source = await readFile(new URL("./StudySideDrawers.tsx", import.meta.url), "utf8");
  assert.match(
    source,
    /const drawerToggleTop = drawerBounds\s*\?\s*drawerBounds\.top \+ drawerBounds\.height \/ 2\s*:\s*"50%"/,
  );
  assert.equal(
    (source.match(/style=\{\{ top: drawerToggleTop \}\}/g) ?? []).length,
    2,
  );
});

test("shell and toggles consume one motion contract with matching directional geometry", async () => {
  const [shellCss, drawerCss] = await Promise.all([
    readFile(new URL("./AdvisorDrawerShell.module.css", import.meta.url), "utf8"),
    readFile(new URL("./StudySideDrawers.module.css", import.meta.url), "utf8"),
  ]);
  for (const declaration of [
    /--advisor-drawer-open-duration:\s*720ms/,
    /--advisor-drawer-close-duration:\s*420ms/,
    /--advisor-drawer-easing:\s*cubic-bezier\(0\.16,\s*1,\s*0\.3,\s*1\)/,
  ]) {
    assert.match(shellCss, declaration);
  }
  for (const css of [shellCss, drawerCss]) {
    assert.match(css, /var\(--advisor-drawer-open-duration\)/);
    assert.match(css, /var\(--advisor-drawer-close-duration\)/);
    assert.match(css, /var\(--advisor-drawer-easing\)/);
  }
  assert.match(shellCss, /drawerFromLeft[^}]*translateX\(-100%\)[\s\S]*?translateX\(0\)/);
  assert.match(shellCss, /drawerToLeft[^}]*translateX\(0\)[\s\S]*?translateX\(-100%\)/);
  assert.match(shellCss, /drawerFromRight[^}]*translateX\(100%\)[\s\S]*?translateX\(0\)/);
  assert.match(shellCss, /drawerToRight[^}]*translateX\(0\)[\s\S]*?translateX\(100%\)/);
  assert.match(drawerCss, /toggleFromLeft[^}]*left:\s*0[\s\S]*?left:\s*var\(--advisor-drawer-width\)/);
  assert.match(drawerCss, /toggleToLeft[^}]*left:\s*var\(--advisor-drawer-width\)[\s\S]*?left:\s*0/);
  assert.match(drawerCss, /toggleFromRight[^}]*right:\s*0[\s\S]*?right:\s*var\(--advisor-drawer-width\)/);
  assert.match(drawerCss, /toggleToRight[^}]*right:\s*var\(--advisor-drawer-width\)[\s\S]*?right:\s*0/);
});

test("closing retention ends from the shared CSS animation rather than a duplicate JavaScript clock", async () => {
  const source = await readFile(new URL("./StudySideDrawers.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /DRAWER_CLOSE_MS|setTimeout|closeTimerRef/);
  assert.match(source, /function finishClose\(side: StudyDrawerSide\)/);
  assert.match(source, /if \(closing !== side\) return/);
  assert.equal(
    (source.match(/onAnimationEnd=\{\(\) => finishClose\("(?:left|right)"\)\}/g) ?? []).length,
    2,
  );
});

test("edge toggles render the approved jade pivot without text glyphs", async () => {
  const [source, css] = await Promise.all([
    readFile(new URL("./StudySideDrawers.tsx", import.meta.url), "utf8"),
    readFile(new URL("./StudySideDrawers.module.css", import.meta.url), "utf8"),
  ]);
  assert.equal((source.match(/className=\{styles\.triggerIcon\}/g) ?? []).length, 2);
  assert.equal((source.match(/className=\{styles\.triggerArrow\}/g) ?? []).length, 2);
  assert.equal((source.match(/aria-hidden="true"/g) ?? []).length >= 2, true);
  assert.match(source, /aria-expanded=\{leftOpen\}/);
  assert.match(source, /aria-expanded=\{rightOpen\}/);
  assert.match(source, /aria-controls="chancellor-advisor-drawer"/);
  assert.match(source, /aria-controls="qintian-advisor-drawer"/);
  assert.doesNotMatch(source, />\{leftActive \?/);
  assert.doesNotMatch(source, />\{rightActive \?/);

  assert.match(css, /\.trigger\s*\{[^}]*width:\s*35px;[^}]*height:\s*68px;/);
  assert.match(css, /\.triggerIcon\s*\{[^}]*width:\s*15px;[^}]*height:\s*15px;/);
  assert.match(css, /\.leftTrigger\s*\{[^}]*border-radius:\s*0 18px 18px 0;/);
  assert.match(css, /\.rightTrigger\s*\{[^}]*border-radius:\s*18px 0 0 18px;/);
  assert.match(css, /\.trigger:focus-visible\s*\{[^}]*outline:\s*none;/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*animation-duration:\s*\.01ms !important/);
});

test("edge toggle aria controls resolve to the rendered advisor dialog ids", async () => {
  const source = await readFile(new URL("./StudySideDrawers.tsx", import.meta.url), "utf8");
  assert.match(source, /aria-controls="chancellor-advisor-drawer"/);
  assert.match(source, /id="chancellor-advisor-drawer"/);
  assert.match(source, /aria-controls="qintian-advisor-drawer"/);
  assert.match(source, /id="qintian-advisor-drawer"/);
});

test("closing retention exposes reopen semantics and cancels closing when clicked", async () => {
  const [source, css] = await Promise.all([
    readFile(new URL("./StudySideDrawers.tsx", import.meta.url), "utf8"),
    readFile(new URL("./StudySideDrawers.module.css", import.meta.url), "utf8"),
  ]);
  assert.match(source, /const leftOpen = open === "left"/);
  assert.match(source, /const rightOpen = open === "right"/);
  assert.match(source, /aria-expanded=\{leftOpen\}/);
  assert.match(source, /aria-expanded=\{rightOpen\}/);
  assert.match(source, /const leftToggleLabel = leftOpen \?/);
  assert.match(source, /const rightToggleLabel = rightOpen \?/);
  assert.match(source, /onClick=\{leftOpen \? \(\) => close\("left"\) :/);
  assert.match(source, /onClick=\{rightOpen \? \(\) => close\("right"\) :/);
  assert.match(source, /function openDrawer[^]*setClosing\(null\)[^]*setOpen\(side\)/);
  assert.doesNotMatch(css, /\.leftTrigger\[data-drawer-phase="closing"\] \.triggerArrow/);
  assert.doesNotMatch(css, /\.rightTrigger\[data-drawer-phase="closing"\] \.triggerArrow/);
});

test("chancellor uses the exact dev portrait asset", async () => {
  const source = await readFile(new URL("./StudySideDrawers.tsx", import.meta.url), "utf8");
  assert.match(source, /portrait="\/heroes\/character-roster\/v5-command-center-zhuge-liang\.webp"/);
});

test("legacy drawer rules and competing composer declarations are gone", async () => {
  const [drawerCss, qintianCss] = await Promise.all([
    readFile(new URL("./StudySideDrawers.module.css", import.meta.url), "utf8"),
    readFile(new URL("./QintianPanel.module.css", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(drawerCss, /\.drawer(?:\s|\{|Header|Workspace|Conversation)/);
  assert.doesNotMatch(drawerCss, /\.chat textarea/);
  assert.doesNotMatch(qintianCss, /\.chatForm textarea/);
});
