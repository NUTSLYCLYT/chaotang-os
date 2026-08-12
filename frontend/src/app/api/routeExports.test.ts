import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

const ILLEGAL_HANDLER_EXPORT =
  /^export\s+(?:async\s+)?(?:function|const)\s+create\w+Handler\b/m;

test("Next.js route modules export no dependency-injection handler factories", async () => {
  const root = new URL("./", import.meta.url);
  const entries = await readdir(root, { recursive: true });
  const offenders: string[] = [];

  for (const entry of entries) {
    const normalized = entry.replaceAll("\\", "/");
    if (!normalized.endsWith("/route.ts") && normalized !== "route.ts") continue;
    const source = await readFile(new URL(normalized, root), "utf8");
    if (ILLEGAL_HANDLER_EXPORT.test(source)) offenders.push(normalized);
  }

  assert.deepEqual(offenders.sort(), []);
});
