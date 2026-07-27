import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pages = [
  ["dadian/page.tsx", "/dadian", undefined, /DadianOverviewClient/, /DadianOverviewClient/],
  ["junjichu/page.tsx", "/junjichu", "军机处", /CourtPlaceholderPage/, /CourtShell/],
  ["command-center/page.tsx", "/command-center", "指挥中心", /CourtPlaceholderPage/, /CourtShell/],
  ["liubu/page.tsx", "/liubu", "六部", /MinistryOverview/, /CourtShell/],
  ["liubu/[code]/page.tsx", "/liubu/", undefined, /DepartmentOverview/, /CourtShell/],
  ["liubu/[code]/[office]/page.tsx", "/liubu/", undefined, /DepartmentOfficeView/, /CourtShell/],
  ["zhuanshu/page.tsx", "/zhuanshu", "专署", /CourtPlaceholderPage/, /CourtShell/],
  ["zhuanshu/jinyiwei/page.tsx", "/zhuanshu/jinyiwei", "锦衣卫", /CourtPlaceholderPage/, /CourtShell/],
  ["zhuanshu/jinyiwei/[signalId]/page.tsx", "/zhuanshu/jinyiwei/", undefined, /CourtPlaceholderPage/, /CourtShell/],
] as const;

test("court entries are server-protected migrated views or visual placeholders", async () => {
  for (const [file, path, name, expectedView, expectedShell] of pages) {
    const source = await readFile(new URL(`./${file}`, import.meta.url), "utf8");
    assert.match(source, /await requireUser\(/);
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
