#!/usr/bin/env node

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, extname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const DEFAULT_INVENTORY = "docs/migrations/2026-08-13-six-ministry-capability-inventory.json";
const DEFAULT_OUTPUT = "docs/migrations/2026-08-14-six-ministry-capability-family-matrix.json";
const DEFAULT_RUNTIME_OUTPUT = "backend/app/agents/runtime_skills/capability_family_bindings.json";

const OWNER_LABELS = {
  libu: "吏部",
  hubu: "户部",
  libu_rites: "礼部",
  bingbu: "兵部",
  xingbu: "刑部",
  gongbu: "工部",
  "shared-six-ministry": "六部共享",
};

const FAMILY_DEFINITIONS = [
  ["retired-legacy-control-plane", "退役旧控制面", null, /retired_standalone_swarms|\/_attic\/|appointment_agent/iu, "retire"],
  ["libu-talent-acquisition", "人才招聘与岗位匹配", "libu", /recruit|talent|candidate|job[_-]?description|招聘|人才/iu, "existing"],
  ["libu-appointment-authority", "任免与责任权限链", "libu", /appointment|appoint|任免|responsib|authority|permission|owner|reviewer/iu, "enhance"],
  ["libu-compensation-relations", "薪酬、绩效与劳动关系", "libu", /compensation|salary|payroll|performance|labor|薪酬|绩效|劳动/iu, "existing"],
  ["hubu-accounting-controls", "会计勾稽与财务控制", "hubu", /account|ledger|reconcil|audit|financial[_-]?control|会计|勾稽|审计/iu, "existing"],
  ["hubu-budget-treasury", "预算、现金与付款闸", "hubu", /budget|treasury|cash|payment|payable|receivable|预算|现金|付款|出纳/iu, "enhance"],
  ["hubu-investment-pricing", "投资、融资、税务与定价", "hubu", /invest|financing|pricing|tax|valuation|投资|融资|定价|税/iu, "existing"],
  ["libu-rites-brand-content", "品牌、内容与公共表达", "libu_rites", /brand|content|copy|public[_-]?relation|communication|品牌|内容|公关|审辞/iu, "enhance"],
  ["libu-rites-stakeholder-protocol", "利益相关方沟通与礼仪", "libu_rites", /stakeholder|ceremon|protocol|event|礼仪|典礼|沟通/iu, "enhance"],
  ["bingbu-sales-channel", "销售真实性与渠道作战", "bingbu", /sales|channel|customer|gtm|growth|销售|渠道|客户/iu, "enhance"],
  ["bingbu-strategy-intelligence", "竞争战略与市场情报", "bingbu", /strategy|compet|market|intelligence|战略|竞争|市场/iu, "enhance"],
  ["xingbu-contract-dispute", "合同审查与争议处置", "xingbu", /contract|dispute|litig|prosecut|defen|judge|合同|争议|诉讼/iu, "enhance"],
  ["xingbu-compliance-risk", "合规、风控与证据审查", "xingbu", /compliance|legal|risk|evidence|audit|合规|法务|风险|证据|审计/iu, "enhance"],
  ["gongbu-engineering-delivery-control", "工程交付与质量控制", "gongbu", /engineering|backend|frontend|e2e|quality|release|delivery|loop|技术|工程|质量|交付|发布/iu, "enhance"],
  ["gongbu-product-supply-operations", "产品、供应链与运营优化", "gongbu", /product|supply|process|ops|operation|产品|供应|流程|运营/iu, "enhance"],
  ["shared-orchestration-registry", "共享编排、路由与注册", "shared-six-ministry", /orchestrat|router|registry|dispatch|flow|runtime|编排|路由|注册/iu, "enhance"],
  ["shared-evaluation-evidence", "共享评测、证据与质量门", "shared-six-ministry", /harness|eval|test|golden|fixture|evidence|gate|评测|证据|门禁/iu, "new"],
];

