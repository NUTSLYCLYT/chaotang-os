import assert from "node:assert/strict";
import test from "node:test";

import { formatBusinessTime } from "./formatBusinessTime.ts";

test("formats UTC timestamps in Asia/Shanghai", () => {
  assert.equal(
    formatBusinessTime("2026-07-28T11:11:36.727253+00:00"),
    "2026/07/28 19:11:36",
  );
});

test("formats offset timestamps across a year boundary", () => {
  assert.equal(
    formatBusinessTime("2026-12-31T18:30:40-05:00"),
    "2027/01/01 07:30:40",
  );
});

test("formats nonzero positive offset timestamps in Asia/Shanghai", () => {
  assert.equal(
    formatBusinessTime("2026-07-28T11:11:36+05:30"),
    "2026/07/28 13:41:36",
  );
});

test("returns the unknown-time label for absent or invalid values", () => {
  for (const value of [undefined, null, "", "not-a-date"]) {
    assert.equal(formatBusinessTime(value), "时间未知");
  }
});

test("does not depend on the process timezone", () => {
  const originalTimezone = process.env.TZ;

  try {
    process.env.TZ = "America/Los_Angeles";
    assert.equal(
      formatBusinessTime("2026-07-28T11:11:36.727253+00:00"),
      "2026/07/28 19:11:36",
    );
  } finally {
    if (originalTimezone === undefined) {
      delete process.env.TZ;
    } else {
      process.env.TZ = originalTimezone;
    }
  }
});
