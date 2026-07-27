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
  ["zhuanshu/page.tsx", "/zhuanshu", "专署", /CourtPlaceholderPage/, /CourtShell/],
  ["zhuanshu/jinyiwei/page.tsx", "/zhuanshu/jinyiwei", "锦衣卫", /CourtPlaceholderPage/, /CourtShell/],
  ["zhuanshu/jinyiwei/[signalId]/page.tsx", "/zhuanshu/jinyiwei/", undefined, /CourtPlaceholderPage/, /CourtShell/],
] as const;

test("court entries are server-protected migrated views or visual placeholders", async () => {
  for (const [file, path, name, expectedView, expectedShell] of pages) {
    const source = await readFile(new URL(`./${file}`, import.meta.url), "utf8");
    assert.match(source, /^import \{ requireUser \} from "[^"]+\/requireUser";\r?$/m);
    const directGuards = source.match(
      /^\s{2}await requireUser\((?:routeSegment|"[^"]+")\);\r?$/gm,
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
