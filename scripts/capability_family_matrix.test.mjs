import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { buildCapabilityFamilyMatrix, buildRuntimeFamilyProjection, main } from "./capability_family_matrix.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const inventoryPath = resolve(root, "docs/migrations/2026-08-13-six-ministry-capability-inventory.json");
const matrixPath = resolve(root, "docs/migrations/2026-08-14-six-ministry-capability-family-matrix.json");
const runtimeProjectionPath = resolve(root, "backend/app/agents/runtime_skills/capability_family_bindings.json");

test("assigns every included source asset to exactly one stable executable family", () => {
  const inventory = JSON.parse(readFileSync(inventoryPath, "utf8"));
  const matrix = buildCapabilityFamilyMatrix(inventory);
  const includedIds = inventory.assets.filter((asset) => asset.included).map((asset) => asset.id).sort();
  const assignedIds = matrix.families.flatMap((family) => family.sourceAssetIds).sort();

  assert.equal(matrix.summary.includedSourceAssets, 1_777);
  assert.equal(matrix.summary.assignedSourceAssets, 1_777);
  assert.equal(matrix.summary.unassignedSourceAssets, 0);
  assert.equal(matrix.summary.multiplyAssignedSourceAssets, 0);
  assert.deepEqual(assignedIds, includedIds);
  assert.equal(new Set(assignedIds).size, assignedIds.length);
  assert.deepEqual(new Set(matrix.families.flatMap((family) => family.owners)), new Set(["libu", "hubu", "libu_rites", "bingbu", "xingbu", "gongbu", "shared-six-ministry"]));

  for (const family of matrix.families) {
    assert.match(family.id, /^capability-family:[a-z0-9]+(?:-[a-z0-9]+)*$/u);
    assert.ok(family.sourceAssetIds.length > 0);
    assert.equal(new Set(family.sourceAssetIds).size, family.sourceAssetIds.length);
    assert.ok(family.owners.length > 0);
    assert.ok(family.devSkillMappings.length > 0);
    assert.ok(Array.isArray(family.runtimeSkillIds));
    if (family.implementationStatus === "retire") assert.deepEqual(family.runtimeSkillIds, []);
    else assert.ok(family.runtimeSkillIds.length > 0);
    for (const field of ["triggers", "inputs", "outputs", "dependencies", "risks", "sideEffects", "acceptanceRequirements"]) {
      assert.ok(Array.isArray(family[field]) && family[field].length > 0, `${family.id}: ${field}`);
    }
    assert.ok(["existing", "enhance", "new", "retire"].includes(family.implementationStatus));
    if (family.implementationStatus !== "retire") {
      const expectedOwner = family.id.startsWith("capability-family:libu-rites-")
        ? "libu_rites"
        : family.id.split(":")[1].split("-")[0] === "shared"
          ? "shared-six-ministry"
          : family.id.split(":")[1].split("-")[0];
      assert.deepEqual(family.owners, [expectedOwner], `${family.id}: owner boundary`);
    }
  }
});

test("consolidates duplicate blobs and explicitly places all seven Gongbu agents", () => {
  const inventory = JSON.parse(readFileSync(inventoryPath, "utf8"));
  const matrix = buildCapabilityFamilyMatrix(inventory);
  assert.ok(matrix.summary.consolidatedDuplicateSourceAssets > 0);

  const gongbuAgentIds = inventory.assets
    .filter((asset) => /^\.claude\/agents\/gongbu-[^/]+\.md$/u.test(asset.path))
    .map((asset) => asset.id)
    .sort();
  assert.equal(gongbuAgentIds.length, 7);
  const family = matrix.families.find((candidate) => candidate.id === "capability-family:gongbu-engineering-delivery-control");
  assert.ok(family);
  assert.deepEqual(gongbuAgentIds.filter((id) => family.sourceAssetIds.includes(id)), gongbuAgentIds);
  assert.deepEqual(family.runtimeSkillIds, [
    "analyze-technical-feasibility",
    "analyze-delivery-schedule",
    "analyze-quality-readiness",
    "analyze-field-conditions",
    "analyze-commitment-fulfillment",
  ]);
});

test("checked-in machine matrix is a deterministic regeneration", () => {
  const inventory = JSON.parse(readFileSync(inventoryPath, "utf8"));
  const expected = buildCapabilityFamilyMatrix(inventory);
  const checkedIn = JSON.parse(readFileSync(matrixPath, "utf8"));
  assert.deepEqual(checkedIn, expected);
  assert.deepEqual(
    JSON.parse(readFileSync(runtimeProjectionPath, "utf8")),
    buildRuntimeFamilyProjection(expected),
  );
});

test("fails closed on duplicate source IDs, unknown owners, and unsafe output paths", () => {
  const inventory = JSON.parse(readFileSync(inventoryPath, "utf8"));
  const duplicate = structuredClone(inventory);
  const includedAssets = duplicate.assets.filter((asset) => asset.included);
  includedAssets[1].id = includedAssets[0].id;
  assert.throws(() => buildCapabilityFamilyMatrix(duplicate), /duplicate included source asset ID/);

  const unknownOwner = structuredClone(inventory);
  unknownOwner.assets.find((asset) => asset.included).owner = "unknown-office";
  assert.throws(() => buildCapabilityFamilyMatrix(unknownOwner), /unknown included source owner/);
  assert.throws(() => main([inventoryPath, "backend/runtime-overwrite.json"]), /docs\/migrations/);
  assert.throws(() => main([inventoryPath, "../escape.json"]), /docs\/migrations/);
});
