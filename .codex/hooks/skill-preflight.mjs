#!/usr/bin/env node

import { readFileSync } from "node:fs";

const systemMessage = [
  "强制 Skill Preflight：每个用户回合都必须重新执行。",
  "在任何回复、检查文件或调用工具之前，必须完整读取 using-superpowers/SKILL.md，",
  "根据当前用户意图重新匹配并完整读取所有适用 skill，然后在 commentary 中声明使用目的。",
  "强制映射：故障/异常使用 systematic-debugging；用户可见故障、假绿、错误记忆或复盘",
  "使用 record-failure；功能或行为修改使用 brainstorming 和 test-driven-development；",
  "提交或完成声明使用 verification-before-completion；worktree 操作使用 using-git-worktrees；",
  "chaotang-os 实质工程任务使用 codex-engineering-workflow。",
  "任何 Git 操作前必须核对并报告绝对工作区路径、当前分支、HEAD 和 git status。",
].join("");

try {
  readFileSync(0, "utf8");
} catch {
  // Hook input is intentionally discarded. The fixed reminder must remain available.
}

process.stdout.write(`${JSON.stringify({ systemMessage })}\n`);