const FALLBACK_FAMILIES = {
  libu: ["libu-workforce-governance", "组织人力治理", "enhance"],
  hubu: ["hubu-financial-governance", "综合财务治理", "enhance"],
  libu_rites: ["libu-rites-communication-governance", "综合传播治理", "enhance"],
  bingbu: ["bingbu-commercial-governance", "综合商业治理", "enhance"],
  xingbu: ["xingbu-legal-governance", "综合法律治理", "enhance"],
  gongbu: ["gongbu-engineering-governance", "综合工程治理", "enhance"],
  "shared-six-ministry": ["shared-runtime-governance", "六部共享运行治理", "enhance"],
};

const CANONICAL_RUNTIME_SKILLS = {
  "bingbu-commercial-governance": ["synthesize-commercial-governance"],
  "bingbu-sales-channel": ["analyze-sales-opportunity", "analyze-lead-acquisition", "analyze-channel-performance", "analyze-customer-health", "analyze-growth-funnel"],
  "bingbu-strategy-intelligence": ["analyze-competitive-position", "analyze-growth-funnel"],
  "gongbu-engineering-delivery-control": ["analyze-technical-feasibility", "analyze-delivery-schedule", "analyze-quality-readiness", "analyze-field-conditions", "analyze-commitment-fulfillment"],
  "gongbu-engineering-governance": ["synthesize-delivery-governance"],
  "gongbu-product-supply-operations": ["analyze-product-strategy", "analyze-supply-readiness"],
  "hubu-accounting-controls": ["analyze-accounting-position", "analyze-financial-controls"],
  "hubu-budget-treasury": ["analyze-budget-performance", "analyze-cash-safety", "analyze-accounting-position"],
  "hubu-financial-governance": ["synthesize-finance-governance"],
  "hubu-investment-pricing": ["analyze-investment-case", "analyze-financing-options", "analyze-pricing-economics"],
  "libu-appointment-authority": ["analyze-appointment-fit", "analyze-workforce-coordination"],
  "libu-compensation-relations": ["analyze-compensation-equity", "analyze-labor-relations", "analyze-hr-policy"],
  "libu-rites-brand-content": ["analyze-brand-consistency", "analyze-content-quality", "analyze-public-relations", "analyze-customer-communications", "analyze-government-enterprise-relations", "analyze-user-experience"],
  "libu-rites-communication-governance": ["synthesize-communications-governance"],
  "libu-talent-acquisition": ["analyze-recruitment-pipeline", "analyze-appointment-fit"],
  "libu-workforce-governance": ["synthesize-workforce-governance"],
  "shared-evaluation-evidence": ["analyze-evidence-integrity", "analyze-quality-readiness"],
  "shared-orchestration-registry": ["conduct-joint-ministry-review"],
  "shared-runtime-governance": ["conduct-joint-ministry-review"],
  "xingbu-compliance-risk": ["analyze-compliance-posture", "analyze-enterprise-risk", "analyze-evidence-integrity"],
  "xingbu-contract-dispute": ["analyze-contract-risk", "analyze-dispute-resolution", "analyze-intellectual-property"],
  "xingbu-legal-governance": ["synthesize-risk-governance", "analyze-legal-policy"],
};

function unique(values) {
  return [...new Set(values.filter(Boolean))].sort();
}

function assetSearchText(asset) {
  return [asset.path, asset.name, asset.description, ...(asset.triggers ?? []), ...(asset.steps ?? [])].join(" ");
}

function chooseFamily(asset) {
  if (/^\.claude\/agents\/gongbu-[^/]+\.md$/u.test(asset.path)) {
    return { slug: "gongbu-engineering-delivery-control", name: "工程交付与质量控制", status: "enhance" };
  }
  const text = assetSearchText(asset);
  for (const [slug, name, owner, matcher, status] of FAMILY_DEFINITIONS) {
    if ((owner === null || owner === asset.owner) && matcher.test(text)) return { slug, name, status };
  }
  const [slug, name, status] = FALLBACK_FAMILIES[asset.owner];
  return { slug, name, status };
}

