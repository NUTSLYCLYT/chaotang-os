#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

function readHookInput() {
  try {
    const input = readFileSync(0, "utf8").trim();
    return input ? JSON.parse(input) : {};
  } catch {
    return {};
  }
}

function failureReason(result) {
  const output = [result.stdout, result.stderr]
    .filter(Boolean)
    .join("\n")
    .trim();
  const reason = output || `harness 检查无法运行（退出码 ${result.status ?? "unknown"}）`;
  return reason.length > 6000 ? `${reason.slice(0, 6000)}\n…输出已截断` : reason;
}

export function hookResponse(status, input, reason) {
  if (status === 0) return null;
  if (input.stop_hook_active === true) {
    return { systemMessage: `Harness 自动复查仍未通过，请人工处理：\n${reason}` };
  }
  return {
    decision: "block",
    reason: `Harness 检查未通过。修复后重新运行验证：\n${reason}`,
  };
}

function runSelfTest() {
  const tests = [
    ["成功时保持静默", hookResponse(0, {}, "unused"), null],
    ["首次失败要求继续", hookResponse(1, {}, "failed").decision, "block"],
    ["重复失败停止自动循环", hookResponse(1, { stop_hook_active: true }, "failed").decision, undefined],
  ];
  const failures = tests.filter(([, actual, expected]) => actual !== expected);
  if (failures.length) {
    for (const [name] of failures) process.stderr.write(`Stop hook 自测失败: ${name}\n`);
    return 1;
  }
  process.stdout.write(`Stop hook self-test: 通过 (${tests.length} 项)\n`);
  return 0;
}

function main() {
  if (process.argv.includes("--self-test")) return runSelfTest();
  const input = readHookInput();
  const result = spawnSync(process.execPath, ["scripts/check_harness.mjs"], {
    cwd: root,
    encoding: "utf8",
  });
  const response = hookResponse(result.status, input, failureReason(result));
  if (response) process.stdout.write(`${JSON.stringify(response)}\n`);
  return 0;
}

process.exitCode = main();
