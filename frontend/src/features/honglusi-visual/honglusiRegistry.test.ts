import assert from "node:assert/strict";
import test from "node:test";

import {
  HONGLUSI_CAPABILITIES,
  HONGLUSI_CATEGORIES,
  getHonglusiCapability,
} from "./honglusiRegistry.ts";

test("Honglusi DEMO registry covers four external capability classes with stable identities", () => {
  assert.deepEqual(HONGLUSI_CATEGORIES, ["模型智囊", "MCP 使团", "自动化行署", "合作方服务"]);
  assert.equal(HONGLUSI_CAPABILITIES.length, 6);
  assert.equal(new Set(HONGLUSI_CAPABILITIES.map((item) => item.id)).size, HONGLUSI_CAPABILITIES.length);

  for (const category of HONGLUSI_CATEGORIES) {
    assert.ok(HONGLUSI_CAPABILITIES.some((item) => item.category === category));
  }
});

test("every capability is an honest, complete, non-executable DEMO passport", () => {
  const banned = /https?:\/\/|bearer|api[ _-]?key|secret|credential|token|curl|powershell|bash/i;
  const statuses = new Set(["待审", "沙箱", "只读", "阻断"]);

  for (const capability of HONGLUSI_CAPABILITIES) {
    assert.equal(capability.mode, "DEMO");
    assert.ok(statuses.has(capability.status));
    assert.ok(capability.source.length > 0);
    assert.ok(capability.summary.length > 0);
    assert.ok(capability.dataClass.length > 0);
    assert.ok(capability.permissions.length > 0);
    assert.ok(capability.risk.level.length > 0);
    assert.ok(capability.risk.reason.length > 0);
    assert.ok(capability.impact.length > 0);
    assert.ok(capability.nextAction.length > 0);
    assert.ok(capability.lastVerifiedLabel.length > 0);
    assert.equal(banned.test(JSON.stringify(capability)), false);
  }
});

test("unknown capability ids fail closed instead of selecting a fallback", () => {
  assert.equal(getHonglusiCapability("not-registered"), null);
  assert.equal(getHonglusiCapability(HONGLUSI_CAPABILITIES[0].id)?.id, HONGLUSI_CAPABILITIES[0].id);
});
