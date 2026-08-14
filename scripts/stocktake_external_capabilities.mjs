#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

export const PINNED_EXT_COMMIT = "939186f0331d9784bc8c4ceee393aeb197230ed0";
const DEFAULT_SOURCE = PINNED_EXT_COMMIT;
const DEFAULT_TARGET = "HEAD";
const DEFAULT_OUTPUT =
  "docs/migrations/2026-08-13-six-ministry-capability-inventory.json";

function parseArgs(argv) {
  const options = {
    source: DEFAULT_SOURCE,
    target: DEFAULT_TARGET,
    output: DEFAULT_OUTPUT,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--source" || argument === "--target" || argument === "--output") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error(`missing value for ${argument}`);
      }
      options[argument.slice(2)] = value;
      index += 1;
    } else {
      throw new Error(`unknown argument: ${argument}`);
    }
  }
  return options;
}

function git(root, args, encoding = "utf8") {
  return execFileSync("git", args, { cwd: root, encoding });
}

function resolveCommit(root, ref) {
  return git(root, ["rev-parse", "--verify", `${ref}^{commit}`]).trim();
}

function treeEntries(root, ref, prefixes) {
  const args = [
    "-c",
    "core.quotePath=false",
    "ls-tree",
    "-r",
    "-z",
    ref,
  ];
  if (prefixes.length > 0) args.push("--", ...prefixes);
  const output = git(root, args, null);
  if (output.length === 0) return [];
  return output
    .toString("utf8")
    .split("\0")
    .filter(Boolean)
    .map((record) => {
      const match = record.match(/^(\d+)\s+(\w+)\s+([0-9a-f]+)\t(.+)$/s);
      if (!match) throw new Error(`unparseable git tree record: ${record}`);
      return { mode: match[1], type: match[2], blob: match[3], path: match[4] };
    });
}

function showFile(root, ref, path) {
  return git(root, ["show", `${ref}:${path}`]);
}

function blobContents(root, entries) {
  const blobs = [...new Set(entries.map((entry) => entry.blob))];
  if (blobs.length === 0) return new Map();
  const output = execFileSync("git", ["cat-file", "--batch"], {
    cwd: root,
    input: `${blobs.join("\n")}\n`,
    maxBuffer: 256 * 1024 * 1024,
  });
  const contents = new Map();
  let offset = 0;
  for (const expected of blobs) {
    const headerEnd = output.indexOf(10, offset);
    if (headerEnd < 0) throw new Error(`missing git cat-file header for ${expected}`);
    const header = output.subarray(offset, headerEnd).toString("utf8");
    const match = header.match(/^([0-9a-f]+) blob (\d+)$/u);
    if (!match || match[1] !== expected) throw new Error(`unexpected git cat-file header: ${header}`);
    const size = Number(match[2]);
    const start = headerEnd + 1;
    contents.set(expected, output.subarray(start, start + size));
    offset = start + size + 1;
  }
  return contents;
}

function targetPaths(root, target) {
  return new Set(
    treeEntries(root, target, [".agents", ".claude", "backend/app/agents"])
      .map((entry) => entry.path),
  );
}

function classify(path) {
  if (/^\.claude\/agents\/[^/]+\.md$/.test(path)) return "development-agent";
  if (/^(?:\.agents|\.claude)\/skills\/[^/]+\/SKILL\.md$/.test(path)) {
    return "development-skill";
  }
  if (/^\.claude\/(?:settings\.json|hooks\/|schemas\/)/.test(path)) {
    return "development-control-plane";
  }
  if (/^backend\/runtime_prompts\/[^/]+\/(?:AGENTS|IDENTITY|SOUL|USER|TOOLS)\.md$/.test(path)) {
    return "runtime-role-component";
  }
  if (/^backend\/agent_design\/.+\/skills\/.+\/SKILL\.md$/.test(path)) {
    return "embedded-domain-skill";
  }
  if (/^(?:\.harness|frontend\/\.harness)\/agents\/[^/]+\.md$/.test(path)) {
    return "harness-agent";
  }
  if (/^frontend\/\.harness\/skills\/.+\/SKILL\.md$/.test(path)) {
    return "frontend-harness-skill";
  }
  if (/^backend\/skills\/.+\/SKILL\.md$/.test(path)) return "backend-skill-package";
  if (/^skills\/personas\/.+\/SKILL\.md$/.test(path)) return "persona-skill";
  if (/^backend\/harness\/.+\/SKILL\.md$/.test(path)) return "harness-candidate-skill";
  if (/(^|\/)SKILL\.md$/.test(path)) return "other-skill-package";
  return null;
}

