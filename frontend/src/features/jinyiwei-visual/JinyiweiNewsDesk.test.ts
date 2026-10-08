import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "JinyiweiNewsDesk.tsx"), "utf8");

test("news desk preserves offline and do-not-infer boundaries", () => {
  assert.match(source, /尚未载入已批准 Feed 快照/);
  assert.match(source, /当前不联网、不抓取/);
  assert.match(source, /不得推断/);
  assert.match(source, /CONFLICTED/);
  assert.match(source, /type="file"/);
  assert.match(source, /\/api\/jinyiwei\/news/);
  assert.match(source, /不联网抓取/);
});
