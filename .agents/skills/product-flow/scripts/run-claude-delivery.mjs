#!/usr/bin/env node

import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const taskRoot = resolve(root, "docs/product/tasks");

export function resolveTaskPath(task) {
  if (!task || isAbsolute(task) || task.includes("..")) return null;
  const absolute = resolve(root, task);
  const withinTasks = absolute.startsWith(`${taskRoot}${sep}`);
  return withinTasks && absolute.endsWith(".md") ? absolute : null;
}

export function taskStatus(content) {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const index = lines.findIndex((line) => line.trimEnd() === "## Status");
  if (index === -1) return null;
  return lines.slice(index + 1).find((line) => line.trim())?.trim() ?? null;
}

export function deliveryExitCode(childCode, finalStatus) {
  if (childCode !== 0) return childCode ?? 3;
  if (finalStatus === "Implemented") return 0;
  if (finalStatus === "Blocked") return 4;
  return 5;
}

const LIVE_TEXT_LIMIT = 6_000;

function truncate(value, limit = LIVE_TEXT_LIMIT) {
  const text = String(value ?? "");
  return text.length <= limit ? text : `${text.slice(0, limit)}\n…（实时输出已截断，完整内容见 JSONL 日志）`;
}

export function sanitizeLogText(value) {
  return String(value ?? "")
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [REDACTED]")
    .replace(
      /((?:api[_-]?key|access[_-]?token|auth[_-]?token|password|secret|openai_api_key|anthropic_api_key|langsmith_api_key)\s*(?:["']?\s*[:=]\s*["']?|\s+))([^\s"',}]+)/gi,
      "$1[REDACTED]",
    );
}

