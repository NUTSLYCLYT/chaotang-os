import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

import {
  buildBusinessEntranceObservation,
  FORBIDDEN_PATTERN_IDS,
  REQUIRED_ANCHOR_PATHS,
  validateBusinessEntranceObservation,
} from "./business-entrance-observation.mjs";

test("observation output names the current canonical business chain", () => {
  const observation = buildBusinessEntranceObservation({ cwd: process.cwd() });
  assert.equal(observation.schemaVersion, "chaotang.business-entrance-observation.v1");
  assert.equal(observation.decision, "PASS");
  assert.equal(observation.nonAuthorizing, true);

  const canonicalIds = observation.canonicalFamilies.map((family) => family.id);
  assert.deepEqual(canonicalIds, [
    "authenticated_frontend_session",
    "chancellor_draft_pre_decree",
    "chancellor_explicit_decree",
    "decree_job_async_execution",
    "honglusi_capability_gate_ui",
    "junjichu_case_projection",
    "scene_pack_v1_roadshow_surface",
    "shiguan_archive_and_recall",
  ]);
});

test("observation keeps legacy and donor entrances out of current authority", () => {
  const observation = buildBusinessEntranceObservation({ cwd: process.cwd() });
  assert.deepEqual(
    observation.observeFamilies.map((family) => family.id),
    [
      "frontend_compatibility_bff_routes",
      "jinyiwei_qintianjian_read_surfaces",
      "swarm_runs_compatibility_surface",
    ],
  );
  assert.deepEqual(
    observation.migrationRequiredFamilies.map((family) => family.id),
    [
      "dirty_root_backend_src_and_web_assets",
      "flywheel_and_knowledge_writers",
      "legacy_direct_execution_sessions",
      "legacy_orchestration_routes",
      "legacy_swarm_session_runners",
    ],
  );
  assert.ok(
    observation.migrationRequiredFamilies.every((family) => family.currentAuthority === "NONE"),
  );
});

test("validator fails closed on missing required anchors", () => {
  const observation = buildBusinessEntranceObservation({ cwd: process.cwd() });
  const tampered = {
    ...observation,
    requiredAnchors: [
      ...observation.requiredAnchors,
      { path: "missing/business-entry-runtime.ts", role: "CANONICAL", exists: false },
    ],
  };
  const result = validateBusinessEntranceObservation(tampered);
  assert.equal(result.decision, "STOP");
  assert.ok(result.errors.includes("REQUIRED_ANCHOR_MISSING"));
});

test("validator rejects every forbidden pattern removal", () => {
  const observation = buildBusinessEntranceObservation({ cwd: process.cwd() });
  for (const id of FORBIDDEN_PATTERN_IDS) {
    const tampered = {
      ...observation,
      forbiddenPatterns: observation.forbiddenPatterns.filter((pattern) => pattern.id !== id),
    };
    const result = validateBusinessEntranceObservation(tampered);
    assert.equal(result.decision, "STOP", id);
    assert.ok(result.errors.includes("FORBIDDEN_PATTERN_SET_DRIFT"), id);
  }
});

test("validator rejects authorizing or early-retirement projections", () => {
  const observation = buildBusinessEntranceObservation({ cwd: process.cwd() });
  assert.equal(
    validateBusinessEntranceObservation({ ...observation, nonAuthorizing: false }).decision,
    "STOP",
  );
  assert.equal(
    validateBusinessEntranceObservation({
      ...observation,
      observeFamilies: [
        ...observation.observeFamilies,
        {
          id: "unsafe_early_retirement",
          status: "RETIRED",
          observationDays: 0,
          retirementAllowed: true,
          replacement: "UNPROVEN",
        },
      ],
    }).decision,
    "STOP",
  );
});

test("required anchor list remains exact and sorted", () => {
  assert.deepEqual(REQUIRED_ANCHOR_PATHS, [
    "backend/app/api/chancellor_drafts.py",
    "backend/app/api/decree_jobs.py",
    "backend/app/api/decrees.py",
    "backend/app/api/junjichu_cases.py",
    "backend/app/api/scene_packs.py",
    "backend/app/api/shiguan.py",
    "frontend/src/app/dadian",
    "frontend/src/app/honglusi/page.tsx",
    "frontend/src/app/junjichu/scene-board/page.tsx",
    "frontend/src/app/study/StudyClient.tsx",
    "frontend/src/lib/backendClient.ts",
    "frontend/src/lib/requireUser.ts",
    "frontend/src/lib/session.ts",
  ]);
});

test("CLI check is stable, read-only and non-authorizing", () => {
  const first = spawnSync(process.execPath, ["scripts/business-entrance-observation.mjs", "--check"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  const second = spawnSync(process.execPath, ["scripts/business-entrance-observation.mjs", "--check"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  assert.equal(first.status, 0, first.stderr);
  assert.equal(second.status, 0, second.stderr);
  assert.equal(first.stderr, "");
  assert.equal(first.stdout, second.stdout);
  const parsed = JSON.parse(first.stdout);
  assert.equal(parsed.decision, "PASS");
  assert.equal(parsed.nonAuthorizing, true);
  assert.equal(parsed.canExecuteProductWork, undefined);
  assert.equal(parsed.productionDeploymentAuthorized, undefined);
});
