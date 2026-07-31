import assert from "node:assert/strict";
import test from "node:test";

import {
  projectQintianDecisionRadar,
  type QintianDecisionRadarInput,
} from "./qintianDecisionRadar.ts";

const IDLE: QintianDecisionRadarInput = {
  decreeText: "",
  draftResult: null,
  draftPending: false,
  draftError: null,
  uiState: { phase: "idle" },
};

test("没有当前旨意时只显示导览", () => {
  const view = projectQintianDecisionRadar(IDLE);

  assert.equal(view.mode, "GUIDE");
  assert.equal(view.provenance, "导览");
  assert.match(view.summary, /如何下旨/);
  assert.deepEqual(view.sections.map((section) => section.label), [
    "从这里开始",
    "示例问题",
  ]);
});

test("输入旨意后教程退出主区域并切换为当前旨意检查", () => {
  const view = projectQintianDecisionRadar({
    ...IDLE,
    decreeText: "评估是否应该在今年扩建工厂",
  });

  assert.equal(view.mode, "FRAMING");
  assert.equal(view.provenance, "当前旨意检查");
  assert.deepEqual(view.sections.map((section) => section.label), [
    "天时判断",
    "关键未知",
    "风险红线",
    "改变判断的信号",
    "最低成本验证",
    "复核建议",
  ]);
  assert.doesNotMatch(JSON.stringify(view), /系统使用指导|如何使用朝堂/);
});

test("拟旨完成后提示核对草案假设而不是声称正式预测", () => {
  const view = projectQintianDecisionRadar({
    ...IDLE,
    decreeText: "评估扩建工厂",
    draftResult: {
      status: "DRAFT_READY",
      version: 1,
      fingerprint: "fp",
      understanding: "需要评估扩建时机",
      expert_example: "先验证订单再分阶段扩建",
      recommendation_reason: "避免一次性承担不可逆成本",
      assumptions: ["未来六个月订单保持稳定"],
      revision_prompt: "",
      draft: {
        objective: "评估扩建",
        scope: [],
        exclusions: [],
        input_materials: [],
        material_gaps: [],
        key_questions: [],
        departments: [],
        execution_steps: [],
        deliverables: [],
        completion_criteria: [],
        permissions_and_limits: [],
        current_status: "DRAFT_READY",
      },
      decree_text: "请户部与工部评估扩建",
    },
    draftPending: false,
    draftError: null,
  });

  assert.equal(view.mode, "DRAFT_READY");
  assert.match(JSON.stringify(view), /未来六个月订单保持稳定/);
  assert.doesNotMatch(JSON.stringify(view), /成功率|正式预测已完成/);
});

test("提交中只说明等待真实回奏", () => {
  const view = projectQintianDecisionRadar({
    ...IDLE,
    decreeText: "评估扩建工厂",
    uiState: { phase: "submitting" },
  });

  assert.equal(view.mode, "IN_REVIEW");
  assert.match(view.summary, /等待真实回奏/);
});

test("成功回奏后进入正式回奏复核并引用真实部门", () => {
  const view = projectQintianDecisionRadar({
    ...IDLE,
    decreeText: "评估扩建工厂",
    uiState: {
      phase: "success",
      chancellor: "丞相",
      routeType: "multi",
      rationale: "涉及预算与建设",
      processingPath: ["丞相", "户部", "工部", "军机处", "丞相"],
      departments: ["户部", "工部"],
      ministryOpinions: [],
      councilVerdict: "建议分阶段验证",
      finalVerdict: "先验证订单再扩建",
      recommendations: ["核实订单", "测算现金流", "设置退出条件"],
      artifacts: [],
    },
  });

  assert.equal(view.mode, "REPLY_READY");
  assert.equal(view.provenance, "正式回奏复核");
  assert.match(JSON.stringify(view), /户部、工部/);
  assert.match(JSON.stringify(view), /先验证订单再扩建/);
});

test("失败状态明确阻断判断并给出恢复动作", () => {
  const view = projectQintianDecisionRadar({
    ...IDLE,
    decreeText: "评估扩建工厂",
    draftError: "拟旨暂不可用",
    uiState: { phase: "error", message: "下旨处理失败" },
  });

  assert.equal(view.mode, "BLOCKED");
  assert.match(view.summary, /不能形成可靠判断/);
  assert.match(JSON.stringify(view), /重试|补充/);
});

test("所有页面事实投影都不伪造概率和实时外部信号", () => {
  const views = [
    projectQintianDecisionRadar(IDLE),
    projectQintianDecisionRadar({ ...IDLE, decreeText: "测试" }),
    projectQintianDecisionRadar({
      ...IDLE,
      decreeText: "测试",
      draftPending: true,
    }),
  ];

  for (const view of views) {
    const rendered = JSON.stringify(view);
    assert.doesNotMatch(rendered, /\d+%|实时信号|预测已完成|触发器已登记/);
  }
});
