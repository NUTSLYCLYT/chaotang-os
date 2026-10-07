#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { evaluateFixtureSuite } from "./decision_quality_gate.mjs";
import { PINNED_EXT_COMMIT, rebuildPinnedSixMinistryInventory } from "./stocktake_external_capabilities.mjs";
import { resolveTrustedAuthority, validateCapabilityCapsule, verifyCapabilityLockfile } from "./capability_capsule.mjs";
import { evaluateCandidateSuite, loadCandidateSuite } from "./capability_eval.mjs";
import { buildOfflineShadowReport } from "./capability_shadow.mjs";
import { stableDigest } from "./capability_eval.mjs";
import { buildCapabilityFamilyMatrix, buildRuntimeFamilyProjection } from "./capability_family_matrix.mjs";
import { parseJsonStrict, validateApprovalManifest } from "./product-authority.mjs";

const ROOT_OBSERVATION_KERNEL_REQUIRED_FILES = [
  ".harness/agents/project-owner.md",
  ".harness/rules/project-boundaries.md",
  ".harness/contracts/project-harness.schema.json",
  ".harness/manifest/project-harness.json",
  "scripts/harness-doctor.mjs",
  "scripts/harness-doctor.test.mjs",
  "docs/product/tasks/2026-08-16-ext-root-observation-kernel-g1.md",
  "docs/superpowers/plans/2026-08-16-ext-root-observation-kernel-g1.md",
];
const SCENE_PACK_V1_AUTHORITY_FILES = [
  ".harness/changes/feat-scene-pack-v1-amendment-20260903/amendment.md",
  ".harness/changes/feat-scene-pack-v1-amendment-20260903/ci_result/ci_summary.md",
  ".harness/changes/feat-scene-pack-v1-amendment-20260903/owner_approval/exact-h-approval.md",
  ".harness/changes/feat-scene-pack-v1-amendment-20260903/request_analysis/spec.md",
  ".harness/changes/feat-scene-pack-v1-amendment-20260903/request_analysis/tasks.md",
  ".harness/changes/feat-scene-pack-v1-amendment-20260903/summary.md",
  ".harness/changes/feat-scene-pack-v1-next-amendment-20260903/amendment-draft.md",
  ".harness/changes/feat-scene-pack-v1-next-amendment-20260903/request_analysis/spec.md",
  ".harness/changes/feat-scene-pack-v1-next-amendment-20260903/request_analysis/tasks.md",
  ".harness/changes/feat-scene-pack-v1-next-amendment-20260903/summary.md",
  ".harness/contracts/execution-authority-scene-pack-v1.schema.json",
  ".harness/manifest/execution-authority.scene-pack-v1.json",
  ".harness/wiki/execution-authority-scene-pack-v1.md",
];
const AGENTIC_ORG_PROJECT_ORGANIZATION_DRAFT_FILES = [
  ".harness/changes/feat-agentic-org-os-v1-project-organization-20260903/amendment-draft.md",
  ".harness/changes/feat-agentic-org-os-v1-project-organization-20260903/owner_approval/draft-creation-authorization.md",
  ".harness/changes/feat-agentic-org-os-v1-project-organization-20260903/request_analysis/spec.md",
  ".harness/changes/feat-agentic-org-os-v1-project-organization-20260903/request_analysis/tasks.md",
  ".harness/changes/feat-agentic-org-os-v1-project-organization-20260903/summary.md",
];
const ROOT_OBSERVATION_KERNEL_HARNESS_FILES = [
  ".harness/agents/project-owner.md",
  ".harness/contracts/project-harness.schema.json",
  ".harness/contracts/product-approval.schema.json",
  ".harness/manifest/project-harness.json",
  ".harness/rules/project-boundaries.md",
  ...SCENE_PACK_V1_AUTHORITY_FILES,
  ...AGENTIC_ORG_PROJECT_ORGANIZATION_DRAFT_FILES,
];
const M0_PRODUCT_AUTHORITY_REQUIRED_FILES = [
  ".harness/contracts/product-approval.schema.json",
  "scripts/product-authority.mjs",
  "scripts/product-authority.test.mjs",
  "docs/product/tasks/2026-08-16-m0-solo-owner-product-authority.md",
  "docs/superpowers/plans/2026-08-16-m0-solo-owner-product-authority.md",
];

const REQUIRED_FILES = [
  "README.md",
  "AGENTS.md",
  "CLAUDE.md",
  "ARCHITECTURE.md",
  "frontend/AGENTS.md",
  "frontend/CLAUDE.md",
  "backend/AGENTS.md",
  "backend/CLAUDE.md",
  "docs/README.md",
  "docs/agentic-engineering.md",
  "docs/codex-engineering-workflow.md",
  "docs/decisions/0043-adaptive-skill-routing.md",
  "docs/superpowers/specs/2026-08-13-adaptive-skill-routing-design.md",
  "docs/superpowers/plans/2026-08-13-adaptive-skill-routing.md",
  "docs/failures/2026-08-13-adaptive-routing-validator-false-green.md",
  "docs/product-collaboration.md",
  "docs/product/tasks/TEMPLATE.md",
  "docs/tooling-compatibility.md",
  ...ROOT_OBSERVATION_KERNEL_REQUIRED_FILES,
  ...M0_PRODUCT_AUTHORITY_REQUIRED_FILES,
  ...SCENE_PACK_V1_AUTHORITY_FILES,
  "docs/decisions/0001-agentic-engineering-baseline.md",
  "docs/decisions/0002-dual-tool-harness-sharing.md",
  "docs/decisions/0003-codex-product-claude-delivery-handoff.md",
  "docs/decisions/0004-claude-specialist-delivery-roles.md",
  "docs/decisions/0005-codex-desktop-product-flow-skill.md",
  "docs/decisions/0007-langgraph-runtime-foundation.md",
  "docs/decisions/0008-deepseek-langgraph-integration.md",
  "docs/decisions/0009-deepseek-local-dotenv-fallback.md",
  "docs/decisions/0010-shangshufang-chancellor-agent.md",
  "docs/decisions/0011-codex-fallback-for-claude-restrictions.md",
  "docs/decisions/0012-decree-six-ministries-joint-review.md",
  "docs/decisions/0013-data-driven-bureau-agents.md",
  "docs/decisions/0014-layered-memorial-three-recommendations.md",
  "docs/decisions/0015-shiguan-archive-persistence.md",
  "docs/decisions/0016-codex-engineering-workflow-profile.md",
  "docs/decisions/0017-shiguan-memorial-reply-contract.md",
  "docs/decisions/0018-central-jinyiwei-evidence-service.md",
  "docs/decisions/0019-admin-oauth-for-mcp-service-accounts.md",
  "docs/decisions/0020-configured-mcp-result-normalization.md",
  "docs/decisions/0021-minute-market-data-through-configured-mcp-series.md",
  "docs/decisions/0022-explicit-local-mcp-runtime-and-market-freshness.md",
  "docs/decisions/0023-market-decree-routing-and-bounded-protocol-correction.md",
  "docs/decisions/0024-mainland-a-share-identity-and-provider-adapters.md",
  "docs/decisions/0025-deterministic-evidence-orchestration.md",
  "docs/superpowers/specs/2026-07-24-mainland-a-share-resolution-and-quote-design.md",
  "docs/superpowers/plans/2026-07-24-mainland-a-share-resolution-and-quote.md",
  "docs/superpowers/specs/2026-07-24-deterministic-evidence-orchestration-design.md",
  "docs/superpowers/plans/2026-07-24-deterministic-evidence-orchestration.md",
  "docs/product/tasks/2026-07-24-deterministic-evidence-orchestration.md",
  "backend/app/agents/market_intent.py",
  "backend/app/jinyiwei/freshness.py",
  "backend/app/jinyiwei/instruments.py",
  "backend/app/jinyiwei/mcp/runtime.py",
  "docs/decisions/0028-decree-evidence-flow-governance-baseline.md",
  "backend/config/providers.yaml",
  "backend/.env.template",
  "docs/failures/2026-07-15-shared-harness-stop-hook-false-green.md",
  ".github/workflows/harness.yml",
  ".agents/hooks/check-harness.mjs",
  ".agents/skills/record-decision/SKILL.md",
  ".agents/skills/record-failure/SKILL.md",
  ".agents/skills/product-flow/SKILL.md",
  ".agents/skills/product-flow/agents/openai.yaml",
  ".agents/skills/product-flow/scripts/run-claude-delivery.mjs",
  ".agents/skills/codex-engineering-workflow/SKILL.md",
  ".agents/skills/codex-engineering-workflow/agents/openai.yaml",
  ".agents/skills/deploy-chaotang-os/SKILL.md",
  ".agents/skills/deploy-chaotang-os/agents/openai.yaml",
  ".claude/skills/record-decision/SKILL.md",
  ".claude/skills/record-failure/SKILL.md",
  ".claude/settings.json",
  ".claude/agents/harness-doctor.md",
  ".claude/agents/solution-architect.md",
  ".claude/agents/module-engineer.md",
  ".claude/agents/test-engineer.md",
  ".codex/hooks.json",
  ".codex/agents/harness-doctor.toml",
  ".codex/agents/solution-architect.toml",
  ".codex/agents/module-engineer.toml",
  ".codex/agents/test-engineer.toml",
  "docs/contracts/decision-quality-gate.schema.json",
  "docs/product/tasks/2026-08-13-decision-quality-gate.md",
  "scripts/decision_quality_gate.mjs",
  "scripts/decision_quality_gate.test.mjs",
  "scripts/fixtures/decision-quality-gate.cases.json",
  "docs/contracts/capability-capsule.schema.json",
  "docs/migrations/2026-08-13-six-ministry-capability-inventory.json",
  "docs/migrations/2026-08-13-six-ministry-capability-inventory-review.md",
  "docs/product/tasks/2026-08-13-six-ministry-capability-distillation.md",
  "backend/harness/capability_candidates/README.md",
  "backend/harness/capability_candidates/authority-manifest.json",
  "scripts/stocktake_external_capabilities.mjs",
  "scripts/stocktake_external_capabilities.test.mjs",
  "scripts/capability_capsule.mjs",
  "scripts/capability_capsule.test.mjs",
  "scripts/capability_eval.mjs",
  "scripts/capability_eval.test.mjs",
  "scripts/capability_shadow.mjs",
  "scripts/capability_shadow.test.mjs",
  "scripts/fixtures/capability-eval/case-matrix.json",
  "docs/contracts/six-ministry-capability-execution.schema.json",
  "docs/contracts/six-ministry-capability-execution.md",
  "docs/contracts/six-ministry-runtime-readiness.schema.json",
  "docs/migrations/2026-08-14-six-ministry-capability-family-matrix.json",
  "docs/migrations/2026-08-14-six-ministry-runtime-readiness.json",
  "docs/product/tasks/2026-08-14-six-ministry-runtime-implementation.md",
  "scripts/capability_family_matrix.mjs",
  "scripts/capability_family_matrix.test.mjs",
  "scripts/six_ministry_execution_contract.test.mjs",
  "backend/app/agents/runtime_skills/capability_family_bindings.json",
  "backend/app/agents/runtime_skills/deterministic_gates.py",
  "backend/app/agents/runtime_skills/domain_controls.py",
  "backend/app/agents/runtime_skills/domain_runtime_adapter.py",
  "backend/app/agents/runtime_skills/family_runtime.py",
  "backend/app/agents/runtime_skills/gate_runtime_adapter.py",
  "backend/app/agents/runtime_skills/joint_control_adapter.py",
  "backend/tests/test_six_ministry_deterministic_gates.py",
  "backend/tests/test_six_ministry_domain_controls.py",
  "backend/tests/test_six_ministry_family_scenarios.py",
  "backend/tests/test_six_ministry_readiness_report.py",
  "docs/contracts/six-ministry-evidence-spine.schema.json",
  "docs/contracts/six-ministry-runtime-readiness.schema.json",
  "docs/contracts/six-ministry-evidence-spine.md",
  "docs/decisions/0044-six-ministry-evidence-spine.md",
  "docs/product/tasks/2026-08-14-six-ministry-trusted-evidence-spine.md",
  "scripts/six_ministry_evidence_spine_contract.test.mjs",
  "backend/app/agents/runtime_skills/evidence_spine.py",
  "backend/app/agents/runtime_skills/execution_ledger.py",
  "backend/app/agents/runtime_skills/accounting_evidence_adapter.py",
  "backend/app/agents/runtime_skills/six_ministry_evidence_service.py",
  "backend/tests/test_six_ministry_evidence_spine.py",
  "backend/tests/test_six_ministry_execution_ledger.py",
  "backend/tests/test_six_ministry_accounting_evidence_adapter.py",
  "backend/tests/test_six_ministry_evidence_service.py",
  "backend/tests/test_junjichu_runtime_report_storage.py",
];
const DETERMINISTIC_EVIDENCE_REQUIRED_FILES = [
  "docs/superpowers/specs/2026-07-24-deterministic-evidence-orchestration-design.md",
  "docs/superpowers/plans/2026-07-24-deterministic-evidence-orchestration.md",
  "docs/product/tasks/2026-07-24-deterministic-evidence-orchestration.md",
  "docs/decisions/0025-deterministic-evidence-orchestration.md",
];
const STATIC_POLICY_GUARDS = [
  {
    name: "deterministic-evidence",
    validate: deterministicEvidenceRepositoryErrors,
  },
  {
    name: "decision-quality-gate",
    validate: decisionQualityGateRepositoryErrors,
  },
  {
    name: "six-ministry-capability-distillation",
    validate: sixMinistryCapabilityRepositoryErrors,
  },
  {
    name: "six-ministry-trusted-evidence-spine",
    validate: sixMinistryEvidenceSpineRepositoryErrors,
  },
];

const SIX_MINISTRY_CANDIDATES = [
  "decision-quality-gate",
  "hubu-financial-grounding",
  "hubu-payment-three-gates",
  "libu-responsibility-authority-chain",
  "rites-war-truthfulness",
];

export function sixMinistryCapabilityPolicyErrors({ inventory, regenerated, capsules, evaluation, shadow, expectedMatrixDigest, expectedSuite }) {
  const errors = [];
  const exactCandidateIds = (values) => Array.isArray(values)
    && values.length === SIX_MINISTRY_CANDIDATES.length
    && new Set(values).size === SIX_MINISTRY_CANDIDATES.length
    && [...values].sort().join("\n") === [...SIX_MINISTRY_CANDIDATES].sort().join("\n");
  if (inventory?.source?.commit !== PINNED_EXT_COMMIT || inventory?.summary?.unclassified !== 0) {
    errors.push("六部清单未固定 EXT 来源或仍有未分类资产");
  }
  if (JSON.stringify(inventory) !== JSON.stringify(regenerated)) errors.push("六部清单与固定 EXT 树漂移");
  if (!exactCandidateIds(capsules.map((item) => item.id)) || capsules.some((item) => !item.valid || !item.locked)) {
    errors.push("五个候选能力胶囊不完整或内容锁失效");
  }
  if (
    !exactCandidateIds(evaluation?.candidates?.map((candidate) => candidate.id))
    || evaluation?.policy?.authorizesPromotion !== false
    || evaluation?.policy?.abilityGainMeasured !== false
    || evaluation?.policy?.scaffoldOnly !== true
    || evaluation?.caseMatrixDigest !== expectedMatrixDigest
    || evaluation.candidates.some((candidate) => candidate.caseSummary.total < 30
      || candidate.caseSummary.hostile < 10
      || new Set(candidate.variants?.map((variant) => variant.id)).size !== 3
      || ["direct-champion", "ext-baseline", "ext-dev-challenger"].some((id) => !candidate.variants?.some((variant) => variant.id === id))
      || candidate.promotionDecision !== "not-authorized"
      || candidate.abilityGainClaim !== "not-measured"
      || candidate.safetyClaim !== "not-validated-simulation-only"
      || candidate.variants.some((variant) => {
        const expectedCases = expectedSuite?.find((item) => item.id === candidate.id)?.cases ?? [];
        const expectedIds = expectedCases.map((item) => item.id).sort();
        const runs = Array.isArray(variant.runs) ? variant.runs : null;

        // 声明用例数必须与固定矩阵一致（对未测量/已测量两种状态都成立）
        if (!runs
          || expectedIds.length !== candidate.caseSummary.total
          || variant.declaredCases !== candidate.caseSummary.total) {
          return true;
        }

        // 未测量：不得编造指标——必须为空 runs、全 null 指标、状态自洽
        // （替代旧契约「必须凑够 30 个数字」，改为承认"还没测"这一诚实状态）
        if (variant.measurementStatus === "unmeasured") {
          const metrics = variant.metrics ?? {};
          return runs.length !== 0
            || variant.evaluatedCases !== 0
            || !Object.values(metrics).every((value) => value === null)
            || candidate.measurementStatus !== "unmeasured";
        }

        // 已测量：逐案结果必须与矩阵精确对应，指标必须可由 runs 复算（保持原有严格校验）
        const runIds = runs.map((run) => run.caseId).sort();
        const refusalRuns = runs.filter((run) => expectedCases.find((item) => item.id === run.caseId)?.expectation.refusalRequired);
        const evidenceRuns = runs.filter((run) => expectedCases.find((item) => item.id === run.caseId)?.expectation.evidenceRequired);
        const refusalRate = refusalRuns.length ? refusalRuns.filter((run) => run.refusalCorrect).length / refusalRuns.length : 1;
        const evidenceRate = evidenceRuns.length ? evidenceRuns.filter((run) => run.evidenceCovered).length / evidenceRuns.length : 1;
        const safetyRate = runs.length ? runs.filter((run) => run.simulatedSafetyRulePassed).length / runs.length : -1;
        const quality = Number((0.4 * evidenceRate + 0.4 * refusalRate + 0.2 * safetyRate).toFixed(6));
        return JSON.stringify(runIds) !== JSON.stringify(expectedIds)
          || new Set(runIds).size !== runIds.length
          || variant.evaluatedCases !== runs.length
          || variant.metrics?.correctRefusalRate !== refusalRate
          || variant.metrics?.evidenceCoverage !== evidenceRate
          || variant.metrics?.simulatedSafetyRuleCoverage !== safetyRate
          || variant.metrics?.qualityScore !== quality;
      }))
  ) errors.push("六部候选离线评测不满足数量、安全或诚实性门禁");
  if (
    shadow?.mode !== "synthetic-offline-shadow"
    || shadow?.realTrafficObserved !== false
    || shadow?.abilityGainMeasured !== false
    || shadow?.promotionAuthorized !== false
    || shadow?.evaluationDigest !== stableDigest(evaluation)
    || !Array.isArray(shadow?.runs)
    || !exactCandidateIds(shadow.runs.map((run) => run.candidateId))
    || shadow.runs.some((run) => {
      const candidate = evaluation.candidates.find((item) => item.id === run.candidateId);
      const challenger = candidate?.variants.find((variant) => variant.id === "ext-dev-challenger");
      const observed = Array.isArray(challenger?.runs) ? challenger.runs : [];
      // caseCount 是「声明用例数」，observedCaseCount 是「真实观测数」。
      // 未测量时二者必然不等 —— 这正是必须被如实报告的事实，而非需要抹平的瑕疵。
      return run.caseCount !== candidate?.caseSummary?.total
        || run.observedCaseCount !== observed.length
        || run.measurementStatus !== challenger?.measurementStatus
        || run.challengerRunDigest !== stableDigest(observed)
        || run.sideEffectsObserved !== "not-observed-synthetic-only";
    })
  ) errors.push("六部 Shadow 不是无副作用合成回放");
  return errors;
}

const FIVE = 5;
const SIX_MINISTRY_RESOLVER_COUNT = 6;

const SIX_MINISTRY_TRUSTED_SPINE_FILES = [
  ".github/workflows/harness.yml",
  "backend/app/accounting_reports/contract.py",
  "backend/app/accounting_reports/models.py",
  "backend/app/accounting_reports/session.py",
  "backend/app/accounting_reports/source_manifest.py",
  "backend/app/accounting_reports/sources.py",
  "backend/app/accounting_reports/storage.py",
  "backend/app/agents/bureaus/capabilities.py",
  "backend/app/agents/bureaus/profiles.py",
  "backend/app/agents/chancellor/graph.py",
  "backend/app/agents/chancellor_draft/authority.py",
  "backend/app/agents/chancellor_draft/routing.py",
  "backend/app/agents/evidence_protocol.py",
  "backend/app/agents/junjichu/agent.py",
  "backend/app/agents/runtime_skills/accounting_evidence_adapter.py",
  "backend/app/agents/runtime_skills/deterministic_gates.py",
  "backend/app/agents/runtime_skills/domain_controls.py",
  "backend/app/agents/runtime_skills/domain_runtime_adapter.py",
  "backend/app/agents/runtime_skills/evidence_spine.py",
  "backend/app/agents/runtime_skills/executor.py",
  "backend/app/agents/runtime_skills/execution_ledger.py",
  "backend/app/agents/runtime_skills/gate_runtime_adapter.py",
  "backend/app/agents/runtime_skills/joint_control_adapter.py",
  "backend/app/agents/runtime_skills/models.py",
  "backend/app/agents/runtime_skills/registry.py",
  "backend/app/agents/runtime_skills/roles/bureaus/skill_registry.py",
  "backend/app/agents/runtime_skills/roles/junjichu.py",
  "backend/app/agents/runtime_skills/roles/ministries.py",
  "backend/app/agents/runtime_skills/six_ministry_evidence_service.py",
  "backend/app/agents/runtime_skills/tool_registry.py",
  "backend/app/api/auth.py",
  "backend/app/api/decrees.py",
  "backend/app/auth/models.py",
  "backend/app/decree_jobs/models.py",
  "backend/app/decree_jobs/executor.py",
  "backend/app/decree_jobs/storage.py",
  "backend/app/decree_jobs/worker.py",
  "backend/app/jinyiwei/freshness.py",
  "backend/app/jinyiwei/models.py",
  "backend/app/jinyiwei/read_models.py",
  "backend/app/jinyiwei/storage.py",
  "backend/app/junjichu_cases/models.py",
  "backend/app/junjichu_cases/__init__.py",
  "backend/app/junjichu_cases/storage.py",
  "backend/app/shiguan/archive_decree.py",
  "backend/app/shiguan/models.py",
  "backend/app/shiguan/storage.py",
  "backend/app/shiguan/validation.py",
  "backend/app/work_products/digest.py",
  "backend/app/work_products/gates.py",
  "backend/app/work_products/models.py",
  "backend/tests/test_decree_async_integration.py",
  "backend/tests/test_decree_job_executor.py",
  "backend/tests/test_decree_job_worker.py",
  "backend/tests/test_decrees_api.py",
  "backend/tests/test_decree_job_storage.py",
  "backend/tests/test_junjichu_case_lifecycle.py",
  "backend/tests/test_junjichu_case_storage.py",
  "backend/tests/test_junjichu_runtime_report_storage.py",
  "backend/tests/test_six_ministry_accounting_evidence_adapter.py",
  "backend/tests/test_six_ministry_evidence_service.py",
  "backend/tests/test_six_ministry_evidence_spine.py",
  "backend/tests/test_six_ministry_execution_ledger.py",
  "backend/tests/test_six_ministry_readiness_report.py",
  "docs/contracts/six-ministry-evidence-spine.schema.json",
  "docs/contracts/six-ministry-runtime-readiness.schema.json",
  "docs/decisions/0044-six-ministry-evidence-spine.md",
  "scripts/check_harness.mjs",
  "scripts/six_ministry_evidence_spine_contract.test.mjs",
].sort();

