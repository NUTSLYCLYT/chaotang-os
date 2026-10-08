import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "JinyiweiGlobalEvidenceMap.tsx"), "utf8");

test("global evidence map stays area-only and exposes controlled feed state", () => {
  assert.match(source, /coverage/);
  assert.match(source, /调查证据声明的区域名称/);
  assert.match(source, /不推断经纬度/);
  assert.match(source, /未启用外部 Feed/);
  assert.match(source, /默认拒绝未知来源与外网抓取/);
});
