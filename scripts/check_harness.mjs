#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

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
  "docs/decisions/0001-agentic-engineering-baseline.md",
  ".github/workflows/harness.yml",
];

const LEGACY_META_HARNESS = [".harness", "frontend/.harness"];

export function missingSections(markdown, sections) {
  return sections.filter((section) => {
    const escaped = section.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return !new RegExp(`^## ${escaped}\\s*$`, "m").test(markdown);
  });
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

export function validateHarness(root) {
  const errors = [];
  for (const path of REQUIRED_FILES) requireFile(root, path, errors);

  for (const path of LEGACY_META_HARNESS) {
    if (existsSync(join(root, path))) errors.push(`旧 meta-harness 不应继续存在: ${path}`);
  }

  const agentsPath = join(root, "AGENTS.md");
  if (existsSync(agentsPath)) {
    const content = readFileSync(agentsPath, "utf8");
    const lines = content.split(/\r?\n/).length;
    if (lines > 80) errors.push(`AGENTS.md 应保持精简，当前 ${lines} 行，限制 80 行`);
    requireText("AGENTS.md", content, [
      "ARCHITECTURE.md",
      "docs/agentic-engineering.md",
      "frontend/AGENTS.md",
      "backend/AGENTS.md",
      "node scripts/check_harness.mjs",
      "事实冲突",
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
      "Baseline", "Workflow", "Feedback Loop", "Adoption Triggers", "Security", "References",
    ]);
    for (const section of missing) errors.push(`docs/agentic-engineering.md 缺少章节: ## ${section}`);
  }

  const decisionPath = join(root, "docs", "decisions", "0001-agentic-engineering-baseline.md");
  if (existsSync(decisionPath)) {
    const missing = missingSections(readFileSync(decisionPath, "utf8"), [
      "Status", "Context", "Decision", "Consequences", "Verification",
    ]);
    for (const section of missing) errors.push(`基线决策缺少章节: ## ${section}`);
  }

  const workflowPath = join(root, ".github", "workflows", "harness.yml");
  if (existsSync(workflowPath)) {
    requireText(".github/workflows/harness.yml", readFileSync(workflowPath, "utf8"), [
      "node scripts/check_harness.mjs",
      "node scripts/check_harness.mjs --self-test",
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
  }

  return errors;
}

function runSelfTest() {
  const tests = [
    ["接受完整章节", missingSections("## Workflow\n\n内容\n\n## Security\n", ["Workflow", "Security"]), []],
    ["拒绝缺失章节", missingSections("## Workflow\n", ["Workflow", "Security"]), ["Security"]],
    ["拒绝低级标题", missingSections("### Security\n", ["Security"]), ["Security"]],
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