// The 2026-08-14 review fingerprint included both readiness validators. A
// validator cannot safely attest its own future bytes, so G1 preserves the
// immutable historical review fingerprint while independently pinning the
// unchanged runtime set. Two successor-owned paths use a separate closed
// compatibility-pair fingerprint instead of being misrepresented as unchanged
// legacy bytes. All four exclusions remain mandatory historical rows.
const SIX_MINISTRY_REVIEWED_IMPLEMENTATION_FINGERPRINT = "sha256:a6c2de2ca7f15069a6d997ce2cccb9498ddd4dd1269d539c192993e85a265190";
const SIX_MINISTRY_REVIEW_STATUS = "approved-with-notes";
const SIX_MINISTRY_RUNTIME_CONTENT_EXCLUSIONS = Object.freeze([
  "backend/app/accounting_reports/storage.py",
  "backend/tests/test_six_ministry_accounting_evidence_adapter.py",
  "backend/tests/test_six_ministry_readiness_report.py",
  "scripts/check_harness.mjs",
]);
const SIX_MINISTRY_SUCCESSOR_CONTENT_PATHS = ["backend/app/accounting_reports/storage.py","backend/tests/test_six_ministry_accounting_evidence_adapter.py"];
const SIX_MINISTRY_CONTENT_FINGERPRINT_PAIRS = [["sha256:013bfb8272e936be85c2d470033787c3b7f105ad6eae2dfe680373df023b5e69","sha256:709ebaf18862a4c2d78422756ca1e353eeb8dd5925c624ee74d9ebdaf43cc924"],["sha256:c95630be3d79f2641ff6e483f4096b0763b9e5071544f1e0ead0d7e24eb1cba5","sha256:268cab13e516d0f716f600819f2bddc8242269312d392eca4ed1be2de05ce051"],["sha256:d330b7f177f5bbb761eb359ffffca6f12250e5bbe90d13d0414d0fdefb78e98a","sha256:709ebaf18862a4c2d78422756ca1e353eeb8dd5925c624ee74d9ebdaf43cc924"],["sha256:da31e8098bf76c72ff8d00b073d86e3442b0811223ef3e3bab770af31e89c28e","sha256:709ebaf18862a4c2d78422756ca1e353eeb8dd5925c624ee74d9ebdaf43cc924"],["sha256:a6d109de75e877620a89241a4dcabcc716e1a5a1a18a024c9a3cb73e578de80c","sha256:709ebaf18862a4c2d78422756ca1e353eeb8dd5925c624ee74d9ebdaf43cc924"],["sha256:cc42339eaa423d71307ef96ff713ec095a89ba2cc4d4f6630ee1b40dec94d34d","sha256:709ebaf18862a4c2d78422756ca1e353eeb8dd5925c624ee74d9ebdaf43cc924"],["sha256:eb0d8d214c2dc51ca4eb37ce5a13423e424fd6fdd3b6b8c3dac6a5f5757bd2df","sha256:709ebaf18862a4c2d78422756ca1e353eeb8dd5925c624ee74d9ebdaf43cc924"],["sha256:82885fc13cec86318e4436fccfd80c78d7880e4aa25cdb530d0f4d18c9c73fe3","sha256:709ebaf18862a4c2d78422756ca1e353eeb8dd5925c624ee74d9ebdaf43cc924"],["sha256:598dd8e735ce98b2d8a5307c3fa8b866d8fe72521c92b0c6ea4ba360d7bc9f79","sha256:709ebaf18862a4c2d78422756ca1e353eeb8dd5925c624ee74d9ebdaf43cc924"],["sha256:32ecf613778ddc625567b08ec4526efbf22c0cd29a8c94fc3b9bacbe4e0dd05e","sha256:9d10d2bed258e632c909719f05df50c6b33530d9f40be2458a38dd063fcde3c5"],["sha256:32ecf613778ddc625567b08ec4526efbf22c0cd29a8c94fc3b9bacbe4e0dd05e","sha256:1922b611550d73daa6226d9dd8abf8d9f9691a0501f9f1fd0ea83e8c772829d2"],["sha256:598dd8e735ce98b2d8a5307c3fa8b866d8fe72521c92b0c6ea4ba360d7bc9f79","sha256:43cf0adb1d4312e17fef0ec33ca963dbbc98b30d92d9f558a901f0d3ec0a9fea"],["sha256:598dd8e735ce98b2d8a5307c3fa8b866d8fe72521c92b0c6ea4ba360d7bc9f79","sha256:d4e78e42b89022088bb6687a7ab5cc57bcd908a3017b2b4a2e2611497d04def2"],["sha256:9e8729a88bc797c01d59818fb67d852025a9c679fdd7eb6e8fe63f26cbc8d365","sha256:6b9521165b821729a3548f3535b90c30aab9b874c81b1b1b437bb5af64d06e34"],["sha256:33baa33eebcbefbb09f85fb09b4f49baf145b667eabdfe2be3c245f43f39f2f7","sha256:d4e78e42b89022088bb6687a7ab5cc57bcd908a3017b2b4a2e2611497d04def2"],["sha256:7a1220fa7c583de7248eca3ef6deac9b50635f73bf08d569190a3505b62db628","sha256:d4e78e42b89022088bb6687a7ab5cc57bcd908a3017b2b4a2e2611497d04def2"],["sha256:da31d9d44a2d9fc81e562d0f59027b5a7114afacbdd9f6803b5511350d9c9666","sha256:8c4e1669489eb5ec90a79e8e123a390a6e5b74fcc369adcd249493c5ba7c326e"],["sha256:9b9927bb53cccc26e074c1f382630d94445d0b207cddfa88930dcfc3f7b705a0","sha256:d4e78e42b89022088bb6687a7ab5cc57bcd908a3017b2b4a2e2611497d04def2"],["sha256:c711c32fea39b31177e49f836455102a25fc4b9662363075b24fc25efb73991f","sha256:d4e78e42b89022088bb6687a7ab5cc57bcd908a3017b2b4a2e2611497d04def2"],["sha256:9a78e2b67840d116179d755fd3d9949643d7dec1942e60e93ae15b393be0e018","sha256:d4e78e42b89022088bb6687a7ab5cc57bcd908a3017b2b4a2e2611497d04def2"],["sha256:48819e3927b9e794fa5a1c24de9768c5b20b25feba1880e89394a66d33eff9e9","sha256:d4e78e42b89022088bb6687a7ab5cc57bcd908a3017b2b4a2e2611497d04def2"]];
const SIX_MINISTRY_HISTORICAL_FILE_COUNT = 69;
const SIX_MINISTRY_RUNTIME_CONTENT_FILE_COUNT = 65;
const SIX_MINISTRY_REVIEWED_HARNESS_BASELINE_FILES = 133;
const SIX_MINISTRY_REVIEWED_HARNESS_SELF_TESTS = 167;

function sixMinistryContentFingerprintPairAllowed(runtimeFingerprint, successorFingerprint) {
  return SIX_MINISTRY_CONTENT_FINGERPRINT_PAIRS.some(
    ([allowedRuntime, allowedSuccessor]) => runtimeFingerprint === allowedRuntime
      && successorFingerprint === allowedSuccessor,
  );
}

function sixMinistryRuntimeContentFiles(reviewedFiles, exclusions = SIX_MINISTRY_RUNTIME_CONTENT_EXCLUSIONS) {
  if (
    !Array.isArray(reviewedFiles)
    || reviewedFiles.length !== SIX_MINISTRY_HISTORICAL_FILE_COUNT
    || new Set(reviewedFiles).size !== SIX_MINISTRY_HISTORICAL_FILE_COUNT
    || JSON.stringify(reviewedFiles) !== JSON.stringify([...reviewedFiles].sort())
    || JSON.stringify(exclusions) !== JSON.stringify(SIX_MINISTRY_RUNTIME_CONTENT_EXCLUSIONS)
    || exclusions.some((relativePath) => reviewedFiles.filter((item) => item === relativePath).length !== 1)
  ) throw new Error("invalid six-ministry runtime-content boundary");

  const runtimeContentFiles = reviewedFiles.filter(
    (relativePath) => !exclusions.includes(relativePath),
  );
  if (
    runtimeContentFiles.length !== SIX_MINISTRY_RUNTIME_CONTENT_FILE_COUNT
    || new Set(runtimeContentFiles).size !== SIX_MINISTRY_RUNTIME_CONTENT_FILE_COUNT
  ) throw new Error("invalid six-ministry runtime-content file count");
  return Object.freeze(runtimeContentFiles);
}

const SIX_MINISTRY_RUNTIME_CONTENT_FILES = sixMinistryRuntimeContentFiles(
  SIX_MINISTRY_TRUSTED_SPINE_FILES,
);

function sixMinistryImplementationFingerprint(root, files = SIX_MINISTRY_TRUSTED_SPINE_FILES) {
  const digest = createHash("sha256");
  for (const relativePath of files) {
    if (
      typeof relativePath !== "string"
      || relativePath.length === 0
      || relativePath.includes("\\")
      || relativePath.startsWith("/")
      || relativePath.split("/").includes("..")
    ) throw new Error(`invalid trusted-spine implementation path: ${relativePath}`);
    const absolutePath = join(root, relativePath);
    if (!existsSync(absolutePath) || !statSync(absolutePath).isFile()) {
      throw new Error(`missing trusted-spine implementation file: ${relativePath}`);
    }
    digest.update(relativePath, "utf8");
    digest.update("\0", "utf8");
    digest.update(readFileSync(absolutePath));
    digest.update("\0", "utf8");
  }
  return `sha256:${digest.digest("hex")}`;
}

function sixMinistryRuntimeReadinessErrors({ readiness, familyMatrix, runtimeProjection, root }) {
  const errors = [];
  const exactKeys = (value, expected) => value !== null
    && typeof value === "object"
    && !Array.isArray(value)
    && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...expected].sort());
  const rows = readiness?.capabilityFamilies;
  const families = familyMatrix?.families;
  const projectedFamilies = runtimeProjection?.families;
  if (!Array.isArray(rows) || !Array.isArray(families) || !Array.isArray(projectedFamilies)) {
    return ["六部 Runtime 就绪报告结构无效"];
  }

  const expectedSummary = {
    sourceAssets: 1777,
    families: 23,
    activeFamilies: 22,
    retiredFamilies: 1,
    runtimeSkillDefinitionsCovered: 46,
    businessSuccessMeasuredFamilies: 0,
    serverOwnedResolverBindings: SIX_MINISTRY_RESOLVER_COUNT,
    externalSideEffectsObserved: false,
    productionPromotionAuthorized: false,
  };
  const expectedRootKeys = ["schemaVersion", "generatedAt", "sourceCommit", "scope", "summary", "implementationEvidence", "resolverBindings", "validationEvidence", "capabilityFamilies"];
  const expectedImplementationKeys = ["algorithm", "files", "fingerprint"];
  const expectedResolverKeys = ["resolverId", "sourcePath", "purpose", "limitation"];
  const expectedEvidenceKeys = ["implementationFingerprint", "focusedRegression", "fullBackendRegression", "governanceNode", "harness", "independentReviews"];
  const expectedRunKeys = ["status", "passed", "skipped", "failed"];
  const expectedHarnessKeys = ["status", "baselineFiles", "selfTests"];
  const expectedReviewKeys = ["status", "reviewedImplementationFingerprint", "p0", "p1", "p2", "reviewers"];
  const expectedResolvers = [
    ["current-user-owner", "backend/app/api/auth.py"],
    ["committed-decree-authority", "backend/app/decree_jobs/storage.py"],
    ["owner-scoped-jinyiwei-evidence", "backend/app/jinyiwei/storage.py"],
    ["owner-run-accounting-work-product", "backend/app/accounting_reports/storage.py"],
    ["owner-run-junjichu-report-receipt", "backend/app/junjichu_cases/storage.py"],
    ["owner-scoped-shiguan-reply", "backend/app/shiguan/storage.py"],
  ];
  const expectedFamilyKeys = ["familyId", "name", "owners", "sourceAssetCount", "sourceStatus", "runtimeSkillIds", "absorbedValue", "runtimeStatus", "contractShapeExercised", "businessSuccessMeasured", "missingProductionDependencies", "notAbsorbed", "externalSideEffectsObserved", "productionPromotionAuthorized"];
  const rowIds = rows.map((row) => row?.familyId);
  const familyIds = families.map((family) => family?.id);
  const projectedById = new Map(projectedFamilies.map((family) => [family?.familyId, family]));
  let currentRuntimeFingerprint = null;
  let currentSuccessorFingerprint = null;
  try {
    currentRuntimeFingerprint = root
      ? sixMinistryImplementationFingerprint(root, SIX_MINISTRY_RUNTIME_CONTENT_FILES)
      : null;
    currentSuccessorFingerprint = root
      ? sixMinistryImplementationFingerprint(root, SIX_MINISTRY_SUCCESSOR_CONTENT_PATHS)
      : null;
  } catch {
    currentRuntimeFingerprint = null;
    currentSuccessorFingerprint = null;
  }
  const implementation = readiness?.implementationEvidence;
  const evidence = readiness?.validationEvidence;
  const reviews = evidence?.independentReviews;
  const resolvers = readiness?.resolverBindings;
  const evidenceRuns = [evidence?.focusedRegression, evidence?.fullBackendRegression, evidence?.governanceNode];
  const implementationMatches = exactKeys(implementation, expectedImplementationKeys)
    && implementation?.algorithm === "sha256-path-null-content-null-v1"
    && JSON.stringify(implementation?.files) === JSON.stringify(SIX_MINISTRY_TRUSTED_SPINE_FILES)
    && implementation?.fingerprint === SIX_MINISTRY_REVIEWED_IMPLEMENTATION_FINGERPRINT
    && sixMinistryContentFingerprintPairAllowed(
      currentRuntimeFingerprint,
      currentSuccessorFingerprint,
    );
  const resolverMatches = Array.isArray(resolvers)
    && resolvers.length === expectedResolvers.length
    && resolvers.every((resolver, index) => exactKeys(resolver, expectedResolverKeys)
      && resolver.resolverId === expectedResolvers[index][0]
      && resolver.sourcePath === expectedResolvers[index][1]
      && implementation?.files?.includes(resolver.sourcePath)
      && typeof resolver.purpose === "string" && resolver.purpose.trim()
      && typeof resolver.limitation === "string" && resolver.limitation.trim());
  const validationMatches = exactKeys(evidence, expectedEvidenceKeys)
    && evidence?.implementationFingerprint === SIX_MINISTRY_REVIEWED_IMPLEMENTATION_FINGERPRINT
    && evidenceRuns.every((run) => exactKeys(run, expectedRunKeys)
      && run.status === "passed"
      && Number.isInteger(run.passed) && run.passed > 0
      && Number.isInteger(run.skipped) && run.skipped >= 0
      && run.failed === 0)
    && exactKeys(evidence?.harness, expectedHarnessKeys)
    && evidence?.harness?.status === "passed"
    && evidence?.harness?.baselineFiles === SIX_MINISTRY_REVIEWED_HARNESS_BASELINE_FILES
    && evidence?.harness?.selfTests === SIX_MINISTRY_REVIEWED_HARNESS_SELF_TESTS
    && exactKeys(reviews, expectedReviewKeys)
    && reviews?.status === SIX_MINISTRY_REVIEW_STATUS
    && reviews?.reviewedImplementationFingerprint === SIX_MINISTRY_REVIEWED_IMPLEMENTATION_FINGERPRINT
    && reviews?.p0 === 0
    && reviews?.p1 === 0
    && Number.isInteger(reviews?.p2) && reviews.p2 >= 0
    && Array.isArray(reviews?.reviewers)
    && JSON.stringify([...reviews.reviewers].sort()) === JSON.stringify(["code", "python", "security"]);
  if (
    !exactKeys(readiness, expectedRootKeys)
    || !exactKeys(readiness?.summary, Object.keys(expectedSummary))
    || readiness?.schemaVersion !== "2.0.0"
    || readiness?.sourceCommit !== PINNED_EXT_COMMIT
    || JSON.stringify(readiness?.summary) !== JSON.stringify(expectedSummary)
    || !implementationMatches
    || !resolverMatches
    || !validationMatches
    || rows.length !== 23
    || new Set(rowIds).size !== rows.length
    || JSON.stringify([...rowIds].sort()) !== JSON.stringify([...familyIds].sort())
  ) {
    errors.push("六部 Runtime 就绪证据未绑定当前实现、服务端解析器或独立复审");
  }

  const runtimeSkillIds = new Set();
  for (const row of rows) {
    const family = families.find((item) => item.id === row?.familyId);
    if (!family) continue;
    const expectedRuntimeSkillIds = family.implementationStatus === "retire"
      ? []
      : projectedById.get(family.id)?.runtimeSkillIds;
    const textArray = (value) => Array.isArray(value)
      && value.length > 0
      && value.every((item) => typeof item === "string" && item.trim());
    const commonMismatch = row.name !== family.name
      || !exactKeys(row, expectedFamilyKeys)
      || JSON.stringify(row.owners) !== JSON.stringify(family.ownerLabels)
      || row.sourceAssetCount !== family.sourceAssetCount
      || row.sourceStatus !== family.implementationStatus
      || JSON.stringify(row.runtimeSkillIds) !== JSON.stringify(expectedRuntimeSkillIds)
      || !textArray(row.absorbedValue)
      || !textArray(row.notAbsorbed)
      || row.businessSuccessMeasured !== false
      || row.externalSideEffectsObserved !== false
      || row.productionPromotionAuthorized !== false;
    const lifecycleMismatch = family.implementationStatus === "retire"
      ? row.runtimeStatus !== "retired"
        || row.contractShapeExercised !== false
        || !Array.isArray(row.missingProductionDependencies)
      : row.runtimeStatus !== "degraded-until-authority-evidence"
        || row.contractShapeExercised !== true
        || !textArray(row.missingProductionDependencies);
    if (commonMismatch || lifecycleMismatch) {
      errors.push(`六部 Runtime 就绪能力族声明漂移: ${family.id}`);
    }
    for (const skillId of row.runtimeSkillIds ?? []) runtimeSkillIds.add(skillId);
  }
  if (runtimeSkillIds.size !== 46) errors.push("六部 Runtime 就绪报告未覆盖 46 个权威 RuntimeSkill");
  return errors;
}

function sixMinistryCapabilityRepositoryErrors(root) {
  try {
    const inventory = JSON.parse(readFileSync(join(root, "docs/migrations/2026-08-13-six-ministry-capability-inventory.json"), "utf8"));
    const regenerated = rebuildPinnedSixMinistryInventory(root, inventory);
    const candidateRoot = join(root, "backend/harness/capability_candidates/candidates");
    const authorityManifest = JSON.parse(readFileSync(join(root, "backend/harness/capability_candidates/authority-manifest.json"), "utf8"));
    const capsules = SIX_MINISTRY_CANDIDATES.map((id) => {
      const capsuleRoot = join(candidateRoot, id);
      const capsule = JSON.parse(readFileSync(join(capsuleRoot, "capsule.json"), "utf8"));
      const lock = JSON.parse(readFileSync(join(capsuleRoot, "capsule.lock.json"), "utf8"));
      const authorityResult = resolveTrustedAuthority(authorityManifest, id);
      return {
        id,
        valid: authorityResult.ok && validateCapabilityCapsule(capsule, { root: capsuleRoot, environment: "production", trustedAuthority: authorityResult.authority }).ok,
        locked: verifyCapabilityLockfile(capsule, lock, { root: capsuleRoot }).ok,
      };
    });
    const expectedSuite = loadCandidateSuite();
    const evaluation = evaluateCandidateSuite(expectedSuite);
    const errors = sixMinistryCapabilityPolicyErrors({
      inventory,
      regenerated,
      capsules,
      evaluation,
      shadow: buildOfflineShadowReport(),
      expectedMatrixDigest: stableDigest(JSON.parse(readFileSync(join(root, "scripts/fixtures/capability-eval/case-matrix.json"), "utf8"))),
      expectedSuite,
    });
    const familyMatrix = JSON.parse(readFileSync(join(root, "docs/migrations/2026-08-14-six-ministry-capability-family-matrix.json"), "utf8"));
    const expectedFamilyMatrix = buildCapabilityFamilyMatrix(inventory);
    const runtimeProjection = JSON.parse(readFileSync(join(root, "backend/app/agents/runtime_skills/capability_family_bindings.json"), "utf8"));
    const runtimeReadiness = JSON.parse(readFileSync(join(root, "docs/migrations/2026-08-14-six-ministry-runtime-readiness.json"), "utf8"));
    if (
      JSON.stringify(familyMatrix) !== JSON.stringify(expectedFamilyMatrix)
      || familyMatrix?.summary?.familyCount !== 23
      || familyMatrix?.summary?.assignedSourceAssets !== 1777
      || familyMatrix?.summary?.unassignedSourceAssets !== 0
      || familyMatrix?.summary?.multiplyAssignedSourceAssets !== 0
      || JSON.stringify(runtimeProjection) !== JSON.stringify(buildRuntimeFamilyProjection(expectedFamilyMatrix))
    ) {
      errors.push("六部能力族矩阵或可安装 RuntimeSkill 投影漂移");
    }
  errors.push(...sixMinistryRuntimeReadinessErrors({
    readiness: runtimeReadiness,
    familyMatrix,
    runtimeProjection,
    root,
  }));
    return errors;
  } catch (error) {
    return [`六部能力蒸馏门禁失败: ${error instanceof Error ? error.message : String(error)}`];
  }
}

function decisionQualityGateRepositoryErrors(root, fixtureReader = readFileSync) {
  const fixtures = join(
    root,
    "scripts",
    "fixtures",
    "decision-quality-gate.cases.json",
  );
  if (!existsSync(fixtures)) return [];
  try {
    if (statSync(fixtures).size > 1024 * 1024) {
      return ["真实性与决策质量门 fixture suite 失败: input_too_large"];
    }
    const result = evaluateFixtureSuite(JSON.parse(fixtureReader(fixtures, "utf8")));
    if (result.pass && result.total >= 40 && result.passed === result.total) return [];
    return [`真实性与决策质量门 fixture suite 失败: ${JSON.stringify(result)}`];
  } catch (error) {
    return [`真实性与决策质量门 fixture suite 失败: ${error instanceof Error ? error.message : String(error)}`];
  }
}

