import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  buildArchiveFilterQuery,
  formatArchiveType,
  formatRealityLabel,
  formatReviewStatus,
  formatSuccessRate,
} from "./archiveStatus.ts";

test("史馆标签格式化：仅奏折、回奏两类档案，并保留真实度与复盘状态", () => {
  assert.equal(formatArchiveType("MEMORIAL"), "奏折");
  assert.equal(formatArchiveType("REPLY"), "回奏");
  assert.equal(formatRealityLabel("LIVE"), "实时链路来源");
  assert.equal(formatRealityLabel("MIXED"), "实时与降级来源混合");
  assert.equal(formatRealityLabel("FALLBACK"), "降级或演示来源");
  assert.equal(formatReviewStatus("PARTIAL"), "部分达成");
  assert.equal(formatReviewStatus(null), "待复盘");
});

test("史馆成功率格式化：无样本时不伪装成 0%", () => {
  assert.equal(formatSuccessRate(null), "暂无可计算样本");
  assert.equal(formatSuccessRate(0.666), "67%");
});

test("史馆筛选查询：裁剪空白并忽略空条件", () => {
  assert.equal(
    buildArchiveFilterQuery({
      type: "REPLY",
      matterType: "  漕运  ",
      department: "",
      limit: 20,
    }),
    "type=REPLY&matterType=%E6%BC%95%E8%BF%90&limit=20",
  );
});

test("史馆页面展示归档证据的事实绑定与 MCP 访问溯源", async () => {
  const source = await readFile(new URL("./page.tsx", import.meta.url), "utf8");
  assert.match(source, /evidenceReferences/);
  assert.match(source, /category/);
  assert.match(source, /dataScope/);
  assert.match(source, /subject/);
  assert.match(source, /jurisdiction/);
  assert.match(source, /accessUrl/);
  assert.match(source, /accessMetadata/);
  assert.match(source, /MCP/);
});
