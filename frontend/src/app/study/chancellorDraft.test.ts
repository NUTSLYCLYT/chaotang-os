import assert from "node:assert/strict";
import test from "node:test";
import { confirmStudyIntent, type ConfirmedStudyIntent } from "./studyIntentConfirmation.ts";

function confirmedGoal(goal: string): ConfirmedStudyIntent {
  const snapshot = { ownerId: "synthetic-owner", normalizedOriginalGoal: goal,
    exactLatestChancellorRestatement: "精确确认的丞相理解", consultationGeneration: 1, contextGeneration: 0 };
  return confirmStudyIntent(snapshot, snapshot)!;
}

import {
  EMPTY_CHANCELLOR_DRAFT_COMPOSER_STATE,
  canIssueChancellorDraft,
  draftDepartmentDisplayRows,
  projectDraftConfirmation,
  requestChancellorDraft,
  resolveOwnerScopedChancellorDraftComposerState,
  type OwnerScopedChancellorDraftComposerState,
} from "./chancellorDraft.ts";

test("unconfirmed raw goals cannot cross the draft network boundary", async () => {
  let requests = 0;
  // @ts-expect-error Runtime callers must also be rejected before fetch.
  const result = await requestChancellorDraft("未经用户确认的目标", 1, async () => {
    requests += 1;
    return Response.json({
      status: "CLARIFYING", version: 1, fingerprint: "a".repeat(64),
      understanding: "理解", expert_example: "案例", draft: null,
    });
  });
  assert.equal(requests, 0);
  assert.equal(result.ok, false);
});

test("structural and JSON confirmation clones are rejected before any fetch", async () => {
  const confirmed = confirmedGoal("报价草案");
  for (const forged of [{ ...confirmed }, JSON.parse(JSON.stringify(confirmed))]) {
    let requests = 0;
    const result = await requestChancellorDraft(forged as ConfirmedStudyIntent, 1, async () => {
      requests += 1;
      throw new Error("must not request");
    });
    assert.equal(requests, 0);
    assert.deepEqual(result, { ok: false });
  }
});

test("owner-scoped composer hides A draft synchronously and disables B issue action", () => {
  const aDraft = {
    status: "DRAFT_READY" as const,
    version: 3,
    fingerprint: "a".repeat(64),
    understanding: "A 理解",
    expert_example: "A 拟旨",
    recommendation_reason: "A 理由",
    assumptions: [],
    revision_prompt: "A 修改提示",
    draft: {
      objective: "A 事项",
      scope: ["A 范围"],
      exclusions: [],
      input_materials: ["A 材料"],
      material_gaps: [],
      key_questions: ["A 问题"],
      departments: [{
        department: "户部",
        bureaus: ["会计司"],
        role: "主办",
        reason: "A 原因",
        responsibility: "A 职责",
        expected_output: "A 产出",
      }],
      execution_steps: ["A 步骤"],
      deliverables: ["A 交付"],
      completion_criteria: ["A 标准"],
      permissions_and_limits: ["A 限制"],
      current_status: "DRAFT_READY" as const,
    },
    decree_text: "owner A private decree",
  };
  const envelope: OwnerScopedChancellorDraftComposerState = {
    ownerId: "owner-a",
    value: {
      decreeText: "owner A private source",
      draftResult: aDraft,
      draftPending: false,
      draftError: null,
    },
  };

  assert.equal(
    resolveOwnerScopedChancellorDraftComposerState(envelope, "owner-a").draftResult,
    aDraft,
  );
  const bState = resolveOwnerScopedChancellorDraftComposerState(envelope, "owner-b");
  assert.deepEqual(bState, EMPTY_CHANCELLOR_DRAFT_COMPOSER_STATE);
  assert.equal(canIssueChancellorDraft(bState.draftResult), false);
});

