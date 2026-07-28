import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("consult BFF is authenticated and forwards only to the independent client", async () => {
  const source = await readFile(new URL("./route.ts", import.meta.url), "utf8");
  assert.match(source, /readSessionId\(request\)/);
  assert.match(source, /chancellorConsult\(/);
  assert.match(source, /status:\s*401/);
  assert.match(source, /status:\s*400/);
  assert.doesNotMatch(source, /submitDecree|\/api\/decrees\/chancellor|shiguan|jinyiwei|junjichu/);
});
