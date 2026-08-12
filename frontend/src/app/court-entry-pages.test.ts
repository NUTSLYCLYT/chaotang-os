import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pages = [
  ["dadian/page.tsx", "/dadian", undefined, /DadianOverviewClient/, /DadianOverviewClient/],
  ["junjichu/page.tsx", "/junjichu", undefined, /JunjichuClient/, /JunjichuClient/],
  ["command-center/page.tsx", "/command-center", "指挥中心", /CourtPlaceholderPage/, /CourtShell/],
  ["liubu/page.tsx", "/liubu", undefined, /MinistryOverviewClient/, /MinistryOverviewClient/],
  ["liubu/[code]/page.tsx", "/liubu/", undefined, /MinistryOverviewClient/, /MinistryOverviewClient/],
  ["liubu/[code]/[office]/page.tsx", "/liubu/", undefined, /MinistryOverviewClient/, /MinistryOverviewClient/],
  ["shiguan/page.tsx", "/shiguan", undefined, /ShiguanClient/, /ShiguanClient/],
  ["study/page.tsx", "/study", undefined, /StudyClient/, /StudyClient/],
  ["zhuanshu/page.tsx", "/zhuanshu", "专署", /ZhuanshuEntryPage/, /CourtShell/],
  ["zhuanshu/jinyiwei/page.tsx", "/zhuanshu/jinyiwei", "锦衣卫", /JinyiweiScrollDesk/, /CourtShell/],
  ["zhuanshu/jinyiwei/[signalId]/page.tsx", "/zhuanshu/jinyiwei/", undefined, /CourtPlaceholderPage/, /CourtShell/],
] as const;

