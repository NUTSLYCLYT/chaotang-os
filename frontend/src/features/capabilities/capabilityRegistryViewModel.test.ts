import assert from "node:assert/strict";
import test from "node:test";

import type { CapabilityRegistryProjection } from "../../lib/backendClient.ts";
import { buildCapabilityRegistryViewModel, capabilityBadge } from "./capabilityRegistryViewModel.ts";

const sample: CapabilityRegistryProjection = {
  schemaVersion: "capability-registry.v1",
  owner: "CapabilityRegistry V1 readonly projection",
  canonicalWriter: "existing source-of-truth modules only",
  readonlySources: ["source-a"],
  summary: {
    total: 2,
    byType: { skill: 1, mcp: 1 },
    byHome: { hanlin: 1, honglusi: 1 },
    byStatus: { approved: 1, trial: 1 },
    externalReviewRequired: 1,
    smallSampleWithoutAuthorityScore: 2,
  },
  agentPersonas: [],
  items: [
    {
      card: {
        id: "skill.a",
        name: "A",
        type: "skill",
        source: "internal",
        bestUseCase: "复用方法",
        inputNeeded: ["输入"],
        outputProduced: ["输出"],
        riskLevel: "low",
        costLevel: "low",
        reusePotential: "high",
        recommendedHome: "hanlin",
        status: "approved",
        evidenceSources: ["source-a"],
        active: true,
        sampleCount: 0,
        authorityScore: null,
        zeroPermissionWhenInactive: true,
      },
      persona: null,
      externalReview: null,
      promotionCase: {
        capabilityId: "skill.a",
        currentHome: "hanlin",
        recommendedAction: "入翰林院公共活字试用",
        rationale: "可复用",
        requiredEvidence: ["复用回执"],
        reviewerDepartment: "吏部",
      },
    },
    {
      card: {
        id: "mcp.x",
        name: "X",
        type: "mcp",
        source: "honglusi",
        bestUseCase: "外部只读数据",
        inputNeeded: ["批准连接"],
        outputProduced: ["证据候选"],
        riskLevel: "high",
        costLevel: "medium",
        reusePotential: "medium",
        recommendedHome: "honglusi",
        status: "trial",
        evidenceSources: ["source-b"],
        active: true,
        sampleCount: 0,
        authorityScore: null,
        zeroPermissionWhenInactive: true,
      },
      persona: null,
      externalReview: {
        provider: "mcp",
        permissionNeeded: ["刑部复核"],
        dataExposure: ["EXTERNAL_PUBLIC"],
        allowedActions: ["READ_ONLY"],
        forbiddenActions: ["external write"],
        requiresXingbuReview: true,
        defaultGrantDuration: "single request",
        auditRequired: true,
      },
      promotionCase: {
        capabilityId: "mcp.x",
        currentHome: "honglusi",
        recommendedAction: "入鸿胪寺外部能力候选",
        rationale: "外部能力",
        requiredEvidence: ["安全审查"],
        reviewerDepartment: "吏部",
      },
    },
  ],
};

test("view model keeps the first screen simple and actionable", () => {
  const view = buildCapabilityRegistryViewModel(sample);

  assert.equal(view.headline, "朝堂能力总账");
  assert.equal(view.tiles.length, 4);
  assert.equal(view.externalCandidates.length, 1);
  assert.equal(view.recommendedForPaidScenarios.length, 1);
  assert.match(view.departmentGroups[0].title + view.departmentGroups[1].title, /翰林院|鸿胪寺/);
});

test("badges expose safety and small-sample limits", () => {
  assert.equal(capabilityBadge(sample.items[0]), "小样本 · 暂不打权威分");
  assert.equal(capabilityBadge(sample.items[1]), "鸿胪寺候选 · 刑部复核");
});
