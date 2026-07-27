import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

test("protected court placeholders select only dev visual shells and keep the honest preparation state", async () => {
  const source = await readFile(new URL("./CourtPlaceholderPage.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("./CourtPlaceholderPage.module.css", import.meta.url), "utf8");
  const dadian = await readFile(new URL("../../app/dadian/page.tsx", import.meta.url), "utf8");
  const junjichu = await readFile(new URL("../../app/junjichu/page.tsx", import.meta.url), "utf8");
  const liubu = await readFile(new URL("../../app/liubu/page.tsx", import.meta.url), "utf8");
  const zhuanshu = await readFile(new URL("../../app/zhuanshu/page.tsx", import.meta.url), "utf8");

  await Promise.all([
    access(new URL("../../../public/assets/dadian/hall-stage-tang.webp", import.meta.url)),
    access(new URL("../../../public/assets/junjichu/junjichu.webp", import.meta.url)),
    access(new URL("../../../public/assets/junjichu/war-room-full.webp", import.meta.url)),
    access(new URL("../../../public/assets/liubu.webp", import.meta.url)),
  ]);
  assert.match(source, /variant/);
  assert.match(source, /功能筹备中/);
  assert.doesNotMatch(source, /fetch\(|useState|useEffect|mock|统计|案卷|消息/);
  assert.match(css, /hall-stage-tang\.webp/);
  assert.match(css, /junjichu\.webp/);
  assert.match(css, /assets\/liubu\.webp/);
  assert.match(css, /zhuanshu/);
  assert.match(dadian, /variant="dadian"/);
  assert.match(junjichu, /variant="junjichu"/);
  assert.match(liubu, /MinistryOverview/);
  assert.match(zhuanshu, /variant="zhuanshu"/);
});
