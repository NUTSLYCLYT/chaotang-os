import assert from "node:assert/strict";
import test from "node:test";

import { initialWelcomeState, nextWelcomeState } from "./welcomeTransition.ts";

test("media readiness before attend starts opening immediately", () => {
  const ready = nextWelcomeState(initialWelcomeState, { type: "media-ready" });
  assert.deepEqual(nextWelcomeState(ready, { type: "attend" }), {
    phase: "opening",
    mediaReady: true,
    attendRequested: true,
  });
});

test("attend before readiness waits and readiness then starts opening", () => {
  const waiting = nextWelcomeState(initialWelcomeState, { type: "attend" });
  assert.equal(waiting.phase, "waiting");
  assert.equal(nextWelcomeState(waiting, { type: "media-ready" }).phase, "opening");
});

test("duplicate attend is ignored", () => {
  const waiting = nextWelcomeState(initialWelcomeState, { type: "attend" });
  assert.equal(nextWelcomeState(waiting, { type: "attend" }), waiting);
});

test("timeout and media failure finish a pending attend", () => {
  const waiting = nextWelcomeState(initialWelcomeState, { type: "attend" });
  assert.equal(nextWelcomeState(waiting, { type: "timeout" }).phase, "finished");
  assert.equal(nextWelcomeState(waiting, { type: "media-error" }).phase, "finished");
});

test("media errors before attend preserve the clickable closed state", () => {
  assert.deepEqual(nextWelcomeState(initialWelcomeState, { type: "media-error" }), initialWelcomeState);
});
