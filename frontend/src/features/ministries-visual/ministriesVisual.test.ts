import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (name: string) => readFile(new URL(name, import.meta.url), "utf8");

test("all ministry scenes consume real replies without writes or false live state", async () => {
  const sources = await Promise.all([
    read("./MinistryOverviewClient.tsx"),
    read("./ministriesController.ts"),
    read("./MinistryOverviewScene.tsx"),
    read("./DepartmentScene.tsx"),
    read("./OfficeScene.tsx"),
  ]);
  const combined = sources.join("\n");
  assert.match(combined, /\/api\/shiguan\/archives\?type=REPLY&limit=100/);
  assert.match(combined, /ReplyCaseView/);
  assert.match(combined, /CourtCapabilityButton/);
  assert.match(combined, /capability="unavailable"/);
  assert.match(combined, /ImmersiveCourtShell/);
  assert.doesNotMatch(
    combined,
    /ownerId|BACKEND_BASE_URL|EventSource|setInterval|Math\.random|method:\s*["'](?:POST|PUT|PATCH|DELETE)/,
  );
});

test("office scene refuses to infer office opinion from a department REPLY", async () => {
  const source = await read("./OfficeScene.tsx");
  assert.match(source, /data-office-opinion-state="not-recorded"/);
  assert.match(source, /逐司明细未记录/);
  assert.match(source, /不能据此推断本司意见/);
  assert.doesNotMatch(source, /本司意见[：:]/);
});

test("routes authenticate before resolving canonical slugs and call notFound", async () => {
  const routes = await Promise.all([
    read("../../app/liubu/page.tsx"),
    read("../../app/liubu/[code]/page.tsx"),
    read("../../app/liubu/[code]/[office]/page.tsx"),
  ]);
  assert.match(routes[0], /requireUser\("\/liubu"\)/);
  assert.ok(routes[1].indexOf("requireUser(") < routes[1].indexOf("resolveMinistryRoute("));
  assert.ok(routes[2].indexOf("requireUser(") < routes[2].indexOf("resolveMinistryRoute("));
  assert.match(routes[1], /notFound\(\)/);
  assert.match(routes[2], /notFound\(\)/);
  assert.doesNotMatch(routes.join("\n"), new RegExp("department-" + "demo"));
});

test("department and office use shared edict and explicit read states", async () => {
  const primitive = await read("./DepartmentVisualPrimitives.tsx");
  const scenes = (
    await Promise.all([read("./DepartmentScene.tsx"), read("./OfficeScene.tsx")])
  ).join("\n");
  const css = await read("./ministries.module.css");
  assert.match(primitive, /from\s+["']\.\.\/court-visuals\/edict\/EdictStage["']/);
  assert.match(primitive, /<EdictStage\b/);
  assert.match(scenes, /status === "loading"/);
  assert.match(scenes, /status === "error"/);
  assert.match(scenes, /status === "empty"/);
  assert.match(scenes, /status === "ready"/);
  assert.match(scenes, /重试读取/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /@media \(max-width: 767px\)/);
  assert.match(css, /overflow-wrap:\s*anywhere/);
  assert.doesNotMatch(css, /line-clamp/);
});

test("overview locks the dev canvas, hotspots and selected office rail", async () => {
  const source = await read("./MinistryOverviewScene.tsx");
  const css = await read("./ministries.module.css");
  assert.match(source, /CANVAS_WIDTH\s*=\s*1672/);
  assert.match(source, /CANVAS_HEIGHT\s*=\s*941/);
  assert.match(source, /TOP_CROP\s*=\s*52/);
  assert.match(source, /ResizeObserver/);
  assert.match(
    source,
    /personnel:\s*\{\s*left:\s*320,\s*top:\s*125,\s*width:\s*240,\s*height:\s*110\s*\}/,
  );
  assert.match(source, /market:\s*"礼部 · 品牌客户域"/);
  assert.match(source, /data-ministry-hotspot/);
  assert.match(source, /data-selected-ministry-rail/);
  assert.doesNotMatch(source, /12\.8\s*亿|2,480|8,952|3,682|128\s*个/);
  assert.match(css, /\.canvas\s*\{[\s\S]*?aspect-ratio:\s*1672\s*\/\s*941/);
  assert.match(css, /\.ministryHotspot\s*\{[\s\S]*?position:\s*absolute/);
});

test("department and office preserve independent three-axis rails and labelled central edicts", async () => {
  const department = await read("./DepartmentScene.tsx");
  const office = await read("./OfficeScene.tsx");
  const css = await read("./ministries.module.css");
  for (const source of [department, office]) {
    assert.match(source, /data-left-rail/);
    assert.match(source, /data-central-memorial/);
    assert.match(source, /data-right-rail/);
    assert.doesNotMatch(source, /<main\b/);
    assert.match(
      source,
      /<section[^>]*data-central-memorial[^>]*aria-labelledby=|<section[^>]*aria-labelledby=[^>]*data-central-memorial/,
    );
  }
  assert.match(department, /data-department-three-columns/);
  assert.match(office, /data-office-three-columns/);
  assert.match(department, /id="department-memorial-heading"/);
  assert.match(office, /id="office-memorial-heading"/);
  assert.match(
    css,
    /\.departmentThreeAxis\s*\{[\s\S]*?grid-template-columns:\s*300px\s+minmax\(520px,\s*1fr\)\s+330px/,
  );
  assert.match(
    css,
    /@media \(max-width: 767px\)[\s\S]*?\.departmentThreeAxis\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/,
  );
});

test("production scenes forbid inferred live status and misleading actor labels", async () => {
  const production = (
    await Promise.all([
      read("./MinistryOverviewScene.tsx"),
      read("./DepartmentScene.tsx"),
      read("./OfficeScene.tsx"),
      read("../junjichu-visual/JunjichuScene.tsx"),
    ])
  ).join("\n");
  assert.doesNotMatch(
    production,
    /LIVE_DEPARTMENTS|真\s*·\s*LIVE|筹备中|大臣|参与官署|真部门/,
  );
  assert.match(production, /projectMinistryReplies/);
  assert.match(production, /projectJunjichuFacts/);
});

test("all ministry scenes render four explicit projected read states", async () => {
  const sources = await Promise.all([
    read("./MinistryOverviewScene.tsx"),
    read("./DepartmentScene.tsx"),
    read("./OfficeScene.tsx"),
  ]);
  for (const source of sources) {
    assert.match(source, /status === "loading"/);
    assert.match(source, /status === "error"/);
    assert.match(source, /status === "empty"/);
    assert.match(source, /status === "ready"/);
    assert.match(source, /重试读取/);
  }
});
