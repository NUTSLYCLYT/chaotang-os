import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

test("dadian scene renders only values supplied by the real overview adapter", async () => {
  const source = await readFile(new URL("./DadianScene.tsx", import.meta.url), "utf8");

  assert.match(source, /createDadianViewModel/);
  assert.match(source, /view\.overview\.replyCount/);
  assert.match(source, /view\.overview\.pendingReviewCount/);
  assert.match(source, /view\.overview\.todayFocus/);
  assert.match(source, /view\.departmentOptions/);
  assert.match(source, /view\.replies/);
  assert.match(source, /reply\.conclusion/);
  assert.match(source, /reply\.respondent/);
  assert.match(source, /reply\.departments/);
  assert.doesNotMatch(
    source,
    /mockDadianData|Math\.random|useSWR|SWR|refreshInterval|EventSource|\/api\/court|BACKEND_BASE_URL|ownerId/,
  );
});

test("dadian scene uses the shared immersive shell and exposes honest data states", async () => {
  const source = await readFile(new URL("./DadianScene.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("./DadianScene.module.css", import.meta.url), "utf8");

  await access(
    new URL("../../../public/assets/dadian/hall-stage-tang.webp", import.meta.url),
  );
  assert.match(source, /ImmersiveCourtShell/);
  assert.match(source, /CourtCapabilityButton/);
  assert.match(source, /\/assets\/dadian\/hall-stage-tang\.webp/);
  assert.match(source, /data-dadian-state="loading"/);
  assert.match(source, /data-dadian-state="error"/);
  assert.match(source, /data-dadian-state=\{view\.state\}/);
  assert.match(source, /role="alert"/);
  assert.match(source, /data-dadian-error="nonblocking"/);
  assert.match(source, /aria-live="polite"/);
  assert.match(source, /capability="unavailable"/);
  assert.match(source, /当前大殿仅提供真实回奏概览/);
  assert.match(css, /overflow-wrap:\s*anywhere/);
  assert.match(css, /@media \(max-width: 767px\)/);
});

test("desktop court restores positioned minister hotspots, tooltips, and cloud flourishes", async () => {
  const source = await readFile(new URL("./DadianScene.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("./DadianScene.module.css", import.meta.url), "utf8");

  assert.match(source, /DEV_HOTSPOTS/);
  for (const label of ["工部", "户部", "吏部", "礼部", "刑部", "丞相", "兵部", "锦衣卫", "钦天监", "史馆"]) {
    assert.match(source, new RegExp(`label: "${label}"`));
  }
  assert.doesNotMatch(source, /label: "史部"/);
  assert.match(source, /x: 21\.7,\s*y: 38\.6/);
  assert.match(source, /x: 50\.7,\s*y: 28\.6/);
  assert.match(source, /x: 79\.5,\s*y: 38\.6/);
  assert.match(source, /--hotspot-x/);
  assert.match(source, /--hotspot-y/);
  assert.match(source, /role="tooltip"/);
  assert.match(source, /aria-describedby/);
  assert.match(source, /CloudFlourish/);
  assert.match(source, /viewBox="0 0 120 40"/);
  assert.match(css, /\.hotspot\s*\{[^}]*position:\s*absolute/);
  assert.match(css, /\.hotspot:hover[\s\S]*?\.hotspot:focus-visible/);
  assert.match(css, /\.hotspot:hover[\s\S]*?\.hotspotTooltip/);
  assert.match(
    css,
    /@media \(max-width: 767px\)[\s\S]*?\.hotspot\s*\{[^}]*position:\s*relative/,
  );
});

test("non-department dev hotspots disclose unavailable metrics instead of fabricating counts", async () => {
  const source = await readFile(new URL("./DadianScene.tsx", import.meta.url), "utf8");

  assert.match(source, /kind: "unavailable"/);
  assert.match(source, /暂无数据/);
  assert.match(source, /当前接口未提供该席位指标/);
  assert.doesNotMatch(source, /\?\.count \?\? 0/);
  assert.doesNotMatch(source, /Math\.random|运行中|会辅中|已上奏|待命/);
});

test("real filters and replies remain visibly rendered rather than visually clipped", async () => {
  const source = await readFile(new URL("./DadianScene.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("./DadianScene.module.css", import.meta.url), "utf8");
  const declarations = (selector: string) => {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`))?.[1];
    assert.ok(match, `${selector} rule must exist`);
    return match;
  };

  assert.match(source, /<select/);
  assert.match(source, /view\.departmentOptions\.map/);
  assert.match(source, /最新真实回奏/);
  assert.match(source, /暂无真实回奏/);
  for (const selector of [".filterBar", ".replyDock"]) {
    const rule = declarations(selector);
    assert.doesNotMatch(rule, /(?:width|height):\s*1px/);
    assert.doesNotMatch(rule, /clip(?:-path)?:/);
    assert.doesNotMatch(rule, /overflow:\s*hidden/);
  }
});

test("real reply conclusions wrap in full without line clamping or clipping", async () => {
  const css = await readFile(new URL("./DadianScene.module.css", import.meta.url), "utf8");
  const replyParagraphRule = css.match(/\.replyList p\s*\{([^}]*)\}/)?.[1];

  assert.ok(replyParagraphRule, "reply conclusion rule must exist");
  assert.match(replyParagraphRule, /overflow-wrap:\s*anywhere/);
  assert.match(replyParagraphRule, /white-space:\s*normal/);
  assert.doesNotMatch(replyParagraphRule, /overflow:\s*hidden/);
  assert.doesNotMatch(replyParagraphRule, /line-clamp/);
});

test("hotspot layer stays above the focus card without blocking the whole court map", async () => {
  const css = await readFile(new URL("./DadianScene.module.css", import.meta.url), "utf8");
  const rule = (selector: string) => {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const declarations = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`))?.[1];
    assert.ok(declarations, `${selector} rule must exist`);
    return declarations;
  };
  const numericZIndex = (declarations: string, selector: string) => {
    const value = declarations.match(/z-index:\s*(\d+)/)?.[1];
    assert.ok(value, `${selector} must use a numeric z-index`);
    return Number(value);
  };

  const focusCard = rule(".focusCard");
  const hotspotLayer = rule(".hotspots");
  const hotspotButton = rule(".hotspot");

  assert.ok(
    numericZIndex(hotspotLayer, ".hotspots") >
      numericZIndex(focusCard, ".focusCard"),
    "positioned hotspots and their tooltips must paint above the focus card",
  );
  assert.match(hotspotLayer, /pointer-events:\s*none/);
  assert.match(hotspotButton, /pointer-events:\s*auto/);
});
