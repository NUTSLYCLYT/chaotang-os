import assert from "node:assert/strict";
import test from "node:test";

test("quick dock layout reserves a center column only for a supplied element", async () => {
  const layoutModule = await import("./courtQuickDockLayout.ts").catch(
    () => null,
  );

  assert.ok(
    layoutModule,
    "courtQuickDockLayout must expose the slot-presence resolver",
  );
  assert.equal(
    layoutModule.resolveCourtQuickDockLayout(undefined),
    "without-center",
  );
  assert.equal(
    layoutModule.resolveCourtQuickDockLayout(null),
    "without-center",
  );
  assert.equal(
    layoutModule.resolveCourtQuickDockLayout({ type: "div", props: {} } as never),
    "with-center",
  );
});
