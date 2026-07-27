import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

test("root layout remains a public shell without auth or backend work", async () => {
  const source = await readFile(new URL("./layout.tsx", import.meta.url), "utf8");

  assert.doesNotMatch(
    source,
    /requireUser|backendClient|fetch\s*\(|cookies\s*\(|courtos_session/,
  );
  assert.match(source, /\{children\}/);
});

test("public root and health routes remain present", async () => {
  await Promise.all([
    access(new URL("./page.tsx", import.meta.url)),
    access(new URL("./health/page.tsx", import.meta.url)),
  ]);
});