function jsonText(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function toolInputSummary(name, input = {}) {
  if (name === "Agent" || name === "Task") {
    return [input.subagent_type, input.description].filter(Boolean).join(" — ") || "启动子角色";
  }
  if (name === "Bash" || name === "PowerShell") return input.command ?? jsonText(input);
  if (name === "Read" || name === "Write" || name === "Edit") {
    return input.file_path ?? input.path ?? jsonText(input);
  }
  if (name === "Glob") return [input.pattern, input.path].filter(Boolean).join(" @ ");
  if (name === "Grep") return [input.pattern, input.path].filter(Boolean).join(" @ ");
  if (name === "Skill") return input.skill ?? jsonText(input);
  return jsonText(input);
}

function toolResultText(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return jsonText(content);
  return content
    .map((item) => (item?.type === "text" ? item.text : jsonText(item)))
    .filter(Boolean)
    .join("\n");
}

export function createStreamFormatter() {
  const toolNames = new Map();
  return (event) => {
    const lines = [];
    if (event?.type === "system" && event.subtype === "init") {
      lines.push(
        `[Claude 会话] 已启动 ${event.model ?? "未知模型"}；权限=${event.permissionMode ?? "未知"}；session=${event.session_id ?? "未知"}`,
      );
    }

    if (event?.type === "assistant") {
      const role = event.parent_tool_use_id ? "Claude 子角色" : "Claude";
      for (const block of event.message?.content ?? []) {
        if (block?.type === "text" && block.text?.trim()) {
          lines.push(`[${role}] ${truncate(sanitizeLogText(block.text.trim()))}`);
        }
        if (block?.type === "tool_use") {
          toolNames.set(block.id, block.name ?? "工具");
          lines.push(
            `[Claude 工具] ${block.name ?? "工具"}: ${truncate(sanitizeLogText(toolInputSummary(block.name, block.input)), 2_000)}`,
          );
        }
      }
    }

    if (event?.type === "user") {
      for (const block of event.message?.content ?? []) {
        if (block?.type !== "tool_result") continue;
        const name = toolNames.get(block.tool_use_id) ?? "工具";
        const result = toolResultText(block.content).trim();
        if (result) {
          lines.push(`[Claude ${name} 结果] ${truncate(sanitizeLogText(result))}`);
        }
      }
    }

    if (event?.type === "system" && event.subtype === "hook_started") {
      lines.push(`[Claude Hook] ${event.hook_name ?? event.hook_event ?? "未知"} 已启动`);
    }
    if (event?.type === "system" && event.subtype === "hook_response") {
      lines.push(
        `[Claude Hook] ${event.hook_name ?? event.hook_event ?? "未知"} ${event.outcome ?? "完成"}（exit=${event.exit_code ?? "未知"}）`,
      );
    }
    if (event?.type === "result") {
      const durationSeconds = Number.isFinite(event.duration_ms)
        ? (event.duration_ms / 1_000).toFixed(1)
        : "未知";
      lines.push(
        `[Claude 完成] ${event.subtype ?? "未知结果"}；turns=${event.num_turns ?? "未知"}；duration=${durationSeconds}s；session=${event.session_id ?? "未知"}`,
      );
    }
    return lines;
  };
}

export function formatClaudeStreamLine(line, formatter) {
  try {
    return formatter(JSON.parse(line));
  } catch {
    return line.trim() ? [`[Claude 原始输出] ${truncate(sanitizeLogText(line))}`] : [];
  }
}

export function buildClaudeArgs(prompt, bypassPermissions) {
  const args = [
    "-p",
    "--permission-mode", "acceptEdits",
    "--output-format", "stream-json",
    "--verbose",
    "--forward-subagent-text",
    "--include-hook-events",
    "--max-turns", "100",
    prompt,
  ];
  if (bypassPermissions) args[args.indexOf("--permission-mode") + 1] = "bypassPermissions";
  return args;
}

function usage() {
  process.stdout.write(`Usage:
  node run-claude-delivery.mjs --task docs/product/tasks/<task>.md [--dry-run] [--bypass-permissions]
  node run-claude-delivery.mjs --self-test
`);
}

function runSelfTest() {
  const formatter = createStreamFormatter();
  const streamArgs = buildClaudeArgs("test", false);
  const bypassArgs = buildClaudeArgs("test", true);
  const sessionLines = formatter({
    type: "system",
    subtype: "init",
    model: "claude-test",
    permissionMode: "acceptEdits",
    session_id: "session-1",
  });
  const agentLines = formatter({
    type: "assistant",
    message: {
      content: [{
        type: "tool_use",
        id: "agent-1",
        name: "Agent",
        input: { subagent_type: "test-engineer", description: "独立验证" },
      }],
    },
  });
  const toolLines = formatter({
    type: "assistant",
    message: {
      content: [{ type: "tool_use", id: "tool-1", name: "Bash", input: { command: "npm test" } }],
    },
  });
  const resultLines = formatter({
    type: "user",
    message: { content: [{ type: "tool_result", tool_use_id: "tool-1", content: "7 passed" }] },
  });
  const tests = [
    ["接受任务目录内 Markdown", resolveTaskPath("docs/product/tasks/example.md") !== null, true],
    ["拒绝目录穿越", resolveTaskPath("docs/product/tasks/../../secret.md"), null],
    ["拒绝非任务目录", resolveTaskPath("docs/example.md"), null],
    ["读取 Ready 状态", taskStatus("# x\n\n## Status\n\nReady\n\n## Next\n"), "Ready"],
    ["拒绝缺失状态", taskStatus("# x\n"), null],
    ["Implemented 才算成功", deliveryExitCode(0, "Implemented"), 0],
    ["Blocked 返回专用错误码", deliveryExitCode(0, "Blocked"), 4],
    ["In Progress 不得假绿", deliveryExitCode(0, "In Progress"), 5],
    ["透传 Claude 非零退出码", deliveryExitCode(7, "Implemented"), 7],
    ["默认使用实时 JSON 流", streamArgs.includes("stream-json"), true],
    ["转发 Claude 子角色文本", streamArgs.includes("--forward-subagent-text"), true],
    ["默认权限仍为 acceptEdits", streamArgs[streamArgs.indexOf("--permission-mode") + 1], "acceptEdits"],
    ["显式授权时使用 bypassPermissions", bypassArgs[bypassArgs.indexOf("--permission-mode") + 1], "bypassPermissions"],
    ["实时日志展示 Claude 会话", sessionLines.some((line) => line.includes("claude-test") && line.includes("session-1")), true],
    ["实时日志展示子角色启动", agentLines.some((line) => line.includes("test-engineer") && line.includes("独立验证")), true],
    ["实时日志展示工具调用", toolLines.some((line) => line.includes("Bash: npm test")), true],
    ["实时日志展示工具结果", resultLines.some((line) => line.includes("Bash 结果") && line.includes("7 passed")), true],
    ["实时日志脱敏常见 API Key", sanitizeLogText("OPENAI_API_KEY=sk-secret").includes("sk-secret"), false],
  ];
  const failures = tests.filter(([, actual, expected]) => actual !== expected);
  for (const [name] of failures) process.stderr.write(`自测失败: ${name}\n`);
  if (failures.length) return 1;
  process.stdout.write(`product-flow Claude runner self-test: 通过 (${tests.length} 项)\n`);
  return 0;
}

function claudeExecutable() {
  return process.platform === "win32" ? "claude.exe" : "claude";
}

function authStatus() {
  const result = spawnSync(claudeExecutable(), ["auth", "status"], {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
  });
  if (result.status !== 0) return null;
  try {
    return JSON.parse(result.stdout);
  } catch {
    return null;
  }
}

function buildPrompt(task, bypassPermissions) {
  const permissionNotice = bypassPermissions
    ? "\n用户已明确授权本次 product-flow 会话使用 bypassPermissions，并执行任务所需的本地依赖安装、lint、test、build、run 与 smoke 命令；仍然禁止提交、推送、发布、部署或创建外部资源。\n"
    : "";
  return `按照根目录 CLAUDE.md 的程序团队负责人流程交付这个产品任务：${task}
${permissionNotice}

任务已经由 Codex 置为 Ready。请顺序完成：
1. 改为 In Progress；
2. 调用 solution-architect，填写 Affected Modules 的允许路径和 Technical Plan；
3. 对每个模块顺序调用 module-engineer；
4. 调用 test-engineer，完成自审和相关验证；
5. 填写 Implementation Report 并改为 Implemented。

不得修改 Product Definition、Acceptance Criteria 或 Delivery Constraints。发现必须由产品决定的
歧义、无法验证的标准或高风险冲突时，改为 Blocked 并把最少问题写入任务文件。不要提交、推送
或发布，不要等待交互式用户输入。`;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    usage();
    return 0;
  }
  if (args.includes("--self-test")) return runSelfTest();

  const taskIndex = args.indexOf("--task");
  const suppliedTask = taskIndex >= 0 ? args[taskIndex + 1] : null;
  const absoluteTask = resolveTaskPath(suppliedTask);
  if (!absoluteTask || !existsSync(absoluteTask)) {
    process.stderr.write("product-flow: --task 必须指向 docs/product/tasks/ 下已存在的 Markdown 文件\n");
    return 2;
  }

  const status = taskStatus(readFileSync(absoluteTask, "utf8"));
  if (status !== "Ready") {
    process.stderr.write(`product-flow: Claude 只能接收 Ready 任务，当前状态: ${status ?? "缺失"}\n`);
    return 2;
  }

  const task = relative(root, absoluteTask).split(sep).join("/");
  const bypassPermissions = args.includes("--bypass-permissions");
  const prompt = buildPrompt(task, bypassPermissions);
  const claudeArgs = buildClaudeArgs(prompt, bypassPermissions);

  if (args.includes("--dry-run")) {
    process.stdout.write(`${JSON.stringify({ command: claudeExecutable(), args: claudeArgs }, null, 2)}\n`);
    return 0;
  }

  const auth = authStatus();
  if (auth?.loggedIn !== true) {
    process.stderr.write("product-flow: Claude Code 尚未登录，请先运行 claude auth login\n");
    return 3;
  }

  const logDirectory = resolve(tmpdir(), "chaotang-product-flow");
  mkdirSync(logDirectory, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const logPath = resolve(logDirectory, `${timestamp}-${basename(task, ".md")}.jsonl`);
  const stderrLogPath = `${logPath}.stderr.log`;
  process.stdout.write(`product-flow: Claude 实时日志已启用；完整 JSONL: ${logPath}\n`);

  return await new Promise((done) => {
    let settled = false;
    const finish = (code) => {
      if (settled) return;
      settled = true;
      done(code);
    };
    const formatter = createStreamFormatter();
    const child = spawn(claudeExecutable(), claudeArgs, {
      cwd: root,
      stdio: ["inherit", "pipe", "pipe"],
      windowsHide: true,
    });
    const lines = createInterface({ input: child.stdout });
    lines.on("line", (line) => {
      appendFileSync(logPath, `${line}\n`, "utf8");
      for (const message of formatClaudeStreamLine(line, formatter)) {
        process.stdout.write(`${message}\n`);
      }
    });
    child.stderr.on("data", (chunk) => {
      const text = String(chunk);
      appendFileSync(stderrLogPath, text, "utf8");
      process.stderr.write(`[Claude stderr] ${sanitizeLogText(text)}`);
    });
    child.on("error", (error) => {
      process.stderr.write(`product-flow: 无法启动 Claude Code: ${error.message}\n`);
      finish(3);
    });
    child.on("close", (code) => {
      const finalStatus = taskStatus(readFileSync(absoluteTask, "utf8"));
      const resultCode = deliveryExitCode(code, finalStatus);
      if (code === 0 && resultCode !== 0) {
        process.stderr.write(
          `product-flow: Claude 已退出，但任务未完成，最终状态: ${finalStatus ?? "缺失"}\n`,
        );
      }
      finish(resultCode);
    });
  });
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) process.exitCode = await main();
