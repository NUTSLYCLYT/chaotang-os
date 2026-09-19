#!/usr/bin/env node

/**
 * 离线影子报告（capability shadow）。
 *
 * 消费 capability_eval 的评测结果，产出**聚合、低敏感度**的遥测。
 *
 * 重要变更（2026-09-19，配合 capability_eval 去取模化）：
 * 上游 metrics 现在可能是 `null`（未测量），本模块必须显式处理该状态，
 * 不得把 null 当作 0、也不得据此宣称"challenger 更高"。
 * 未测量时 comparison 为 "unmeasured"，并且 qualityScore 等字段保持 null。
 */

import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { evaluateCandidateSuite, loadCandidateSuite, stableDigest } from "./capability_eval.mjs";

function compareScore(challenger, champion) {
  const challengerScore = challenger?.metrics?.qualityScore;
  const championScore = champion?.metrics?.qualityScore;
  if (typeof challengerScore !== "number" || typeof championScore !== "number") {
    return "unmeasured";
  }
  return challengerScore > championScore
    ? "challenger-score-higher"
    : "challenger-score-not-higher";
}

export function buildOfflineShadowReport() {
  const evaluation = evaluateCandidateSuite(loadCandidateSuite());
  return {
    schemaVersion: "1.0.0",
    mode: "synthetic-offline-shadow",
    realTrafficObserved: false,
    abilityGainMeasured: false,
    promotionAuthorized: false,
    evaluationDigest: stableDigest(evaluation),
    prohibitedEffects: ["network", "tools", "external-write"],
    telemetry: {
      aggregateOnly: true,
      containsPromptText: false,
      containsOwnerOrTenantId: false,
      containsEvidenceContent: false,
    },
    runs: evaluation.candidates.map((candidate) => {
      const champion = candidate.variants.find((item) => item.id === "direct-champion");
      const challenger = candidate.variants.find((item) => item.id === "ext-dev-challenger");
      return {
        candidateId: candidate.id,
        caseCount: candidate.caseSummary.total,
        observedCaseCount: candidate.caseSummary.observed,
        measurementStatus: candidate.measurementStatus,
        deterministicScaffoldComparison: compareScore(challenger, champion),
        // 未测量时保持 null，绝不落回 0 以免被误读为"零分能力"
        qualityScore: challenger?.metrics?.qualityScore ?? null,
        evidenceCoverage: challenger?.metrics?.evidenceCoverage ?? null,
        correctRefusalRate: challenger?.metrics?.correctRefusalRate ?? null,
        simulatedSafetyRuleCoverage: challenger?.metrics?.simulatedSafetyRuleCoverage ?? null,
        sideEffectsObserved: "not-observed-synthetic-only",
        challengerRunDigest: stableDigest(challenger?.runs ?? []),
      };
    }),
  };
}

export function main() {
  process.stdout.write(`${JSON.stringify(buildOfflineShadowReport(), null, 2)}\n`);
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) main();
