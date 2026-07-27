#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
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
  "docs/codex-engineering-workflow.md",
  "docs/product-collaboration.md",
  "docs/product/tasks/TEMPLATE.md",
  "docs/tooling-compatibility.md",
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
];

const DECREE_FLOW_BASELINE = "docs/decisions/0028-decree-evidence-flow-governance-baseline.md";
const DECREE_FLOW_BASELINE_SHA256 = "4f5f8c4ecd98f475edd2f9a74a8844cca91c892caa673fdca360fb58018affd2";
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

const LEGACY_META_HARNESS = [".harness", "frontend/.harness"];

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

export function productTaskErrors(path, content) {
  const errors = [];
  for (const section of missingSections(content, PRODUCT_TASK_SECTIONS)) {
    errors.push(`产品任务 ${path} 缺少章节: ## ${section}`);
  }

  if (!/^# [^#\r\n].+$/m.test(content)) {
    errors.push(`产品任务 ${path} 缺少一级标题`);
  }

  const statusBody = sectionBody(content, "Status");
  const status = statusBody?.split(/\r?\n/, 1)[0].trim();
  if (statusBody !== null && !PRODUCT_TASK_STATUSES.includes(status)) {
    errors.push(
      `产品任务 ${path} 的 Status 必须是 ${PRODUCT_TASK_STATUSES.join(", ")}，当前为: ${status || "空"}`,
    );
  }

  const criteria = sectionBody(content, "Acceptance Criteria");
  if (criteria !== null && !/^- \[(?: |x|X)\] .+/m.test(criteria)) {
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

  const actualHash = createHash("sha256").update(baselineContent).digest("hex");
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

  const codexWorkflowSkillPath = join(root, ".agents", "skills", "codex-engineering-workflow", "SKILL.md");
  if (existsSync(codexWorkflowSkillPath)) {
    requireText(
      ".agents/skills/codex-engineering-workflow/SKILL.md",
      readFileSync(codexWorkflowSkillPath, "utf8"),
      [
        "name: codex-engineering-workflow",
        "brainstorming",
        "systematic-debugging",
        "verification-before-completion",
        "gstack-qa-only",
        "gstack-review",
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

  const agentsPath = join(root, "AGENTS.md");
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
      "node .agents/hooks/check-harness.mjs --self-test",
      "事实冲突",
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

  const codexWorkflowGuidePath = join(root, "docs", "codex-engineering-workflow.md");
  if (existsSync(codexWorkflowGuidePath)) {
    requireText("docs/codex-engineering-workflow.md", readFileSync(codexWorkflowGuidePath, "utf8"), [
      "规则优先级",
      "场景矩阵",
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
  const tests = [
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
      "提取 Markdown 章节正文",
      sectionBody("## Status\n\nReady\n\n## Next\n内容\n", "Status"),
      "Ready",
    ],
    ["接受合法产品任务", productTaskErrors("task.md", validProductTask), []],
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
