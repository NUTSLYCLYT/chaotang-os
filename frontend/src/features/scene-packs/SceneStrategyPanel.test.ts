import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source() {
  return readFile(new URL("./SceneStrategyPanel.tsx", import.meta.url), "utf8");
}

test("结果案例入口先说明用户得到的结果，再提供明确动作", async () => {
  const value = await source();

  assert.match(value, /aria-label="结果案例入口"/);
  assert.match(value, />结果案例</);
  assert.match(value, /每张案例都说明你将得到的结果/);
  assert.match(value, /你将得到：<\/strong>\{pack\.shortValue\}/);
  assert.match(value, /真实链路/);
  assert.match(value, /占位链路/);
  assert.match(value, /开始办理/);
  assert.match(value, /查看案例输入/);
  assert.doesNotMatch(value, /立即开局/);
  assert.doesNotMatch(value, />查看样例</);
});

test("结果案例入口保留原场景和 demo 路由", async () => {
  const value = await source();

  assert.match(value, /router\.push\(`\/scene-pack\/\$\{pack\.slug\}`\)/);
  assert.match(value, /router\.push\(`\/scene-pack\/\$\{pack\.slug\}\?demo=1`\)/);
  assert.match(value, /pack\.implementationStatus === "real_v1"/);
  assert.match(value, /data-source=\{source\}/);
});