test("court entries are server-protected migrated views or visual placeholders", async () => {
  for (const [file, path, name, expectedView, expectedShell] of pages) {
    const source = await readFile(new URL(`./${file}`, import.meta.url), "utf8");
    assert.match(source, /^import \{ requireUser \} from "[^"]+\/requireUser";\r?$/m);
    const directGuards = source.match(
      /^\s{2}(?:const \w+ = )?await requireUser\((?:routeSegment|"[^"]+")\);\r?$/gm,
    );
    assert.equal(directGuards?.length, 1, `${file} must execute exactly one direct requireUser guard`);
    assert.ok(
      source.indexOf(directGuards[0]) < source.indexOf("return "),
      `${file} must authenticate before rendering`,
    );
    assert.match(source, new RegExp(path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(source, expectedShell);
    assert.match(source, expectedView);
    if (name) assert.match(source, new RegExp(name));
    assert.doesNotMatch(source, /fetch\(|"use client"/);
  }
});

test("Dadian delegates its immersive shell to DadianScene and rejects the old placeholder", async () => {
  const page = await readFile(new URL("./dadian/page.tsx", import.meta.url), "utf8");
  const scene = await readFile(
    new URL("../features/dadian-visual/DadianScene.tsx", import.meta.url),
    "utf8",
  );

  assert.match(page, /DadianOverviewClient/);
  assert.doesNotMatch(page, /CourtShell|CourtPlaceholderPage|variant="dadian"/);
  assert.match(scene, /ImmersiveCourtShell/);
});

test("junjichu and liubu routes delegate to their read-only controllers", async () => {
  const junjichuSource = await readFile(new URL("./junjichu/page.tsx", import.meta.url), "utf8");
  const liubuSources = (
    await Promise.all([
      readFile(new URL("./liubu/page.tsx", import.meta.url), "utf8"),
      readFile(new URL("./liubu/[code]/page.tsx", import.meta.url), "utf8"),
      readFile(new URL("./liubu/[code]/[office]/page.tsx", import.meta.url), "utf8"),
    ])
  ).join("\n");

  assert.match(junjichuSource, /JunjichuClient/);
  assert.doesNotMatch(junjichuSource, /CourtPlaceholderPage/);
  assert.match(liubuSources, /MinistryOverviewClient|resolveMinistryRoute/);
  assert.doesNotMatch(liubuSources, /department-demo|DepartmentDemo/);
});

test("Shiguan and Study entries delegate to their migrated workspace clients", async () => {
  const shiguanClient = await readFile(new URL("./shiguan/ShiguanClient.tsx", import.meta.url), "utf8");
  const studyClient = await readFile(new URL("./study/StudyClient.tsx", import.meta.url), "utf8");

  assert.match(shiguanClient, /import\s+\{\s*ShiguanWorkspace\s*\}/);
  assert.match(shiguanClient, /<ShiguanWorkspace\b/);
  assert.match(studyClient, /import\s+\{\s*DevStudyWorkspace\s*\}/);
  assert.match(studyClient, /<DevStudyWorkspace\b/);
});

test("Zhuanshu restores the dev entry into the protected Jinyiwei desk", async () => {
  const page = await readFile(new URL("./zhuanshu/page.tsx", import.meta.url), "utf8");
  const entry = await readFile(
    new URL("../features/zhuanshu-visual/ZhuanshuEntryPage.tsx", import.meta.url),
    "utf8",
  );
  const stylesheet = await readFile(
    new URL("../features/zhuanshu-visual/ZhuanshuEntryPage.module.css", import.meta.url),
    "utf8",
  );

  assert.match(page, /<ZhuanshuEntryPage variant="zhuanshu"\s*\/>/);
  assert.doesNotMatch(page, /CourtPlaceholderPage/);
  assert.match(entry, /href="\/zhuanshu\/jinyiwei"/);
  assert.match(entry, /专署/);
  assert.match(entry, /锦衣卫/);
  assert.match(entry, /assets\/zhuanshu\/jinyiwei-hero-v3\.webp/);
  assert.match(entry, /太医院/);
  assert.match(entry, /钦天监/);
  assert.match(entry, /aria-hidden/);
  assert.match(entry, /className=\{styles\.visualStage\}/);
  assert.match(entry, /className=\{styles\.registry\}/);
  assert.match(stylesheet, /grid-template-rows: minmax\(480px, 1fr\) auto/);
  assert.doesNotMatch(stylesheet, /radial-gradient\(circle at 75% 43%/);
  assert.doesNotMatch(entry, /fetch\(|method\s*:\s*["'](?:POST|PATCH|PUT|DELETE)/);
});

test("Jinyiwei uses a guarded scroll desk with an atmospheric guard background", async () => {
  const page = await readFile(new URL("./zhuanshu/jinyiwei/page.tsx", import.meta.url), "utf8");
  const desk = await readFile(
    new URL("../features/jinyiwei-visual/JinyiweiScrollDesk.tsx", import.meta.url),
    "utf8",
  );
  const stylesheet = await readFile(
    new URL("../features/jinyiwei-visual/JinyiweiScrollDesk.module.css", import.meta.url),
    "utf8",
  );

  assert.match(page, /<JinyiweiScrollDesk\s*\/>/);
  assert.doesNotMatch(page, /CourtPlaceholderPage/);
  assert.match(desk, /EdictStage/);
  assert.match(desk, /CollapsedEdictScroll/);
  assert.match(desk, /\/api\/jinyiwei\/investigations/);
  assert.doesNotMatch(desk, /const CASE_FILES/);
  assert.match(desk, /只读案卷/);
  assert.doesNotMatch(desk, /method\s*:\s*["'](?:POST|PATCH|PUT|DELETE)/);
  assert.match(stylesheet, /assets\/jinyiwei\/audit-hall\.webp/);
  assert.match(stylesheet, /grid-template-columns/);
  assert.match(stylesheet, /\.index\s*\{[\s\S]*?max-height:/);
  assert.match(stylesheet, /\.caseList\s*\{[\s\S]*?overflow-y:\s*auto/);
  assert.match(stylesheet, /\.expandedScroll\s*\{[\s\S]*?height:\s*clamp\(/);
  assert.match(desk, /\/api\/jinyiwei\/investigations\/\$\{encodeURIComponent\(selectedId\)\}/);
  assert.match(
    desk,
    /const select = \(id: string\) => \{\s*setSelectedId\(id\);\s*setExpanded\(true\);/,
  );
});
