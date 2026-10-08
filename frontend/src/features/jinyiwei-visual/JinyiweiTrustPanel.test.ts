import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "JinyiweiTrustPanel.tsx"), "utf8");

test("trust desk exposes explainable assessments and a bounded coverage projection", () => {
  assert.match(source, /真实性评估与证据地图/);
  assert.match(source, /assessmentBasis/);
  assert.match(source, /counterEvidenceIds/);
  assert.match(source, /doNotInfer/);
  assert.match(source, /coverage/);
  assert.match(source, /不会猜测精确位置/);
});