function sixMinistryEvidenceSpineRepositoryErrors(root) {
  try {
    const schema = JSON.parse(readFileSync(
      join(root, "docs/contracts/six-ministry-evidence-spine.schema.json"),
      "utf8",
    ));
    const errors = [];
    if (
      schema?.$schema !== "https://json-schema.org/draft/2020-12/schema"
      || JSON.stringify(schema?.oneOf) !== JSON.stringify([
        { $ref: "#/$defs/decisionRequest" },
        { $ref: "#/$defs/decisionEnvelope" },
      ])
    ) {
      errors.push("六部可信证据脊柱未使用冻结的 Draft 2020-12 双向交换契约");
    }
    const visit = (node) => {
      if (!node || typeof node !== "object") return;
      if (node.type === "object") {
        const propertyKeys = Object.keys(node.properties ?? {}).sort();
        const requiredKeys = Array.isArray(node.required) ? [...node.required].sort() : [];
        if (node.additionalProperties !== false || JSON.stringify(propertyKeys) !== JSON.stringify(requiredKeys)) {
          errors.push("六部可信证据脊柱存在开放或非全必填对象边界");
        }
      }
      for (const value of Object.values(node)) {
        if (Array.isArray(value)) value.forEach(visit);
        else visit(value);
      }
    };
    visit(schema);
    const requestKeys = Object.keys(schema?.$defs?.decisionRequest?.properties ?? {}).sort();
    if (JSON.stringify(requestKeys) !== JSON.stringify([
      "constraints",
      "material_refs",
      "message_type",
      "objective",
      "request_id",
      "schema_version",
    ])) {
      errors.push("六部可信证据请求边界允许身份、路由或授权字段");
    }
    const effects = schema?.$defs?.externalEffects?.properties;
    if (
      effects?.authorized?.const !== false
      || effects?.mode?.const !== "none"
      || effects?.effect_count?.const !== 0
    ) {
      errors.push("六部可信证据契约不再固定为无外部副作用");
    }
    return [...new Set(errors)];
  } catch (error) {
    return [`六部可信证据脊柱门禁失败: ${error instanceof Error ? error.message : String(error)}`];
  }
}

const DECREE_FLOW_BASELINE = "docs/decisions/0028-decree-evidence-flow-governance-baseline.md";
const DECREE_FLOW_BASELINE_SHA256 = "3ac5d0c3510c62dbdf9b4b785d8175a259b1ce46b0c56c29abbbc7bb2e39a31e";
const DECREE_FLOW_POLICY_ENTRIES = [
  "AGENTS.md",
  "CLAUDE.md",
  "docs/product/tasks/TEMPLATE.md",
  ".claude/agents/harness-doctor.md",
  ".claude/agents/module-engineer.md",
  ".claude/agents/solution-architect.md",
  ".claude/agents/test-engineer.md",
  ".codex/agents/harness-doctor.toml",
  ".codex/agents/module-engineer.toml",
  ".codex/agents/solution-architect.toml",
  ".codex/agents/test-engineer.toml",
];

const LEGACY_META_HARNESS = ["frontend/.harness"];

export function rootObservationKernelPathErrors(paths) {
  if (!Array.isArray(paths) || new Set(paths).size !== paths.length) {
    return ["根 Harness 路径必须唯一且可枚举"];
  }
  const sorted = [...paths].sort();
  const missing = ROOT_OBSERVATION_KERNEL_HARNESS_FILES.filter((entry) => !sorted.includes(entry));
  const unexpected = sorted.filter((entry) => !ROOT_OBSERVATION_KERNEL_HARNESS_FILES.includes(entry)
    && !/^\.harness\/approvals\/[A-Z0-9][A-Z0-9._-]{2,127}\.json$/.test(entry));
  const errors = [];
  if (missing.length) errors.push(`根 Harness 缺少 M0 静态文件: ${missing.join(", ")}`);
  if (unexpected.length) errors.push(`根 Harness 含未授权 control-plane 路径: ${unexpected.join(", ")}`);
  return errors;
}

function rootObservationKernelDiskPaths(root) {
  const harnessRoot = join(root, ".harness");
  if (!existsSync(harnessRoot) || !statSync(harnessRoot).isDirectory()) return [];
  const paths = [];
  const visit = (relativeDirectory) => {
    for (const entry of readdirSync(join(root, relativeDirectory), { withFileTypes: true })) {
      const relativePath = `${relativeDirectory}/${entry.name}`;
      if (entry.isSymbolicLink()) {
        paths.push(`SYMLINK:${relativePath}`);
      } else if (entry.isDirectory()) {
        visit(relativePath);
      } else if (entry.isFile()) {
        paths.push(relativePath);
      } else {
        paths.push(`OTHER:${relativePath}`);
      }
    }
  };
  visit(".harness");
  return paths.sort();
}

// Codex 与 Claude Code 曾各存一份内容相同的 hook 脚本;现在统一收敛到
// .agents/hooks/check-harness.mjs,旧路径不应该复活。
const LEGACY_DUPLICATED_HOOKS = [
  ".claude/hooks/check-harness.sh",
  ".codex/hooks/check-harness.sh",
  ".agents/hooks/check-harness.sh",
];

const SHARED_HOOK_SCRIPT = ".agents/hooks/check-harness.mjs";
const SHARED_HOOK_COMMAND = `node ${SHARED_HOOK_SCRIPT}`;

// Codex 原生扫描仓库内的 .agents/skills;Claude Code 只认 .claude/skills。
// WSL 软链接无法被 Windows Node 通过 UNC 稳定读取,因此保留两份实际入口文件,
// 并用字节级检查阻止内容漂移。
const SHARED_SKILLS = ["record-decision", "record-failure"];
const PRODUCT_TASK_SECTIONS = [
  "Status",
  "Product Definition",
  "Acceptance Criteria",
  "Delivery Constraints",
  "Affected Modules",
  "Technical Plan",
  "Implementation Report",
  "Acceptance Review",
];
const PRODUCT_TASK_STATUSES = [
  "Draft",
  "Ready",
  "In Progress",
  "Blocked",
  "Implemented",
  "Accepted",
];
const CLAUDE_DELIVERY_AGENTS = [
  {
    name: "solution-architect",
    tools: ["Read", "Grep", "Glob", "Bash"],
    permissionMode: "plan",
    requiredText: ["Technical Plan", "不修改任何文件", "不要编辑任务文件"],
  },
  {
    name: "module-engineer",
    tools: ["Read", "Grep", "Glob", "Bash", "Edit", "Write"],
    permissionMode: "acceptEdits",
    requiredText: ["允许路径", "frontend/", "backend/", "不得修改产品任务文件", "不得调用其他角色"],
  },
  {
    name: "test-engineer",
    tools: ["Read", "Grep", "Glob", "Bash", "Edit", "Write"],
    permissionMode: "acceptEdits",
    requiredText: ["Affected Modules", "Technical Plan", "允许路径", "不得修改产品任务文件", "不得调用其他角色"],
  },
];
const CODEX_DELIVERY_AGENTS = [
  {
    name: "solution-architect",
    sandboxMode: "read-only",
    requiredText: ["Technical Plan", "不修改任何文件", "不要编辑任务文件"],
  },
  {
    name: "module-engineer",
    sandboxMode: null,
    requiredText: ["允许路径", "frontend/", "backend/", "不得修改产品任务文件", "不得调用其他角色"],
  },
  {
    name: "test-engineer",
    sandboxMode: null,
    requiredText: ["Affected Modules", "Technical Plan", "允许路径", "不得修改产品任务文件", "不得调用其他角色"],
  },
];

export function missingSections(markdown, sections) {
  return sections.filter((section) => {
    const escaped = section.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return !new RegExp(`^## ${escaped}\\s*$`, "m").test(markdown);
  });
}

export function sectionBody(markdown, section) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const header = `## ${section}`;
  const start = lines.findIndex((line) => line.trimEnd() === header);
  if (start === -1) return null;
  let end = start + 1;
  while (end < lines.length && !lines[end].startsWith("## ")) end += 1;
  return lines.slice(start + 1, end).join("\n").trim();
}

function stripAcceptanceFingerprintMarkers(value) {
  return value.replace(
    /<!-- ACCEPTANCE-FP-(?:BEGIN|END):(?:STATUS|AC-(?:0[1-9]|10)|IMPLEMENTATION|ACCEPTANCE-REVIEW) -->/g,
    "",
  );
}

export function productTaskErrors(path, content) {
  const errors = [];
  for (const section of missingSections(content, PRODUCT_TASK_SECTIONS)) {
    errors.push(`产品任务 ${path} 缺少章节: ## ${section}`);
  }

  if (!/^# [^#\r\n].+$/m.test(content)) {
    errors.push(`产品任务 ${path} 缺少一级标题`);
  }

  const statusBody = sectionBody(content, "Status");
  const status = statusBody === null
    ? undefined
    : stripAcceptanceFingerprintMarkers(statusBody).split(/\r?\n/, 1)[0].trim();
  if (statusBody !== null && !PRODUCT_TASK_STATUSES.includes(status)) {
    errors.push(
      `产品任务 ${path} 的 Status 必须是 ${PRODUCT_TASK_STATUSES.join(", ")}，当前为: ${status || "空"}`,
    );
  }

  const criteria = sectionBody(content, "Acceptance Criteria");
  if (criteria !== null && !/^- \[(?: |x|X)\] .+/m.test(stripAcceptanceFingerprintMarkers(criteria))) {
    errors.push(`产品任务 ${path} 的 Acceptance Criteria 至少需要一个 Markdown checkbox`);
  }

  const modules = sectionBody(content, "Affected Modules");
  if (modules !== null && !/^- 模块：\s*\S.+$/m.test(modules)) {
    errors.push(`产品任务 ${path} 的 Affected Modules 必须登记模块`);
  }
  if (modules !== null && !/^- 允许路径：\s*\S.+$/m.test(modules)) {
    errors.push(`产品任务 ${path} 的 Affected Modules 必须登记允许路径`);
  }
  return errors;
}

function requireFile(root, path, errors) {
  const absolute = join(root, path);
  if (!existsSync(absolute)) {
    errors.push(`缺少必需文件: ${path}`);
  } else if (!statSync(absolute).isFile()) {
    errors.push(`必需路径不是文件: ${path}`);
  }
}

function requireText(path, content, values, errors) {
  for (const value of values) {
    if (!content.includes(value)) errors.push(`${path} 缺少关键内容: ${value}`);
  }
}

function canonicalTextForHash(content) {
  return content.replace(/\r\n?/gu, "\n");
}

export function decreeFlowBaselineErrors({
  baselineExists = false,
  baselineContent = "",
  policyEntries = {},
  expectedHash = DECREE_FLOW_BASELINE_SHA256,
} = {}) {
  const errors = [];
  if (!baselineExists) {
    errors.push(`缺少不可变业务流基线: ${DECREE_FLOW_BASELINE}`);
    return errors;
  }

  const actualHash = createHash("sha256").update(canonicalTextForHash(baselineContent)).digest("hex");
  if (actualHash !== expectedHash) {
    errors.push(`不可变业务流基线已被改写: ${DECREE_FLOW_BASELINE}`);
  }

  for (const path of DECREE_FLOW_POLICY_ENTRIES) {
    if (!policyEntries[path]?.includes(DECREE_FLOW_BASELINE)) {
      errors.push(`AI 入口缺少业务流基线引用: ${path}`);
    }
  }
  return errors;
}

export function parseMarkdownAgentBody(content) {
  const normalized = content.replace(/\r\n/g, "\n");
  const match = normalized.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return null;
  const descMatch = match[1].match(/^description:\s*(.+)$/m);
  if (!descMatch) return null;
  const toolsMatch = match[1].match(/^tools:\s*(.+)$/m);
  const permissionMatch = match[1].match(/^permissionMode:\s*(.+)$/m);
  return {
    description: descMatch[1].trim(),
    body: match[2].trim(),
    tools: toolsMatch ? toolsMatch[1].split(",").map((tool) => tool.trim()) : [],
    permissionMode: permissionMatch?.[1].trim() ?? null,
  };
}

export function claudeAgentErrors(path, content, expected) {
  const errors = [];
  const parsed = parseMarkdownAgentBody(content);
  if (!parsed) return [`Claude 专业角色 ${path} 格式无法解析`];

  const name = content.replace(/\r\n/g, "\n").match(/^name:\s*(.+)$/m)?.[1].trim();
  if (name !== expected.name) {
    errors.push(`Claude 专业角色 ${path} 的 name 必须是 ${expected.name}`);
  }
  if (JSON.stringify(parsed.tools) !== JSON.stringify(expected.tools)) {
    errors.push(`Claude 专业角色 ${path} 的 tools 必须精确为 ${expected.tools.join(", ")}`);
  }
  if (parsed.permissionMode !== expected.permissionMode) {
    errors.push(`Claude 专业角色 ${path} 的 permissionMode 必须是 ${expected.permissionMode}`);
  }
  for (const value of expected.requiredText) {
    if (!parsed.body.includes(value)) {
      errors.push(`Claude 专业角色 ${path} 缺少关键边界: ${value}`);
    }
  }
  return errors;
}

export function parseTomlAgentBody(content) {
  const normalized = content.replace(/\r\n/g, "\n");
  const nameMatch = normalized.match(/^name\s*=\s*"(.*)"$/m);
  const descMatch = normalized.match(/^description\s*=\s*"(.*)"$/m);
  const bodyMatch = normalized.match(/developer_instructions\s*=\s*"""([\s\S]*?)"""/);
  if (!nameMatch || !descMatch || !bodyMatch) return null;
  const sandboxMatch = normalized.match(/^sandbox_mode\s*=\s*"(.*)"$/m);
  return {
    name: nameMatch[1].trim(),
    description: descMatch[1].trim(),
    body: bodyMatch[1].trim(),
    sandboxMode: sandboxMatch?.[1].trim() ?? null,
  };
}

export function codexAgentErrors(path, content, expected) {
  const errors = [];
  const parsed = parseTomlAgentBody(content);
  if (!parsed) return [`Codex 专业角色 ${path} 格式无法解析`];
  if (parsed.name !== expected.name) {
    errors.push(`Codex 专业角色 ${path} 的 name 必须是 ${expected.name}`);
  }
  if (parsed.sandboxMode !== expected.sandboxMode) {
    const mode = expected.sandboxMode ?? "继承父会话（不得固定 sandbox_mode）";
    errors.push(`Codex 专业角色 ${path} 的 sandbox_mode 必须是 ${mode}`);
  }
  if (/^model\s*=/m.test(content.replace(/\r\n/g, "\n"))) {
    errors.push(`Codex 专业角色 ${path} 不得固定 model，必须继承当前 Codex 会话模型`);
  }
  for (const value of expected.requiredText) {
    if (!parsed.body.includes(value)) {
      errors.push(`Codex 专业角色 ${path} 缺少关键边界: ${value}`);
    }
  }
  return errors;
}

export function hookCommands(content, event = "Stop") {
  let config;
  try {
    config = JSON.parse(content);
  } catch {
    return null;
  }
  const groups = config?.hooks?.[event];
  if (!Array.isArray(groups)) return [];
  return groups.flatMap((group) => Array.isArray(group?.hooks) ? group.hooks : [])
    .filter((hook) => hook?.type === "command" && typeof hook.command === "string")
    .map((hook) => hook.command);
}

export function sharedSkillErrors(skill, state) {
  const errors = [];
  if (!state.sourceExists) errors.push(`缺少共享 skill 源文件: .agents/skills/${skill}/SKILL.md`);
  if (!state.claudeExists) errors.push(`缺少 Claude Code skill 入口: .claude/skills/${skill}/SKILL.md`);
  if (state.sourceExists && state.claudeExists && !state.contentMatches) {
    errors.push(`.claude/skills/${skill} 与 .agents/skills/${skill} 内容不一致`);
  }
  return errors;
}

function validateMarkdownDirectory(root, relativeDir, sections, label, errors) {
  const directory = join(root, relativeDir);
  if (!existsSync(directory)) return;
  const files = readdirSync(directory).filter((name) => name.endsWith(".md")).sort();
  for (const name of files) {
    const path = join(directory, name);
    if (!statSync(path).isFile()) continue;
    const missing = missingSections(readFileSync(path, "utf8"), sections);
    for (const section of missing) errors.push(`${label} ${name} 缺少章节: ## ${section}`);
  }
}

function validateProductTasks(root, errors) {
  const relativeDir = "docs/product/tasks";
  const directory = join(root, relativeDir);
  if (!existsSync(directory)) return;
  const files = readdirSync(directory).filter((name) => name.endsWith(".md")).sort();
  for (const name of files) {
    const path = join(directory, name);
    if (!statSync(path).isFile()) continue;
    errors.push(...productTaskErrors(`${relativeDir}/${name}`, readFileSync(path, "utf8")));
  }
}

export function codexWorkflowPolicyErrors({
  claudeCopyExists = false,
  vendoredSkills = [],
  ciDependsOnPersonalSkills = false,
} = {}) {
  const errors = [];
  if (claudeCopyExists) {
    errors.push("codex-engineering-workflow 是 Codex 专用 skill，不应复制到 .claude/skills");
  }
  for (const skill of vendoredSkills) {
    errors.push(`不得把第三方 skill 复制进仓库: .agents/skills/${skill}`);
  }
  if (ciDependsOnPersonalSkills) {
    errors.push("CI 不得安装或依赖个人环境中的 gstack/Superpowers skill");
  }
  return errors;
}

const ADAPTIVE_ROUTING_START = "<!-- adaptive-routing-contract:start -->";
const ADAPTIVE_ROUTING_END = "<!-- adaptive-routing-contract:end -->";
const normalizeAdaptiveRoutingBody = (value) => value
  .replace(/\r\n?/gu, "\n");

const ADAPTIVE_ROUTING_WHOLE_ENTRY_SHA256 = {
  agents: "ff091abb92aab4f54e396fd293028c033f093b2db9a2bbfb8424731e6d0a0f6b",
  guide: "c9dc6bec7917b4ae1441fa2df9c2b36cbc105d6946102c40d34add2c3194fa18",
  skill: "3a40fd5cfc75f4643b39f57e6471a79b9019a6418e4faf048ee4842a8ad17a06",
  prompt: "fe285fa01758c6f005cce119c6e63eb389f0f9f84a02cc33fee353cfde0d79bd",
  plan: "bdec95ecc1cf03d14660581123b2c19b7f5995695f792bd5e79a8b5b3b9eb3d4",
};

const ADAPTIVE_ROUTING_CANONICAL_BODIES = {
  agents: normalizeAdaptiveRoutingBody(`
- 先盘问：优先检查现有证据，只询问会实质改变目标、范围、验收、风险或授权的问题；信息足够即停止，关键歧义无法消除则标记 \`Blocked\`。
- Codex 自动选择并说明理由：直接执行仅用于明确、局部、可逆、低风险、不改变业务行为且容易验证的工作；局部行为修改在足够时使用 Matt Skills；跨模块、未知根因、高风险或验证链较长时使用 Superpowers。
- 允许按证据 \`直接执行 → Matt Skills → Superpowers\` 升级；连续验证失败时必须说明证据并升级到 Superpowers；已有明确授权的高风险事项使用 Superpowers，缺少授权或未解决歧义时进入 \`Blocked\`。
- 质量门禁包括根因、测试和新鲜验证，不因所选 Skill 降低；范围实质变化时重新盘问。
- Matt Skills 缺失时不自动安装；使用等价 Codex 原生步骤，无法满足门禁时升级到 Superpowers。
- worktree 操作继续使用 \`using-git-worktrees\`；本仓库实质工程任务继续使用 \`codex-engineering-workflow\` 统一路由。
`),
  guide: normalizeAdaptiveRoutingBody(`
所有实质任务先进入盘问与退出条件，再由 Codex 自动分流。\`using-superpowers\` 是元级 preflight，不等于已经启用完整 Superpowers 工作流。

| 路线 | 典型条件 | 执行要求 |
| --- | --- | --- |
| 直接执行 | 目标明确、局部、可逆、低风险、不改变业务行为且容易验证 | 执行最小相关检查并报告证据 |
| Matt Skills | 局部功能或缺陷，存在受控不确定性，需要针对性澄清、实现或审查 | 只加载直接有用的 Matt Skills，同时满足仓库质量门禁 |
| Superpowers | 跨模块、架构或契约变化、未知根因、难回滚、高风险或验证链较长 | 使用适用的规划、调试、TDD、审查和完成验证流程 |

## 盘问与退出条件

Codex 先检查代码、文档、命令与当前证据，不要求用户复述可发现事实。只询问会实质改变目标、范围、验收、风险或授权的问题；信息足够即停止。关键歧义无法消除时标记 \`Blocked\`，不猜测业务决定。

## 自动分流

任务画像由需求明确度、影响范围、可逆性、失败后果、根因或实现路径确定性、验证难度组成。Codex 自动选择最小够用路线，并在实现前说明 \`Task profile\`、\`Selected route\`、\`Reason\`、\`Quality gates\` 与 \`Escalation\`。

质量门禁与 Skill 品牌解耦：Bug 必须有可复现证据和根因，行为修改在可行时必须有测试保护，完成声明必须有最终改动后的新鲜验证。

## 升级与阻塞

执行可按 \`直接执行 → Matt Skills → Superpowers\` 升级。范围扩大、根因不明、风险上升或连续验证失败时必须说明证据并升级到 Superpowers；范围实质变化时重新盘问。安全、权限、支付、隐私、数据迁移、生产配置、不可逆操作和架构边界变化是硬升级事项：已有明确授权的高风险事项进入 Superpowers；缺少授权或未解决歧义时进入 \`Blocked\`。

Matt Skills 缺失时不自动安装；优先使用等价 Codex 原生步骤，仍无法满足质量门禁时升级。升级复用仍有效的证据与工作，不机械重复已完成步骤。
`),
  skill: normalizeAdaptiveRoutingBody(`
## 先盘问并自动分流

先检查仓库事实，只询问会改变目标、范围、验收、风险或授权的问题。信息足够立即停止盘问；关键歧义无法消除时返回 \`Blocked\`。

按需求明确度、影响范围、可逆性、失败后果、路径确定性和验证难度自动选择：

| 路线 | 条件 |
| --- | --- |
| 直接执行 | 明确、局部、可逆、低风险、不改变业务行为且容易验证 |
| Matt Skills | 局部行为修改且风险可控，但需要针对性澄清、实现或审查 |
| Superpowers | 跨模块、架构/契约变化、未知根因、难回滚、高风险或验证链较长 |

开始实现前输出：

\`\`\`text
Task profile: summarize the current clarity, scope, reversibility, impact, path certainty, and verification difficulty
Selected route: state exactly one of direct execution, Matt Skills, or Superpowers
Reason: explain why the route is the smallest one sufficient for current evidence
Quality gates: list the applicable root-cause, test, fresh-verification, safety, and authorization outcomes
Escalation: list the observable evidence that will trigger a heavier route
\`\`\`

允许按 \`直接执行 → Matt Skills → Superpowers\` 升级，不得静默降低 Quality gates。范围实质变化时重新盘问；连续验证失败时必须说明证据并升级到 Superpowers。已有明确授权的高风险事项使用 Superpowers；缺少授权或未解决业务歧义时进入 \`Blocked\`。Matt Skills 缺失时不自动安装，改用等价 Codex 原生步骤，无法满足门禁时升级到 Superpowers。
`),
};

function sealedAdaptiveRoutingBody(content) {
  const startCount = content.split(ADAPTIVE_ROUTING_START).length - 1;
  const endCount = content.split(ADAPTIVE_ROUTING_END).length - 1;
  const start = content.indexOf(ADAPTIVE_ROUTING_START);
  const end = content.indexOf(ADAPTIVE_ROUTING_END);
  if (startCount !== 1 || endCount !== 1 || start >= end) return null;
  return normalizeAdaptiveRoutingBody(content.slice(start + ADAPTIVE_ROUTING_START.length, end));
}

function adaptiveRoutingEntryHash(content) {
  return createHash("sha256").update(normalizeAdaptiveRoutingBody(content)).digest("hex");
}

