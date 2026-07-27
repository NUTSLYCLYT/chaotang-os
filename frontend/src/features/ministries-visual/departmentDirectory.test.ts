import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  DEPARTMENT_ACTIONS,
  DEPARTMENT_DIRECTORY,
  getDepartment,
  getOffice,
} from "./departmentDirectory.ts";

test("directory exactly reconciles six departments and 39 canonical offices", async () => {
  assert.equal(DEPARTMENT_DIRECTORY.length, 6);
  const source = await readFile(
    new URL("../../../../backend/app/agents/bureaus/profiles.py", import.meta.url),
    "utf8",
  );
  const canonical = [...source.matchAll(
    /BureauProfile\(\s*"([^"]+)",\s*"([^"]+)",\s*\(([\s\S]*?)\),?\s*\)/g,
  )].map((match) => ({
    identity: `${match[1]}:${match[2]}`,
    responsibilities: [...match[3].matchAll(/"([^"]+)"/g)].map((item) => item[1]),
  }));
  const frontend = DEPARTMENT_DIRECTORY.flatMap((department) =>
    department.offices.map((office) => ({
      identity: `${department.name}:${office.name}`,
      responsibilities: [...office.responsibilities],
    })),
  );
  assert.equal(canonical.length, 39);
  assert.equal(new Set(frontend.map((item) => item.identity)).size, 39);
  assert.deepEqual(frontend, canonical);
});

test("office slugs resolve only inside their canonical department", () => {
  for (const department of DEPARTMENT_DIRECTORY) {
    assert.equal(getDepartment(department.code), department);
    for (const office of department.offices) {
      assert.equal(getOffice(department.code, office.slug), office);
      for (const other of DEPARTMENT_DIRECTORY) {
        if (other.code !== department.code) assert.equal(getOffice(other.code, office.slug), null);
      }
    }
  }
  assert.equal(getDepartment("unknown"), null);
  assert.equal(getOffice("personnel", "unknown"), null);
});

test("directory keeps only explicitly unavailable dev action labels", () => {
  assert.equal(Object.keys(DEPARTMENT_ACTIONS).length, 6);
  for (const department of DEPARTMENT_DIRECTORY) {
    for (const office of department.offices) {
      assert.equal(office.actions.length, 5);
      assert.equal(office.actions.at(-1), "先拦下风险");
      assert.equal(new Set(office.actions).size, 5);
    }
  }
});