test("拟旨请求只调用同源 BFF，并透传版本", async () => {
  const requests: Array<{ input: string; body: string }> = [];
  const result = await requestChancellorDraft(
    confirmedGoal(" 我想赚钱 "),
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
    messages: [{ role: "user", content: "[用户原始目标]\n我想赚钱\n\n[用户已确认的丞相理解]\n精确确认的丞相理解" }],
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

test("无年份财务草案只接受系统补全为 2025 的可下旨响应", async () => {
  const completeDraft = {
    objective: "生成 2025 年财务报表",
    scope: ["2025 年财务数据"],
    exclusions: [],
    input_materials: ["系统内现有财务数据"],
    material_gaps: [],
    key_questions: [],
    departments: [{
      department: "户部",
      bureaus: ["会计司"],
      role: "主审",
      reason: "负责财务报表",
      responsibility: "生成并校验报表",
      expected_output: "2025 年财务报表",
    }],
    execution_steps: ["生成 2025 年报表"],
    deliverables: ["2025 年财务报表"],
    completion_criteria: ["2025 年报表可下载"],
    permissions_and_limits: ["只读系统内数据"],
    current_status: "DRAFT_READY" as const,
  };
  const canonical = "读取系统内既有财务数据并生成可下载的 2025 年财务报表";
  const ready = await requestChancellorDraft(confirmedGoal("读取系统内既有财务数据并生成可下载财务报表"), 1, async () =>
    Response.json({
      status: "DRAFT_READY",
      version: 1,
      fingerprint: "b".repeat(64),
      understanding: "生成财务报表",
      expert_example: canonical,
      recommendation_reason: "采用上一完整年度",
      assumptions: ["参考日期为 2026-08-05，上一完整年度为 2025 年"],
      revision_prompt: "",
      draft: completeDraft,
      decree_text: canonical,
    }));

  assert.equal(ready.ok, true);
  if (!ready.ok) return;
  assert.match(ready.draft.expert_example, /2025/);
  assert.match(ready.draft.decree_text ?? "", /2025/);
  assert.equal(ready.draft.decree_text, ready.draft.expert_example);
  assert.equal(canIssueChancellorDraft(ready.draft), true);
});

test("DRAFT_READY canonical text must equal the executable decree text", async () => {
  const result = await requestChancellorDraft(confirmedGoal("generate the 2025 report"), 1, async () =>
    Response.json({
      status: "DRAFT_READY",
      version: 1,
      fingerprint: "d".repeat(64),
      understanding: "generate the 2025 report",
      expert_example: "generate the 2025 report",
      recommendation_reason: "explicit period",
      assumptions: [],
      revision_prompt: "",
      draft: {
        objective: "generate the 2025 report",
        scope: ["2025"],
        exclusions: [],
        input_materials: [],
        material_gaps: [],
        key_questions: [],
        departments: [],
        execution_steps: [],
        deliverables: ["XLSX"],
        completion_criteria: ["downloadable"],
        permissions_and_limits: ["read only"],
        current_status: "DRAFT_READY",
      },
      decree_text: "generate the 2024 report",
    }),
  );

  assert.deepEqual(result, { ok: false });
});

test("NEEDS_INPUT presents deterministic guidance without an issue action", async () => {
  const result = await requestChancellorDraft(confirmedGoal("generate a report"), 1, async () =>
    Response.json({
      status: "NEEDS_INPUT",
      version: 1,
      fingerprint: "e".repeat(64),
      understanding: "period is ambiguous",
      expert_example: "Please provide a valid accounting period.",
      recommendation_reason: "INVALID_PERIOD",
      assumptions: [],
      revision_prompt: "Please provide a valid year.",
      draft: null,
      decree_text: null,
    }),
  );

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(projectDraftConfirmation(result.draft), {
    visibleCanonicalText: "Please provide a valid accounting period.",
    showIssueAction: false,
  });
  assert.equal(canIssueChancellorDraft(result.draft), false);
});

test("NEEDS_INPUT 响应不得夹带可执行 decree_text", async () => {
  const result = await requestChancellorDraft(confirmedGoal("生成财务报表"), 1, async () =>
    Response.json({
      status: "NEEDS_INPUT",
      version: 1,
      fingerprint: "c".repeat(64),
      understanding: "缺少可用期间",
      expert_example: "",
      recommendation_reason: "需要补充",
      assumptions: [],
      revision_prompt: "请补充年份",
      draft: null,
      decree_text: "不得执行的替换文本",
    }));

  assert.deepEqual(result, { ok: false });
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
