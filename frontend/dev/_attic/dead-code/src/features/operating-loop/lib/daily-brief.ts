import { BUILD_BUDGET_SUMMARY, DEPARTMENT_BUILD_BUDGETS } from './build-budget';
import { BUILD_RETROSPECTIVE_SUMMARY, BUILD_RETROSPECTIVES } from './build-retrospective';

export type OperatingSignalType = 'risk' | 'opportunity' | 'decision_needed' | 'execution_followup';
export type OperatingSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface OperatingSignal {
  id: string;
  type: OperatingSignalType;
  title: string;
  summary: string;
  severity: OperatingSeverity;
  source: 'manual' | 'archive' | 'project' | 'customer' | 'finance' | 'external_intel' | 'mock';
  evidence: string[];
  recommendedAction: string;
  createdAt: string;
}

export interface DailyOperatingRecommendation {
  id: string;
  title: string;
  whyNow: string;
  suggestedCommand: string;
  priority: 1 | 2 | 3;
  recommendedMinisters: string[];
}

export interface DailyOperatingBrief {
  id: string;
  date: string;
  summary: string;
  signals: OperatingSignal[];
  recommendations: DailyOperatingRecommendation[];
  generatedAt: string;
}

export const DAILY_OPERATING_BRIEF: DailyOperatingBrief = {
  id: 'brief-2026-06-01',
  date: '2026-06-01',
  generatedAt: '2026-06-01T08:00:00.000Z',
  summary: '今日主线：先把朝堂 OS 从页面演示推进到经营闭环，重点处理合作评估、项目风险和 7 天作战计划。',
  signals: [
    {
      id: 'signal-xiamen-ai',
      type: 'decision_needed',
      title: '厦门 AI 公司合作方案待裁决',
      summary: '合作结构、投入边界、招商话术和 90 天交付路径需要统一判断。',
      severity: 'high',
      source: 'manual',
      evidence: ['合作意向已形成', '涉及股权与投入', '需要多部门会审'],
      recommendedAction: '召集户部、刑部、礼部、锦衣卫、钦天监会审。',
      createdAt: '2026-06-01T08:00:00.000Z',
    },
    {
      id: 'signal-xigang-opc',
      type: 'risk',
      title: '西港 OPC 项目推进风险需复核',
      summary: '商业模式、执行路径和关键资源仍需压实，避免后续反复。',
      severity: 'high',
      source: 'project',
      evidence: ['项目价值高', '路径复杂', '需要招商材料和风险审查'],
      recommendedAction: '进入军机处做商业模式、执行路径与风险会审。',
      createdAt: '2026-06-01T07:40:00.000Z',
    },
    {
      id: 'signal-chaotang-7day',
      type: 'execution_followup',
      title: '朝堂 OS 需要 7 天开发作战计划',
      summary: '当前已有上书房、军机处、三省、史馆等模块，应收束为一条可演示闭环。',
      severity: 'medium',
      source: 'project',
      evidence: ['上书房已是主入口', '军机处已有 SSE 作战流', '史馆已有归档面'],
      recommendedAction: '召集工部、兵部、礼部制定 7 天 MVP 作战计划。',
      createdAt: '2026-06-01T07:20:00.000Z',
    },
    {
      id: 'signal-hubu-build-budget',
      type: 'decision_needed',
      title: '户部建议先审批部门建设预算',
      summary: `当前有 ${BUILD_BUDGET_SUMMARY.pendingCount} 个建设项目待批，申请预算 ${BUILD_BUDGET_SUMMARY.totalRequested}，需先按 ROI 和现金流排优先级。`,
      severity: 'high',
      source: 'finance',
      evidence: [
        `平均 ROI ${BUILD_BUDGET_SUMMARY.avgRoi}`,
        `现金余量 ${BUILD_BUDGET_SUMMARY.cashReserve}`,
        '工部建设其他部门前需要户部给出预算边界',
      ],
      recommendedAction:
        '召集户部与工部，先审批部门建设预算，按 ROI、现金流压力和经营闭环价值确定开工顺序。',
      createdAt: '2026-06-01T08:10:00.000Z',
    },
    {
      id: 'signal-shiguan-build-retro',
      type: 'execution_followup',
      title: '史馆已沉淀部门建设复盘',
      summary: `当前已有 ${BUILD_RETROSPECTIVE_SUMMARY.total} 条建设复盘，平均评分 ${BUILD_RETROSPECTIVE_SUMMARY.avgScore}，可反哺下一轮工部和户部建设。`,
      severity: 'medium',
      source: 'archive',
      evidence: BUILD_RETROSPECTIVES.slice(0, 3).map((item) => `${item.title} · ${item.score} 分`),
      recommendedAction: BUILD_RETROSPECTIVE_SUMMARY.nextSuggestion,
      createdAt: '2026-06-01T08:30:00.000Z',
    },
  ],
  recommendations: [
    {
      id: 'op-rec-hubu-budget-first',
      title: '先审户部建设预算与 ROI',
      whyNow: `${DEPARTMENT_BUILD_BUDGETS[0]?.title ?? '户部建设任务'} 已进入待批，若不先定预算边界，工部后续建设会缺少资源约束。`,
      suggestedCommand:
        '召集户部、工部、军机处，审批部门建设预算，优先处理户部经营预算中台 v1，明确预算上限、ROI、现金流压力、验收标准和开工顺序。',
      priority: 1,
      recommendedMinisters: ['户部', '工部', '军机处', '史馆'],
    },
    {
      id: 'op-rec-xiamen-ai',
      title: '评估厦门 AI 公司合作方案',
      whyNow: '这件事涉及投入、股权、招商和交付，必须先给老板一份可裁决奏折。',
      suggestedCommand:
        '召集户部、刑部、礼部、锦衣卫、钦天监，评估厦门 AI 公司合作方案，重点审查商业模式、股权风险、招商话术和 90 天执行路径。',
      priority: 1,
      recommendedMinisters: ['户部', '刑部', '礼部', '锦衣卫', '钦天监'],
    },
    {
      id: 'op-rec-shiguan-feedback',
      title: '让史馆复盘反哺下一轮建设',
      whyNow: '工部和户部已形成建设链路，但要成为可复制系统，必须把执行结果沉淀为下次可用的经验。',
      suggestedCommand:
        '召集史馆、工部、户部，复盘本轮部门建设，输出目标、过程、结果、证据、风险、评分和下一轮建设建议，并反哺上书房每日经营建议。',
      priority: 2,
      recommendedMinisters: ['史馆', '工部', '户部', '军机处'],
    },
    {
      id: 'op-rec-xigang-opc',
      title: '审查西港 OPC 项目推进风险',
      whyNow: '项目价值高但路径复杂，先做军机会审能减少后续反复和资源浪费。',
      suggestedCommand:
        '让军机处评估西港 OPC 项目的商业模式、执行路径、合作风险和下一步招商材料。',
      priority: 2,
      recommendedMinisters: ['户部', '刑部', '礼部', '兵部', '锦衣卫'],
    },
    {
      id: 'op-rec-chaotang-7day',
      title: '生成朝堂 OS 7 天开发作战计划',
      whyNow: '当前模块很多，最需要把每日建议、军机处、奏折、批示、军令状、史馆归档串成闭环。',
      suggestedCommand:
        '召集工部、兵部、礼部，制定朝堂 OS 7 天 MVP 作战计划，目标是打通每日建议、军机处、奏折、批示、军令状和史馆归档。',
      priority: 3,
      recommendedMinisters: ['工部', '兵部', '礼部'],
    },
  ],
};
