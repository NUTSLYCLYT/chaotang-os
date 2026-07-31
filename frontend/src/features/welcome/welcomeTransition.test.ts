import assert from "node:assert/strict";
import test from "node:test";

import { nextWelcomePhase } from "./welcomeTransition.ts";

test("attend starts the background opening video only from the closed phase", () => {
  assert.equal(nextWelcomePhase("closed", "attend"), "opening");
  assert.equal(nextWelcomePhase("opening", "attend"), "opening");
});
