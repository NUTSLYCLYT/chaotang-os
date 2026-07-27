import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  createCourtExplanationId,
  resolveCourtCapabilityButtonState,
} from "./types.ts";

test("immersive shell exposes scene and background without network code", async () => {
  const source = await readFile(
    new URL("./ImmersiveCourtShell.tsx", import.meta.url),
    "utf8",
  );
  const css = await readFile(
    new URL("./ImmersiveCourtShell.module.css", import.meta.url),
    "utf8",
  );
  assert.match(source, /data-court-scene/);
  assert.match(source, /backgroundImage/);
  assert.doesNotMatch(source, /fetch\(|BACKEND_BASE_URL|ownerId/);
  assert.match(
    css,
    /\.shell\s*\{[^}]*position: fixed;[^}]*inset: 0;[^}]*box-sizing: border-box;[^}]*height: 100dvh;/,
  );
  assert.match(
    css,
    /@media \(max-width: 767px\)[\s\S]*?\.shell\s*\{[^}]*overflow-y: auto;/,
  );

  const contentRule = css.match(/\.content\s*\{([^}]*)\}/)?.[1];
  assert.ok(contentRule, "immersive shell must define a scoped content rule");
  assert.match(contentRule, /width: min\(100%, 1600px\)/);
  assert.match(contentRule, /box-sizing: border-box/);
  assert.match(contentRule, /env\(safe-area-inset-right\)/);
  assert.match(contentRule, /env\(safe-area-inset-left\)/);
});

test("capability button uses a unique React id without replacing existing descriptions", async () => {
  const source = await readFile(
    new URL("./CourtCapabilityButton.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /useId\(\)/);
  assert.match(source, /createCourtExplanationId/);
  assert.match(source, /aria-describedby/);
  assert.doesNotMatch(source, /buttonProps\.id/);

  const firstId = createCourtExplanationId(":r0:");
  const secondId = createCourtExplanationId(":r1:");
  assert.notEqual(firstId, secondId);

  const state = resolveCourtCapabilityButtonState(
    "enabled",
    firstId,
    false,
    "caller-description",
  );
  assert.equal(state.disabled, false);
  assert.equal(state.ariaDescribedBy, `caller-description ${firstId}`);
});

test("enabled, readonly, and unavailable capabilities have explicit disabled semantics", () => {
  const explanationId = createCourtExplanationId(":r2:");

  assert.equal(
    resolveCourtCapabilityButtonState("enabled", explanationId).disabled,
    false,
  );
  assert.equal(
    resolveCourtCapabilityButtonState("enabled", explanationId, true).disabled,
    true,
  );
  assert.equal(
    resolveCourtCapabilityButtonState("readonly", explanationId).disabled,
    true,
  );
  assert.equal(
    resolveCourtCapabilityButtonState("unavailable", explanationId).disabled,
    true,
  );
});
