import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function sceneSource() {
  return readFile(new URL("./DadianScene.tsx", import.meta.url), "utf8");
}

test("dadian retains only the overview values used by its visible summary", async () => {
  const source = await sceneSource();

  assert.match(source, /createDadianViewModel/);
  assert.match(source, /view\.overview\.replyCount/);
  assert.match(source, /view\.overview\.pendingReviewCount/);
  assert.match(source, /view\.overview\.todayFocus/);
  assert.doesNotMatch(source, /view\.departmentOptions|view\.replies/);
  assert.doesNotMatch(source, /reply\.conclusion|reply\.respondent|reply\.departments/);
  assert.doesNotMatch(source, /mockDadianData|Math\.random|EventSource|BACKEND_BASE_URL|ownerId/);
});

test("dadian anchors each module arrow to the corresponding figure's head on the background asset stage", async () => {
  const source = await sceneSource();
  const css = await readFile(new URL("./DadianScene.module.css", import.meta.url), "utf8");

  assert.doesNotMatch(source, /qintianjian|钦天监/);
  for (const { id, x, y } of [
    { id: "gongbu", x: 23.4, y: 44.5 },
    { id: "hubu", x: 29.4, y: 35.3 },
    { id: "libu-personnel", x: 34.1, y: 29.7 },
    { id: "libu", x: 41.7, y: 31.4 },
    { id: "prime", x: 50.7, y: 37.0 },
    { id: "xingbu", x: 60.2, y: 31.4 },
    { id: "bingbu", x: 72.4, y: 35.2 },
    { id: "jinyiwei", x: 67.5, y: 29.3 },
    { id: "shiguan", x: 79.1, y: 44.4 },
  ]) {
    assert.match(source, new RegExp(`id: "${id}"[^\\n]*x: ${x}, y: ${y}`));
  }
  assert.match(
    css,
    /\.courtMap\s*\{[\s\S]*?position:\s*fixed[\s\S]*?inset:\s*0/,
  );
  assert.match(
    css,
    /\.hotspots\s*\{[\s\S]*?left:\s*50%[\s\S]*?top:\s*50%[\s\S]*?width:\s*max\(100vw,\s*calc\(100dvh\s*\*\s*1660\s*\/\s*947\)\)[\s\S]*?height:\s*max\(100dvh,\s*calc\(100vw\s*\*\s*947\s*\/\s*1660\)\)[\s\S]*?transform:\s*translate\(-50%,\s*-50%\)/,
  );
  assert.match(css, /\.hotspot\s*\{[\s\S]*?transform:\s*translate\(-50%,\s*calc\(-100%\s*-\s*6px\)\)/);
  assert.match(css, /\.hotspot:hover,[\s\S]*?transform:\s*translate\(-50%,\s*calc\(-100%\s*-\s*8px\)\)/);
});

test("dadian omits the department filter and latest-replies dock", async () => {
  const source = await sceneSource();
  const css = await readFile(new URL("./DadianScene.module.css", import.meta.url), "utf8");

  assert.doesNotMatch(source, /<select|filterBar|replyDock|replyList/);
  assert.doesNotMatch(source, /参与部门|最新真实回奏|暂无真实回奏/);
  assert.doesNotMatch(source, /当前大殿不提供部门统计或筛选|仅保留朝堂席位定位，不展示推测数值/);
  assert.doesNotMatch(css, /\.filterBar\s*\{|\.replyDock\s*\{|\.replyList\s*\{/);
});

test("dadian keeps the shared shell, honest states, and static court seats", async () => {
  const source = await sceneSource();
  const css = await readFile(new URL("./DadianScene.module.css", import.meta.url), "utf8");

  await access(new URL("../../../public/assets/dadian/hall-stage-tang.webp", import.meta.url));
  assert.match(source, /ImmersiveCourtShell/);
  assert.match(source, /fullBleedContent/);
  assert.match(source, /showQuickDockHandle=\{false\}/);
  assert.doesNotMatch(source, /styles\.subtitle|企业 AI 指挥中枢 · 万务一统/);
  assert.doesNotMatch(source, /styles\.eyebrow|Chaotang OS/);
  assert.match(source, /CourtCapabilityButton/);
  assert.match(source, /data-dadian-state="loading"/);
  assert.match(source, /data-dadian-state="error"/);
  assert.match(source, /data-dadian-error="nonblocking"/);
  assert.match(source, /DEV_HOTSPOTS/);
  assert.match(source, /role="tooltip"/);
  assert.doesNotMatch(source, /当前大殿不提供部门统计或筛选|仅保留朝堂席位定位，不展示推测数值/);
  assert.match(css, /@media \(max-width: 767px\)/);
  assert.match(css, /\.titleRow h1\s*\{[\s\S]*?font-size:\s*clamp\(3rem,\s*5\.25vw,\s*3\.75rem\)/);
  assert.match(css, /\.hero\s*\{[\s\S]*?top:\s*12px/);
  assert.doesNotMatch(css, /\.eyebrow(?:\s|\{|\.)/);
  assert.match(
    css,
    /\.courtMap:has\(\.hotspot:hover\),[\s\S]*?\.courtMap:has\(\.hotspot:focus-visible\),[\s\S]*?\.courtMap:has\(\.hotspot\[data-tooltip-open\]\)\s*\{[\s\S]*?z-index:\s*11/,
  );
});

test("dadian sends the enabled throne command button to the study", async () => {
  const source = await sceneSource();

  assert.match(source, /useRouter/);
  assert.match(source, /const router = useRouter\(\)/);
  assert.match(
    source,
    /capability="enabled"[\s\S]*?onClick=\{\(\) => router\.push\("\/study"\)\}/,
  );
});

test("dadian seat cards navigate to their corresponding workspaces", async () => {
  const source = await sceneSource();

  for (const { id, href } of [
    { id: "gongbu", href: "/liubu/gongbu" },
    { id: "hubu", href: "/liubu/finance" },
    { id: "libu-personnel", href: "/liubu/personnel" },
    { id: "libu", href: "/liubu/market" },
    { id: "prime", href: "/study" },
    { id: "xingbu", href: "/liubu/legal" },
    { id: "bingbu", href: "/liubu/ops" },
    { id: "jinyiwei", href: "/jinyiwei" },
    { id: "shiguan", href: "/shiguan" },
  ]) {
    assert.match(source, new RegExp(`id: "${id}"[^\\n]*href: "${href}"`));
  }
  assert.match(source, /onClick=\{\(\) => router\.push\(hotspot\.href\)\}/);
});

test("dadian seat cards explain the result of each click", async () => {
  const source = await sceneSource();

  for (const { id, action } of [
    { id: "gongbu", action: "进入工部" },
    { id: "hubu", action: "进入户部" },
    { id: "libu-personnel", action: "进入吏部" },
    { id: "libu", action: "进入礼部" },
    { id: "prime", action: "前往上书房" },
    { id: "xingbu", action: "进入刑部" },
    { id: "bingbu", action: "进入兵部" },
    { id: "jinyiwei", action: "查阅案卷" },
    { id: "shiguan", action: "查阅归档" },
  ]) {
    assert.match(source, new RegExp(`id: "${id}"[^\\n]*actionLabel: "${action}"`));
  }
  assert.match(source, /aria-label=\{`\$\{hotspot\.label\}：\$\{hotspot\.actionLabel\}`\}/);
  assert.match(source, /\{hotspot\.actionLabel\}/);
  assert.doesNotMatch(source, /席位展示/);
});

test("today-focus card sits 20px from the desktop left edge without changing the mobile layout", async () => {
  const css = await readFile(new URL("./DadianScene.module.css", import.meta.url), "utf8");
  const desktopCard = css.match(/\.focusCard\s*\{([^}]*)\}/)?.[1];

  assert.ok(desktopCard, "desktop focus-card rule must exist");
  assert.match(desktopCard, /left:\s*20px/);
  assert.match(css, /@media \(max-width: 767px\)[\s\S]*?\.focusCard\s*\{[^}]*left:\s*auto/);
});