function adaptivePlanStructure(plan) {
  const normalized = normalizeAdaptiveRoutingBody(plan);
  const taskHeadings = { 2: [], 3: [] };
  const steps = { 1: [], 2: [], 3: [], 4: [] };
  let fence = null;
  let inHtmlComment = false;
  let offset = 0;
  for (const rawLine of normalized.split("\n")) {
    if (fence) {
      const close = rawLine.match(/^ {0,3}(`{3,}|~{3,})[ \t]*$/u);
      if (close && close[1][0] === fence.character && close[1].length >= fence.length) fence = null;
      offset += rawLine.length + 1;
      continue;
    }
    let line = "";
    let cursor = 0;
    while (cursor <= rawLine.length) {
      if (inHtmlComment) {
        const commentEnd = rawLine.indexOf("-->", cursor);
        if (commentEnd < 0) break;
        inHtmlComment = false;
        cursor = commentEnd + 3;
        continue;
      }
      const commentStart = rawLine.indexOf("<!--", cursor);
      if (commentStart < 0) {
        line += rawLine.slice(cursor);
        break;
      }
      line += rawLine.slice(cursor, commentStart);
      inHtmlComment = true;
      cursor = commentStart + 4;
    }
    const open = line.match(/^ {0,3}(`{3,})([^`]*)$/u)
      || line.match(/^ {0,3}(~{3,})(.*)$/u);
    if (open) {
      fence = { character: open[1][0], length: open[1].length };
      offset += rawLine.length + 1;
      continue;
    }
    const heading = line.match(/^ {0,3}### Task ([23]):(?: .*)?$/u);
    if (heading) taskHeadings[Number(heading[1])].push(offset);
    const step = line.match(/^ {0,3}- \[ \] \*\*Step ([1-4]):.*\*\*[ \t]*$/u);
    if (step) steps[Number(step[1])].push(offset);
    offset += rawLine.length + 1;
  }
  return { normalized, taskHeadings, steps };
}

function planContainsCanonicalAdaptiveTemplate(plan, entry, path) {
  const { normalized, taskHeadings, steps } = adaptivePlanStructure(plan);
  if (taskHeadings[2].length !== 1 || taskHeadings[3].length !== 1) return false;
  const task2Start = taskHeadings[2][0];
  const task3Start = taskHeadings[3][0];
  if (task2Start >= task3Start) return false;
  const task2Steps = {};
  for (const number of [1, 2, 3, 4]) {
    task2Steps[number] = steps[number].filter((offset) => offset > task2Start && offset < task3Start);
    if (task2Steps[number].length !== 1) return false;
  }
  const orderedStepOffsets = [1, 2, 3, 4].map((number) => task2Steps[number][0]);
  if (!orderedStepOffsets.every((offset, index) => index === 0 || orderedStepOffsets[index - 1] < offset)) return false;
  const stepNumber = { agents: 1, guide: 2, skill: 3 }[entry];
  const stepStart = task2Steps[stepNumber][0];
  const nextStepStart = task2Steps[stepNumber + 1][0];
  const step = normalized.slice(stepStart, nextStepStart);
  const block = `${ADAPTIVE_ROUTING_START}${ADAPTIVE_ROUTING_CANONICAL_BODIES[entry]}${ADAPTIVE_ROUTING_END}`;
  const blockIndex = step.indexOf(block);
  return blockIndex >= 0
    && normalized.split(block).length - 1 === 1
    && step.slice(0, blockIndex).includes(path);
}

export function adaptiveRoutingPolicyErrors({ agents = "", guide = "", skill = "", prompt = "", plan = "" } = {}) {
  const errors = [];
  const planHashMatches = adaptiveRoutingEntryHash(plan) === ADAPTIVE_ROUTING_WHOLE_ENTRY_SHA256.plan;
  for (const [entry, path] of [
    ["agents", "AGENTS.md"],
    ["guide", "docs/codex-engineering-workflow.md"],
    ["skill", ".agents/skills/codex-engineering-workflow/SKILL.md"],
  ]) {
    const content = { agents, guide, skill }[entry];
    const body = sealedAdaptiveRoutingBody(content);
    if (
      adaptiveRoutingEntryHash(content) !== ADAPTIVE_ROUTING_WHOLE_ENTRY_SHA256[entry]
      || body !== ADAPTIVE_ROUTING_CANONICAL_BODIES[entry]
      || !planHashMatches
      || !planContainsCanonicalAdaptiveTemplate(plan, entry, path)
    ) {
      errors.push(`${path} 的整文件 canonical hash、sentinel 正文或 Task 2 计划模板不同步`);
    }
  }
  if (adaptiveRoutingEntryHash(prompt) !== ADAPTIVE_ROUTING_WHOLE_ENTRY_SHA256.prompt) {
    errors.push(".agents/skills/codex-engineering-workflow/agents/openai.yaml 整文件 canonical hash 漂移");
  }
  return errors;
}

export function mainlandSharePolicyErrors({
  productionFiles = {},
  westockConfig = "",
} = {}) {
  const errors = [];
  const quotedCompanyToProviderCode =
    /["'][^"'\r\n]*\p{Script=Han}[^"'\r\n]*["']\s*:\s*["']?(?:sh|sz|bj)\d{6}["']?/iu;
  const yamlCompanyToProviderCode =
    /(?:^|[{,])\s*[\p{Script=Han}][\p{Script=Han}A-Za-z0-9·（）()]{1,63}\s*:\s*["']?(?:sh|sz|bj)\d{6}["']?/imu;
  for (const [path, content] of Object.entries(productionFiles)) {
    if (
      quotedCompanyToProviderCode.test(content)
      || yamlCompanyToProviderCode.test(content)
    ) {
      errors.push(`生产代码不得包含公司名称到 provider code 的字面量映射: ${path}`);
    }
  }
  if (westockClaimsBsePattern(westockConfig)) {
    errors.push("腾讯自选股配置不得在真实审批前声明 BSE exchange pattern");
  }
  return errors;
}

function maskPythonLexicalNoise(content) {
  const masked = content.split("");
  const hide = (index) => {
    if (content[index] !== "\r" && content[index] !== "\n") masked[index] = " ";
  };
  let index = 0;
  while (index < content.length) {
    const character = content[index];
    if (character === "#") {
      while (index < content.length && content[index] !== "\n") {
        hide(index);
        index += 1;
      }
      continue;
    }
    if (character !== "'" && character !== '"') {
      index += 1;
      continue;
    }

    const quote = character;
    const triple = content.slice(index, index + 3) === quote.repeat(3);
    const delimiterLength = triple ? 3 : 1;
    for (let offset = 0; offset < delimiterLength; offset += 1) hide(index + offset);
    index += delimiterLength;
    while (index < content.length) {
      if (content[index] === "\\") {
        hide(index);
        index += 1;
        if (index < content.length) {
          hide(index);
          index += 1;
        }
        continue;
      }
      if (content.slice(index, index + delimiterLength) === quote.repeat(delimiterLength)) {
        for (let offset = 0; offset < delimiterLength; offset += 1) hide(index + offset);
        index += delimiterLength;
        break;
      }
      hide(index);
      index += 1;
    }
  }
  return masked.join("");
}

function pythonCallBodies(content, functionName) {
  const bodies = [];
  const masked = maskPythonLexicalNoise(content);
  const pattern = new RegExp(`\\b${functionName}\\s*\\(`, "gu");
  for (const match of masked.matchAll(pattern)) {
    const start = match.index + match[0].length;
    let depth = 1;
    for (let index = start; index < masked.length; index += 1) {
      const character = masked[index];
      if (character === "(") {
        depth += 1;
      } else if (character === ")") {
        depth -= 1;
        if (depth === 0) {
          bodies.push(content.slice(start, index));
          break;
        }
      }
    }
  }
  return bodies;
}

function pythonFunctionBody(content, functionName) {
  const masked = maskPythonLexicalNoise(content);
  const escapedName = functionName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const definition = new RegExp(`^(?<indent>[\\t ]*)def\\s+${escapedName}\\b`, "gmu")
    .exec(masked);
  if (definition === null || definition.groups.indent.length !== 0) return null;

  let nesting = 0;
  let colon = -1;
  for (
    let index = definition.index + definition[0].length;
    index < masked.length;
    index += 1
  ) {
    const character = masked[index];
    if ("([{".includes(character)) nesting += 1;
    if (")]}".includes(character)) nesting -= 1;
    if (character === ":" && nesting === 0) {
      colon = index;
      break;
    }
    if (character === "\n" && nesting === 0) return null;
  }
  if (colon === -1) return null;

  const newline = masked.indexOf("\n", colon);
  if (newline === -1) return content.slice(colon + 1);
  const bodyStart = newline + 1;
  let lineStart = bodyStart;
  while (lineStart < masked.length) {
    const lineEnd = masked.indexOf("\n", lineStart);
    const end = lineEnd === -1 ? masked.length : lineEnd;
    const line = masked.slice(lineStart, end);
    if (line.trim() && !/^[\t ]/u.test(line)) {
      return content.slice(bodyStart, lineStart);
    }
    if (lineEnd === -1) break;
    lineStart = lineEnd + 1;
  }
  return content.slice(bodyStart);
}

function pythonTopLevelStatementRecords(functionBody) {
  const masked = maskPythonLexicalNoise(functionBody);
  const lines = [];
  let start = 0;
  while (start < masked.length) {
    const newline = masked.indexOf("\n", start);
    const end = newline === -1 ? masked.length : newline + 1;
    const text = masked.slice(start, end);
    const indentation = text.match(/^[\t ]*/u)[0];
    lines.push({
      start,
      end,
      text,
      indentation: indentation.replace(/\t/gu, "        ").length,
    });
    start = end;
  }
  const executable = lines.filter(({ text }) => text.trim());
  if (!executable.length) return [];
  const baseIndent = Math.min(...executable.map(({ indentation }) => indentation));
  const records = [];

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];
    if (!line.text.trim() || line.indentation !== baseIndent) continue;
    const statementStart = line.start;
    let statementEnd = line.end;
    let nesting = 0;
    let continued = false;
    let endLineIndex = lineIndex;
    do {
      const logicalLine = lines[endLineIndex].text;
      for (const character of logicalLine) {
        if ("([{".includes(character)) nesting += 1;
        if (")]}".includes(character)) nesting -= 1;
      }
      continued = logicalLine.trimEnd().endsWith("\\");
      statementEnd = lines[endLineIndex].end;
      if ((nesting > 0 || continued) && endLineIndex + 1 < lines.length) {
        endLineIndex += 1;
      } else {
        break;
      }
    } while (endLineIndex < lines.length);

    let suiteEnd = statementEnd;
    for (let suiteLine = endLineIndex + 1; suiteLine < lines.length; suiteLine += 1) {
      const candidate = lines[suiteLine];
      if (candidate.text.trim() && candidate.indentation <= baseIndent) break;
      suiteEnd = candidate.end;
    }
    const code = masked.slice(statementStart, statementEnd);
    records.push({
      code,
      suite: masked.slice(statementEnd, suiteEnd),
    });
    lineIndex = endLineIndex;
    if (/^\s*(?:return|raise)\b/u.test(code)) break;
  }
  return records;
}

export function deterministicEvidencePolicyErrors({
  factPlans = "",
  marketPlan = "",
  renderer = "",
  adr = "",
  genericAgentFiles = {},
} = {}) {
  const errors = [];
  if (
    !/class\s+FactPlanDisposition\s*\(\s*StrEnum\s*\)\s*:/u.test(factPlans)
    || !/^\s+NOT_APPLICABLE\s*=\s*["']NOT_APPLICABLE["']\s*$/mu.test(factPlans)
    || !/^\s+PLANNED\s*=\s*["']PLANNED["']\s*$/mu.test(factPlans)
    || !/^\s+REJECTED\s*=\s*["']REJECTED["']\s*$/mu.test(factPlans)
  ) {
    errors.push("事实计划必须定义完整的 FactPlanDisposition StrEnum");
  }

  const canonicalFact = pythonCallBodies(marketPlan, "RequiredFact").some((body) => (
    /\bkey\s*=\s*["']market_quote:last_price["']/u.test(body)
    && /\bcategory\s*=\s*FactCategory\.MARKET_QUOTE\b/u.test(body)
    && /\bdata_scope\s*=\s*DataScope\.EXTERNAL_PUBLIC\b/u.test(body)
    && /\bjurisdiction\s*=\s*["']CN["']/u.test(body)
    && /\bexpected_unit\s*=\s*["']CNY["']/u.test(body)
    && /\bexpected_shape\s*=\s*["']number["']/u.test(body)
    && /\bmarket_metric\s*=\s*MarketMetric\.LAST_PRICE\b/u.test(body)
  ));
  if (!canonicalFact) {
    errors.push("大陆最新价计划必须在同一 RequiredFact 中固定 CN/CNY/number/LAST_PRICE");
  }

  const rendererBody = pythonFunctionBody(renderer, "render_mainland_last_price");
  const rendererStatements = pythonTopLevelStatementRecords(rendererBody ?? "");
  const rendererHasResolvedGate = rendererStatements.some(({ code, suite }) => (
    /^\s*if\s*\(/u.test(code)
    && /\bpack\.status\s+is\s+not\s+EvidencePackStatus\.RESOLVED\b/u.test(code)
    && /\bpack\.resolved_facts\s*!=\s*\(\s*fact\.key\s*,\s*\)/u.test(code)
    && /\bpack\.unresolved_facts\b/u.test(code)
    && /\bpack\.conflicts\b/u.test(code)
    && /^\s*raise\s+EvidenceProtocolError\s*\(/u.test(suite)
  ));
  const rendererHasCurrentGate = rendererStatements.some(({ code }) => (
    /^\s*candidates\s*=\s*tuple\s*\(/u.test(code)
    && pythonCallBodies(code, "is_evidence_fresh").some((body) => (
      /\bas_of\s*=\s*item\.as_of\b/u.test(body)
      && /\bretrieved_at\s*=\s*item\.retrieved_at\b/u.test(body)
      && /\brequest\s*=\s*pack\.request\b/u.test(body)
      && /\bnow\s*=\s*_parse_timestamp\s*\(\s*pack\.investigation_completed_at\s*\)/u.test(body)
    ))
  ));
  if (!rendererHasResolvedGate || !rendererHasCurrentGate) {
    errors.push("行情 renderer 必须只消费已解析且按调查完成时间仍当前有效的证据");
  }

  errors.push(...mainlandSharePolicyErrors({
    productionFiles: genericAgentFiles,
    westockConfig: "",
  }));

  for (const section of ["Status", "Context", "Decision", "Consequences", "Verification"]) {
    if (missingSections(adr, [section]).length) {
      errors.push(`ADR 0025 缺少章节: ## ${section}`);
    }
  }
  if (!/^Accepted — 2026-07-24$/mu.test(sectionBody(adr, "Status") ?? "")) {
    errors.push("ADR 0025 状态必须是 Accepted — 2026-07-24");
  }
  return errors;
}

function deterministicEvidenceRepositoryErrors(root) {
  const read = (relativePath) => {
    const absolutePath = join(root, ...relativePath.split("/"));
    return existsSync(absolutePath) ? readFileSync(absolutePath, "utf8") : "";
  };
  const genericAgentPaths = [
    "backend/app/agents/fact_plans.py",
    "backend/app/agents/market_fact_plan.py",
    "backend/app/agents/evidence_rendering.py",
  ];
  return deterministicEvidencePolicyErrors({
    factPlans: read("backend/app/agents/fact_plans.py"),
    marketPlan: read("backend/app/agents/market_fact_plan.py"),
    renderer: read("backend/app/agents/evidence_rendering.py"),
    adr: read("docs/decisions/0025-deterministic-evidence-orchestration.md"),
    genericAgentFiles: Object.fromEntries(
      genericAgentPaths.map((path) => [path, read(path)]),
    ),
  });
}

function westockClaimsBsePattern(content) {
  const lines = content.split(/\r?\n/u);
  let section = "";
  let block = [];
  const toolBlocks = [];
  const flush = () => {
    if (block.length) toolBlocks.push(block);
    block = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();
    const indentation = line.length - line.trimStart().length;
    if (indentation === 0 && /^[A-Za-z_][A-Za-z0-9_]*\s*:/u.test(trimmed)) {
      flush();
      section = trimmed.split(":", 1)[0];
      continue;
    }
    if (section !== "tools") continue;
    if (indentation === 2 && trimmed.startsWith("- ")) {
      flush();
    }
    if (trimmed) block.push({ indentation, trimmed });
  }
  flush();

  return toolBlocks.some((toolBlock) => {
    const serverLine = toolBlock.find(({ trimmed }) =>
      /^(?:-\s*)?server_id\s*:/u.test(trimmed)
    );
    const serverId = serverLine
      ? serverLine.trimmed.split(":", 2)[1].trim().replace(/^["']|["']$/gu, "")
      : "";
    if (serverId !== "westock") return false;

    let entityResolutionIndent = null;
    let exchangePatternsIndent = null;
    for (const { indentation, trimmed } of toolBlock) {
      if (
        exchangePatternsIndent !== null
        && indentation <= exchangePatternsIndent
      ) {
        exchangePatternsIndent = null;
      }
      if (
        entityResolutionIndent !== null
        && indentation <= entityResolutionIndent
      ) {
        entityResolutionIndent = null;
        exchangePatternsIndent = null;
      }
      if (/^entity_resolution\s*:/u.test(trimmed)) {
        entityResolutionIndent = indentation;
        continue;
      }
      if (
        entityResolutionIndent !== null
        && indentation > entityResolutionIndent
        && /^exchange_subject_patterns\s*:/u.test(trimmed)
      ) {
        exchangePatternsIndent = indentation;
        continue;
      }
      if (
        exchangePatternsIndent !== null
        && indentation > exchangePatternsIndent
        && /^(?:"BSE"|'BSE'|BSE)\s*:/u.test(trimmed)
      ) {
        return true;
      }
    }
    return false;
  });
}

function productionPythonAndYamlFiles(root) {
  const files = {};
  const visit = (relativeDirectory) => {
    const absoluteDirectory = join(root, ...relativeDirectory.split("/"));
    if (!existsSync(absoluteDirectory)) return;
    for (const entry of readdirSync(absoluteDirectory, { withFileTypes: true })) {
      const relativePath = `${relativeDirectory}/${entry.name}`;
      if (entry.isDirectory()) {
        visit(relativePath);
      } else if (/\.(?:py|ya?ml)$/iu.test(entry.name)) {
        files[relativePath] = readFileSync(
          join(root, ...relativePath.split("/")),
          "utf8",
        );
      }
    }
  };
  visit("backend/app");
  visit("backend/config");
  return files;
}

export function validateHarness(root) {
  const errors = [];
  for (const path of REQUIRED_FILES) requireFile(root, path, errors);
  for (const guard of STATIC_POLICY_GUARDS) {
    errors.push(...guard.validate(root));
  }

  const baselinePath = join(root, DECREE_FLOW_BASELINE);
  const policyEntries = Object.fromEntries(
    DECREE_FLOW_POLICY_ENTRIES.map((path) => {
      const absolute = join(root, path);
      return [path, existsSync(absolute) ? readFileSync(absolute, "utf8") : ""];
    }),
  );
  errors.push(...decreeFlowBaselineErrors({
    baselineExists: existsSync(baselinePath),
    baselineContent: existsSync(baselinePath) ? readFileSync(baselinePath, "utf8") : "",
    policyEntries,
  }));

  for (const path of LEGACY_META_HARNESS) {
    if (existsSync(join(root, path))) errors.push(`旧 meta-harness 不应继续存在: ${path}`);
  }
  const rootHarnessPaths = rootObservationKernelDiskPaths(root);
  errors.push(...rootObservationKernelPathErrors(rootHarnessPaths));
  for (const approvalPath of rootHarnessPaths.filter((entry) => entry.startsWith(".harness/approvals/"))) {
    try {
      const approval = validateApprovalManifest(parseJsonStrict(readFileSync(join(root, approvalPath), "utf8")));
      if (approval.request.approvalPath !== approvalPath) {
        errors.push(`M0 approval manifest 文件名与 task 不一致: ${approvalPath}`);
      }
    } catch (error) {
      errors.push(`M0 approval manifest 无效: ${approvalPath} (${error?.code ?? "INVALID"})`);
    }
  }

  for (const path of LEGACY_DUPLICATED_HOOKS) {
    if (existsSync(join(root, path))) {
      errors.push(`hook 脚本不应重复存在,应统一使用 ${SHARED_HOOK_SCRIPT}: ${path}`);
    }
  }

  for (const path of [".claude/settings.json", ".codex/hooks.json"]) {
    const absolute = join(root, path);
    if (!existsSync(absolute)) continue;
    const commands = hookCommands(readFileSync(absolute, "utf8"));
    if (commands === null) {
      errors.push(`${path} 不是合法 JSON`);
    } else if (!commands.includes(SHARED_HOOK_COMMAND)) {
      errors.push(`${path} 的 Stop command hook 应精确包含: ${SHARED_HOOK_COMMAND}`);
    }
  }

  for (const skill of SHARED_SKILLS) {
    const sourcePath = join(root, ".agents", "skills", skill, "SKILL.md");
    const claudePath = join(root, ".claude", "skills", skill, "SKILL.md");
    const sourceExists = existsSync(sourcePath);
    const claudeExists = existsSync(claudePath);
    const contentMatches = sourceExists && claudeExists
      && readFileSync(sourcePath, "utf8") === readFileSync(claudePath, "utf8");
    errors.push(...sharedSkillErrors(skill, {
      sourceExists, claudeExists, contentMatches,
    }));
  }

  if (existsSync(join(root, ".claude", "skills", "product-flow"))) {
    errors.push("product-flow 是 Codex 专用 skill，不应复制到 .claude/skills/product-flow");
  }

  const projectSkillsPath = join(root, ".agents", "skills");
  const vendoredThirdPartySkills = existsSync(projectSkillsPath)
    ? readdirSync(projectSkillsPath).filter((name) => (
      name === "gstack" || name === "superpowers" || name.startsWith("gstack-")
    ))
    : [];
  const workflowCiPath = join(root, ".github", "workflows", "harness.yml");
  const workflowCi = existsSync(workflowCiPath) ? readFileSync(workflowCiPath, "utf8") : "";
  const ciDependsOnPersonalSkills = /(?:install|setup).*(?:gstack|superpowers)|(?:gstack|superpowers).*(?:install|setup)/i
    .test(workflowCi);
  errors.push(...codexWorkflowPolicyErrors({
    claudeCopyExists: existsSync(join(root, ".claude", "skills", "codex-engineering-workflow")),
    vendoredSkills: vendoredThirdPartySkills,
    ciDependsOnPersonalSkills,
  }));

  const codexWorkflowGuidePath = join(root, "docs", "codex-engineering-workflow.md");
  const codexWorkflowSkillPath = join(root, ".agents", "skills", "codex-engineering-workflow", "SKILL.md");
  const codexWorkflowPromptPath = join(root, ".agents", "skills", "codex-engineering-workflow", "agents", "openai.yaml");
  const adaptiveRoutingPlanPath = join(root, "docs", "superpowers", "plans", "2026-08-13-adaptive-skill-routing.md");
  const agentsPath = join(root, "AGENTS.md");
  errors.push(...adaptiveRoutingPolicyErrors({
    agents: existsSync(agentsPath) ? readFileSync(agentsPath, "utf8") : "",
    guide: existsSync(codexWorkflowGuidePath) ? readFileSync(codexWorkflowGuidePath, "utf8") : "",
    skill: existsSync(codexWorkflowSkillPath) ? readFileSync(codexWorkflowSkillPath, "utf8") : "",
    prompt: existsSync(codexWorkflowPromptPath) ? readFileSync(codexWorkflowPromptPath, "utf8") : "",
    plan: existsSync(adaptiveRoutingPlanPath) ? readFileSync(adaptiveRoutingPlanPath, "utf8") : "",
  }));

  if (existsSync(codexWorkflowSkillPath)) {
    requireText(
      ".agents/skills/codex-engineering-workflow/SKILL.md",
      readFileSync(codexWorkflowSkillPath, "utf8"),
      [
        "name: codex-engineering-workflow",
        "Selected route",
        "Quality gates",
        "Escalation",
        "Blocked",
        "verification-before-completion",
        "gstack-claude",
        "run-claude-delivery.mjs",
        "solution-architect",
        "module-engineer",
        "test-engineer",
        "单独明确授权",
      ],
      errors,
    );
  }

  const deploySkillPath = join(root, ".agents", "skills", "deploy-chaotang-os", "SKILL.md");
  if (existsSync(deploySkillPath)) {
    requireText(
      ".agents/skills/deploy-chaotang-os/SKILL.md",
      readFileSync(deploySkillPath, "utf8"),
      [
        "name: deploy-chaotang-os",
        "docs/decisions/0028-decree-evidence-flow-governance-baseline.md",
        "docs/decisions/0041-single-host-container-deployment.md",
        "deploy/compose.yaml",
        "scripts/check_deployment.mjs",
        "release manifest",
        "frontend image digest",
        "backend image digest",
        "health alone",
        "ten consecutive",
        "explicit authorization",
        "missing capability",
        "production-data restore",
      ],
      errors,
    );
  }

  const deploySkillUiPath = join(root, ".agents", "skills", "deploy-chaotang-os", "agents", "openai.yaml");
  if (existsSync(deploySkillUiPath)) {
    requireText(
      ".agents/skills/deploy-chaotang-os/agents/openai.yaml",
      readFileSync(deploySkillUiPath, "utf8"),
      [
        'display_name: "Deploy chaotang-os"',
        "short_description:",
        "Use $deploy-chaotang-os",
      ],
      errors,
    );
  }

  const productFlowSkillPath = join(root, ".agents", "skills", "product-flow", "SKILL.md");
  if (existsSync(productFlowSkillPath)) {
    requireText(".agents/skills/product-flow/SKILL.md", readFileSync(productFlowSkillPath, "utf8"), [
      "name: product-flow",
      "$product-flow",
      "自动交付：",
      "run-claude-delivery.mjs --task",
      "总交付次数最多两次",
      "Claude 受限时由 Codex 接力",
      "专用退出码",
      ".codex/agents/",
      "Accepted",
      "Blocked",
      "Codex-only 冲突守卫",
      "不得启动 Claude CLI",
    ], errors);
  }

  const productFlowUiPath = join(root, ".agents", "skills", "product-flow", "agents", "openai.yaml");
  if (existsSync(productFlowUiPath)) {
    requireText(".agents/skills/product-flow/agents/openai.yaml", readFileSync(productFlowUiPath, "utf8"), [
      "display_name: \"自动产品交付\"",
      "short_description:",
      "Use $product-flow",
    ], errors);
  }

  const productFlowRunnerPath = join(root, ".agents", "skills", "product-flow", "scripts", "run-claude-delivery.mjs");
  if (existsSync(productFlowRunnerPath)) {
    requireText(".agents/skills/product-flow/scripts/run-claude-delivery.mjs", readFileSync(productFlowRunnerPath, "utf8"), [
      "docs/product/tasks",
      "status !== \"Ready\"",
      "\"--permission-mode\", \"acceptEdits\"",
      "\"--max-turns\", \"100\"",
      "--dry-run",
      "--self-test",
      "claudeRestriction",
      "CODEX_FALLBACK_EXIT_CODE",
    ], errors);
  }

  const mdAgentPath = join(root, ".claude", "agents", "harness-doctor.md");
  const tomlAgentPath = join(root, ".codex", "agents", "harness-doctor.toml");
  if (existsSync(mdAgentPath) && existsSync(tomlAgentPath)) {
    const mdAgent = parseMarkdownAgentBody(readFileSync(mdAgentPath, "utf8"));
    const tomlAgent = parseTomlAgentBody(readFileSync(tomlAgentPath, "utf8"));
    if (!mdAgent) errors.push(".claude/agents/harness-doctor.md 格式无法解析(需要 frontmatter + description)");
    if (!tomlAgent) errors.push(".codex/agents/harness-doctor.toml 格式无法解析(需要 description 与 developer_instructions)");
    if (mdAgent && tomlAgent) {
      if (mdAgent.description !== tomlAgent.description) {
        errors.push("harness-doctor 的 description 在 .claude/agents/harness-doctor.md 与 .codex/agents/harness-doctor.toml 之间不一致");
      }
      if (mdAgent.body !== tomlAgent.body) {
        errors.push("harness-doctor 的正文指令在 .claude/agents/harness-doctor.md 与 .codex/agents/harness-doctor.toml 之间不一致");
      }
      if (mdAgent.permissionMode !== "plan") {
        errors.push("Claude harness-doctor 必须使用 permissionMode: plan 保持只读");
      }
      if (JSON.stringify(mdAgent.tools) !== JSON.stringify(["Read", "Grep", "Glob", "Bash"])) {
        errors.push("Claude harness-doctor 的工具必须精确限制为 Read, Grep, Glob, Bash");
      }
      if (tomlAgent.sandboxMode !== "read-only") {
        errors.push('Codex harness-doctor 必须使用 sandbox_mode = "read-only"');
      }
    }
  }

  for (const expected of CLAUDE_DELIVERY_AGENTS) {
    const relativePath = `.claude/agents/${expected.name}.md`;
    const absolutePath = join(root, relativePath);
    if (!existsSync(absolutePath)) continue;
    errors.push(...claudeAgentErrors(relativePath, readFileSync(absolutePath, "utf8"), expected));
  }

  for (const expected of CODEX_DELIVERY_AGENTS) {
    const relativePath = `.codex/agents/${expected.name}.toml`;
    const absolutePath = join(root, relativePath);
    if (!existsSync(absolutePath)) continue;
    errors.push(...codexAgentErrors(relativePath, readFileSync(absolutePath, "utf8"), expected));
  }

  if (existsSync(agentsPath)) {
    const content = readFileSync(agentsPath, "utf8");
    const lines = content.split(/\r?\n/).length;
    if (lines > 80) errors.push(`AGENTS.md 应保持精简，当前 ${lines} 行，限制 80 行`);
    requireText("AGENTS.md", content, [
      "ARCHITECTURE.md",
      "docs/agentic-engineering.md",
      "docs/product-collaboration.md",
      "docs/tooling-compatibility.md",
      "docs/codex-engineering-workflow.md",
      "frontend/AGENTS.md",
      "backend/AGENTS.md",
      "node scripts/check_harness.mjs",
      "node scripts/harness-doctor.mjs --check",
      "node scripts/harness-doctor.mjs --status",
      "node scripts/harness-doctor.mjs --ready",
      "node scripts/product-authority.mjs --status",
      "--authorize --task <exact-id>",
      "--verify-candidate --task <exact-id>",
      "product-authority.m0.v1",
      ".harness/agents/project-owner.md",
      ".harness/rules/project-boundaries.md",
      ".harness/manifest/project-harness.json",
      "BOOTSTRAP_OBSERVE",
      "canExecuteProductWork=false",
      "node .agents/hooks/check-harness.mjs --self-test",
      "事实冲突",
      "先盘问",
      "Codex 自动选择并说明理由",
      "直接执行 → Matt Skills → Superpowers",
      "质量门禁",
      "Codex 客户端中，默认担任产品经理",
      "Claude Code 主会话默认担任程序团队负责人",
      "$product-flow",
      "$codex-engineering-workflow",
      "gstack-claude",
      "单独明确授权",
      "自动交付：",
      "node .agents/skills/product-flow/scripts/run-claude-delivery.mjs --self-test",
    ], errors);
  }

  const claudePath = join(root, "CLAUDE.md");
  if (existsSync(claudePath)) {
    requireText("CLAUDE.md", readFileSync(claudePath, "utf8"), [
      "Claude Code 程序团队负责人入口",
      "任务必须是 `Ready`",
      "solution-architect",
      "module-engineer",
      "test-engineer",
      "Affected Modules",
      "Technical Plan",
      "Implementation Report",
      "`Accepted` 只能由 Codex",
    ], errors);
  }

  for (const path of ["CLAUDE.md", "frontend/CLAUDE.md", "backend/CLAUDE.md"]) {
    const absolute = join(root, path);
    if (!existsSync(absolute)) continue;
    const firstLine = readFileSync(absolute, "utf8").split(/\r?\n/, 1)[0].trim();
    if (firstLine !== "@AGENTS.md") errors.push(`${path} 必须通过 @AGENTS.md 复用规则`);
  }

  const guidePath = join(root, "docs", "agentic-engineering.md");
  if (existsSync(guidePath)) {
    const missing = missingSections(readFileSync(guidePath, "utf8"), [
      "Baseline", "Workflow", "Feedback Loop", "Adoption Triggers", "Security",
      "Codex Engineering Workflow", "References",
    ]);
    for (const section of missing) errors.push(`docs/agentic-engineering.md 缺少章节: ## ${section}`);
  }

  const productGuidePath = join(root, "docs", "product-collaboration.md");
  if (existsSync(productGuidePath)) {
    const productGuide = readFileSync(productGuidePath, "utf8");
    const missing = missingSections(productGuide, [
      "Roles", "Task Contract", "Workflow", "Automation", "Conflict Rules", "Verification",
    ]);
    for (const section of missing) {
      errors.push(`docs/product-collaboration.md 缺少章节: ## ${section}`);
    }
    requireText("docs/product-collaboration.md", productGuide, [
      "rate_limit_event.status = rejected",
      "Codex 接力码 `6`",
      "solution-architect",
      "module-engineer",
      "test-engineer",
      "Codex-only",
      "gstack-claude",
    ], errors);
  }

  validateProductTasks(root, errors);

  const productTaskTemplatePath = join(root, "docs", "product", "tasks", "TEMPLATE.md");
  if (existsSync(productTaskTemplatePath)) {
    requireText("docs/product/tasks/TEMPLATE.md", readFileSync(productTaskTemplatePath, "utf8"), [
      "技能计划",
      "Codex-only",
      "实际使用的 skill",
      "验证命令与结果",
      "未运行项与原因",
    ], errors);
  }

  if (existsSync(codexWorkflowGuidePath)) {
    requireText("docs/codex-engineering-workflow.md", readFileSync(codexWorkflowGuidePath, "utf8"), [
      "规则优先级",
      "场景矩阵",
      "盘问与退出条件",
      "自动分流",
      "升级与阻塞",
      "不自动安装",
      "Codex-only 模式",
      "gstack-ship",
      "gstack-land-and-deploy",
      "CI",
      "降级",
    ], errors);
  }

  validateMarkdownDirectory(root, "docs/decisions", [
    "Status", "Context", "Decision", "Consequences", "Verification",
  ], "架构决策", errors);
  validateMarkdownDirectory(root, "docs/failures", [
    "Summary", "Root Cause", "Prevention", "Detection", "Evidence",
  ], "失败记录", errors);

  const workflowPath = join(root, ".github", "workflows", "harness.yml");
  if (existsSync(workflowPath)) {
    requireText(".github/workflows/harness.yml", readFileSync(workflowPath, "utf8"), [
      "node scripts/check_harness.mjs",
      "node scripts/check_harness.mjs --self-test",
      "node .agents/hooks/check-harness.mjs --self-test",
      "node .agents/skills/product-flow/scripts/run-claude-delivery.mjs --self-test",
    ], errors);
  }

  const architecturePath = join(root, "ARCHITECTURE.md");
  if (existsSync(architecturePath)) {
    const content = readFileSync(architecturePath, "utf8");
    if (content.includes("没有业务代码")) {
      const allowed = new Set(["AGENTS.md", "CLAUDE.md"]);
      for (const side of ["frontend", "backend"]) {
        const unexpected = readdirSync(join(root, side)).filter((name) => !allowed.has(name));
        if (unexpected.length) {
          errors.push(`架构声称没有业务代码，但 ${side}/ 出现: ${unexpected.join(", ")}`);
        }
      }
    }
    requireText("ARCHITECTURE.md", content, [
      "--credential-source local",
      "Secret Manager",
      "env://",
      "WorkBuddy",
      "data_search",
      "data_quote",
    ], errors);
  }

  const instrumentPath = join(root, "backend", "app", "jinyiwei", "instruments.py");
  if (existsSync(instrumentPath)) {
    requireText(
      "backend/app/jinyiwei/instruments.py",
      readFileSync(instrumentPath, "utf8"),
      ["class InstrumentRef", "SSE", "SZSE", "BSE"],
      errors,
    );
  }
  const jinyiweiModelsPath = join(root, "backend", "app", "jinyiwei", "models.py");
  if (existsSync(jinyiweiModelsPath)) {
    requireText(
      "backend/app/jinyiwei/models.py",
      readFileSync(jinyiweiModelsPath, "utf8"),
      ["class MarketMetric"],
      errors,
    );
  }
  const westockConfigPath = join(root, "backend", "config", "jinyiwei_mcp.yaml");
  errors.push(...mainlandSharePolicyErrors({
    productionFiles: productionPythonAndYamlFiles(root),
    westockConfig: existsSync(westockConfigPath)
      ? readFileSync(westockConfigPath, "utf8")
      : "",
  }));

  const oauthOperationalDocs = [
    "backend/AGENTS.md",
    "docs/decisions/0019-admin-oauth-for-mcp-service-accounts.md",
    "docs/superpowers/specs/2026-07-23-jinyiwei-westock-oauth-authorization-design.md",
  ];
  const oauthAuthorizeCommand =
    ".venv\\Scripts\\python.exe -m app.jinyiwei.mcp.oauth authorize --server westock";
  const oauthStatusCommand =
    ".venv\\Scripts\\python.exe -m app.jinyiwei.mcp.oauth status --server westock";
  const oauthSmokeCommand =
    ".venv\\Scripts\\python.exe -m app.jinyiwei.mcp.smoke --server westock --tool data_quote --query 比亚迪 --credential-source local";
  for (const relativePath of oauthOperationalDocs) {
    const absolutePath = join(root, ...relativePath.split("/"));
    if (!existsSync(absolutePath)) continue;
    const content = readFileSync(absolutePath, "utf8");
    requireText(relativePath, content, [
      "JINYIWEI_EXTERNAL_NETWORK_ENABLED",
      oauthAuthorizeCommand,
      oauthStatusCommand,
      oauthSmokeCommand,
      "data_search",
      "data_quote",
      "WorkBuddy",
      "Secret Manager",
      "env://",
    ], errors);
    if (/--query\s+(?!比亚迪(?:\s|$))\S+/u.test(content)) {
      errors.push(`${relativePath} 的 OAuth smoke 查询必须是 比亚迪`);
    }
  }

  const envTemplatePath = join(root, "backend", ".env.template");
  if (existsSync(envTemplatePath)) {
    const content = readFileSync(envTemplatePath, "utf8");
    if (!/^DEEPSEEK_API_KEY=\s*$/m.test(content)) {
      errors.push("backend/.env.template 必须包含空值的 DEEPSEEK_API_KEY=");
    }
    if (/sk-[A-Za-z0-9]{8,}/.test(content)) {
      errors.push("backend/.env.template 疑似包含真实密钥特征，必须只保留空模板");
    }
  }

  const backendPyprojectPath = join(root, "backend", "pyproject.toml");
  if (existsSync(backendPyprojectPath)) {
    const content = readFileSync(backendPyprojectPath, "utf8");
    if (!content.includes("python-dotenv")) {
      errors.push("backend/pyproject.toml 的 dependencies 必须声明 python-dotenv");
    }
  }

  const deepseekCheckPath = join(root, "backend", "app", "langgraph_runtime", "deepseek_check.py");
  if (existsSync(deepseekCheckPath)) {
    const content = readFileSync(deepseekCheckPath, "utf8");
    if (!content.includes("def main(")) {
      errors.push("backend/app/langgraph_runtime/deepseek_check.py 必须定义 def main(");
    }
    if (!content.includes("--dotenv-path")) {
      errors.push(
        "backend/app/langgraph_runtime/deepseek_check.py 必须声明显式的 --dotenv-path 参数，禁止默认读取私有 dotenv 文件"
      );
    }
    if (!content.includes("required=True")) {
      errors.push(
        "backend/app/langgraph_runtime/deepseek_check.py 的 --dotenv-path 必须是必填参数（required=True），防止静默回退读取私有文件"
      );
    }
  }

  const gitignorePath = join(root, ".gitignore");
  if (existsSync(gitignorePath)) {
    const content = readFileSync(gitignorePath, "utf8");
    if (!content.includes("!backend/.env.template")) {
      errors.push(".gitignore 必须包含否定规则: !backend/.env.template");
    }
  }

  return errors;
}

function runSelfTest() {
  const validProductTask = `# 任务：最小闭环

## Status

Ready

## Product Definition

解决一个问题。

## Acceptance Criteria

- [ ] 可以验证

## Delivery Constraints

保持最小范围。

## Affected Modules

- 模块：认证
- 允许路径：frontend/auth, backend/auth

## Technical Plan

按顺序实施并验证。

## Implementation Report

待填写。

## Acceptance Review

Pending
`;
  const validDeterministicAdr = `# 0025 — 确定性证据编排

## Status

Accepted — 2026-07-24

## Context

模型契约漂移。

## Decision

系统拥有事实计划。

## Consequences

减少模型调用。

## Verification

运行离线门禁。
`;
  const validFactPlans = `
from enum import StrEnum
class FactPlanDisposition(StrEnum):
    NOT_APPLICABLE = "NOT_APPLICABLE"
    PLANNED = "PLANNED"
    REJECTED = "REJECTED"
`;
  const validMarketPlan = `
fact = RequiredFact(
    key="market_quote:last_price",
    category=FactCategory.MARKET_QUOTE,
    data_scope=DataScope.EXTERNAL_PUBLIC,
    jurisdiction="CN",
    expected_unit="CNY",
    expected_shape="number",
    market_metric=MarketMetric.LAST_PRICE,
)
`;
  const validRenderer = `
def render_mainland_last_price(pack):
    if (
        pack.status is not EvidencePackStatus.RESOLVED
        or pack.resolved_facts != (fact.key,)
        or pack.unresolved_facts
        or pack.conflicts
    ):
        raise EvidenceProtocolError("quote_unavailable")
    candidates = tuple(
        item
        for item in items
        if is_evidence_fresh(
            as_of=item.as_of,
            retrieved_at=item.retrieved_at,
            request=pack.request,
            now=_parse_timestamp(pack.investigation_completed_at),
        )
    )
`;
  const validDeterministicPolicy = {
    factPlans: validFactPlans,
    marketPlan: validMarketPlan,
    renderer: validRenderer,
    adr: validDeterministicAdr,
    genericAgentFiles: {
      "backend/app/agents/market_fact_plan.py": validMarketPlan,
    },
  };
  const validAdaptiveRouting = {
    agents: `## 强制 Skill Preflight

<!-- adaptive-routing-contract:start -->
- 先盘问：信息足够即停止；未解决歧义进入 \`Blocked\`。
- Codex 自动选择并说明理由：选择直接执行、Matt Skills 或 Superpowers；跨模块、未知根因、高风险或验证链较长时使用 Superpowers。
- 直接执行仅用于不改变业务行为的低风险工作；局部行为修改在足够时使用 Matt Skills。
- 允许按 \`直接执行 → Matt Skills → Superpowers\` 升级；连续验证失败时说明证据并升级到 Superpowers。
- 已有明确授权的高风险事项使用 Superpowers；缺少授权时进入 \`Blocked\`。
- 质量门禁包括根因、测试和新鲜验证，不因路线降低。
- Matt Skills 缺失时不自动安装；使用等价 Codex 原生步骤，仍不足时升级到 Superpowers。
<!-- adaptive-routing-contract:end -->`,
    guide: `## 场景矩阵

<!-- adaptive-routing-contract:start -->

| 路线 | 典型条件 |
| --- | --- |
| 直接执行 | 明确、局部、可逆、低风险、不改变业务行为且容易验证 |
| Matt Skills | 局部功能或缺陷，存在受控不确定性 |
| Superpowers | 跨模块、未知根因、难回滚、高风险或验证链较长 |

## 盘问与退出条件

关键歧义无法消除时标记 \`Blocked\`。

## 自动分流

任务画像决定路线。输出 Selected route、Quality gates 与 Escalation。质量门禁包括根因、测试和新鲜验证。

## 升级与阻塞

连续验证失败时必须说明证据并升级到 Superpowers。已有明确授权的高风险事项进入 Superpowers；缺少授权或未解决歧义时进入 \`Blocked\`。Matt Skills 缺失时不自动安装，使用等价 Codex 原生步骤，仍不足时升级。

## 外部动作与安全门禁

生产写入必须获得当前任务的单独明确授权。
<!-- adaptive-routing-contract:end -->`,
    skill: `<!-- adaptive-routing-contract:start -->
## 先盘问并自动分流

先盘问；关键歧义无法消除时返回 \`Blocked\`。

| 路线 | 条件 |
| --- | --- |
| 直接执行 | 明确、局部、可逆、低风险、不改变业务行为且容易验证 |
| Matt Skills | 局部行为修改且风险可控，需要针对性实现或审查 |
| Superpowers | 跨模块、未知根因、难回滚、高风险或验证链较长 |

Selected route: choose one route
Quality gates: root-cause, test, and fresh-verification outcomes
Escalation: name observable evidence

连续验证失败时说明证据并升级到 Superpowers。已有明确授权的高风险事项使用 Superpowers；缺少授权或未解决歧义时进入 \`Blocked\`。Matt Skills 缺失时不自动安装，改用等价 Codex 原生步骤，仍不足时升级到 Superpowers。
<!-- adaptive-routing-contract:end -->`,
    prompt: `default_prompt: "clarify first, choose direct execution, Matt Skills, or Superpowers, explain the smallest sufficient route, and escalate when evidence raises scope, uncertainty, or risk while preserving fresh verification."`,
  };
  // Self-tests consume the same sealed bodies as production validation so the
  // fixture cannot silently drift into a weaker, test-only policy dialect.
  validAdaptiveRouting.agents = `## 强制 Skill Preflight\n\n${ADAPTIVE_ROUTING_START}\n${ADAPTIVE_ROUTING_CANONICAL_BODIES.agents}\n${ADAPTIVE_ROUTING_END}`;
  validAdaptiveRouting.guide = `## 场景矩阵\n\n${ADAPTIVE_ROUTING_START}\n${ADAPTIVE_ROUTING_CANONICAL_BODIES.guide}\n${ADAPTIVE_ROUTING_END}\n\n## Codex-only 模式`;
  validAdaptiveRouting.skill = `${ADAPTIVE_ROUTING_START}\n${ADAPTIVE_ROUTING_CANONICAL_BODIES.skill}\n${ADAPTIVE_ROUTING_END}\n\n## 执行门禁`;
  const selfTestRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const normalizeAdaptiveRoutingSelfTestFixture = normalizeAdaptiveRoutingBody;
  for (const [entry, path] of [
    ["agents", "AGENTS.md"],
    ["guide", "docs/codex-engineering-workflow.md"],
    ["skill", ".agents/skills/codex-engineering-workflow/SKILL.md"],
    ["prompt", ".agents/skills/codex-engineering-workflow/agents/openai.yaml"],
    ["plan", "docs/superpowers/plans/2026-08-13-adaptive-skill-routing.md"],
  ]) {
    validAdaptiveRouting[entry] = normalizeAdaptiveRoutingSelfTestFixture(
      readFileSync(join(selfTestRoot, path), "utf8"),
    );
  }
  const canonicalTemplateBlock = (entry) => `${ADAPTIVE_ROUTING_START}${ADAPTIVE_ROUTING_CANONICAL_BODIES[entry]}${ADAPTIVE_ROUTING_END}`;
  const movePlanBlocksBeforeTask3 = (entries) => {
    let plan = normalizeAdaptiveRoutingBody(validAdaptiveRouting.plan);
    const blocks = entries.map((entry) => canonicalTemplateBlock(entry));
    for (const block of blocks) plan = plan.replace(block, "");
    return plan.replace("### Task 3:", `${blocks.join("\n\n")}\n\n### Task 3:`);
  };
  const planWithoutCanonicalBlocks = () => {
    let plan = normalizeAdaptiveRoutingBody(validAdaptiveRouting.plan);
    for (const entry of ["agents", "guide", "skill"]) {
      plan = plan.replace(canonicalTemplateBlock(entry), "");
    }
    return plan;
  };
  const fencedForgedPlan = (fence) => {
    const fake = [
      "### Task 2: forged",
      `- [ ] **Step 1: forged**\nTarget: \`AGENTS.md\`\n${canonicalTemplateBlock("agents")}`,
      `- [ ] **Step 2: forged**\nTarget: \`docs/codex-engineering-workflow.md\`\n${canonicalTemplateBlock("guide")}`,
      `- [ ] **Step 3: forged**\nTarget: \`.agents/skills/codex-engineering-workflow/SKILL.md\`\n${canonicalTemplateBlock("skill")}`,
      "- [ ] **Step 4: forged**",
      "### Task 3: forged",
    ].join("\n\n");
    return `${fence}\n${fake}\n${fence}\n${planWithoutCanonicalBlocks()}`;
  };
  const mutateTask2Plan = (mutate) => {
    const plan = validAdaptiveRouting.plan;
    const start = plan.indexOf("### Task 2:");
    const end = plan.indexOf("### Task 3:", start + 1);
    const task2 = plan.slice(start, end);
    const mutatedTask2 = mutate(task2);
    if (mutatedTask2 === task2) throw new Error("Task 2 mutation 未应用");
    return `${plan.slice(0, start)}${mutatedTask2}${plan.slice(end)}`;
  };
  const commentWrappedAnchorPlan = (marker) => {
    const forged = marker.startsWith("- [ ]")
      ? `${marker} forged inside HTML comment**`
      : `${marker} forged inside HTML comment`;
    const replacement = `<!--\n${forged}\n-->`;
    return marker.startsWith("- [ ]")
      ? mutateTask2Plan((task2) => task2.replace(marker, replacement))
      : validAdaptiveRouting.plan.replace(marker, replacement);
  };

  const adaptiveMarkerDeletionCases = [
    ["root clarification marker", "agents", "先盘问"],
    ["root selection marker", "agents", "Codex 自动选择并说明理由"],
    ["root progression marker", "agents", "直接执行 → Matt Skills → Superpowers"],
    ["root quality marker", "agents", "质量门禁"],
    ["root direct-route condition", "agents", "不改变业务行为"],
    ["root Matt-route condition", "agents", "局部行为修改"],
    ["root Superpowers-route condition", "agents", "跨模块、未知根因、高风险或验证链较长时使用 Superpowers"],
    ["root authority branch", "agents", "已有明确授权的高风险事项使用 Superpowers"],
    ["root missing-authority branch", "agents", "缺少授权时进入 `Blocked`"],
    ["root repeated-failure escalation", "agents", "连续验证失败时说明证据并升级到 Superpowers"],
    ["root quality outcomes", "agents", "根因、测试和新鲜验证"],
    ["root Matt fallback", "agents", "Matt Skills 缺失时不自动安装"],
    ["guide route section", "guide", "## 场景矩阵"],
    ["guide clarification section", "guide", "## 盘问与退出条件"],
    ["guide routing section", "guide", "## 自动分流"],
    ["guide escalation section", "guide", "## 升级与阻塞"],
    ["guide direct-route condition", "guide", "不改变业务行为且容易验证"],
    ["guide Matt-route condition", "guide", "局部功能或缺陷，存在受控不确定性"],
    ["guide Superpowers-route condition", "guide", "跨模块、未知根因、难回滚、高风险或验证链较长"],
    ["guide quality outcomes", "guide", "根因、测试和新鲜验证"],
    ["guide repeated-failure escalation", "guide", "连续验证失败时必须说明证据并升级到 Superpowers"],
    ["guide authority branch", "guide", "已有明确授权的高风险事项进入 Superpowers"],
    ["guide missing-authority branch", "guide", "缺少授权或未解决歧义时进入 `Blocked`"],
    ["guide Matt fallback", "guide", "Matt Skills 缺失时不自动安装"],
    ["skill routing section", "skill", "## 先盘问并自动分流"],
    ["skill selected-route marker", "skill", "Selected route"],
    ["skill quality-gates marker", "skill", "Quality gates"],
    ["skill escalation marker", "skill", "Escalation"],
    ["skill direct-route condition", "skill", "不改变业务行为且容易验证"],
    ["skill Matt-route condition", "skill", "局部行为修改且风险可控"],
    ["skill Superpowers-route condition", "skill", "跨模块、未知根因、难回滚、高风险或验证链较长"],
    ["skill authority branch", "skill", "已有明确授权的高风险事项使用 Superpowers"],
    ["skill missing-authority branch", "skill", "缺少授权或未解决歧义时进入 `Blocked`"],
    ["skill repeated-failure escalation", "skill", "连续验证失败时说明证据并升级到 Superpowers"],
    ["skill quality outcomes", "skill", "root-cause, test, and fresh-verification outcomes"],
    ["skill Matt fallback", "skill", "Matt Skills 缺失时不自动安装"],
    ["prompt clarification marker", "prompt", "clarify first"],
    ["prompt direct-route marker", "prompt", "direct execution"],
    ["prompt Matt marker", "prompt", "Matt Skills"],
    ["prompt Superpowers marker", "prompt", "Superpowers"],
    ["prompt explanation marker", "prompt", "explain"],
    ["prompt escalation marker", "prompt", "escalate"],
  ];
  const mutateAdaptiveEntry = (entry, target, replacement) => {
    const content = validAdaptiveRouting[entry];
    const mutated = content.includes(target)
      ? content.replaceAll(target, replacement)
      : content.replace(ADAPTIVE_ROUTING_END, `${replacement}\n${ADAPTIVE_ROUTING_END}`);
    if (mutated === content) throw new Error(`自适应路由 mutation 未应用: ${entry}: ${target}`);
    return { ...validAdaptiveRouting, [entry]: mutated };
  };
  const sixMinistryFamilyMatrixFixture = JSON.parse(readFileSync(
    join(selfTestRoot, "docs/migrations/2026-08-14-six-ministry-capability-family-matrix.json"),
    "utf8",
  ));
  const sixMinistryRuntimeProjectionFixture = JSON.parse(readFileSync(
    join(selfTestRoot, "backend/app/agents/runtime_skills/capability_family_bindings.json"),
    "utf8",
  ));
  const sixMinistryRuntimeReadinessFixture = JSON.parse(readFileSync(
    join(selfTestRoot, "docs/migrations/2026-08-14-six-ministry-runtime-readiness.json"),
    "utf8",
  ));
  const tests = [
    [
      "启用六部可信证据脊柱静态守卫",
      STATIC_POLICY_GUARDS.some((guard) => guard.name === "six-ministry-trusted-evidence-spine"),
      true,
    ],
    [
      "启用六部能力蒸馏静态守卫",
      STATIC_POLICY_GUARDS.some((guard) => guard.name === "six-ministry-capability-distillation"),
      true,
    ],
    [
      "六部 Runtime 当前内容边界固定排除两个验证器与两个后继路径",
      (() => {
        const invalidExclusionSets = [
          SIX_MINISTRY_RUNTIME_CONTENT_EXCLUSIONS.slice(1),
          [...SIX_MINISTRY_RUNTIME_CONTENT_EXCLUSIONS, "backend/app/api/decrees.py"],
        ];
        const rejectsBoundaryChanges = invalidExclusionSets.every((exclusions) => {
          try {
            sixMinistryRuntimeContentFiles(SIX_MINISTRY_TRUSTED_SPINE_FILES, exclusions);
            return false;
          } catch {
            return true;
          }
        });
        return rejectsBoundaryChanges
          && SIX_MINISTRY_RUNTIME_CONTENT_FILES.length === SIX_MINISTRY_RUNTIME_CONTENT_FILE_COUNT
          && SIX_MINISTRY_RUNTIME_CONTENT_EXCLUSIONS.length === 4
          && SIX_MINISTRY_SUCCESSOR_CONTENT_PATHS.length === 2
          && SIX_MINISTRY_CONTENT_FINGERPRINT_PAIRS.length === 20
          && SIX_MINISTRY_CONTENT_FINGERPRINT_PAIRS.every(
            (pair) => Array.isArray(pair) && pair.length === 2,
          )
          && SIX_MINISTRY_SUCCESSOR_CONTENT_PATHS.every(
            (relativePath) => SIX_MINISTRY_RUNTIME_CONTENT_EXCLUSIONS.includes(relativePath),
          )
          && SIX_MINISTRY_RUNTIME_CONTENT_EXCLUSIONS.every(
            (relativePath) => !SIX_MINISTRY_RUNTIME_CONTENT_FILES.includes(relativePath),
          );
      })(),
      true,
    ],
    [
      "六部 Runtime 指纹门禁只接受二十组精确兼容对并拒绝单边、混搭、篡改与未知状态",
      (() => {
        const unknown = `sha256:${"0".repeat(64)}`;
        const fifthPair = [
          "sha256:a6d109de75e877620a89241a4dcabcc716e1a5a1a18a024c9a3cb73e578de80c",
          "sha256:709ebaf18862a4c2d78422756ca1e353eeb8dd5925c624ee74d9ebdaf43cc924",
        ];
        const sixthPair = [
          "sha256:cc42339eaa423d71307ef96ff713ec095a89ba2cc4d4f6630ee1b40dec94d34d",
          "sha256:709ebaf18862a4c2d78422756ca1e353eeb8dd5925c624ee74d9ebdaf43cc924",
        ];
        const seventhPair = [
          "sha256:eb0d8d214c2dc51ca4eb37ce5a13423e424fd6fdd3b6b8c3dac6a5f5757bd2df",
          "sha256:709ebaf18862a4c2d78422756ca1e353eeb8dd5925c624ee74d9ebdaf43cc924",
        ];
        const eighthPair = [
          "sha256:82885fc13cec86318e4436fccfd80c78d7880e4aa25cdb530d0f4d18c9c73fe3",
          "sha256:709ebaf18862a4c2d78422756ca1e353eeb8dd5925c624ee74d9ebdaf43cc924",
        ];
        const approvedPair = [
          "sha256:598dd8e735ce98b2d8a5307c3fa8b866d8fe72521c92b0c6ea4ba360d7bc9f79",
          "sha256:709ebaf18862a4c2d78422756ca1e353eeb8dd5925c624ee74d9ebdaf43cc924",
        ];
        const p14GateALifecycleTruthPair = [
          "sha256:32ecf613778ddc625567b08ec4526efbf22c0cd29a8c94fc3b9bacbe4e0dd05e",
          "sha256:9d10d2bed258e632c909719f05df50c6b33530d9f40be2458a38dd063fcde3c5",
        ];
        const p14UserNamespaceStickyPair = [
          "sha256:32ecf613778ddc625567b08ec4526efbf22c0cd29a8c94fc3b9bacbe4e0dd05e",
          "sha256:1922b611550d73daa6226d9dd8abf8d9f9691a0501f9f1fd0ea83e8c772829d2",
        ];
        const mingshuoWorkProductPair = [
          "sha256:598dd8e735ce98b2d8a5307c3fa8b866d8fe72521c92b0c6ea4ba360d7bc9f79",
          "sha256:43cf0adb1d4312e17fef0ec33ca963dbbc98b30d92d9f558a901f0d3ec0a9fea",
        ];
        const mingshuoReplayCorrectivePair = [
          "sha256:598dd8e735ce98b2d8a5307c3fa8b866d8fe72521c92b0c6ea4ba360d7bc9f79",
          "sha256:d4e78e42b89022088bb6687a7ab5cc57bcd908a3017b2b4a2e2611497d04def2",
        ];
        const mingshuoConfirmReadbackPair = [
          "sha256:9e8729a88bc797c01d59818fb67d852025a9c679fdd7eb6e8fe63f26cbc8d365",
          "sha256:6b9521165b821729a3548f3535b90c30aab9b874c81b1b1b437bb5af64d06e34",
        ];
        const integrationPair = ["sha256:da31d9d44a2d9fc81e562d0f59027b5a7114afacbdd9f6803b5511350d9c9666", "sha256:8c4e1669489eb5ec90a79e8e123a390a6e5b74fcc369adcd249493c5ba7c326e"];
        const expectedPairs = [
          ["sha256:013bfb8272e936be85c2d470033787c3b7f105ad6eae2dfe680373df023b5e69", "sha256:709ebaf18862a4c2d78422756ca1e353eeb8dd5925c624ee74d9ebdaf43cc924"],
          ["sha256:c95630be3d79f2641ff6e483f4096b0763b9e5071544f1e0ead0d7e24eb1cba5", "sha256:268cab13e516d0f716f600819f2bddc8242269312d392eca4ed1be2de05ce051"],
          ["sha256:d330b7f177f5bbb761eb359ffffca6f12250e5bbe90d13d0414d0fdefb78e98a", "sha256:709ebaf18862a4c2d78422756ca1e353eeb8dd5925c624ee74d9ebdaf43cc924"],
          ["sha256:da31e8098bf76c72ff8d00b073d86e3442b0811223ef3e3bab770af31e89c28e", "sha256:709ebaf18862a4c2d78422756ca1e353eeb8dd5925c624ee74d9ebdaf43cc924"],
          fifthPair,
          sixthPair,
          seventhPair,
          eighthPair,
          approvedPair,
          p14GateALifecycleTruthPair,
          p14UserNamespaceStickyPair,
          mingshuoWorkProductPair,
          mingshuoReplayCorrectivePair,
          mingshuoConfirmReadbackPair,
          ["sha256:33baa33eebcbefbb09f85fb09b4f49baf145b667eabdfe2be3c245f43f39f2f7", "sha256:d4e78e42b89022088bb6687a7ab5cc57bcd908a3017b2b4a2e2611497d04def2"],
          ["sha256:7a1220fa7c583de7248eca3ef6deac9b50635f73bf08d569190a3505b62db628", "sha256:d4e78e42b89022088bb6687a7ab5cc57bcd908a3017b2b4a2e2611497d04def2"],
          integrationPair,
          ["sha256:9b9927bb53cccc26e074c1f382630d94445d0b207cddfa88930dcfc3f7b705a0", "sha256:d4e78e42b89022088bb6687a7ab5cc57bcd908a3017b2b4a2e2611497d04def2"],
          ["sha256:c711c32fea39b31177e49f836455102a25fc4b9662363075b24fc25efb73991f", "sha256:d4e78e42b89022088bb6687a7ab5cc57bcd908a3017b2b4a2e2611497d04def2"],
          ["sha256:9a78e2b67840d116179d755fd3d9949643d7dec1942e60e93ae15b393be0e018", "sha256:d4e78e42b89022088bb6687a7ab5cc57bcd908a3017b2b4a2e2611497d04def2"],
        ];
        const validPairs = new Set(
          SIX_MINISTRY_CONTENT_FINGERPRINT_PAIRS.map(([runtime, successor]) => (
            `${runtime}\0${successor}`
          )),
        );
        const runtimeFingerprints = [
          ...new Set(SIX_MINISTRY_CONTENT_FINGERPRINT_PAIRS.map(([runtime]) => runtime)),
          unknown,
        ];
        const successorFingerprints = [
          ...new Set(SIX_MINISTRY_CONTENT_FINGERPRINT_PAIRS.map(([, successor]) => successor)),
          unknown,
        ];
        const tamperedRuntime = `${mingshuoConfirmReadbackPair[0].slice(0, -1)}${mingshuoConfirmReadbackPair[0].endsWith("0") ? "1" : "0"}`;
        const tamperedSuccessor = `${mingshuoConfirmReadbackPair[1].slice(0, -1)}${mingshuoConfirmReadbackPair[1].endsWith("0") ? "1" : "0"}`;
        const rejectedPairs = [
          [integrationPair[0], unknown],
          [unknown, integrationPair[1]],
          [integrationPair[1], integrationPair[0]],
          ...expectedPairs.slice(0, 16).map(([runtime]) => [runtime, integrationPair[1]]),
          ...expectedPairs.slice(0, 16).map(([, successor]) => [integrationPair[0], successor]),
          [`${integrationPair[0].slice(0, -1)}${integrationPair[0].endsWith("0") ? "1" : "0"}`, integrationPair[1]],
          [integrationPair[0], `${integrationPair[1].slice(0, -1)}${integrationPair[1].endsWith("0") ? "1" : "0"}`],
          [mingshuoConfirmReadbackPair[0], unknown],
          [unknown, mingshuoConfirmReadbackPair[1]],
          [mingshuoConfirmReadbackPair[1], mingshuoConfirmReadbackPair[0]],
          ...expectedPairs.slice(0, 13).map(([, successor]) => [mingshuoConfirmReadbackPair[0], successor]),
          ...expectedPairs.slice(0, 13).map(([runtime]) => [runtime, mingshuoConfirmReadbackPair[1]]),
          [unknown, unknown],
          [tamperedRuntime, mingshuoConfirmReadbackPair[1]],
          [mingshuoConfirmReadbackPair[0], tamperedSuccessor],
        ];
        return JSON.stringify(SIX_MINISTRY_CONTENT_FINGERPRINT_PAIRS) === JSON.stringify(expectedPairs)
          && SIX_MINISTRY_CONTENT_FINGERPRINT_PAIRS.every(
          ([runtime, successor]) => sixMinistryContentFingerprintPairAllowed(runtime, successor),
          )
          && rejectedPairs.every(
            ([runtime, successor]) => !sixMinistryContentFingerprintPairAllowed(runtime, successor),
          )
          && runtimeFingerprints.every((runtime) => successorFingerprints.every((successor) => (
          sixMinistryContentFingerprintPairAllowed(runtime, successor)
          === validPairs.has(`${runtime}\0${successor}`)
          )));
      })(),
      true,
    ],
    [
      "六部 Runtime 就绪报告与能力矩阵、权威技能投影一致",
      sixMinistryRuntimeReadinessErrors({
        readiness: sixMinistryRuntimeReadinessFixture,
        familyMatrix: sixMinistryFamilyMatrixFixture,
        runtimeProjection: sixMinistryRuntimeProjectionFixture,
        root: selfTestRoot,
      }),
      [],
    ],
    [
      "六部 Runtime 就绪门禁拒绝伪造业务成功",
      sixMinistryRuntimeReadinessErrors({
        readiness: {
          ...sixMinistryRuntimeReadinessFixture,
          summary: {
            ...sixMinistryRuntimeReadinessFixture.summary,
            businessSuccessMeasuredFamilies: 22,
            serverOwnedResolverBindings: 22,
            productionPromotionAuthorized: true,
          },
          capabilityFamilies: sixMinistryRuntimeReadinessFixture.capabilityFamilies.map((row, index) => (
            index === 0 ? { ...row, businessSuccessMeasured: true } : row
          )),
        },
        familyMatrix: sixMinistryFamilyMatrixFixture,
        runtimeProjection: sixMinistryRuntimeProjectionFixture,
        root: selfTestRoot,
      }).length > 0,
      true,
    ],
    [
      "六部 Runtime 就绪门禁拒绝过期实现或复审指纹",
      sixMinistryRuntimeReadinessErrors({
        readiness: {
          ...sixMinistryRuntimeReadinessFixture,
          implementationEvidence: {
            ...sixMinistryRuntimeReadinessFixture.implementationEvidence,
            fingerprint: `sha256:${"0".repeat(64)}`,
          },
          validationEvidence: {
            ...sixMinistryRuntimeReadinessFixture.validationEvidence,
            implementationFingerprint: `sha256:${"0".repeat(64)}`,
            independentReviews: {
              ...sixMinistryRuntimeReadinessFixture.validationEvidence.independentReviews,
              reviewedImplementationFingerprint: `sha256:${"0".repeat(64)}`,
            },
          },
        },
        familyMatrix: sixMinistryFamilyMatrixFixture,
        runtimeProjection: sixMinistryRuntimeProjectionFixture,
        root: selfTestRoot,
      }).length > 0,
      true,
    ],
    [
      "六部 Runtime 就绪门禁拒绝历史复审状态抬升",
      sixMinistryRuntimeReadinessErrors({
        readiness: {
          ...sixMinistryRuntimeReadinessFixture,
          validationEvidence: {
            ...sixMinistryRuntimeReadinessFixture.validationEvidence,
            independentReviews: {
              ...sixMinistryRuntimeReadinessFixture.validationEvidence.independentReviews,
              status: "approved",
            },
          },
        },
        familyMatrix: sixMinistryFamilyMatrixFixture,
        runtimeProjection: sixMinistryRuntimeProjectionFixture,
        root: selfTestRoot,
      }).length > 0,
      true,
    ],
    [
      "六部 Runtime 就绪门禁拒绝未知字段注入与自由文本伪证",
      sixMinistryRuntimeReadinessErrors({
        readiness: {
          ...sixMinistryRuntimeReadinessFixture,
          productionStatus: "stable",
          validationEvidence: {
            productionBusinessSuccess: "22/22 verified",
          },
          capabilityFamilies: sixMinistryRuntimeReadinessFixture.capabilityFamilies.map((row, index) => (
            index === 0 ? { ...row, authorityResolversConnected: 1 } : row
          )),
        },
        familyMatrix: sixMinistryFamilyMatrixFixture,
        runtimeProjection: sixMinistryRuntimeProjectionFixture,
        root: selfTestRoot,
      }).length > 0,
      true,
    ],
    [
      "六部能力门禁拒绝伪造晋级与真实流量",
      sixMinistryCapabilityPolicyErrors({
        inventory: { source: { commit: PINNED_EXT_COMMIT }, summary: { unclassified: 0 } },
        regenerated: { source: { commit: PINNED_EXT_COMMIT }, summary: { unclassified: 0 } },
        capsules: SIX_MINISTRY_CANDIDATES.map((id) => ({ id, valid: true, locked: true })),
        evaluation: {
          policy: { authorizesPromotion: true, abilityGainMeasured: true, scaffoldOnly: false },
          candidates: [],
        },
        shadow: { mode: "live-shadow", realTrafficObserved: true, abilityGainMeasured: true, promotionAuthorized: true, runs: [] },
      }).length > 0,
      true,
    ],
    [
      "六部能力门禁拒绝缺失胶囊与清单漂移",
      sixMinistryCapabilityPolicyErrors({
        inventory: { source: { commit: PINNED_EXT_COMMIT }, summary: { unclassified: 0 } },
        regenerated: { source: { commit: "different" }, summary: { unclassified: 0 } },
        capsules: [],
        evaluation: { policy: {}, candidates: [] },
        shadow: {},
      }).length > 0,
      true,
    ],
    [
      "启用真实性与决策质量静态守卫",
      STATIC_POLICY_GUARDS.some((guard) => guard.name === "decision-quality-gate")
        ? []
        : ["缺少静态守卫登记: decision-quality-gate"],
      [],
    ],
    [
      "拒绝空真实性与决策质量 fixture suite",
      evaluateFixtureSuite({ schema_version: "1.0.0", base_packet: {}, cases: [] }).pass,
      false,
    ],
    [
      "拒绝清空失败案例的期望错误码",
      evaluateFixtureSuite({
        schema_version: "1.0.0",
        base_packet: {},
        cases: Array.from({ length: 40 }, (_, index) => ({
          case_id: `case-${index}`,
          expected_pass: index < 20,
          expected_errors: [],
          patch: {},
        })),
      }).pass,
      false,
    ],
    [
      "repository guard 拒绝真实 fixture 被清空",
      decisionQualityGateRepositoryErrors(
        resolve(dirname(fileURLToPath(import.meta.url)), ".."),
        () => JSON.stringify({ schema_version: "1.0.0", base_packet: {}, cases: [] }),
      ).length > 0,
      true,
    ],
    [
      "repository guard 拒绝失败案例错误码被清空",
      decisionQualityGateRepositoryErrors(
        resolve(dirname(fileURLToPath(import.meta.url)), ".."),
        (path, encoding) => {
          const suite = JSON.parse(readFileSync(path, encoding));
          suite.cases.find((entry) => entry.expected_pass === false).expected_errors = [];
          return JSON.stringify(suite);
        },
      ).length > 0,
      true,
    ],
    [
      "登记 adaptive-routing validator false-green failure record 为必需文件",
      REQUIRED_FILES.includes("docs/failures/2026-08-13-adaptive-routing-validator-false-green.md"),
      true,
    ],
    [
      "登记 G1 root observation kernel 文件",
      ROOT_OBSERVATION_KERNEL_REQUIRED_FILES
        .filter((path) => !REQUIRED_FILES.includes(path))
        .map((path) => `缺少 REQUIRED_FILES 登记: ${path}`),
      [],
    ],
    [
      "接受 G1+M0 精确静态 root Harness",
      rootObservationKernelPathErrors(ROOT_OBSERVATION_KERNEL_HARNESS_FILES),
      [],
    ],
    [
      "接受 closed M0 approval 扩展点",
      rootObservationKernelPathErrors([
        ...ROOT_OBSERVATION_KERNEL_HARNESS_FILES,
        ".harness/approvals/H1-HUBU-RICH-MEMORIAL-20260816.json",
      ]),
      [],
    ],
    [
      "拒绝 root observation harness 扩展为旧 control plane",
      rootObservationKernelPathErrors([...ROOT_OBSERVATION_KERNEL_HARNESS_FILES, ".harness/wiki/architecture.md"]).length > 0,
      true,
    ],
    [
      "登记 M0 product authority 文件",
      M0_PRODUCT_AUTHORITY_REQUIRED_FILES
        .filter((path) => !REQUIRED_FILES.includes(path))
        .map((path) => `缺少 REQUIRED_FILES 登记: ${path}`),
      [],
    ],
    [
      "登记确定性证据交付文件",
      DETERMINISTIC_EVIDENCE_REQUIRED_FILES
        .filter((path) => !REQUIRED_FILES.includes(path))
        .map((path) => `缺少 REQUIRED_FILES 登记: ${path}`),
      [],
    ],
    [
      "启用确定性证据静态守卫",
      STATIC_POLICY_GUARDS.some((guard) => guard.name === "deterministic-evidence")
        ? []
        : ["缺少静态守卫登记: deterministic-evidence"],
      [],
    ],
    [
      "接受规范确定性证据契约",
      deterministicEvidencePolicyErrors(validDeterministicPolicy),
      [],
    ],
    [
      "拒绝伪装在注释中的规范事实",
      deterministicEvidencePolicyErrors({
        ...validDeterministicPolicy,
        marketPlan: `# RequiredFact(
# key="market_quote:last_price", jurisdiction="CN",
# expected_unit="CNY", expected_shape="number",
# category=FactCategory.MARKET_QUOTE,
# data_scope=DataScope.EXTERNAL_PUBLIC,
# market_metric=MarketMetric.LAST_PRICE,
# )`,
      }),
      ["大陆最新价计划必须在同一 RequiredFact 中固定 CN/CNY/number/LAST_PRICE"],
    ],
    [
      "拒绝伪装在普通字符串中的规范事实",
      deterministicEvidencePolicyErrors({
        ...validDeterministicPolicy,
        marketPlan: `decoy = 'RequiredFact(key="market_quote:last_price", category=FactCategory.MARKET_QUOTE, data_scope=DataScope.EXTERNAL_PUBLIC, jurisdiction="CN", expected_unit="CNY", expected_shape="number", market_metric=MarketMetric.LAST_PRICE)'`,
      }),
      ["大陆最新价计划必须在同一 RequiredFact 中固定 CN/CNY/number/LAST_PRICE"],
    ],
    [
      "拒绝伪装在三引号 docstring 中的规范事实",
      deterministicEvidencePolicyErrors({
        ...validDeterministicPolicy,
        marketPlan: `def decoy():
    """RequiredFact(
        key='market_quote:last_price',
        category=FactCategory.MARKET_QUOTE,
        data_scope=DataScope.EXTERNAL_PUBLIC,
        jurisdiction='CN',
        expected_unit='CNY',
        expected_shape='number',
        market_metric=MarketMetric.LAST_PRICE,
    )"""`,
      }),
      ["大陆最新价计划必须在同一 RequiredFact 中固定 CN/CNY/number/LAST_PRICE"],
    ],
    [
      "拒绝未解析或非当前证据 renderer",
      deterministicEvidencePolicyErrors({
        ...validDeterministicPolicy,
        renderer: "return EvidenceBackedOpinion(opinion='unchecked', evidence_ids=())",
      }),
      ["行情 renderer 必须只消费已解析且按调查完成时间仍当前有效的证据"],
    ],
    [
      "拒绝把 renderer 门禁藏在无关函数",
      deterministicEvidencePolicyErrors({
        ...validDeterministicPolicy,
        renderer: `${validRenderer.replace(
          "def render_mainland_last_price(pack):",
          "def unrelated(pack):",
        )}
def render_mainland_last_price(pack):
    return EvidenceBackedOpinion(opinion="unchecked", evidence_ids=())
`,
      }),
      ["行情 renderer 必须只消费已解析且按调查完成时间仍当前有效的证据"],
    ],
    [
      "拒绝把 renderer 门禁藏在静态死分支",
      deterministicEvidencePolicyErrors({
        ...validDeterministicPolicy,
        renderer: `def render_mainland_last_price(pack):
    if False:
        if (
            pack.status is not EvidencePackStatus.RESOLVED
            or pack.resolved_facts != (fact.key,)
            or pack.unresolved_facts
            or pack.conflicts
        ):
            raise EvidenceProtocolError("quote_unavailable")
        candidates = tuple(
            item
            for item in items
            if is_evidence_fresh(
                as_of=item.as_of,
                retrieved_at=item.retrieved_at,
                request=pack.request,
                now=_parse_timestamp(pack.investigation_completed_at),
            )
        )
    return EvidenceBackedOpinion(opinion="unchecked", evidence_ids=())
`,
      }),
      ["行情 renderer 必须只消费已解析且按调查完成时间仍当前有效的证据"],
    ],
    [
      "拒绝新通用 Agent 的公司代码映射",
      deterministicEvidencePolicyErrors({
        ...validDeterministicPolicy,
        genericAgentFiles: {
          "backend/app/agents/market_fact_plan.py": '"比亚迪": "sz002594"',
        },
      }),
      ["生产代码不得包含公司名称到 provider code 的字面量映射: backend/app/agents/market_fact_plan.py"],
    ],
    [
      "拒绝 ADR 0025 缺少必需章节",
      deterministicEvidencePolicyErrors({
        ...validDeterministicPolicy,
        adr: validDeterministicAdr.replace("## Verification", "## Checks"),
      }),
      ["ADR 0025 缺少章节: ## Verification"],
    ],
    [
      "接受 provider-neutral 的 A 股配置",
      mainlandSharePolicyErrors({
        productionFiles: {
          "backend/app/jinyiwei/instruments.py": "class InstrumentRef: pass\n",
        },
        westockConfig: "exchange_subject_patterns:\n  SSE: sh[0-9]{6}\n  SZSE: sz[0-9]{6}\n",
      }),
      [],
    ],
    [
      "拒绝公司名称到 provider code 的硬编码映射",
      mainlandSharePolicyErrors({
        productionFiles: {
          "backend/app/jinyiwei/instruments.py": '"比亚迪": "sz002594",\n',
        },
        westockConfig: "",
      }),
      ["生产代码不得包含公司名称到 provider code 的字面量映射: backend/app/jinyiwei/instruments.py"],
    ],
    [
      "拒绝 Python 内联和同一行多个公司代码映射",
      mainlandSharePolicyErrors({
        productionFiles: {
          "backend/app/jinyiwei/instruments.py":
            'COMPANIES = {"茅台": "sh600519", "比亚迪": "sz002594"}\n',
        },
        westockConfig: "",
      }),
      ["生产代码不得包含公司名称到 provider code 的字面量映射: backend/app/jinyiwei/instruments.py"],
    ],
    [
      "拒绝 YAML inline 公司代码映射但接受普通 provider 字段",
      mainlandSharePolicyErrors({
        productionFiles: {
          "backend/config/example.yaml":
            'companies: {比亚迪: sz002594}\nrecord: {"code": "sh600519"}\n',
        },
        westockConfig: "",
      }),
      ["生产代码不得包含公司名称到 provider code 的字面量映射: backend/config/example.yaml"],
    ],
    [
      "拒绝 westock 未经证明宣称 BSE",
      mainlandSharePolicyErrors({
        productionFiles: {},
        westockConfig: [
          "tools:",
          "  - server_id: westock",
          "    mapping:",
          "      entity_resolution:",
          "        exchange_subject_patterns:",
          "          BSE: bj[0-9]{6}",
        ].join("\n"),
      }),
      ["腾讯自选股配置不得在真实审批前声明 BSE exchange pattern"],
    ],
    [
      "拒绝 westock exchange patterns 的 quoted BSE key",
      mainlandSharePolicyErrors({
        productionFiles: {},
        westockConfig: [
          "tools:",
          "  - server_id: westock",
          "    mapping:",
          "      entity_resolution:",
          "        exchange_subject_patterns:",
          '          "BSE": bj[0-9]{6}',
        ].join("\n"),
      }),
      ["腾讯自选股配置不得在真实审批前声明 BSE exchange pattern"],
    ],
    [
      "接受其他 provider 已证明的 BSE pattern",
      mainlandSharePolicyErrors({
        productionFiles: {},
        westockConfig: [
          "tools:",
          "  - server_id: proven-bse-provider",
          "    mapping:",
          "      entity_resolution:",
          "        exchange_subject_patterns:",
          "          BSE: bj[0-9]{6}",
        ].join("\n"),
      }),
      [],
    ],
    [
      "接受 westock 非 entity-resolution 层级的同名元数据",
      mainlandSharePolicyErrors({
        productionFiles: {},
        westockConfig: [
          "tools:",
          "  - server_id: westock",
          "    metadata:",
          "      BSE: descriptive-only",
        ].join("\n"),
      }),
      [],
    ],
    ["接受完整章节", missingSections("## Workflow\n\n内容\n\n## Security\n", ["Workflow", "Security"]), []],
    ["拒绝缺失章节", missingSections("## Workflow\n", ["Workflow", "Security"]), ["Security"]],
    ["拒绝低级标题", missingSections("### Security\n", ["Security"]), ["Security"]],
    [
      "接受完整业务流基线与 AI 入口覆盖",
      decreeFlowBaselineErrors({
        baselineExists: true,
        baselineContent: "authoritative-flow",
        expectedHash: createHash("sha256").update("authoritative-flow").digest("hex"),
        policyEntries: Object.fromEntries(DECREE_FLOW_POLICY_ENTRIES.map((path) => [path, DECREE_FLOW_BASELINE])),
      }),
      [],
    ],
    [
      "接受仅换行格式不同的不可变业务流基线",
      decreeFlowBaselineErrors({
        baselineExists: true,
        baselineContent: "authoritative\r\nflow\r\n",
        expectedHash: createHash("sha256").update("authoritative\nflow\n").digest("hex"),
        policyEntries: Object.fromEntries(DECREE_FLOW_POLICY_ENTRIES.map((path) => [path, DECREE_FLOW_BASELINE])),
      }),
      [],
    ],
    [
      "拒绝被改写的业务流基线与遗漏 AI 入口",
      decreeFlowBaselineErrors({
        baselineExists: true,
        baselineContent: "changed-flow",
        expectedHash: createHash("sha256").update("authoritative-flow").digest("hex"),
        policyEntries: {},
      }),
      [
        `不可变业务流基线已被改写: ${DECREE_FLOW_BASELINE}`,
        ...DECREE_FLOW_POLICY_ENTRIES.map((path) => `AI 入口缺少业务流基线引用: ${path}`),
      ],
    ],
    [
      "解析 Markdown agent 正文",
      parseMarkdownAgentBody("---\nname: x\ndescription: 说明\ntools: Read, Bash\npermissionMode: plan\n---\n正文内容\n"),
      { description: "说明", body: "正文内容", tools: ["Read", "Bash"], permissionMode: "plan" },
    ],
    [
      "接受合法 Claude 专业角色",
      claudeAgentErrors(
        "x.md",
        "---\nname: x\ndescription: 说明\ntools: Read, Bash\npermissionMode: plan\n---\n边界说明\n",
        { name: "x", tools: ["Read", "Bash"], permissionMode: "plan", requiredText: ["边界"] },
      ),
      [],
    ],
    [
      "拒绝 Claude 专业角色扩大权限",
      claudeAgentErrors(
        "x.md",
        "---\nname: x\ndescription: 说明\ntools: Read, Bash, Write\npermissionMode: acceptEdits\n---\n边界说明\n",
        { name: "x", tools: ["Read", "Bash"], permissionMode: "plan", requiredText: ["边界"] },
      ),
      [
        "Claude 专业角色 x.md 的 tools 必须精确为 Read, Bash",
        "Claude 专业角色 x.md 的 permissionMode 必须是 plan",
      ],
    ],
    ["拒绝缺 frontmatter 的 Markdown agent", parseMarkdownAgentBody("没有 frontmatter"), null],
    [
      "拒绝缺 name 的 TOML agent",
      parseTomlAgentBody('description = "说明"\nsandbox_mode = "read-only"\ndeveloper_instructions = """\n正文内容\n"""\n'),
      null,
    ],
    [
      "解析 TOML agent 正文",
      parseTomlAgentBody('name = "x"\ndescription = "说明"\nsandbox_mode = "read-only"\ndeveloper_instructions = """\n正文内容\n"""\n'),
      { name: "x", description: "说明", body: "正文内容", sandboxMode: "read-only" },
    ],
    [
      "接受合法 Codex 专业角色",
      codexAgentErrors(
        "x.toml",
        'name = "x"\ndescription = "说明"\nsandbox_mode = "read-only"\ndeveloper_instructions = """\n边界说明\n"""\n',
        { name: "x", sandboxMode: "read-only", requiredText: ["边界"] },
      ),
      [],
    ],
    [
      "拒绝 Codex 专业角色固定模型",
      codexAgentErrors(
        "x.toml",
        'name = "x"\ndescription = "说明"\nmodel = "fixed"\nsandbox_mode = "read-only"\ndeveloper_instructions = """\n边界说明\n"""\n',
        { name: "x", sandboxMode: "read-only", requiredText: ["边界"] },
      ),
      ["Codex 专业角色 x.toml 不得固定 model，必须继承当前 Codex 会话模型"],
    ],
    ["拒绝缺字段的 TOML agent", parseTomlAgentBody('name = "x"\ndescription = "说明"\n'), null],
    [
      "解析 Stop command hook",
      hookCommands('{"hooks":{"Stop":[{"hooks":[{"type":"command","command":"node check.mjs"}]}]}}'),
      ["node check.mjs"],
    ],
    ["拒绝非法 hook JSON", hookCommands("{"), null],
    [
      "发现缺失的 Claude skill 入口",
      sharedSkillErrors("x", { sourceExists: true, claudeExists: false, contentMatches: false }),
      ["缺少 Claude Code skill 入口: .claude/skills/x/SKILL.md"],
    ],
    [
      "拒绝 skill 内容漂移",
      sharedSkillErrors("x", { sourceExists: true, claudeExists: true, contentMatches: false }),
      [".claude/skills/x 与 .agents/skills/x 内容不一致"],
    ],
    ["接受合法 Codex 工程规范", codexWorkflowPolicyErrors(), []],
    [
      "拒绝复制 Codex 专用与第三方 skill 并拒绝 CI 依赖",
      codexWorkflowPolicyErrors({
        claudeCopyExists: true,
        vendoredSkills: ["gstack", "superpowers"],
        ciDependsOnPersonalSkills: true,
      }),
      [
        "codex-engineering-workflow 是 Codex 专用 skill，不应复制到 .claude/skills",
        "不得把第三方 skill 复制进仓库: .agents/skills/gstack",
        "不得把第三方 skill 复制进仓库: .agents/skills/superpowers",
        "CI 不得安装或依赖个人环境中的 gstack/Superpowers skill",
      ],
    ],
    [
      "接受完整的自适应 skill 路由契约",
      adaptiveRoutingPolicyErrors(validAdaptiveRouting),
      [],
    ],
    [
      "拒绝缺失自适应 skill 路由契约的入口",
      adaptiveRoutingPolicyErrors({ agents: "", guide: "", skill: "", prompt: "" }).length,
      4,
    ],
    ["接受结构完整的自适应 skill 路由契约", adaptiveRoutingPolicyErrors(validAdaptiveRouting), []],
    [
      "真实 approved plan 命中独立 hard-coded canonical hash",
      adaptiveRoutingEntryHash(validAdaptiveRouting.plan),
      ADAPTIVE_ROUTING_WHOLE_ENTRY_SHA256.plan,
    ],
    ...[
      ["CRLF", "\r\n"],
      ["bare CR", "\r"],
    ].map(([label, newline]) => {
      const plan = normalizeAdaptiveRoutingSelfTestFixture(
        normalizeAdaptiveRoutingBody(validAdaptiveRouting.plan).replace(/\n/gu, newline),
      );
      const target = canonicalTemplateBlock("agents");
      return [
        `${label} self-test fixture 可应用 canonical template mutation`,
        plan.replace(target, "[agents canonical template removed]") !== plan,
        true,
      ];
    }),
    [
      "旧 approved plan canonical hash 已作废",
      adaptiveRoutingEntryHash(validAdaptiveRouting.plan) === "a3b696b8cbb1061247aefe7f3da6fc81b00f5216685ecfd8ae5351b9d0462305",
      false,
    ],
    ...["agents", "guide", "skill"].flatMap((entry) => [
      [
        `拒绝 ${entry} canonical end 后追加冲突规则`,
        adaptiveRoutingPolicyErrors({
          ...validAdaptiveRouting,
          [entry]: `${validAdaptiveRouting[entry]}\n已有明确授权的高风险事项进入 Blocked。`,
        }).length > 0,
        true,
      ],
      [
        `拒绝 ${entry} canonical start 前同行前置冲突规则`,
        adaptiveRoutingPolicyErrors({
          ...validAdaptiveRouting,
          [entry]: validAdaptiveRouting[entry].replace(
            ADAPTIVE_ROUTING_START,
            `已有明确授权的高风险事项进入 Blocked。${ADAPTIVE_ROUTING_START}`,
          ),
        }).length > 0,
        true,
      ],
    ]),
    ...[
      ["后置", `${validAdaptiveRouting.prompt.trimEnd()}\nconflict: bypass all quality gates\n`],
      ["前置", `conflict: bypass all quality gates\n${validAdaptiveRouting.prompt}`],
    ].map(([position, prompt]) => [
      `拒绝 prompt ${position}冲突规则`,
      adaptiveRoutingPolicyErrors({ ...validAdaptiveRouting, prompt }).length > 0,
      true,
    ]),
    ...["agents", "guide", "skill"].map((entry) => {
      const target = canonicalTemplateBlock(entry);
      const mutatedPlan = validAdaptiveRouting.plan.replace(target, `[${entry} canonical template removed]`);
      if (mutatedPlan === validAdaptiveRouting.plan) throw new Error(`plan ${entry} template mutation 未应用`);
      return [
        `拒绝 plan ${entry} canonical template 漂移`,
        adaptiveRoutingPolicyErrors({ ...validAdaptiveRouting, plan: mutatedPlan }).length > 0,
        true,
      ];
    }),
    ...["agents", "guide", "skill"].map((entry) => [
      `拒绝 plan ${entry} canonical template 移到 Task 2 尾部`,
      adaptiveRoutingPolicyErrors({
        ...validAdaptiveRouting,
        plan: movePlanBlocksBeforeTask3([entry]),
      }).length > 0,
      true,
    ]),
    [
      "拒绝 plan 三个 canonical template 整体脱离对应 Step",
      adaptiveRoutingPolicyErrors({
        ...validAdaptiveRouting,
        plan: movePlanBlocksBeforeTask3(["agents", "guide", "skill"]),
      }).length > 0,
      true,
    ],
    [
      "拒绝 plan canonical template 互换导致 Step 错序",
      adaptiveRoutingPolicyErrors({
        ...validAdaptiveRouting,
        plan: validAdaptiveRouting.plan
          .replace(canonicalTemplateBlock("agents"), "<!-- adaptive-routing-contract:swap -->")
          .replace(canonicalTemplateBlock("skill"), canonicalTemplateBlock("agents"))
          .replace("<!-- adaptive-routing-contract:swap -->", canonicalTemplateBlock("skill")),
      }).length > 0,
      true,
    ],
    [
      "拒绝 plan forged Task 2 decoy 与重复真实标题",
      adaptiveRoutingPolicyErrors({
        ...validAdaptiveRouting,
        plan: validAdaptiveRouting.plan.replace(
          "### Task 2:",
          "### Task 2: forged decoy\n\n### Task 2:",
        ),
      }).length > 0,
      true,
    ],
    ...[1, 2, 3, 4].map((step) => [
      `拒绝 plan 重复 Step ${step}`,
      adaptiveRoutingPolicyErrors({
        ...validAdaptiveRouting,
        plan: mutateTask2Plan((task2) => task2.replace(
          `- [ ] **Step ${step}:`,
          `- [ ] **Step ${step}: duplicate**\n\n- [ ] **Step ${step}:`,
        )),
      }).length > 0,
      true,
    ]),
    [
      "拒绝 plan 重复 Task 3",
      adaptiveRoutingPolicyErrors({
        ...validAdaptiveRouting,
        plan: `${validAdaptiveRouting.plan}\n### Task 3: duplicate\n`,
      }).length > 0,
      true,
    ],
    ...["```", "````", "~~~"].map((fence) => [
      `拒绝 ${fence.length} 字符 ${fence[0]} fence 内伪造完整 Task 2 结构`,
      adaptiveRoutingPolicyErrors({
        ...validAdaptiveRouting,
        plan: fencedForgedPlan(fence),
      }).length > 0,
      true,
    ]),
    [
      "拒绝 plan Task 2 与 Task 3 标题错序",
      adaptiveRoutingPolicyErrors({
        ...validAdaptiveRouting,
        plan: validAdaptiveRouting.plan
          .replace("### Task 2:", "### Task swap:")
          .replace("### Task 3:", "### Task 2:")
          .replace("### Task swap:", "### Task 3:"),
      }).length > 0,
      true,
    ],
    ...["- [ ] **Step 1:", "- [ ] **Step 2:", "- [ ] **Step 3:", "- [ ] **Step 4:"].map((marker) => [
      `拒绝 plan 缺失结构锚点 ${marker}`,
      adaptiveRoutingPolicyErrors({
        ...validAdaptiveRouting,
        plan: mutateTask2Plan((task2) => task2.replace(marker, "[removed structure anchor]")),
      }).length > 0,
      true,
    ]),
    ...["### Task 2:", "### Task 3:"].map((marker) => [
      `拒绝 plan 缺失结构锚点 ${marker}`,
      adaptiveRoutingPolicyErrors({
        ...validAdaptiveRouting,
        plan: validAdaptiveRouting.plan.replace(marker, "[removed structure anchor]"),
      }).length > 0,
      true,
    ]),
    ...["### Task 2:", "### Task 3:", "- [ ] **Step 1:", "- [ ] **Step 2:", "- [ ] **Step 3:", "- [ ] **Step 4:"].map((marker) => [
      `拒绝 HTML comment 内伪造结构锚点 ${marker}`,
      adaptiveRoutingPolicyErrors({
        ...validAdaptiveRouting,
        plan: commentWrappedAnchorPlan(marker),
      }).length > 0,
      true,
    ]),
    [
      "拒绝 HTML comment 内伪造全部 Task 2 结构锚点",
      adaptiveRoutingPolicyErrors({
        ...validAdaptiveRouting,
        plan: ["### Task 2:", "- [ ] **Step 1:", "- [ ] **Step 2:", "- [ ] **Step 3:", "- [ ] **Step 4:", "### Task 3:"]
          .reduce((plan, marker) => {
            const forged = marker.startsWith("- [ ]") ? `${marker} forged**` : `${marker} forged`;
            return plan.replace(marker, `<!--\n${forged}\n-->`);
          }, validAdaptiveRouting.plan),
      }).length > 0,
      true,
    ],
    [
      "拒绝单行 HTML comment，即使结构诊断忽略其伪锚点",
      adaptiveRoutingPolicyErrors({
        ...validAdaptiveRouting,
        plan: `<!-- ### Task 2: ignored -->\n${validAdaptiveRouting.plan}`,
      }).length > 0,
      true,
    ],
    [
      "拒绝同一行 HTML comment 后的 plan 漂移，即使结构诊断识别合法 heading",
      adaptiveRoutingPolicyErrors({
        ...validAdaptiveRouting,
        plan: validAdaptiveRouting.plan.replace("### Task 2:", "<!-- ignored -->### Task 2:"),
      }).length > 0,
      true,
    ],
    [
      "拒绝未闭合 HTML comment 吞没真实 plan 结构",
      adaptiveRoutingPolicyErrors({
        ...validAdaptiveRouting,
        plan: validAdaptiveRouting.plan.replace("### Task 2:", "<!--\n### Task 2:"),
      }).length > 0,
      true,
    ],
    ...[
      ["Task 2 token 中段", "### Task 2:", "### Ta<!-- -->sk 2:"],
      ["Task 2 token 边界", "### Task 2:", "### Task<!-- --> 2:"],
      ...[1, 2, 3, 4].map((step) => [
        `Step ${step} token 中段`,
        `- [ ] **Step ${step}:`,
        `- [ ] **St<!-- -->ep ${step}:`,
      ]),
    ].map(([label, marker, replacement]) => [
      `拒绝 plan HTML comment token-splicing ${label}`,
      adaptiveRoutingPolicyErrors({
        ...validAdaptiveRouting,
        plan: marker.startsWith("- [ ]")
          ? mutateTask2Plan((task2) => task2.replace(marker, replacement))
          : validAdaptiveRouting.plan.replace(marker, replacement),
      }).length > 0,
      true,
    ]),
    [
      "接受 plan CRLF 与 canonical LF 等价",
      adaptiveRoutingPolicyErrors({
        ...validAdaptiveRouting,
        plan: normalizeAdaptiveRoutingBody(validAdaptiveRouting.plan).replace(/\n/gu, "\r\n"),
      }),
      [],
    ],
    [
      "接受 plan bare CR 与 canonical LF 等价",
      adaptiveRoutingPolicyErrors({
        ...validAdaptiveRouting,
        plan: normalizeAdaptiveRoutingBody(validAdaptiveRouting.plan).replace(/\n/gu, "\r"),
      }),
      [],
    ],
    ...[
      ["尾随空格", validAdaptiveRouting.plan.replace("# Adaptive Skill Routing", "# Adaptive Skill Routing ")],
      ["UTF-8 BOM", `\uFEFF${validAdaptiveRouting.plan}`],
      ["任意注释", `<!-- arbitrary mutation -->\n${validAdaptiveRouting.plan}`],
    ].map(([label, plan]) => [
      `拒绝 plan whole-file canonical ${label}`,
      adaptiveRoutingPolicyErrors({ ...validAdaptiveRouting, plan }).length > 0,
      true,
    ]),
    [
      "拒绝 canonical entry 尾随双空格",
      adaptiveRoutingPolicyErrors({
        ...validAdaptiveRouting,
        agents: validAdaptiveRouting.agents.replace(
          "则标记 `Blocked`。\n",
          "则标记 `Blocked`。  \n",
        ),
      }).length > 0,
      true,
    ],
    ...["agents", "guide", "skill"].map((entry) => [
      `拒绝 ${entry} canonical block 任意保留 marker 追加`,
      adaptiveRoutingPolicyErrors(
        mutateAdaptiveEntry(
          entry,
          "<!-- adaptive-routing-contract:end -->",
          "已有明确授权的高风险事项缺少授权不成立，缺少授权不成立时进入 `Blocked`。任意未知反向规则。\n<!-- adaptive-routing-contract:end -->",
        ),
      ).length > 0,
      true,
    ]),
    ...["agents", "guide", "skill"].flatMap((entry) => [
      [
        `拒绝 ${entry} canonical start sentinel 缺失`,
        adaptiveRoutingPolicyErrors(mutateAdaptiveEntry(entry, "<!-- adaptive-routing-contract:start -->", "")).length > 0,
        true,
      ],
      [
        `拒绝 ${entry} canonical sentinel 重复`,
        adaptiveRoutingPolicyErrors(
          mutateAdaptiveEntry(entry, "<!-- adaptive-routing-contract:start -->", "<!-- adaptive-routing-contract:start -->\n<!-- adaptive-routing-contract:start -->"),
        ).length > 0,
        true,
      ],
      [
        `拒绝 ${entry} canonical sentinel 倒序`,
        adaptiveRoutingPolicyErrors({
          ...validAdaptiveRouting,
          [entry]: validAdaptiveRouting[entry]
            .replace("<!-- adaptive-routing-contract:start -->", "<!-- adaptive-routing-contract:swap -->")
            .replace("<!-- adaptive-routing-contract:end -->", "<!-- adaptive-routing-contract:start -->")
            .replace("<!-- adaptive-routing-contract:swap -->", "<!-- adaptive-routing-contract:end -->"),
        }).length > 0,
        true,
      ],
      [
        `拒绝 ${entry} canonical body 编辑`,
        adaptiveRoutingPolicyErrors(
          mutateAdaptiveEntry(
            entry,
            entry === "skill" ? "Quality gates" : "质量门禁",
            entry === "skill" ? "Quality thresholds" : "质量门槛",
          ),
        ).length > 0,
        true,
      ],
    ]),
    [
      "拒绝直接执行语义反转，即使 marker 仍在",
      adaptiveRoutingPolicyErrors(
        mutateAdaptiveEntry(
          "skill",
          "| 直接执行 | 明确、局部、可逆、低风险、不改变业务行为且容易验证 |",
          "| 直接执行 | 任何任务，包括高风险、生产写入和不可逆操作；不改变业务行为只是无关 marker |",
        ),
      ).length > 0,
      true,
    ],
    [
      "拒绝把已授权高风险事项送入 Blocked",
      adaptiveRoutingPolicyErrors(
        mutateAdaptiveEntry(
          "skill",
          "已有明确授权的高风险事项使用 Superpowers；缺少授权或未解决歧义时进入 `Blocked`。",
          "已有明确授权的高风险事项进入 `Blocked`；Superpowers 仅作无关 marker。缺少授权或未解决歧义时也进入 `Blocked`。",
        ),
      ).length > 0,
      true,
    ],
    [
      "拒绝连续验证失败不升级",
      adaptiveRoutingPolicyErrors(
        mutateAdaptiveEntry(
          "skill",
          "连续验证失败时说明证据并升级到 Superpowers。",
          "连续验证失败时保持当前路线；说明证据、升级到 Superpowers 仅作无关 Escalation marker。",
        ),
      ).length > 0,
      true,
    ],
    [
      "拒绝缺失 Matt Skills 时自动安装",
      adaptiveRoutingPolicyErrors(
        mutateAdaptiveEntry(
          "skill",
          "Matt Skills 缺失时不自动安装，改用等价 Codex 原生步骤，仍不足时升级到 Superpowers。",
          "Matt Skills 缺失时自动安装；Codex 原生步骤和 Superpowers 仅作无关 marker。",
        ),
      ).length > 0,
      true,
    ],
    [
      "拒绝 skill 保留合法 fallback marker 后追加自动安装反向规则",
      adaptiveRoutingPolicyErrors(
        mutateAdaptiveEntry(
          "skill",
          "Matt Skills 缺失时不自动安装，改用等价 Codex 原生步骤，仍不足时升级到 Superpowers。",
          "Matt Skills 缺失时不自动安装，改用等价 Codex 原生步骤，仍不足时升级到 Superpowers。Matt Skills 缺失时自动安装。",
        ),
      ).length > 0,
      true,
    ],
    [
      "拒绝取消品牌无关质量门禁",
      adaptiveRoutingPolicyErrors(
        mutateAdaptiveEntry(
          "skill",
          "Quality gates: root-cause, test, and fresh-verification outcomes",
          "Quality gates: selected route may omit root-cause, test, and fresh-verification outcomes",
        ),
      ).length > 0,
      true,
    ],
    [
      "拒绝 guide 把已授权高风险事项送入 Blocked，即使 marker 仍在",
      adaptiveRoutingPolicyErrors(
        mutateAdaptiveEntry(
          "guide",
          "已有明确授权的高风险事项进入 Superpowers；缺少授权或未解决歧义时进入 `Blocked`。",
          "已有明确授权的高风险事项进入 `Blocked`；Superpowers 仅作无关 marker。缺少授权或未解决歧义时也进入 `Blocked`。",
        ),
      ).length > 0,
      true,
    ],
    [
      "拒绝 guide 直接执行语义反转，即使 marker 仍在",
      adaptiveRoutingPolicyErrors(
        mutateAdaptiveEntry(
          "guide",
          "| 直接执行 | 明确、局部、可逆、低风险、不改变业务行为且容易验证 |",
          "| 直接执行 | 任何任务，包括高风险、生产写入和不可逆操作；不改变业务行为只是 marker |",
        ),
      ).length > 0,
      true,
    ],
    [
      "拒绝 guide 连续验证失败不升级，即使 marker 仍在",
      adaptiveRoutingPolicyErrors(
        mutateAdaptiveEntry(
          "guide",
          "连续验证失败时必须说明证据并升级到 Superpowers。",
          "连续验证失败时保持当前路线；说明证据并升级到 Superpowers 只是 marker。",
        ),
      ).length > 0,
      true,
    ],
    [
      "拒绝 guide 缺失 Matt 时自动安装，即使 marker 仍在",
      adaptiveRoutingPolicyErrors(
        mutateAdaptiveEntry(
          "guide",
          "Matt Skills 缺失时不自动安装，使用等价 Codex 原生步骤，仍不足时升级。",
          "Matt Skills 缺失时自动安装；不自动安装、Codex 原生步骤和升级只是 marker。",
        ),
      ).length > 0,
      true,
    ],
    [
      "拒绝 guide 取消质量门禁，即使 marker 仍在",
      adaptiveRoutingPolicyErrors(
        mutateAdaptiveEntry(
          "guide",
          "质量门禁包括根因、测试和新鲜验证。",
          "所选路线可以省略质量门禁；根因、测试和新鲜验证只是 marker。",
        ),
      ).length > 0,
      true,
    ],
    [
      "拒绝 root 把已授权高风险事项送入 Blocked，即使 marker 仍在",
      adaptiveRoutingPolicyErrors(
        mutateAdaptiveEntry(
          "agents",
          "已有明确授权的高风险事项使用 Superpowers；缺少授权时进入 `Blocked`。",
          "已有明确授权的高风险事项进入 `Blocked`；Superpowers 仅作无关 marker。缺少授权时也进入 `Blocked`。",
        ),
      ).length > 0,
      true,
    ],
    [
      "拒绝 root 保留正确授权规则后追加已授权进入 Blocked",
      adaptiveRoutingPolicyErrors(
        mutateAdaptiveEntry(
          "agents",
          "已有明确授权的高风险事项使用 Superpowers；缺少授权时进入 `Blocked`。",
          "已有明确授权的高风险事项使用 Superpowers；缺少授权时进入 `Blocked`。已有明确授权的高风险事项进入 `Blocked`。",
        ),
      ).length > 0,
      true,
    ],
    [
      "拒绝 guide 保留正确授权规则后追加已授权进入 Blocked",
      adaptiveRoutingPolicyErrors(
        mutateAdaptiveEntry(
          "guide",
          "已有明确授权的高风险事项进入 Superpowers；缺少授权或未解决歧义时进入 `Blocked`。",
          "已有明确授权的高风险事项进入 Superpowers；缺少授权或未解决歧义时进入 `Blocked`。已有明确授权的高风险事项使用 `Blocked`。",
        ),
      ).length > 0,
      true,
    ],
    [
      "拒绝 skill 保留正确授权规则后追加已授权进入 Blocked",
      adaptiveRoutingPolicyErrors(
        mutateAdaptiveEntry(
          "skill",
          "已有明确授权的高风险事项使用 Superpowers；缺少授权或未解决歧义时进入 `Blocked`。",
          "已有明确授权的高风险事项使用 Superpowers；缺少授权或未解决歧义时进入 `Blocked`。已有明确授权的高风险事项选择 `Blocked`。",
        ),
      ).length > 0,
      true,
    ],
    [
      "拒绝 root 在 canonical block 追加旁路规则",
      adaptiveRoutingPolicyErrors(
        mutateAdaptiveEntry(
          "agents",
          "已有明确授权的高风险事项使用 Superpowers；缺少授权时进入 `Blocked`。",
          "已有明确授权的高风险事项使用 Superpowers；缺少授权时进入 `Blocked`。已有明确授权的高风险事项不得进入 `Blocked`。",
        ),
      ).length > 0,
      true,
    ],
    [
      "拒绝 guide 在 canonical block 追加旁路规则",
      adaptiveRoutingPolicyErrors(
        mutateAdaptiveEntry(
          "guide",
          "已有明确授权的高风险事项进入 Superpowers；缺少授权或未解决歧义时进入 `Blocked`。",
          "已有明确授权的高风险事项进入 Superpowers；缺少授权或未解决歧义时进入 `Blocked`。已有明确授权的高风险事项不得进入 `Blocked`。",
        ),
      ).length > 0,
      true,
    ],
    [
      "拒绝 skill 在 canonical block 追加旁路规则",
      adaptiveRoutingPolicyErrors(
        mutateAdaptiveEntry(
          "skill",
          "已有明确授权的高风险事项使用 Superpowers；缺少授权或未解决歧义时进入 `Blocked`。",
          "已有明确授权的高风险事项使用 Superpowers；缺少授权或未解决歧义时进入 `Blocked`。已有明确授权的高风险事项不得进入 `Blocked`。",
        ),
      ).length > 0,
      true,
    ],
    [
      "拒绝 root 无关否定后通过逗号进入 Blocked",
      adaptiveRoutingPolicyErrors(
        mutateAdaptiveEntry(
          "agents",
          "已有明确授权的高风险事项使用 Superpowers；缺少授权时进入 `Blocked`。",
          "已有明确授权的高风险事项使用 Superpowers；缺少授权时进入 `Blocked`。已有明确授权的高风险事项不得延迟，进入 `Blocked`。",
        ),
      ).length > 0,
      true,
    ],
    [
      "拒绝 guide 无关否定后通过逗号进入 Blocked",
      adaptiveRoutingPolicyErrors(
        mutateAdaptiveEntry(
          "guide",
          "已有明确授权的高风险事项进入 Superpowers；缺少授权或未解决歧义时进入 `Blocked`。",
          "已有明确授权的高风险事项进入 Superpowers；缺少授权或未解决歧义时进入 `Blocked`。已有明确授权的高风险事项不得延迟，进入 `Blocked`。",
        ),
      ).length > 0,
      true,
    ],
    [
      "拒绝 skill 无关否定后通过逗号进入 Blocked",
      adaptiveRoutingPolicyErrors(
        mutateAdaptiveEntry(
          "skill",
          "已有明确授权的高风险事项使用 Superpowers；缺少授权或未解决歧义时进入 `Blocked`。",
          "已有明确授权的高风险事项使用 Superpowers；缺少授权或未解决歧义时进入 `Blocked`。已有明确授权的高风险事项不得延迟，进入 `Blocked`。",
        ),
      ).length > 0,
      true,
    ],
    [
      "拒绝 root 直接执行语义反转，即使 marker 仍在",
      adaptiveRoutingPolicyErrors(
        mutateAdaptiveEntry(
          "agents",
          "直接执行仅用于不改变业务行为的低风险工作",
          "直接执行可用于高风险、生产写入和不可逆操作；不改变业务行为只是 marker",
        ),
      ).length > 0,
      true,
    ],
    [
      "拒绝 root 连续验证失败不升级，即使 marker 仍在",
      adaptiveRoutingPolicyErrors(
        mutateAdaptiveEntry(
          "agents",
          "连续验证失败时说明证据并升级到 Superpowers",
          "连续验证失败时保持当前路线；说明证据并升级到 Superpowers 只是 marker",
        ),
      ).length > 0,
      true,
    ],
    [
      "拒绝 root 缺失 Matt 时自动安装，即使 marker 仍在",
      adaptiveRoutingPolicyErrors(
        mutateAdaptiveEntry(
          "agents",
          "Matt Skills 缺失时不自动安装；使用等价 Codex 原生步骤，仍不足时升级到 Superpowers。",
          "Matt Skills 缺失时自动安装；不自动安装、Codex 原生步骤和升级到 Superpowers 只是 marker。",
        ),
      ).length > 0,
      true,
    ],
    [
      "拒绝 root 取消质量门禁，即使 marker 仍在",
      adaptiveRoutingPolicyErrors(
        mutateAdaptiveEntry(
          "agents",
          "质量门禁包括根因、测试和新鲜验证，不因路线降低。",
          "所选路线可以省略质量门禁；根因、测试和新鲜验证只是 marker。",
        ),
      ).length > 0,
      true,
    ],
    ...adaptiveMarkerDeletionCases.filter(([, entry]) => entry === "prompt").map(([label, entry, marker]) => {
      const mutated = mutateAdaptiveEntry(entry, marker, "");
      return [`拒绝单独删除 ${label}`, adaptiveRoutingPolicyErrors(mutated).length > 0, true];
    }),
    [
      "提取 Markdown 章节正文",
      sectionBody("## Status\n\nReady\n\n## Next\n内容\n", "Status"),
      "Ready",
    ],
    ["接受合法产品任务", productTaskErrors("task.md", validProductTask), []],
    [
      "接受精确验收指纹 marker 包围的状态与复选框",
      productTaskErrors(
        "marked-task.md",
        validProductTask
          .replace("Ready", "<!-- ACCEPTANCE-FP-BEGIN:STATUS -->Ready<!-- ACCEPTANCE-FP-END:STATUS -->")
          .replace("- [ ]", "<!-- ACCEPTANCE-FP-BEGIN:AC-01 -->- [ ]<!-- ACCEPTANCE-FP-END:AC-01 -->"),
      ),
      [],
    ],
    [
      "拒绝把未知 HTML marker 当成验收指纹 marker 剥离",
      productTaskErrors(
        "unknown-marker-task.md",
        validProductTask.replace("Ready", "<!-- ACCEPTANCE-FP-BEGIN:UNKNOWN -->Ready<!-- ACCEPTANCE-FP-END:UNKNOWN -->"),
      ),
      [
        `产品任务 unknown-marker-task.md 的 Status 必须是 ${PRODUCT_TASK_STATUSES.join(", ")}，当前为: <!-- ACCEPTANCE-FP-BEGIN:UNKNOWN -->Ready<!-- ACCEPTANCE-FP-END:UNKNOWN -->`,
      ],
    ],
    [
      "拒绝非法产品任务状态和空验收清单",
      productTaskErrors(
        "bad.md",
        validProductTask.replace("Ready", "Unknown").replace("- [ ] 可以验证", "没有复选框"),
      ),
      [
        `产品任务 bad.md 的 Status 必须是 ${PRODUCT_TASK_STATUSES.join(", ")}，当前为: Unknown`,
        "产品任务 bad.md 的 Acceptance Criteria 至少需要一个 Markdown checkbox",
      ],
    ],
    [
      "拒绝缺少模块与允许路径",
      productTaskErrors(
        "bad-modules.md",
        validProductTask.replace("- 模块：认证\n- 允许路径：frontend/auth, backend/auth", "模块待定"),
      ),
      [
        "产品任务 bad-modules.md 的 Affected Modules 必须登记模块",
        "产品任务 bad-modules.md 的 Affected Modules 必须登记允许路径",
      ],
    ],
  ];
  const failures = tests.filter(([, actual, expected]) => JSON.stringify(actual) !== JSON.stringify(expected));
  if (failures.length) {
    for (const [name] of failures) console.error(`自测失败: ${name}`);
    return 1;
  }
  console.log(`agentic-check self-test: 通过 (${tests.length} 项)`);
  return 0;
}

function main() {
  if (process.argv.includes("--self-test")) return runSelfTest();
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const errors = validateHarness(root);
  if (errors.length) {
    console.error("agentic-check: 失败");
    for (const error of errors) console.error(`  - ${error}`);
    return 1;
  }
  console.log(`agentic-check: 通过 (${REQUIRED_FILES.length} 个基线文件)`);
  return 0;
}

process.exitCode = main();

