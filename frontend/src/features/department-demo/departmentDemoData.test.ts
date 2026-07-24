import assert from "node:assert/strict";
import test from "node:test";

import {
  DEPARTMENT_DEMOS,
  getDepartmentDemo,
  getDepartmentOfficeDemo,
} from "./departmentDemoData.ts";

test("six ministry demonstrations have unique routes and visual assets", () => {
  assert.equal(DEPARTMENT_DEMOS.length, 6);
  assert.equal(new Set(DEPARTMENT_DEMOS.map((department) => department.code)).size, 6);
  assert.deepEqual(
    DEPARTMENT_DEMOS.map((department) => department.code),
    ["personnel", "finance", "market", "ops", "legal", "gongbu"],
  );

  for (const department of DEPARTMENT_DEMOS) {
    assert.match(department.background, /^\/assets\/six-ministries\/.+\.webp$/);
    assert.ok(department.offices.length > 0);
    assert.match(department.demoLabel, /演示展示/);
  }
});

test("department and office demos are resolved locally without a fallback", () => {
  assert.equal(getDepartmentDemo("finance")?.name, "户部");
  assert.equal(getDepartmentDemo("unknown"), undefined);
  assert.equal(getDepartmentOfficeDemo("finance", "budget")?.name, "预算司");
  assert.equal(getDepartmentOfficeDemo("finance", "unknown"), undefined);
});
