import assert from "node:assert/strict";
import test from "node:test";

import { redirectLegacyJinyiweiEntry } from "./redirectLegacyEntry.ts";

test("legacy Jinyiwei entry authenticates before redirecting to the fixed visual desk", async () => {
  const calls: string[] = [];
  await assert.rejects(
    () => redirectLegacyJinyiweiEntry(
      async (nextPath) => { calls.push(`authenticate:${nextPath}`); return { id: "user-1" }; },
      (location) => { calls.push(`redirect:${location}`); throw new Error(location); },
    ),
    /\/zhuanshu\/jinyiwei/,
  );
  assert.deepEqual(calls, ["authenticate:/jinyiwei", "redirect:/zhuanshu/jinyiwei"]);
});
