import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

test("史馆保留现有 BFF 契约，同时采用太史馆三栏视觉外壳", async () => {
  const source = await readFile(new URL("./ShiguanClient.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("./shiguan.module.css", import.meta.url), "utf8");

  await access(new URL("../../../public/assets/shiguan/shiguan.webp", import.meta.url));
  assert.match(source, /from "\.\/shiguan\.module\.css"/);
  assert.match(source, /太史馆/);
  assert.match(source, /EdictScrollShell/);
  assert.match(source, /styles\.threeColumn/);
  assert.match(source, /styles\.archiveColumn/);
  assert.match(source, /styles\.reviewColumn/);
  assert.match(source, /暂无真实档案/);
  for (const endpoint of [
    "/api/shiguan/archives",
    "/api/shiguan/statistics",
    "/api/shiguan/recall",
    "/api/shiguan/archives/${archive.id}/review",
  ]) assert.match(source, new RegExp(endpoint.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.doesNotMatch(source, /@\/features\/shiguan-ui|useArchiveRecords|useArchiveStats|ima-knowledge|promo-archive|\/api\/scribe\/lessons|lucide|tailwind/);
  assert.match(css, /url\("\/assets\/shiguan\/shiguan\.webp"\) center top \/ cover no-repeat/);
  assert.match(css, /grid-template-columns: minmax\(220px, 0\.78fr\) minmax\(0, 1\.45fr\) minmax\(250px, 0\.92fr\)/);
  assert.match(css, /@media \(max-width: 1080px\)/);
});
