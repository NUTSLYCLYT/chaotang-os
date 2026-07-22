import assert from "node:assert/strict";
import test from "node:test";

import nextConfig from "./next.config.ts";

test("allows the 127.0.0.1 development origin", () => {
  assert.deepEqual(nextConfig.allowedDevOrigins, ["127.0.0.1"]);
});
