import assert from "node:assert/strict";
import test from "node:test";

import type { CapabilityRegistryProjection } from "../../lib/backendClient.ts";
import {
  buildCapabilityRegistryViewModel,
  capabilityBadge,
} from "./capabilityRegistryViewModel.ts";

const readiness = {
  visibilityStatus: "catalog_visible",
  installationStatus: "see_current_status",
  connectionStatus: "not_applicable_or_unknown",
  verificationStatus: "not_individually_verified",
  runtimeBindingStatus: "not_bound" as const,
};

const sample: CapabilityRegistryProjection = {
  schemaVersion: "capability-registry.v2",
  owner: "CapabilityRegistry V2 readonly projection",
  canonicalWriter: "existing source-of-truth modules only",
  readonlySources: ["source-a"],
  summary: {
    total: 2,
    byType: { skill: 1, provider: 1 },
    byHome: { hanlin: 1, honglusi: 1 },
    byStatus: { trial: 2 },
    externalReviewRequired: 1,
    smallSampleWithoutAuthorityScore: 2,
    catalogHanlinSkills: 73,
    catalogProviderGroups: 14,
    catalogMcpTools: 83,
    catalogSnapshotProviderGroups: 16,
    catalogSnapshotMcpTools: 92,
    catalogExcludedSupportTools: 9,
  },
  agentPersonas: [],
  items: [
    {
      card: {
        id: "skill.a",
        name: "A",
        type: "skill",
        source: "personal_catalog",
        bestUseCase: "复用方法",
        inputNeeded: ["输入"],
        outputProduced: ["输出"],
        riskLevel: "low",
        costLevel: "low",
        reusePotential: "high",
        recommendedHome: "hanlin",
        status: "trial",
        evidenceSources: ["source-a"],
        active: false,
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
      catalog: {
        origin: "personal_catalog",
        category: "工程",
        naturalLanguageTrigger: "帮我调试",
        explicitTrigger: "$systematic-debugging",
        invocationPolicy: "AUTO_MATCH",
        feeStatus: "skill_has_no_separate_fee_underlying_service_may_charge",
        permissionSummary: "沿用当前任务权限",
        externalData: "no_external_send_declared_or_task_dependent",
        readiness,
        blocker: "尚未绑定朝堂 Runtime",
        providerGroup: null,
        toolCount: 0,
        tools: [],
      },
    },
    {
      card: {
        id: "provider.figma",
        name: "Figma",
        type: "provider",
        source: "honglusi",
        bestUseCase: "设计能力",
        inputNeeded: ["批准连接"],
        outputProduced: ["设计候选"],
        riskLevel: "high",
        costLevel: "medium",
        reusePotential: "medium",
        recommendedHome: "honglusi",
        status: "trial",
        evidenceSources: ["source-b"],
        active: false,
        sampleCount: 0,
        authorityScore: null,
        zeroPermissionWhenInactive: true,
      },
      persona: null,
      externalReview: {
        provider: "Figma",
        permissionNeeded: ["账号"],
        dataExposure: ["设计数据"],
        allowedActions: ["METADATA_ONLY"],
        forbiddenActions: ["external write"],
        requiresXingbuReview: true,
        defaultGrantDuration: "no runtime grant",
        auditRequired: true,
      },
      promotionCase: {
        capabilityId: "provider.figma",
        currentHome: "honglusi",
        recommendedAction: "入鸿胪寺外部能力候选",
        rationale: "外部能力",
        requiredEvidence: ["安全审查"],
        reviewerDepartment: "吏部",
      },
      catalog: {
        origin: "personal_catalog",
        category: null,
        naturalLanguageTrigger: "在 Figma 中创建页面",
        explicitTrigger: null,
        invocationPolicy: "PREPARE_THEN_CONFIRM",
        feeStatus: "取决于方案",
        permissionSummary: "任务级确认",
        externalData: "may_send_selected_data",
        readiness,
        blocker: "尚未绑定朝堂 Runtime",
        providerGroup: "Figma",
        toolCount: 1,
        tools: [
          {
            id: "tool.figma",
            name: "mcp__figma__use_figma",
            providerGroup: "Figma",
            invocationPolicy: "PREPARE_THEN_CONFIRM",
            connectionStatus: "inherit_provider_status",
            verificationStatus: "not_individually_verified",
            runtimeBindingStatus: "not_bound",
          },
        ],
      },
    },
  ],
};

test("view model keeps personal catalog roles and counts separate", () => {
  const view = buildCapabilityRegistryViewModel(sample);

  assert.equal(view.headline, "朝堂能力总账");
  assert.equal(view.tiles.length, 4);
  assert.equal(view.hanlinCatalog.length, 1);
  assert.equal(view.externalProviderGroups.length, 1);
  assert.deepEqual(
    view.tiles.map((tile) => tile.value),
    ["73", "14/16", "83/92", "9"],
  );
});

test("badges explain invocation policy without implying runtime permission", () => {
  assert.equal(capabilityBadge(sample.items[0]), "自然语言自动匹配");
  assert.equal(capabilityBadge(sample.items[1]), "准备后再确认");
  assert.equal(sample.items[0].catalog?.readiness.runtimeBindingStatus, "not_bound");
  assert.equal(sample.items[1].card.active, false);
});
