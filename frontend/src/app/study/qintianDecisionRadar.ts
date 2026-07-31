import type { ChancellorDraftResult } from "./chancellorDraft.ts";
import type { DecreeUiState } from "./decreeStatus.ts";

export type QintianDecisionRadarMode =
  | "GUIDE"
  | "FRAMING"
  | "DRAFT_READY"
  | "IN_REVIEW"
  | "REPLY_READY"
  | "BLOCKED";

export interface QintianDecisionRadarSection {
  label: string;
  items: string[];
}

export interface QintianDecisionRadarView {
  mode: QintianDecisionRadarMode;
  provenance: "导览" | "当前旨意检查" | "正式回奏复核";
  title: string;
  summary: string;
  sections: QintianDecisionRadarSection[];
  disclaimer: string;
}

export interface QintianDecisionRadarInput {
  decreeText: string;
  draftResult: ChancellorDraftResult | null;
  draftPending: boolean;
  draftError: string | null;
  uiState: DecreeUiState;
}

const DECISION_LABELS = [
  "天时判断",
  "关键未知",
  "风险红线",
  "改变判断的信号",
  "最低成本验证",
  "复核建议",
] as const;

function decisionSections(items: string[][]): QintianDecisionRadarSection[] {
  return DECISION_LABELS.map((label, index) => ({
    label,
    items: items[index] ?? [],
  }));
}

function currentDecisionView(
  mode: Exclude<QintianDecisionRadarMode, "GUIDE" | "REPLY_READY">,
  summary: string,
  items: string[][],
): QintianDecisionRadarView {
  return {
    mode,
    provenance: "当前旨意检查",
    title: "钦天监 · 决策雷达",
    summary,
    sections: decisionSections(items),
    disclaimer: "以下为当前页面事实的决策检查，不是正式预测，也不会触发执行。",
  };
}

export function projectQintianDecisionRadar(
  input: QintianDecisionRadarInput,
): QintianDecisionRadarView {
  if (input.draftError || input.uiState.phase === "error") {
    return currentDecisionView(
      "BLOCKED",
      "当前信息链路受阻，不能形成可靠判断。",
      [
        ["暂停扩大承诺，先恢复可验证的信息链路。"],
        ["失败发生在拟旨还是正式办理？当前输入是否仍完整？"],
        ["不得把失败状态解释成已经办理或已经否决。"],
        ["重试成功并得到真实结果后，判断才可能改变。"],
        ["保留当前旨意，补充缺失信息后重试。"],
        ["恢复后重新核对旨意、草案版本与正式回奏。"],
      ],
    );
  }

  if (input.uiState.phase === "submitting") {
    return currentDecisionView(
      "IN_REVIEW",
      "正式办理进行中；等待真实回奏，不推测中间结论。",
      [
        ["此时不追加不可逆承诺，等待受权流程返回。"],
        ["尚未知各部意见、证据采用情况和最终结论。"],
        ["处理中状态不代表批准、归档或执行完成。"],
        ["只有真实回奏返回，当前判断才进入复核。"],
        ["无需重复下旨；保留页面并等待本次请求结束。"],
        ["回奏到达后立即核对结论、建议和参与部门。"],
      ],
    );
  }

  if (input.uiState.phase === "success") {
    const departments = input.uiState.departments.join("、");
    return {
      mode: "REPLY_READY",
      provenance: "正式回奏复核",
      title: "钦天监 · 回奏复核",
      summary: input.uiState.finalVerdict,
      sections: decisionSections([
        [`已有 ${departments} 的正式办理结果；先判断建议的行动窗口。`],
        [input.uiState.rationale],
        ["付款、合同、公开承诺和不可逆交付仍需用户明确确认。"],
        [`若参与部门的新证据推翻“${input.uiState.finalVerdict}”，应重新审议。`],
        [input.uiState.recommendations[0] ?? "先验证最关键的一条建议。"],
        ["在首个建议完成后复核，不把本次回奏当作永久结论。"],
      ]),
      disclaimer: "此处只复核真实回奏；钦天监没有改变回奏或启动执行的权限。",
    };
  }

  const normalizedDecree = input.decreeText.trim();
  if (!normalizedDecree && !input.draftResult && !input.draftPending) {
    return {
      mode: "GUIDE",
      provenance: "导览",
      title: "钦天监 · 使用指导",
      summary: "先了解如何下旨，再用时机、风险和反事实检查你的决定。",
      sections: [
        {
          label: "从这里开始",
          items: [
            "在御前输入框写清目标、期限和不能接受的结果。",
            "先拟旨核对理解，再由你亲自确认是否正式下旨。",
          ],
        },
        {
          label: "示例问题",
          items: [
            "什么信息会改变当前判断？",
            "如果现在不做，三个月后最可能后悔什么？",
            "哪一步会让损失变得不可逆？",
          ],
        },
      ],
      disclaimer: "导览只解释系统用法，不构成对具体事项的判断。",
    };
  }

  if (input.draftResult?.status === "DRAFT_READY") {
    const assumptions = input.draftResult.assumptions.length > 0
      ? input.draftResult.assumptions
      : ["草案没有列出明确假设，正式下旨前应补齐。"];
    return currentDecisionView(
      "DRAFT_READY",
      "草案已形成；现在应核对假设、红线与退出条件。",
      [
        ["草案可供确认，但尚未进入正式执行。"],
        assumptions,
        ["付款、合同、公开承诺和不可逆交付必须明确人工确认。"],
        ["核心假设被证伪、期限变化或证据过期时，应停止沿用草案。"],
        [input.draftResult.expert_example || "先验证影响结论最大的一个假设。"],
        ["正式下旨前复核一次；取得首批真实结果后再次复核。"],
      ],
    );
  }

  return currentDecisionView(
    "FRAMING",
    input.draftPending
      ? "丞相正在拟旨；先检查哪些信息必须写进草案。"
      : "当前事项仍在界定；先把会改变选择的信息写清楚。",
    [
      ["先区分现在必须决定的部分与可以等待的部分。"],
      ["目标期限是什么？成功标准是什么？不行动的代价是什么？"],
      ["付款、合同、公开承诺和不可逆交付是否存在？"],
      ["哪些可观察事实出现后，应推进、暂停或改道？"],
      ["先补一条最能区分不同选择的证据。"],
      ["在期限、成本或关键假设变化时重新检查。"],
    ],
  );
}