function assetName(path, kind) {
  if (kind === "development-agent") return path.split("/").at(-1).replace(/\.md$/, "");
  if (kind === "development-skill") return path.split("/").at(-2);
  if (kind === "runtime-role-component") return path.split("/")[2];
  if (kind === "embedded-domain-skill") {
    return path.slice(path.lastIndexOf("/skills/") + 8, -"/SKILL.md".length);
  }
  if (kind.endsWith("skill") || kind.endsWith("skill-package")) {
    return path.split("/").at(-2);
  }
  if (kind === "harness-agent") return path.split("/").at(-1).replace(/\.md$/, "");
  return path;
}

function frontmatterDescription(content) {
  if (!content.startsWith("---\n")) return null;
  const end = content.indexOf("\n---", 4);
  if (end === -1) return null;
  const match = content.slice(4, end).match(/^description:\s*["']?(.+?)["']?\s*$/m);
  return match?.[1] ?? null;
}

function disposition(kind, existsInTarget) {
  if (existsInTarget) return "compare-existing";
  if (kind === "development-control-plane") return "reject-direct-copy";
  if (kind === "persona-skill") return "merge-as-evaluation-lens";
  if (kind === "harness-candidate-skill") return "quarantine-candidate";
  if (kind === "embedded-domain-skill") return "merge-by-capability";
  if (kind === "runtime-role-component") return "evaluate-role-bundle";
  return "evaluate-for-distillation";
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

const stableCompare = (left, right) => (left < right ? -1 : left > right ? 1 : 0);

const MINISTRY_ALIASES = {
  libu: ["吏部", "libu_personnel", "flow_libu", "routers/libu.py", "libu_", "recruit", "personnel", "appointment", "talent", "compensation", "labor", "hr_", "chro"],
  hubu: ["户部", "hubu", "finance", "financial", "budget", "treasury", "cashflow", "payment", "accounting", "tax", "investment"],
  libu_rites: ["礼部", "lipu", "libu_communication", "brand", "content", "public_relations"],
  bingbu: ["兵部", "bingbu", "strategy", "competition", "channel", "sales"],
  xingbu: ["刑部", "xingbu", "legal", "contract", "compliance", "dispute"],
  gongbu: ["工部", "gongbu", "delivery", "quality", "supply", "technology", "product"],
};

const SIX_MINISTRY_ROOT = "backend/agent_design/buildAgent/三省六部体系/";
const INCLUDED_ROOTS = [
  "backend/agent_design/",
  "backend/runtime_prompts/",
  "backend/skills/",
  "backend/config/",
  "backend/src/",
  "backend/web/routers/",
  "backend/scripts/",
  "backend/tests/",
  "backend/harness/",
  "frontend/config/",
  "frontend/dev/contracts/",
  "frontend/src/core/courtos/",
  "frontend/src/features/",
  "frontend/src/lib/swarm/",
  "frontend/e2e/",
  "frontend/tests/",
];

const FULL_TREE_SCOPE = ["<entire pinned commit tree>"];

function normalizedPath(path) {
  return path.toLowerCase().replaceAll("-", "_");
}

function ownerFor(path) {
  const normalized = normalizedPath(path);
  const directoryOwner = path.startsWith(SIX_MINISTRY_ROOT)
    ? path.slice(SIX_MINISTRY_ROOT.length).split("/")[0]
    : null;
  const directoryMap = { 吏部: "libu", 户部: "hubu", 礼部: "libu_rites", 兵部: "bingbu", 刑部: "xingbu", 工部: "gongbu" };
  if (directoryMap[directoryOwner]) return directoryMap[directoryOwner];
  for (const [owner, aliases] of Object.entries(MINISTRY_ALIASES)) {
    if (aliases.some((alias) => normalized.includes(alias.toLowerCase().replaceAll("-", "_")))) return owner;
  }
  if (path.startsWith(SIX_MINISTRY_ROOT)) return "shared-six-ministry";
  return null;
}

function inclusionFor(path) {
  const owner = ownerFor(path);
  if (owner) {
    return {
      included: true,
      owner,
      reason: path.startsWith(SIX_MINISTRY_ROOT)
        ? "Included because the file is inside the canonical six-ministry agent-design tree."
        : `Included because its repository path maps explicitly to the ${owner} ministry capability domain.`,
    };
  }
  return {
    included: false,
    owner: "out-of-scope-unmapped",
    reason: "Excluded because neither its path nor its owning directory maps to a six-ministry capability domain.",
  };
}

function sixMinistryKind(path) {
  if (path.startsWith("backend/agent_design/")) {
    if (/(?:AGENTS|IDENTITY|SOUL|TOOLS|USER)\.md$/.test(path)) return "agent-component";
    if (/(?:SKILL\.md|\/skills\/[^/]+)$/.test(path)) return "embedded-skill";
    return "agent-design-support";
  }
  if (path.startsWith("backend/runtime_prompts/")) return "runtime-prompt-component";
  if (/backend\/skills\//.test(path)) return "department-skill";
  if (/backend\/config\/.+(?:flow|registry|orchestrator)/.test(path)) return "flow-or-registry";
  if (path.startsWith("backend/config/")) return "domain-config";
  if (path.startsWith("backend/web/routers/")) return "router-api";
  if (path.startsWith("backend/harness/") || path.startsWith("frontend/dev/contracts/evals/")) return "harness-or-evaluation";
  if (path.startsWith("backend/tests/") || path.startsWith("frontend/e2e/") || path.startsWith("frontend/tests/") || /(?:\.nodetest|\.test|\.spec)\./.test(path)) return "test-or-golden";
  if (/golden_cases|\/fixtures\//.test(path)) return "test-or-golden";
  if (path.startsWith("backend/scripts/")) return "tool-or-importer";
  if (path.startsWith("backend/src/") && /(validator|parser|vet|gate|audit|budget|treasury|cashflow|payment|finance|financial)/.test(normalizedPath(path))) return "validator-or-parser";
  if (path.startsWith("backend/src/")) return "backend-runtime-support";
  if (path.startsWith("frontend/dev/contracts/loops/")) return "frontend-loop-contract";
  if (path.startsWith("frontend/dev/contracts/prompts/")) return "frontend-prompt-contract";
  if (path.startsWith("frontend/config/")) return "frontend-office-registry";
  if (path.startsWith("frontend/")) return "frontend-runtime-or-ui";
  return null;
}

function summaryText(content) {
  const text = content.toString("utf8").replace(/^---[\s\S]*?---\s*/u, "");
  const line = text.split(/\r?\n/u).map((item) => item.replace(/^#+\s*/u, "").trim()).find(Boolean);
  return (line ?? "No embedded description; inspect the pinned source asset.").slice(0, 500);
}

function behaviorFor(kind, owner, path, content) {
  const text = content.toString("utf8");
  const triggerWords = [...new Set((text.match(/[\u4e00-\u9fffA-Za-z_]{2,24}/gu) ?? []).filter((word) => /招聘|任免|预算|现金|付款|合同|质量|交付|品牌|销售|成本|投资|审计|风险|人才|薪酬|trigger|keyword|entrypoint/iu.test(word)).slice(0, 12))];
  const devSkills = {
    libu: ["analyze-appointment-fit", "analyze-compensation-equity", "analyze-workforce-coordination", "analyze-labor-relations", "analyze-hr-policy", "analyze-recruitment-pipeline"],
    hubu: ["analyze-accounting-position", "analyze-financial-controls", "analyze-budget-performance", "analyze-financing-options", "analyze-investment-case", "analyze-pricing-economics", "analyze-cash-safety"],
    libu_rites: ["DEV libu_rites bureau skills"],
    bingbu: ["DEV bingbu bureau skills"],
    xingbu: ["DEV xingbu bureau skills"],
    gongbu: ["DEV gongbu bureau skills"],
    "shared-six-ministry": ["DEV RuntimeSkill registry and executor"],
  };
  const executable = ["router-api", "validator-or-parser", "backend-runtime-support", "frontend-runtime-or-ui", "tool-or-importer"].includes(kind);
  const promptLike = ["agent-component", "embedded-skill", "runtime-prompt-component", "frontend-prompt-contract", "department-skill"].includes(kind);
  return {
    triggers: triggerWords.length ? triggerWords : [`Loaded or routed as ${kind}`],
    antiTriggers: promptLike ? ["Do not treat role prose as execution authority", "Do not invoke outside the owning ministry"] : ["Do not execute when required evidence or authority is absent"],
    inputs: kind.includes("test") || kind.includes("harness") ? ["Fixture or candidate output"] : ["Task or structured domain evidence defined by the asset"],
    steps: [summaryText(content)],
    outputs: kind.includes("config") || kind.includes("registry") || kind.includes("contract") ? ["Declarative configuration or contract"] : ["Domain result, opinion, validation, or supporting artifact"],
    dependencies: [kind.startsWith("frontend") ? "frontend CourtOS modules" : "backend/runtime modules referenced by the pinned asset"],
    tools: executable ? ["Executable code path; exact imports remain in the pinned source"] : ["No independently verified typed tool binding"],
    sideEffects: /write|archive|upload|send|payment|付款|归档|写入/iu.test(text) ? ["Potential external or persistent effect is mentioned; requires authority review"] : ["No material side effect established by inventory evidence"],
    failureStopEscalation: /except Exception|fallback|降级|return None/iu.test(text) ? ["Contains fallback or swallowed-failure behavior; rewrite as explicit degraded/failed before promotion"] : ["Stop or request evidence when contract, authority, or required input is missing"],
    consumptionChain: promptLike ? ["No typed DEV consumer proven; source is prompt/declarative inventory"] : [executable ? "Referenced through repository runtime, route, test, or UI layer; re-verify during migration" : "Supporting asset consumed by its adjacent flow, harness, or registry"],
    devMapping: devSkills[owner] ?? ["No direct DEV typed capability mapping"],
  };
}

function migrationDecision(kind, owner, path) {
  if (path.includes("retired_standalone_swarms") || path.includes("/_attic/") || /appointment_agent/.test(path)) {
    return ["retire", "Retired, attic, or unrelated demonstration asset must not enter the production capability graph.", "high"];
  }
  if (kind === "embedded-skill" || kind === "agent-component" || kind === "runtime-prompt-component" || kind === "frontend-prompt-contract") {
    return ["distill-rewrite", "Prompt prose is not executable authority; extract invariants and evaluation cases into the DEV RuntimeSkill model.", "high"];
  }
  if (kind === "validator-or-parser" || kind === "tool-or-importer") {
    return ["distill-rewrite", "Deterministic logic is valuable but must adopt DEV evidence, tenant, tool-policy, and failure contracts.", "medium"];
  }
  if (kind === "test-or-golden" || kind === "harness-or-evaluation") {
    return ["retain-as-evaluation", "Preserve cases and expected invariants while rebasing them onto the DEV contracts.", "low"];
  }
  if (kind === "frontend-runtime-or-ui" || kind === "frontend-office-registry" || kind === "frontend-loop-contract") {
    return ["retain-concept", "Keep the interaction or routing concept but move business authority to the backend typed runtime.", "medium"];
  }
  return ["distill-rewrite", `Map the ${owner} asset into the existing DEV typed capability instead of copying the legacy control plane.`, "medium"];
}

export function buildSixMinistryInventory(root, source, target = "HEAD") {
  const sourceCommit = resolveCommit(root, source);
  const targetCommit = resolveCommit(root, target);
  const sourceEntries = treeEntries(root, sourceCommit, []);
  const classified = sourceEntries.map((entry) => ({
    ...entry,
    kind: sixMinistryKind(entry.path) ?? classify(entry.path) ?? "repository-file",
    inclusion: inclusionFor(entry.path),
  }));
  const contentByBlob = blobContents(root, classified);
  const assets = classified.map((entry) => {
    const content = contentByBlob.get(entry.blob);
    if (!content) throw new Error(`missing pinned blob content: ${entry.path}`);
    const { included, owner, reason: classificationReason } = entry.inclusion;
    const digest = sha256(content);
    const duplicateGroup = `sha256:${digest}`;
    const [verdict, reason, risk] = migrationDecision(entry.kind, owner, entry.path);
    return {
      id: `six-ministry:${owner}:${sha256(entry.path).slice(0, 16)}`,
      owner,
      included,
      classificationReason,
      kind: entry.kind,
      name: entry.path.split("/").at(-1),
      path: entry.path,
      sourceCommit,
      sourceBlob: entry.blob,
      blobDigest: digest,
      bytes: Buffer.byteLength(content),
      description: summaryText(content),
      ...(included
        ? behaviorFor(entry.kind, owner, entry.path, content)
        : {
            triggers: [], antiTriggers: [], inputs: [], steps: [], outputs: [], dependencies: [], tools: [], sideEffects: [], failureStopEscalation: [], consumptionChain: [], devMapping: [],
          }),
      duplicateGroup,
      verdict: included ? verdict : "exclude",
      reason: included ? reason : classificationReason,
      risk: included ? risk : "none",
    };
  }).sort((left, right) => stableCompare(left.path, right.path));
  const duplicateGroups = Object.fromEntries([...new Set(assets.map((asset) => asset.duplicateGroup))].sort(stableCompare).map((group) => {
    const members = assets.filter((asset) => asset.duplicateGroup === group);
    return [group, { digest: group.slice("sha256:".length), sourcePaths: members.map((asset) => asset.path).sort(stableCompare), duplicate: members.length > 1 }];
  }));
  const countBy = (field) => Object.fromEntries([...new Set(assets.map((asset) => asset[field]))].sort(stableCompare).map((value) => [value, assets.filter((asset) => asset[field] === value).length]));
  return {
    schemaVersion: "2.0.0",
    source: { ref: source, commit: sourceCommit, pinned: source === sourceCommit || sourceCommit === PINNED_EXT_COMMIT },
    target: { ref: target, commit: targetCommit },
    scope: FULL_TREE_SCOPE,
    completenessPolicy: "Every blob in the pinned commit tree is emitted exactly once and explicitly classified as included or excluded with a reason.",
    summary: {
      totalAssets: assets.length,
      totalTreeFiles: assets.length,
      includedAssets: assets.filter((asset) => asset.included).length,
      excludedAssets: assets.filter((asset) => !asset.included).length,
      sixMinistryAssets: assets.filter((asset) => asset.included).length,
      excludedUniverseAssets: assets.filter((asset) => !asset.included).length,
      unclassified: 0,
      byOwner: countBy("owner"),
      byKind: countBy("kind"),
      duplicateGroups: Object.values(duplicateGroups).filter((group) => group.duplicate).length,
    },
    duplicateGroups,
    assets,
  };
}

export function buildStocktake(root, source, target) {
  const sourceCommit = resolveCommit(root, source);
  const targetCommit = resolveCommit(root, target);
  const existing = targetPaths(root, targetCommit);
  const prefixes = [];
  const entries = treeEntries(root, sourceCommit, prefixes)
    .map((entry) => ({ ...entry, kind: classify(entry.path) }))
    .filter((entry) => entry.kind !== null)
    .map((entry) => {
      const content = showFile(root, sourceCommit, entry.path);
      const name = assetName(entry.path, entry.kind);
      return {
        path: entry.path,
        kind: entry.kind,
        name,
        sourceBlob: entry.blob,
        sha256: sha256(content),
        bytes: Buffer.byteLength(content),
        description: frontmatterDescription(content),
        exactPathExistsInTarget: existing.has(entry.path),
        disposition: disposition(entry.kind, existing.has(entry.path)),
      };
    })
    .sort((left, right) => left.path.localeCompare(right.path));

  const byKind = Object.fromEntries(
    [...new Set(entries.map((entry) => entry.kind))]
      .sort()
      .map((kind) => [kind, entries.filter((entry) => entry.kind === kind).length]),
  );
  const uniqueNamesByKind = Object.fromEntries(
    Object.keys(byKind).map((kind) => [
      kind,
      new Set(entries.filter((entry) => entry.kind === kind).map((entry) => entry.name)).size,
    ]),
  );
  const uniqueBlobsByKind = Object.fromEntries(
    Object.keys(byKind).map((kind) => [
      kind,
      new Set(entries.filter((entry) => entry.kind === kind).map((entry) => entry.sourceBlob)).size,
    ]),
  );

  return {
    schemaVersion: "1.0.0",
    source: { ref: source, commit: sourceCommit },
    target: { ref: target, commit: targetCommit },
    scope: ["entire source tree; only classified Agent/Skill/control-plane paths are emitted"],
    policy: {
      inventoryOnly: true,
      directCopyAuthorized: false,
      runtimePromotionRequiresEvaluation: true,
      protectedTargetRoots: ["AGENTS.md", ".agents", ".claude", "backend/app/agents/runtime_skills"],
    },
    summary: {
      totalEntries: entries.length,
      byKind,
      uniqueNamesByKind,
      uniqueBlobsByKind,
    },
    entries,
  };
}

export function main(argv = process.argv.slice(2)) {
  const root = git(process.cwd(), ["rev-parse", "--show-toplevel"]).trim();
  const options = parseArgs(argv);
  const stocktake = buildSixMinistryInventory(root, options.source, options.target);
  const output = resolve(root, options.output);
  const outputRelative = relative(root, output);
  if (
    outputRelative === "" ||
    outputRelative === ".." ||
    outputRelative.startsWith(`..${sep}`) ||
    resolve(outputRelative) === outputRelative
  ) {
    throw new Error("output must stay inside the repository");
  }
  const normalizedOutput = outputRelative.split(sep).join("/");
  const protectedRoots = ["AGENTS.md", ".agents", ".claude", "backend/app"];
  if (
    protectedRoots.some(
      (protectedRoot) =>
        normalizedOutput === protectedRoot || normalizedOutput.startsWith(`${protectedRoot}/`),
    )
  ) {
    throw new Error(`output targets a protected repository root: ${normalizedOutput}`);
  }
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, `${JSON.stringify(stocktake, null, 2)}\n`);
  process.stdout.write(
    `Capability stocktake: ${stocktake.summary.totalAssets ?? stocktake.summary.totalEntries} entries -> ${options.output}\n`,
  );
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main();
}
