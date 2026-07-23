import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("CourtPlaceholderPage renders a Chinese preparation state without data requests", async () => {
  const source = await readFile(new URL("./CourtPlaceholderPage.tsx", import.meta.url), "utf8");

  assert.match(source, /功能筹备中/);
  assert.match(source, /routeSegment/);
  assert.match(source, /data-court-placeholder/);
  assert.doesNotMatch(source, /fetch\(|"use client"|useEffect|useState/);
});
