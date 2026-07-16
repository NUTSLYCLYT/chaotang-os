#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { spawn, spawnSync } from "node:child_process";
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

function usage() {
  process.stdout.write(`Usage:
  node run-claude-delivery.mjs --task docs/product/tasks/<task>.md [--dry-run]
  node run-claude-delivery.mjs --self-test
`);
}

function runSelfTest() {
  const tests = [
    ["接受任务目录内 Markdown", resolveTaskPath("docs/product/tasks/example.md") !== null, true],
    ["拒绝目录穿越", resolveTaskPath("docs/product/tasks/../../secret.md"), null],
    ["拒绝非任务目录", resolveTaskPath("docs/example.md"), null],
    ["读取 Ready 状态", taskStatus("# x\n\n## Status\n\nReady\n\n## Next\n"), "Ready"],
    ["拒绝缺失状态", taskStatus("# x\n"), null],
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

function buildPrompt(task) {
  return `按照根目录 CLAUDE.md 的程序团队负责人流程交付这个产品任务：${task}

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
  const prompt = buildPrompt(task);
  const claudeArgs = [
    "-p",
    "--permission-mode", "acceptEdits",
    "--output-format", "text",
    "--max-turns", "100",
    prompt,
  ];

  if (args.includes("--dry-run")) {
    process.stdout.write(`${JSON.stringify({ command: claudeExecutable(), args: claudeArgs }, null, 2)}\n`);
    return 0;
  }

  const auth = authStatus();
  if (auth?.loggedIn !== true) {
    process.stderr.write("product-flow: Claude Code 尚未登录，请先运行 claude auth login\n");
    return 3;
  }

  return await new Promise((done) => {
    const child = spawn(claudeExecutable(), claudeArgs, {
      cwd: root,
      stdio: "inherit",
      windowsHide: true,
    });
    child.on("error", (error) => {
      process.stderr.write(`product-flow: 无法启动 Claude Code: ${error.message}\n`);
      done(3);
    });
    child.on("exit", (code) => done(code ?? 3));
  });
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) process.exitCode = await main();
