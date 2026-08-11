import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

test("史馆保留现有 BFF 契约，同时采用太史馆三栏视觉外壳", async () => {
  const source = await readFile(new URL("./ShiguanClient.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("./shiguan.module.css", import.meta.url), "utf8");
  const workspace = await readFile(
    new URL("../../features/shiguan-visual/ShiguanWorkspace.tsx", import.meta.url),
    "utf8",
  );

  await access(new URL("../../../public/assets/shiguan/shiguan.webp", import.meta.url));
  assert.match(source, /from "\.\/shiguan\.module\.css"/);
  assert.match(source, /ShiguanWorkspace/);
  assert.match(source, /ShiguanController/);
  assert.match(source, /requestShiguanJson/);
  assert.match(source, /parseDecisionPayload/);
  assert.doesNotMatch(source, /async function requestJson/);
  assert.match(source, /controller\.connect/);
  assert.match(source, /controller\.start/);
  assert.doesNotMatch(source, /controller\.loadInitial/);
  assert.match(workspace, /太史馆/);
  assert.match(source, /statisticsState=/);
  assert.match(source, /recallState=/);
  assert.match(source, /reviewState=/);
  assert.match(source, /decisionState=/);
  assert.match(source, /onSelectArchive=/);
  assert.match(source, /onFilter=/);
  assert.match(source, /onRecall=/);
  assert.match(source, /onReview=/);
  assert.match(source, /onDecision=/);
  for (const endpoint of [
    "/api/shiguan/archives",
    "/api/shiguan/statistics",
    "/api/shiguan/recall",
    "/api/shiguan/archives/${archiveId}/review",
    "/api/shiguan/archives/${encodeURIComponent(archiveId)}/decision",
  ]) assert.match(source, new RegExp(endpoint.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.doesNotMatch(source, /@\/features\/shiguan-ui|useArchiveRecords|useArchiveStats|ima-knowledge|promo-archive|\/api\/scribe\/lessons|lucide|tailwind/);
  assert.match(css, /\.page/);
  assert.doesNotMatch(css, /url\("\/assets\/shiguan\/shiguan\.webp"\)/);
});