function familyContract(definition, assets) {
  const owners = unique(assets.map((asset) => asset.owner));
  const sourceDigests = unique(assets.map((asset) => asset.blobDigest));
  const devSkillMappings = unique(assets.flatMap((asset) => asset.devMapping ?? []));
  const hasPotentialSideEffects = assets.some((asset) =>
    (asset.sideEffects ?? []).some((effect) => !effect.startsWith("No material side effect")),
  );
  return {
    id: `capability-family:${definition.slug}`,
    name: definition.name,
    owners,
    ownerLabels: owners.map((owner) => OWNER_LABELS[owner]),
    sourceAssetIds: assets.map((asset) => asset.id).sort(),
    sourceBlobDigests: sourceDigests,
    sourceAssetCount: assets.length,
    uniqueBlobCount: sourceDigests.length,
    consolidatedDuplicateSourceAssets: assets.length - sourceDigests.length,
    devSkillMappings: devSkillMappings.length ? devSkillMappings : ["No direct DEV skill; create typed RuntimeSkill candidate"],
    runtimeSkillIds: definition.status === "retire"
      ? []
      : [...(CANONICAL_RUNTIME_SKILLS[definition.slug] ?? [])],
    triggers: unique(assets.flatMap((asset) => asset.triggers ?? [])).slice(0, 24).length
      ? unique(assets.flatMap((asset) => asset.triggers ?? [])).slice(0, 24)
      : [`Task routes to ${definition.name}`],
    inputs: unique(assets.flatMap((asset) => asset.inputs ?? [])).slice(0, 16),
    outputs: unique(assets.flatMap((asset) => asset.outputs ?? [])).slice(0, 16),
    dependencies: unique(assets.flatMap((asset) => asset.dependencies ?? [])).slice(0, 16),
    risks: unique([
      ...assets.map((asset) => asset.risk === "high" ? "Legacy prompt/control-plane authority cannot be copied directly" : null),
      "Source behavior is static inventory evidence and requires typed DEV contract validation",
    ]),
    sideEffects: hasPotentialSideEffects
      ? ["Potential persistent or external effects exist in source assets; capability must remain preview-only until separately authorized"]
      : ["No verified production side effect; preserve no-side-effect evaluation until runtime promotion"],
    implementationStatus: definition.status,
    acceptanceRequirements: [
      "All source asset IDs remain traceable to the pinned commit and digest",
      "Typed trigger, input, output, evidence, tenant, authority, and failure contracts pass schema validation",
      "Offline golden and adversarial cases prove correct refusal under missing evidence or authority",
      "No production promotion without explicit RuntimeSkill registration, shadow evidence, rollback digest, and human approval",
    ],
  };
}

