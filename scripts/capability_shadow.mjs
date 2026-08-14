#!/usr/bin/env node

import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { evaluateCandidateSuite, loadCandidateSuite, stableDigest } from "./capability_eval.mjs";

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
        deterministicScaffoldComparison: challenger.metrics.qualityScore > champion.metrics.qualityScore
          ? "challenger-score-higher"
          : "challenger-score-not-higher",
        qualityScore: challenger.metrics.qualityScore,
        evidenceCoverage: challenger.metrics.evidenceCoverage,
        correctRefusalRate: challenger.metrics.correctRefusalRate,
        simulatedSafetyRuleCoverage: challenger.metrics.simulatedSafetyRuleCoverage,
        sideEffectsObserved: "not-observed-synthetic-only",
        challengerRunDigest: stableDigest(challenger.runs),
      };
    }),
  };
}

export function main() {
  process.stdout.write(`${JSON.stringify(buildOfflineShadowReport(), null, 2)}\n`);
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) main();
