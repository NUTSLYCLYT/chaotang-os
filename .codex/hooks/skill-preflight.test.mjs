import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const hookPath = fileURLToPath(new URL("./skill-preflight.mjs", import.meta.url));

function runHook(input) {
  return spawnSync(process.execPath, [hookPath], {
    encoding: "utf8",
    input,
  });
}

function parseOutput(result) {
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");
  return JSON.parse(result.stdout);
}

test("injects mandatory skill preflight guidance for every user prompt", () => {
  const result = runHook(
    JSON.stringify({
      hook_event_name: "UserPromptSubmit",
      session_id: "session-test",
      turn_id: "turn-test",
      cwd: "D:/workspace/chaotang-os-harness-only",
    }),
  );

  const output = parseOutput(result);
  assert.deepEqual(Object.keys(output), ["systemMessage"]);
  assert.match(output.systemMessage, /using-superpowers/);
  assert.match(output.systemMessage, /每个用户回合/);
  assert.match(output.systemMessage, /record-failure/);
  assert.match(output.systemMessage, /绝对工作区路径/);
});

test("fails open with the same safe reminder for malformed hook input", () => {
  const marker = "DO-NOT-ECHO-PRIVATE-PROMPT";
  const valid = parseOutput(runHook("{}"));
  const malformed = parseOutput(runHook(`not-json-${marker}`));

  assert.deepEqual(malformed, valid);
  assert.doesNotMatch(malformed.systemMessage, new RegExp(marker));
});
