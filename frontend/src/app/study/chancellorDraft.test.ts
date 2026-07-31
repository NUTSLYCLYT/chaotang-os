import assert from "node:assert/strict";
import test from "node:test";

import {
  canIssueChancellorDraft,
  draftDepartmentDisplayRows,
  requestChancellorDraft,
} from "./chancellorDraft.ts";

test("拟旨请求只调用同源 BFF，并透传版本", async () => {
  const requests: Array<{ input: string; body: string }> = [];
  const result = await requestChancellorDraft(
    " 我想赚钱 ",
    2,
    async (input, init) => {
      requests.push({ input: String(input), body: String(init?.body) });
      return Response.json({
        status: "CLARIFYING",
        version: 2,
        fingerprint: "a".repeat(64),
        understanding: "理解",
        expert_example: "案例",
        recommendation_reason: "理由",
        assumptions: [],
        revision_prompt: "修改",
        draft: null,
      });
    },
  );

  assert.equal(result.ok, true);
  assert.equal(requests[0].input, "/api/drafts/chancellor");
  assert.deepEqual(JSON.parse(requests[0].body), {
    messages: [{ role: "user", content: "我想赚钱" }],
    version: 2,
  });
});

test("下旨资格按实际执行正文的规范化长度判断", () => {
  const completeDraft = {
    objective: "生成财务报表",
    scope: Array.from({ length: 30 }, (_, index) =>
      `财务数据范围 ${index}: ${"明细".repeat(80)}`),
    exclusions: [],
    input_materials: ["财务资料"],
    material_gaps: [],
    key_questions: ["数据是否完整"],
    departments: [{
      department: "户部",
      bureaus: ["会计司"],
      role: "主管",
      reason: "负责财务事项",
      responsibility: "核对并编制报表",
      expected_output: "财务报表",
    }],
    execution_steps: ["核对数据"],
    deliverables: ["财务报表"],
    completion_criteria: ["核对完成"],
    permissions_and_limits: ["不修改原始数据"],
    current_status: "DRAFT_READY" as const,
  };
  assert.ok(JSON.stringify(completeDraft).length > 2000);
  const base = {
    status: "DRAFT_READY" as const,
    version: 1,
    fingerprint: "a".repeat(64),
    understanding: "理解",
    expert_example: "范例",
    recommendation_reason: "理由",
    assumptions: [],
    revision_prompt: "修改",
    draft: completeDraft,
  };

  for (const [text, expected] of [
    [" ", false],
    ["旨", true],
    ["旨".repeat(2000), true],
    [` ${"旨".repeat(2000)} `, true],
    ["旨".repeat(2001), false],
  ] as const) {
    assert.equal(canIssueChancellorDraft({
      ...base,
      decree_text: text,
    }), expected);
  }

  assert.equal(canIssueChancellorDraft({
    ...base,
    decree_text: "请户部会计司生成管理层综合财务报表。",
  }), true);
});

test("只有完整的 DRAFT_READY 草案允许下旨", () => {
  const completeDraft = {
    objective: "生成财务报表",
    scope: ["核对财务数据"],
    exclusions: [],
    input_materials: ["已提供的财务资料"],
    material_gaps: [],
    key_questions: ["数据是否完整"],
    departments: [{
      department: "户部",
      bureaus: ["会计司"],
      role: "主审",
      reason: "负责财务事项",
      responsibility: "核对并编制报表",
      expected_output: "财务报表",
    }],
    execution_steps: ["核对数据", "编制报表"],
    deliverables: ["财务报表"],
    completion_criteria: ["报表勾稽关系通过"],
    permissions_and_limits: ["不修改原始数据"],
    current_status: "DRAFT_READY" as const,
  };
  const base = {
    version: 1,
    fingerprint: "a".repeat(64),
    understanding: "理解",
    expert_example: "案例",
    recommendation_reason: "理由",
    assumptions: [],
    revision_prompt: "修改",
    decree_text: null,
  };
  assert.equal(canIssueChancellorDraft({ ...base, status: "CLARIFYING", draft: null }), false);
  assert.equal(canIssueChancellorDraft({ ...base, status: "DRAFT_READY", draft: null }), false);
  assert.equal(canIssueChancellorDraft({ ...base, status: "DRAFT_READY", draft: completeDraft, decree_text: null }), false);
  assert.equal(canIssueChancellorDraft({
    ...base,
    status: "DRAFT_READY",
    draft: completeDraft,
    decree_text: "正式草案",
  }), true);
});

test("部门展示投影保留部门和多司批准顺序，并完整绑定六项字段", () => {
  assert.deepEqual(draftDepartmentDisplayRows([
    {
      department: "户部",
      bureaus: ["会计司", "审计司"],
      role: "主管",
      reason: "负责财务事项",
      responsibility: "编制并校验报表",
      expected_output: "管理层财务报表",
    },
    {
      department: "工部",
      bureaus: ["营缮司"],
      role: "会办",
      reason: "核实施工事项",
      responsibility: "复核工程进度",
      expected_output: "工程进度说明",
    },
  ]), [
    {
      department: "户部",
      bureaus: "会计司、审计司",
      role: "主管",
      reason: "负责财务事项",
      responsibility: "编制并校验报表",
      expectedOutput: "管理层财务报表",
    },
    {
      department: "工部",
      bureaus: "营缮司",
      role: "会办",
      reason: "核实施工事项",
      responsibility: "复核工程进度",
      expectedOutput: "工程进度说明",
    },
  ]);
});
