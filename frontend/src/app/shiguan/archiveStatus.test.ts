import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildArchiveFilterQuery,
  formatArchiveType,
  formatRealityLabel,
  formatReviewStatus,
  formatSuccessRate,
} from "./archiveStatus.ts";

test("史馆标签格式化：五类档案、真实度与复盘状态都有中文展示", () => {
  assert.equal(formatArchiveType("DECISION"), "决策");
  assert.equal(formatRealityLabel("FALLBACK"), "兜底/演示");
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
      type: "DECISION",
      matterType: "  漕运  ",
      department: "",
      limit: 20,
    }),
    "type=DECISION&matterType=%E6%BC%95%E8%BF%90&limit=20",
  );
});