export function buildCapabilityFamilyMatrix(inventory) {
  const included = inventory.assets.filter((asset) => asset.included);
  const includedIds = included.map((asset) => asset.id);
  if (new Set(includedIds).size !== includedIds.length) {
    throw new Error("duplicate included source asset ID");
  }
  const unknownOwners = unique(included.map((asset) => asset.owner).filter((owner) => !Object.hasOwn(FALLBACK_FAMILIES, owner)));
  if (unknownOwners.length) throw new Error(`unknown included source owner: ${unknownOwners.join(", ")}`);
  const grouped = new Map();
  for (const asset of included) {
    const definition = chooseFamily(asset);
    const group = grouped.get(definition.slug) ?? { definition, assets: [] };
    group.assets.push(asset);
    grouped.set(definition.slug, group);
  }
  const families = [...grouped.values()]
    .map(({ definition, assets }) => familyContract(definition, assets))
    .sort((left, right) => left.id.localeCompare(right.id));
  const activeFamilyIds = families
    .filter((family) => family.implementationStatus !== "retire")
    .map((family) => family.id.replace("capability-family:", ""));
  if (
    activeFamilyIds.length !== Object.keys(CANONICAL_RUNTIME_SKILLS).length
    || activeFamilyIds.some((id) => !Object.hasOwn(CANONICAL_RUNTIME_SKILLS, id))
  ) {
    throw new Error("canonical RuntimeSkill family mapping is incomplete");
  }
  const assigned = families.flatMap((family) => family.sourceAssetIds);
  const assignmentCounts = new Map();
  for (const id of assigned) assignmentCounts.set(id, (assignmentCounts.get(id) ?? 0) + 1);
  const includedIdSet = new Set(includedIds);
  return {
    schemaVersion: "1.0.0",
    sourceInventory: {
      schemaVersion: inventory.schemaVersion,
      commit: inventory.source.commit,
      includedAssetCount: included.length,
    },
    policy: {
      inventoryOnly: true,
      runtimePromotionAuthorized: false,
      assignmentCardinality: "Every included source asset belongs to exactly one capability family.",
      duplicatePolicy: "Duplicate blobs are consolidated as one capability concept while every source asset ID remains traceable.",
    },
    summary: {
      familyCount: families.length,
      includedSourceAssets: included.length,
      assignedSourceAssets: assigned.length,
      unassignedSourceAssets: [...includedIdSet].filter((id) => !assignmentCounts.has(id)).length,
      multiplyAssignedSourceAssets: [...assignmentCounts.values()].filter((count) => count !== 1).length,
      uniqueSourceBlobs: new Set(included.map((asset) => asset.blobDigest)).size,
      consolidatedDuplicateSourceAssets: included.length - new Set(included.map((asset) => asset.blobDigest)).size,
      byImplementationStatus: Object.fromEntries(["existing", "enhance", "new", "retire"].map((status) => [status, families.filter((family) => family.implementationStatus === status).length])),
    },
    families,
  };
}

export function buildRuntimeFamilyProjection(matrix) {
  return {
    schemaVersion: "1.0.0",
    sourceCommit: matrix.sourceInventory.commit,
    sourceMatrixSummary: matrix.summary,
    families: matrix.families
      .filter((family) => family.implementationStatus !== "retire")
      .map((family) => ({
        familyId: family.id,
        implementationStatus: family.implementationStatus,
        sourceAssetCount: family.sourceAssetCount,
        runtimeSkillIds: family.runtimeSkillIds,
      })),
  };
}

export function main(argv = process.argv.slice(2)) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const inventoryPath = resolve(root, argv[0] ?? DEFAULT_INVENTORY);
  const outputPath = resolve(root, argv[1] ?? DEFAULT_OUTPUT);
  const allowedOutputRoot = resolve(root, "docs/migrations");
  const relativeOutput = relative(allowedOutputRoot, outputPath);
  if (
    !relativeOutput
    || relativeOutput.startsWith("..")
    || isAbsolute(relativeOutput)
    || extname(relativeOutput) !== ".json"
  ) {
    throw new Error("output must be a JSON file under docs/migrations/");
  }
  const inventory = JSON.parse(readFileSync(inventoryPath, "utf8"));
  const matrix = buildCapabilityFamilyMatrix(inventory);
  if (matrix.summary.unassignedSourceAssets || matrix.summary.multiplyAssignedSourceAssets) {
    throw new Error("capability family assignment is not exactly-once complete");
  }
  writeFileSync(outputPath, `${JSON.stringify(matrix, null, 2)}\n`);
  if (outputPath === resolve(root, DEFAULT_OUTPUT)) {
    const runtimeOutputPath = resolve(root, DEFAULT_RUNTIME_OUTPUT);
    writeFileSync(
      runtimeOutputPath,
      `${JSON.stringify(buildRuntimeFamilyProjection(matrix), null, 2)}\n`,
    );
  }
  process.stdout.write(`Capability families: ${matrix.summary.familyCount}; assets: ${matrix.summary.assignedSourceAssets}\n`);
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) main();
