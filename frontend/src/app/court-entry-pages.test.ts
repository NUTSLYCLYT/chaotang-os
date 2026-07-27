import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pages = [
  ["dadian/page.tsx", "/dadian", "大殿", /DadianOverviewClient/],
  ["junjichu/page.tsx", "/junjichu", "军机处", /CourtPlaceholderPage/],
  ["command-center/page.tsx", "/command-center", "指挥中心", /CourtPlaceholderPage/],
  ["liubu/page.tsx", "/liubu", "六部", /MinistryOverview/],
  ["liubu/[code]/page.tsx", "/liubu/", undefined, /DepartmentOverview/],
  ["liubu/[code]/[office]/page.tsx", "/liubu/", undefined, /DepartmentOfficeView/],
  ["zhuanshu/page.tsx", "/zhuanshu", "专署", /CourtPlaceholderPage/],
  ["zhuanshu/jinyiwei/page.tsx", "/zhuanshu/jinyiwei", "锦衣卫", /CourtPlaceholderPage/],
  ["zhuanshu/jinyiwei/[signalId]/page.tsx", "/zhuanshu/jinyiwei/", undefined, /CourtPlaceholderPage/],
] as const;

test("court entries are server-protected migrated views or visual placeholders", async () => {
  for (const [file, path, name, expectedView] of pages) {
    const source = await readFile(new URL(`./${file}`, import.meta.url), "utf8");
    assert.match(source, /await requireUser\(/);
    assert.match(source, new RegExp(path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(source, /CourtShell/);
    assert.match(source, expectedView);
    if (name) assert.match(source, new RegExp(name));
    assert.doesNotMatch(source, /fetch\(|"use client"/);
  }
});
