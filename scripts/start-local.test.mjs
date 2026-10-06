import { readFile } from "node:fs/promises";
import test from "node:test";
import assert from "node:assert/strict";

const script = await readFile(new URL("./start-local.ps1", import.meta.url), "utf8");
const wrapper = await readFile(new URL("./start-local.cmd", import.meta.url), "utf8");
const docs = await readFile(new URL("../docs/local-trial.md", import.meta.url), "utf8");

test("local launcher exposes explicit start/stop/status actions", () => {
  assert.match(script, /ValidateSet\("Start", "Stop", "Status"\)/);
  assert.match(script, /-Action Status/);
  assert.match(script, /-Action Stop/);
  assert.match(script, /schemaVersion = "chaotang\.local-runtime\.v1"/);
  assert.match(script, /Stop-ProcessTree/);
});

test("local launcher binds loopback only and waits for both real services", () => {
  assert.match(script, /--host 127\.0\.0\.1 --port \$BackendPort/);
  assert.match(script, /--hostname 127\.0\.0\.1 --port \$FrontendPort/);
  assert.match(script, /Wait-Http "http:\/\/127\.0\.0\.1:\$BackendPort\/health"/);
  assert.match(script, /Wait-Http "http:\/\/127\.0\.0\.1:\$FrontendPort\/"/);
});

test("local launcher never invents model credentials or opens a browser", () => {
  assert.doesNotMatch(script, /DEEPSEEK_API_KEY\s*=/);
  assert.doesNotMatch(script, /OPENAI_API_KEY\s*=/);
  assert.doesNotMatch(script, /Start-Process\s+.*https?:/);
  assert.match(script, /modelCalls = "disabled until user submits/);
});

test("double-click wrapper delegates only a constrained action", () => {
  assert.match(wrapper, /-ExecutionPolicy Bypass/);
  assert.match(wrapper, /-Action "%ACTION%"/);
  assert.doesNotMatch(wrapper, /%\*/);
});

test("local trial documentation states setup, real-model boundary and rollback", () => {
  assert.match(docs, /npm ci/);
  assert.match(docs, /start-local\.cmd/);
  assert.match(docs, /真实模型/);
  assert.match(docs, /Stop/);
  assert.match(docs, /不会自动发送/);
});
