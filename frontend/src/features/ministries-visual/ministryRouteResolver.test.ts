import assert from "node:assert/strict";
import test from "node:test";

import { resolveMinistryRoute } from "./ministryRouteResolver.ts";

test("route resolver rejects unknown and cross-department office slugs", () => {
  assert.deepEqual(resolveMinistryRoute(), { kind: "overview" });
  assert.equal(resolveMinistryRoute("unknown").kind, "not-found");
  assert.equal(resolveMinistryRoute("personnel", "unknown").kind, "not-found");
  assert.equal(resolveMinistryRoute("personnel", "budget").kind, "not-found");
  assert.equal(resolveMinistryRoute("finance", "budget").kind, "office");
});
