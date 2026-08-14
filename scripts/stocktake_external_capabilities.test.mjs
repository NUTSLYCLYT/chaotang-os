import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  buildSixMinistryInventory,
  buildStocktake,
} from "./stocktake_external_capabilities.mjs";

function git(root, args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
}

function write(root, path, contents) {
  const target = join(root, ...path.split("/"));
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, contents);
}

test("classifies external capabilities without treating them as authorized imports", () => {
  const root = mkdtempSync(join(tmpdir(), "capability-stocktake-"));
  try {
    git(root, ["init", "-q"]);
    git(root, ["config", "user.email", "stocktake@example.invalid"]);
    git(root, ["config", "user.name", "Stocktake Test"]);
    write(root, "AGENTS.md", "# target\n");
    write(root, ".claude/agents/existing.md", "existing\n");
    git(root, ["add", "."]);
    git(root, ["commit", "-qm", "target"]);
    git(root, ["branch", "target"]);

    write(root, ".claude/agents/reviewer.md", "---\nname: reviewer\n---\nReview.\n");
    write(
      root,
      ".claude/skills/design/SKILL.md",
      "---\nname: design\ndescription: Design safely\n---\nSteps.\n",
    );
    write(root, ".claude/settings.json", "{}\n");
    write(root, "backend/runtime_prompts/legal/SOUL.md", "Legal boundary.\n");
    write(
      root,
      "backend/agent_design/department/skills/audit/SKILL.md",
      "---\nname: audit\n---\nAudit.\n",
    );
    git(root, ["add", "."]);
    git(root, ["commit", "-qm", "source"]);
    git(root, ["branch", "source"]);

    const result = buildStocktake(root, "source", "target");
    assert.equal(result.summary.totalEntries, 6);
    assert.deepEqual(result.summary.byKind, {
      "development-agent": 2,
      "development-control-plane": 1,
      "development-skill": 1,
      "embedded-domain-skill": 1,
      "runtime-role-component": 1,
    });
    assert.equal(result.policy.directCopyAuthorized, false);
    assert.equal(Object.hasOwn(result, "generatedAt"), false);
    assert.equal(
      result.entries.find((entry) => entry.path === ".claude/settings.json").disposition,
      "reject-direct-copy",
    );
    assert.equal(
      result.entries.find((entry) => entry.name === "design").description,
      "Design safely",
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("CLI writes a deterministic in-repository snapshot and rejects unsafe outputs", () => {
  const root = mkdtempSync(join(tmpdir(), "capability-stocktake-cli-"));
  const script = resolve(dirname(fileURLToPath(import.meta.url)), "stocktake_external_capabilities.mjs");
  try {
    git(root, ["init", "-q"]);
    git(root, ["config", "user.email", "stocktake@example.invalid"]);
    git(root, ["config", "user.name", "Stocktake Test"]);
    write(root, ".agents/skills/example/SKILL.md", "---\nname: example\n---\nExample.\n");
    git(root, ["add", "."]);
    git(root, ["commit", "-qm", "fixture"]);

    const output = "docs/migrations/stocktake.json";
    execFileSync(process.execPath, [script, "--source", "HEAD", "--target", "HEAD", "--output", output], {
      cwd: root,
      encoding: "utf8",
    });
    assert.equal(existsSync(join(root, output)), true);
    const first = readFileSync(join(root, output), "utf8");
    execFileSync(process.execPath, [script, "--source", "HEAD", "--target", "HEAD", "--output", output], {
      cwd: root,
      encoding: "utf8",
    });
    assert.equal(readFileSync(join(root, output), "utf8"), first);
    assert.throws(
      () => execFileSync(process.execPath, [script, "--source", "HEAD", "--target", "HEAD", "--output", "../escape.json"], { cwd: root }),
      /output must stay inside the repository/,
    );
    assert.throws(
      () => execFileSync(process.execPath, [script, "--source", "HEAD", "--target", "HEAD", "--output", ".agents/overwrite.json"], { cwd: root }),
      /protected repository root/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("builds a pinned, exhaustive six-ministry inventory with rich migration records", () => {
  const root = mkdtempSync(join(tmpdir(), "six-ministry-inventory-"));
  try {
    git(root, ["init", "-q"]);
    git(root, ["config", "user.email", "stocktake@example.invalid"]);
    git(root, ["config", "user.name", "Stocktake Test"]);
    write(root, "backend/config/flow_hubu.yaml", "steps: []\n");
    write(root, "backend/runtime_prompts/finance_risk/SOUL.md", "Finance risk.\n");
    write(root, "backend/src/hubu_budget.py", "def budget_gate(): pass\n");
    write(root, "backend/web/routers/libu.py", "router = object()\n");
    write(root, "backend/tests/test_hubu_budget.py", "def test_budget(): pass\n");
    write(root, "frontend/dev/contracts/loops/libu_chro.loop.yaml", "steps: []\n");
    write(root, "frontend/src/features/gongbu/lib/quality.ts", "export const quality = true;\n");
    write(root, ".claude/agents/gongbu-quality-gate.md", "Review engineering quality.\n");
    write(root, "README.md", "Unrelated repository documentation.\n");
    write(
      root,
      "backend/agent_design/buildAgent/三省六部体系/户部/skills/audit/SKILL.md",
      "---\nname: audit\n---\nAudit.\n",
    );
    git(root, ["add", "."]);
    git(root, ["commit", "-qm", "source"]);
    const commit = git(root, ["rev-parse", "HEAD"]);

    const result = buildSixMinistryInventory(root, commit, commit);
    assert.equal(result.source.commit, commit);
    assert.equal(result.summary.unclassified, 0);
    assert.equal(result.summary.totalTreeFiles, 10);
    assert.equal(result.summary.includedAssets, 9);
    assert.equal(result.summary.excludedAssets, 1);
    assert.deepEqual(new Set(result.assets.filter((asset) => asset.included).map((asset) => asset.owner)), new Set(["hubu", "libu", "gongbu"]));
    for (const asset of result.assets) {
      assert.match(asset.id, /^six-ministry:[a-z0-9_-]+:[0-9a-f]{16}$/);
      assert.equal(asset.path.length > 0, true);
      assert.match(asset.blobDigest, /^[0-9a-f]{40,64}$/);
      for (const field of ["triggers", "antiTriggers", "inputs", "steps", "outputs", "dependencies", "tools", "sideEffects", "failureStopEscalation", "consumptionChain", "devMapping"]) {
        assert.equal(Array.isArray(asset[field]), true, `${asset.path}: ${field}`);
      }
      assert.equal(typeof asset.verdict, "string");
      assert.equal(typeof asset.reason, "string");
      assert.equal(typeof asset.risk, "string");
      assert.equal(typeof asset.duplicateGroup, "string");
      assert.equal(typeof asset.included, "boolean");
      assert.equal(typeof asset.classificationReason, "string");
      assert.ok(asset.classificationReason.length > 0);
      assert.equal(result.duplicateGroups[asset.duplicateGroup].sourcePaths.includes(asset.path), true);
    }
    assert.equal(result.assets.find((asset) => asset.path === ".claude/agents/gongbu-quality-gate.md").included, true);
    assert.equal(result.assets.find((asset) => asset.path === "README.md").included, false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("pinned EXT inventory classifies every selected source asset", () => {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const result = buildSixMinistryInventory(
    root,
    "939186f0331d9784bc8c4ceee393aeb197230ed0",
    "HEAD",
  );
  assert.equal(result.summary.unclassified, 0);
  const completeTree = execFileSync(
    "git",
    ["-c", "core.quotePath=false", "ls-tree", "-r", "-z", "--name-only", result.source.commit],
    { cwd: root, encoding: "utf8" },
  ).split("\0").filter(Boolean);
  assert.equal(result.assets.length, completeTree.length);
  assert.deepEqual(result.assets.map((asset) => asset.path), completeTree.sort());
  assert.equal(new Set(result.assets.map((asset) => asset.path)).size, completeTree.length);
  assert.equal(result.summary.totalTreeFiles, completeTree.length);
  assert.equal(result.summary.includedAssets + result.summary.excludedAssets, completeTree.length);
  assert.ok(result.assets.length >= 8_000);
  assert.ok(result.summary.sixMinistryAssets >= 1_000);
  assert.ok(result.summary.excludedUniverseAssets > 0);
  for (const owner of ["libu", "hubu", "libu_rites", "bingbu", "xingbu", "gongbu", "shared-six-ministry", "out-of-scope-unmapped"]) {
    assert.ok(Object.hasOwn(result.summary.byOwner, owner), owner);
  }
  const gongbuAgents = result.assets.filter((asset) => /^\.claude\/agents\/gongbu-[^/]+\.md$/u.test(asset.path));
  assert.ok(gongbuAgents.length >= 7);
  assert.ok(gongbuAgents.every((asset) => asset.included && asset.owner === "gongbu"));
  assert.ok(result.assets.every((asset) => /^[0-9a-f]{40,64}$/u.test(asset.sourceBlob) && /^[0-9a-f]{64}$/u.test(asset.blobDigest)));
  assert.ok(result.assets.every((asset) => typeof asset.classificationReason === "string" && asset.classificationReason.length > 0));
});
