import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("StudyClient keeps decree controls inside the Shangshufang workspace", async () => {
  const source = await readFile(new URL("./StudyClient.tsx", import.meta.url), "utf8");

  assert.match(source, /ChaotangHeader currentLabel="上书房"/);
  assert.match(source, /EdictScrollShell/);
  assert.match(source, /className=\{styles\.background\}/);
  assert.doesNotMatch(source, /styles\.workspace|styles\.flow|styles\.courtNote/);
  assert.match(source, /data-testid="decree-fee-notice"/);
  assert.match(source, /data-testid="decree-textarea"/);
  assert.match(source, /data-testid="submit-decree-button"/);
  assert.match(source, /data-testid="decree-status"/);
  assert.match(source, /fetch\("\/api\/decrees\/chancellor"/);
});

test("Study background uses the dev Shangshufang scene asset", async () => {
  const styles = await readFile(new URL("./study.module.css", import.meta.url), "utf8");

  assert.match(styles, /url\("\/shangshufang\/bg-shangshufang-scene\.webp"\)/);
  assert.doesNotMatch(styles, /bg-shangshufang-full\.webp/);
});

test("Study decree composer matches the dev fixed bottom Dock visual contract", async () => {
  const source = await readFile(new URL("./StudyClient.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("./study.module.css", import.meta.url), "utf8");

  const scrollShellStart = source.indexOf("<EdictScrollShell>");
  const scrollShellEnd = source.indexOf("</EdictScrollShell>");
  const dockStart = source.indexOf("className={styles.decreeDock}");

  assert.ok(scrollShellStart >= 0 && scrollShellEnd > scrollShellStart);
  assert.ok(dockStart > scrollShellEnd, "fixed Dock must sit outside the scroll shell");
  assert.match(source, /className=\{styles\.edictArea\}/);
  assert.match(source, /className=\{styles\.decreeDock\}/);
  assert.match(source, /className=\{styles\.dockShell\}/);
  assert.match(source, /className=\{styles\.composerRow\}/);
  assert.match(source, /className=\{styles\.decreeInput\}/);
  assert.match(source, /className=\{styles\.decreeSubmit\}/);
  assert.match(source, /rows=\{1\}/);
  assert.match(source, /<svg[\s\S]*?aria-hidden="true"/);
  assert.match(styles, /\.background\s*\{[\s\S]*?display:\s*flex[\s\S]*?flex-direction:\s*column[\s\S]*?height:\s*calc\(100svh - 64px\)/);
  assert.match(styles, /\.edictArea\s*\{[\s\S]*?flex:\s*1[\s\S]*?min-height:\s*0[\s\S]*?overflow-y:\s*auto[\s\S]*?padding-bottom:\s*128px/);
  assert.match(styles, /\.decreeDock\s*\{[\s\S]*?position:\s*fixed[\s\S]*?inset-inline:\s*0[\s\S]*?bottom:\s*calc\(32px \+ env\(safe-area-inset-bottom\)\)[\s\S]*?z-index:\s*96[\s\S]*?padding:\s*0 16px/);
  assert.match(styles, /\.dockShell\s*\{[\s\S]*?max-width:\s*1180px[\s\S]*?rgba\(240, 198, 106, \.30\)[\s\S]*?border-radius:\s*16px[\s\S]*?backdrop-filter:\s*blur\(14px\)/);
  assert.match(styles, /\.dockShell::before[\s\S]*?linear-gradient\(90deg, transparent, #f0c66a, transparent\)/);
  assert.match(styles, /\.composerRow\s*\{[\s\S]*?display:\s*flex[\s\S]*?flex-direction:\s*column/);
  assert.match(styles, /@media \(min-width: 768px\)[\s\S]*?\.composerRow[\s\S]*?flex-direction:\s*row/);
  assert.match(styles, /\.decreeInput/);
  assert.match(styles, /height:\s*36px/);
  assert.match(styles, /resize:\s*none/);
  assert.match(styles, /padding:\s*8px 14px/);
  assert.match(styles, /border-radius:\s*999px/);
  assert.match(styles, /rgba\(240,\s*198,\s*106,\s*\.267\)/);
  assert.match(styles, /background:\s*rgba\(0,\s*0,\s*0,\s*\.4\)/);
  assert.doesNotMatch(styles, /\.decreeInput:focus-visible\s*\{[^}]*outline:/);
  assert.match(styles, /\.decreeSubmit/);
  assert.match(styles, /\.decreeSubmit\s*\{[\s\S]*?height:\s*36px[\s\S]*?padding:\s*0 16px[\s\S]*?border-radius:\s*999px/);
  assert.match(styles, /\.decreeSubmit:hover:not\(:disabled\)[\s\S]*?translateY\(-1px\)/);
  assert.match(styles, /\.decreeSubmit:disabled[\s\S]*?opacity:\s*\.5/);
});
