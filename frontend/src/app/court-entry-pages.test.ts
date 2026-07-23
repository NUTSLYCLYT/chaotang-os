import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pages = [
  ["dadian/page.tsx", "/dadian", "大殿"],
  ["junjichu/page.tsx", "/junjichu", "军机处"],
  ["command-center/page.tsx", "/command-center", "指挥中心"],
  ["liubu/page.tsx", "/liubu", "六部"],
  ["liubu/[code]/page.tsx", "/liubu/"],
  ["liubu/[code]/[office]/page.tsx", "/liubu/"],
  ["zhuanshu/page.tsx", "/zhuanshu", "专署"],
  ["zhuanshu/jinyiwei/page.tsx", "/zhuanshu/jinyiwei", "锦衣卫"],
  ["zhuanshu/jinyiwei/[signalId]/page.tsx", "/zhuanshu/jinyiwei/"],
] as const;

test("first-batch court entries are server-protected visual placeholders", async () => {
  for (const [file, path, name] of pages) {
    const source = await readFile(new URL(`./${file}`, import.meta.url), "utf8");
    assert.match(source, /await requireUser\(/);
    assert.match(source, new RegExp(path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(source, /CourtShell/);
    assert.match(source, /CourtPlaceholderPage/);
    if (name) assert.match(source, new RegExp(name));
    assert.doesNotMatch(source, /fetch\(|"use client"/);
  }
});
