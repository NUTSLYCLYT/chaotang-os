import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  buildArchiveFilterQuery,
  formatArchiveType,
  formatRealityLabel,
  formatReviewStatus,
  formatSuccessRate,
  reviewDraftFromStatus,
  resolveReviewDraft,
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
  const [source, detail] = await Promise.all([
    readFile(new URL("./ShiguanClient.tsx", import.meta.url), "utf8"),
    readFile(
      new URL("../../features/shiguan-visual/ShiguanArchiveDetail.tsx", import.meta.url),
      "utf8",
    ),
  ]);
  assert.match(source, /ShiguanWorkspace/);
  assert.match(detail, /evidenceReferences/);
  assert.match(detail, /category/);
  assert.match(detail, /dataScope/);
  assert.match(detail, /subject/);
  assert.match(detail, /jurisdiction/);
  assert.match(detail, /sourceUrl/);
  assert.match(detail, /accessUrl/);
  assert.match(detail, /accessMetadata/);
  assert.match(detail, /snapshot\.value/);
  assert.match(detail, /snapshot\.unit/);
  assert.match(detail, /formatBusinessTime\(snapshot\.asOf\)/);
  assert.match(detail, /snapshot\.publishedAt/);
  assert.match(detail, /formatBusinessTime\(snapshot\.retrievedAt\)/);
  assert.match(detail, /snapshot\.publisher/);
  assert.match(detail, /snapshot\.sourceType/);
  assert.match(detail, /snapshot\.coverage/);
  assert.match(detail, /snapshot\.licenseNote/);
  assert.match(detail, /snapshot\.quality/);
  assert.match(detail, /snapshot\.stance/);
  assert.match(detail, /snapshot\.contentHash/);
  assert.match(detail, /snapshot\.confidence/);
  assert.match(detail, /snapshot\.evidenceId/);
  assert.match(detail, /reference\.packId/);
  assert.match(detail, /reference\.investigationId/);
  assert.match(detail, /reference\.ordinal/);
  assert.match(detail, /serverId/);
  assert.match(detail, /toolName/);
  assert.match(detail, /MCP/);
  assert.match(detail, /resolveReviewDraft/);
  assert.match(detail, /reviewStatusReviewedAt/);
});

test("review draft follows a same-archive review status refresh", () => {
  const initial = reviewDraftFromStatus(null, null, null);
  const edited = { ...initial, note: "尚未提交的旧值" };
  const refreshed = reviewDraftFromStatus(
    "PARTIAL",
    "新复盘结论",
    "2026-07-24T10:00:00Z",
  );
  assert.deepEqual(initial, {
    status: "OBSERVING",
    note: "",
    revision: "null\u0000null\u0000null",
  });
  assert.deepEqual(resolveReviewDraft(edited, refreshed), refreshed);
});
