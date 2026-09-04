#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const SCHEMA_VERSION = "chaotang.business-entrance-observation.v1";

export const REQUIRED_ANCHOR_PATHS = Object.freeze([
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

export const FORBIDDEN_PATTERN_IDS = Object.freeze([
  "dirty_donor_bulk_import",
  "external_publication_activation",
  "ima_or_mingshuo_second_truth_source",
  "legacy_route_retirement_without_observation",
  "production_deployment_claim",
  "second_product_authority",
  "second_shiguan_writer",
  "second_truth_ledger",
  "swarm_or_direct_business_execution",
]);

function git(args, cwd) {
  try {
    return execFileSync("/usr/bin/git", ["--no-replace-objects", ...args], {
      cwd,
      encoding: "utf8",
      env: {
        PATH: "/usr/bin:/bin",
        GIT_CONFIG_NOSYSTEM: "1",
        GIT_NO_REPLACE_OBJECTS: "1",
        GIT_TERMINAL_PROMPT: "0",
      },
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 10_000,
    }).trim();
  } catch {
    return null;
  }
}

function sortedById(items) {
  return [...items].sort((left, right) => left.id.localeCompare(right.id));
}

function uniqueIds(items) {
  return new Set(items.map((item) => item.id)).size === items.length;
}

export function buildBusinessEntranceObservation({ cwd = process.cwd() } = {}) {
  const root = path.resolve(cwd);
  const requiredAnchors = REQUIRED_ANCHOR_PATHS.map((entry) => ({
    path: entry,
    role: "CURRENT_MAINLINE_ANCHOR",
    exists: existsSync(path.join(root, entry)),
  }));

  const observation = {
    schemaVersion: SCHEMA_VERSION,
    decision: "PASS",
    nonAuthorizing: true,
    baseline: {
      branch: "ext-dev",
      head: git(["rev-parse", "HEAD"], root),
      tree: git(["rev-parse", "HEAD^{tree}"], root),
    },
    canonicalFamilies: sortedById([
      {
        id: "authenticated_frontend_session",
        status: "CANONICAL_AUTH_BOUNDARY",
        anchors: ["frontend/src/lib/requireUser.ts", "frontend/src/lib/session.ts"],
        currentAuthority: "SERVER_VALIDATED_SESSION_ONLY",
      },
      {
        id: "chancellor_draft_pre_decree",
        status: "CANONICAL_PRE_DECREE_ENTRY",
        anchors: ["backend/app/api/chancellor_drafts.py", "frontend/src/app/study/StudyClient.tsx"],
        currentAuthority: "NO_EXECUTION_SIDE_EFFECTS",
      },
      {
        id: "chancellor_explicit_decree",
        status: "CANONICAL_EXECUTION_ENTRY",
        anchors: ["backend/app/api/decrees.py", "frontend/src/app/study/StudyClient.tsx"],
        currentAuthority: "EXPLICIT_USER_DECREE",
      },
      {
        id: "decree_job_async_execution",
        status: "CANONICAL_ASYNC_JOB_SURFACE",
        anchors: ["backend/app/api/decree_jobs.py"],
        currentAuthority: "SERVER_OWNED_JOB_IDENTITY",
      },
      {
        id: "honglusi_capability_gate_ui",
        status: "OBSERVED_CAPABILITY_GATE_UI",
        anchors: ["frontend/src/app/honglusi/page.tsx"],
        currentAuthority: "NO_PRODUCTION_THIRD_PARTY_ACTIVATION",
      },
      {
        id: "junjichu_case_projection",
        status: "CANONICAL_CASE_PROJECTION",
        anchors: ["backend/app/api/junjichu_cases.py", "frontend/src/app/junjichu/scene-board/page.tsx"],
        currentAuthority: "OWNER_SCOPED_PROJECTION_ONLY",
      },
      {
        id: "scene_pack_v1_roadshow_surface",
        status: "ROADSHOW_CANONICAL_SCENE_SURFACE",
        anchors: ["backend/app/api/scene_packs.py", "frontend/src/app/dadian"],
        currentAuthority: "NON_PRODUCTION_DECISION_SURFACE",
      },
      {
        id: "shiguan_archive_and_recall",
        status: "CANONICAL_ARCHIVE_AND_RECALL_SURFACE",
        anchors: ["backend/app/api/shiguan.py"],
        currentAuthority: "SERVER_BOUND_OUTCOMES_ONLY",
      },
    ]),
    observeFamilies: sortedById([
      {
        id: "frontend_compatibility_bff_routes",
        status: "OBSERVE_BEFORE_RETIREMENT",
        observationDays: 0,
        retirementAllowed: false,
        replacement: "CANONICAL_BACKEND_API_ADAPTERS",
      },
      {
        id: "jinyiwei_qintianjian_read_surfaces",
        status: "BOUNDED_EVIDENCE_READERS",
        observationDays: 0,
        retirementAllowed: false,
        replacement: "CONTROLLED_READER_SURFACES",
      },
      {
        id: "swarm_runs_compatibility_surface",
        status: "OBSERVE_BEFORE_RETIREMENT",
        observationDays: 0,
        retirementAllowed: false,
        replacement: "UNPROVEN",
      },
    ]),
    migrationRequiredFamilies: sortedById([
      {
        id: "dirty_root_backend_src_and_web_assets",
        status: "DONOR_ONLY_PENDING_TRIAGE",
        currentAuthority: "NONE",
        replacement: "REQUIRES_BYTE_DONOR_REVIEW",
      },
      {
        id: "flywheel_and_knowledge_writers",
        status: "P0_CANONICAL_WRITER_PROOF_REQUIRED",
        currentAuthority: "NONE",
        replacement: "SHIGUAN_RECEIPT_BOUNDARY_REQUIRED",
      },
      {
        id: "legacy_direct_execution_sessions",
        status: "MIGRATION_REVIEW_REQUIRED",
        currentAuthority: "NONE",
        replacement: "CANONICAL_DECREE_OR_ENGINEERING_KERNEL",
      },
      {
        id: "legacy_orchestration_routes",
        status: "MIGRATION_REVIEW_REQUIRED",
        currentAuthority: "NONE",
        replacement: "CANONICAL_DECREE_OR_ENGINEERING_KERNEL",
      },
      {
        id: "legacy_swarm_session_runners",
        status: "MIGRATION_REVIEW_REQUIRED",
        currentAuthority: "NONE",
        replacement: "CANONICAL_DECREE_OR_ENGINEERING_KERNEL",
      },
    ]),
    forbiddenPatterns: FORBIDDEN_PATTERN_IDS.map((id) => ({
      id,
      decision: "STOP",
    })),
    requiredAnchors,
    nextSuccessor: {
      taskId: "MINGSHUO-SOLUTION-HUB-V1-FACT-PACK-BLUEPRINT-SUCCESSOR-20260904",
      status: "REQUIRES_SEPARATE_PRODUCT_AUTHORITY",
      candidatePathsFrozen: false,
    },
    errors: [],
  };

  return validateBusinessEntranceObservation(observation);
}

export function validateBusinessEntranceObservation(observation) {
  const errors = [];
  const add = (condition, code) => {
    if (condition && !errors.includes(code)) errors.push(code);
  };

  add(observation?.schemaVersion !== SCHEMA_VERSION, "SCHEMA_VERSION_INVALID");
  add(!["PASS", "STOP"].includes(observation?.decision), "DECISION_INVALID");
  add(observation?.nonAuthorizing !== true, "NON_AUTHORIZING_REQUIRED");
  add(typeof observation?.baseline?.head !== "string" || typeof observation?.baseline?.tree !== "string", "BASELINE_UNVERIFIED");

  for (const key of ["canonicalFamilies", "observeFamilies", "migrationRequiredFamilies", "forbiddenPatterns", "requiredAnchors"]) {
    add(!Array.isArray(observation?.[key]), `${key.toUpperCase()}_INVALID`);
    if (Array.isArray(observation?.[key])) add(!uniqueIds(observation[key].filter((item) => typeof item.id === "string")), `${key.toUpperCase()}_DUPLICATE`);
  }

  const forbiddenIds = Array.isArray(observation?.forbiddenPatterns)
    ? observation.forbiddenPatterns.map((pattern) => pattern.id).sort()
    : [];
  add(JSON.stringify(forbiddenIds) !== JSON.stringify([...FORBIDDEN_PATTERN_IDS]), "FORBIDDEN_PATTERN_SET_DRIFT");

  const anchors = Array.isArray(observation?.requiredAnchors) ? observation.requiredAnchors : [];
  add(anchors.some((anchor) => anchor?.exists !== true), "REQUIRED_ANCHOR_MISSING");

  const observeFamilies = Array.isArray(observation?.observeFamilies) ? observation.observeFamilies : [];
  add(
    observeFamilies.some((family) => family?.retirementAllowed === true && Number(family?.observationDays) < 14),
    "UNOBSERVED_RETIREMENT_FORBIDDEN",
  );

  const authorizingKeys = [
    "canExecuteProductWork",
    "canAcceptProductCandidate",
    "productionDeploymentAuthorized",
    "authorityDecision",
  ];
  add(authorizingKeys.some((key) => Object.hasOwn(observation ?? {}, key)), "AUTHORIZING_FIELD_FORBIDDEN");

  return {
    ...(observation ?? {}),
    decision: errors.length === 0 ? "PASS" : "STOP",
    nonAuthorizing: true,
    errors,
  };
}

function runCli() {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args.length === 1 && args[0] !== "--check")) {
    process.stderr.write("usage: node scripts/business-entrance-observation.mjs [--check]\n");
    process.exitCode = 2;
    return;
  }
  const observation = buildBusinessEntranceObservation({ cwd: process.cwd() });
  process.stdout.write(`${JSON.stringify(observation, null, 2)}\n`);
  if (args[0] === "--check" && observation.decision !== "PASS") {
    process.exitCode = 1;
  }
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === currentFile) {
  runCli();
}
