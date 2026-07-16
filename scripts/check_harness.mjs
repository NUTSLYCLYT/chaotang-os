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
  "backend/config/providers.yaml",
  "docs/failures/2026-07-15-shared-harness-stop-hook-false-green.md",
  ".github/workflows/harness.yml",
  ".agents/hooks/check-harness.mjs",
  ".agents/skills/record-decision/SKILL.md",
  ".agents/skills/record-failure/SKILL.md",
  ".agents/skills/product-flow/SKILL.md",
  ".agents/skills/product-flow/agents/openai.yaml",
  ".agents/skills/product-flow/scripts/run-claude-delivery.mjs",
  ".claude/skills/record-decision/SKILL.md",
  ".claude/skills/record-failure/SKILL.md",
  ".claude/settings.json",
  ".claude/agents/harness-doctor.md",
  ".claude/agents/solution-architect.md",
  ".claude/agents/module-engineer.md",
  ".claude/agents/test-engineer.md",
  ".codex/hooks.json",
  ".codex/agents/harness-doctor.toml",
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
  const descMatch = normalized.match(/^description\s*=\s*"(.*)"$/m);
  const bodyMatch = normalized.match(/developer_instructions\s*=\s*"""([\s\S]*?)"""/);
  if (!descMatch || !bodyMatch) return null;
  const sandboxMatch = normalized.match(/^sandbox_mode\s*=\s*"(.*)"$/m);
  return {
    description: descMatch[1].trim(),
    body: bodyMatch[1].trim(),
    sandboxMode: sandboxMatch?.[1].trim() ?? null,
  };
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

export function validateHarness(root) {
  const errors = [];
  for (const path of REQUIRED_FILES) requireFile(root, path, errors);

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

  const productFlowSkillPath = join(root, ".agents", "skills", "product-flow", "SKILL.md");
  if (existsSync(productFlowSkillPath)) {
    requireText(".agents/skills/product-flow/SKILL.md", readFileSync(productFlowSkillPath, "utf8"), [
      "name: product-flow",
      "$product-flow",
      "自动交付：",
      "run-claude-delivery.mjs --task",
      "总交付次数最多两次",
      "Accepted",
      "Blocked",
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
      "frontend/AGENTS.md",
      "backend/AGENTS.md",
      "node scripts/check_harness.mjs",
      "node .agents/hooks/check-harness.mjs --self-test",
      "事实冲突",
      "Codex 客户端中，默认担任产品经理",
      "Claude Code 主会话默认担任程序团队负责人",
      "$product-flow",
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
      "Baseline", "Workflow", "Feedback Loop", "Adoption Triggers", "Security", "References",
    ]);
    for (const section of missing) errors.push(`docs/agentic-engineering.md 缺少章节: ## ${section}`);
  }

  const productGuidePath = join(root, "docs", "product-collaboration.md");
  if (existsSync(productGuidePath)) {
    const missing = missingSections(readFileSync(productGuidePath, "utf8"), [
      "Roles", "Task Contract", "Workflow", "Automation", "Conflict Rules", "Verification",
    ]);
    for (const section of missing) {
      errors.push(`docs/product-collaboration.md 缺少章节: ## ${section}`);
    }
  }

  validateProductTasks(root, errors);

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
  const tests = [
    ["接受完整章节", missingSections("## Workflow\n\n内容\n\n## Security\n", ["Workflow", "Security"]), []],
    ["拒绝缺失章节", missingSections("## Workflow\n", ["Workflow", "Security"]), ["Security"]],
    ["拒绝低级标题", missingSections("### Security\n", ["Security"]), ["Security"]],
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
      "解析 TOML agent 正文",
      parseTomlAgentBody('description = "说明"\nsandbox_mode = "read-only"\ndeveloper_instructions = """\n正文内容\n"""\n'),
      { description: "说明", body: "正文内容", sandboxMode: "read-only" },
    ],
    ["拒绝缺字段的 TOML agent", parseTomlAgentBody('description = "说明"\n'), null],
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
