/**
 * 吏部 · 组织编制司 · 增岗/编制算账(Workforce Planning · 2026-07-01)
 *
 * 杀手场景:一道"再招个人/加个岗"的旨 → 增岗前先算:编制超没超 + 该增还是先挖潜。
 * 小老板最容易踩的雷:业务一忙就加人,人力成本占比悄悄爬到失控,砍时最痛。
 * 质门:增岗必须有 工作量证据 + 考虑过重组/挖潜替代 + 编制预算有余,否则"先挖潜再增"。
 * 人力成本占比 = 总人力成本 / 营收(有营收才算);增量 ROI = 预期增量价值 / 新岗年成本。
 * 纯函数,缺则标缺不替判(铁律9,数据不出浏览器)。
 */

import { resolveDecisionLadder, type DecisionRung } from '@/features/shared/office-kit/office-review';
import { computeRoi } from '@/features/shared/office-kit/finance-capability';

export interface OrgHeadcountInput {
  newRole: string; // 拟增岗位
  currentAnnualLaborCost: number | null; // 当前总人力成本(元/年)
  annualRevenue: number | null; // 年营收(元,可选;有则算人力成本占比)
  newRoleAnnualCost: number | null; // 新岗年成本(元)
  expectedIncrementalValue: number | null; // 新岗预期年增量价值(元,可选)
  hasWorkloadEvidence: boolean; // 有工作量证据(真忙不过来,非拍脑袋)
  hasReorgAlternative: boolean; // 考虑过重组/挖潜/外包替代
  hasBudgetHeadroom: boolean; // 编制预算有余
}

export type OrgHeadcountVerdict = 'add' | 'reorg_first' | 'over_headcount' | 'insufficient';

export const ORG_HEADCOUNT_VERDICT_CN: Record<OrgHeadcountVerdict, string> = {
  add: '该增',
  reorg_first: '先挖潜再增',
  over_headcount: '编制超重·缓增',
  insufficient: '缺证·先补',
};

/** 人力成本占比警戒线(总人力成本/营收);>此值视为编制偏重。 */
const LABOR_RATIO_ALERT = 0.5;

export interface OrgHeadcountReview {
  role: string;
  verdict: OrgHeadcountVerdict;
  /** 增岗后人力成本占比(0-1);无营收则 null。 */
  laborCostRatio: number | null;
  /** 新岗增量 ROI = 预期增量 / 新岗年成本。 */
  incrementalRoi: number | null;
  /** 组织编制司:编制/工作量视角。 */
  orgOpinion: string;
  /** 户部:成本占比/ROI。 */
  financeOpinion: string;
  blockers: string[];
  nextStep: string;
  missing: string[];
}

export function reviewOrgHeadcount(input: OrgHeadcountInput): OrgHeadcountReview {
  const missing: string[] = [];
  if (input.newRoleAnnualCost == null || input.newRoleAnnualCost <= 0) missing.push('新岗年成本');
  if (input.currentAnnualLaborCost == null || input.currentAnnualLaborCost < 0) missing.push('当前总人力成本');

  const postCost =
    input.currentAnnualLaborCost != null && input.newRoleAnnualCost != null
      ? input.currentAnnualLaborCost + input.newRoleAnnualCost
      : null;
  const laborCostRatio =
    postCost != null && input.annualRevenue != null && input.annualRevenue > 0
      ? Math.round((postCost / input.annualRevenue) * 100) / 100
      : null;
  const incrementalRoi = computeRoi(input.expectedIncrementalValue, input.newRoleAnnualCost); // 点用户部 ROI 能力

  const blockers: string[] = [];
  if (!input.hasWorkloadEvidence) blockers.push('没工作量证据');
  if (!input.hasReorgAlternative) blockers.push('没考虑重组/挖潜替代');
  if (!input.hasBudgetHeadroom) blockers.push('编制预算无余');

  const overHeadcount = laborCostRatio != null && laborCostRatio > LABOR_RATIO_ALERT;
  // 编制特有:占比超警戒线且无明确增量 → 也算"价值不足"(除 ROI<1 外的额外触发)。
  const extraValueFail = overHeadcount && !(incrementalRoi != null && incrementalRoi >= 1);

  const RUNG: Record<DecisionRung, OrgHeadcountVerdict> = { ok: 'add', gate_fail: 'reorg_first', value_fail: 'over_headcount', insufficient: 'insufficient' };
  const verdict: OrgHeadcountVerdict = RUNG[resolveDecisionLadder({ missing, blockers, roi: incrementalRoi, extraValueFail })];
  let nextStep: string;
  if (verdict === 'insufficient') {
    nextStep = '先补:' + missing.join('、');
  } else if (verdict === 'reorg_first') {
    nextStep = `增岗前先解:${blockers.join('、')}——业务一忙就加人,是编制失控最常见的起点`;
  } else if (verdict === 'over_headcount') {
    nextStep = extraValueFail
      ? `增岗后人力成本占比 ${Math.round((laborCostRatio ?? 0) * 100)}% > ${LABOR_RATIO_ALERT * 100}% 警戒线,且无明确增量——缓增,先挖潜`
      : `新岗年成本 ${input.newRoleAnnualCost} 元 > 预期增量 ${input.expectedIncrementalValue} 元(ROI ${incrementalRoi})——缓增`;
  } else {
    nextStep = incrementalRoi != null ? `工作量/预算齐,增量 ROI ${incrementalRoi},该增——定岗定编后招` : `工作量/预算齐,该增——先定岗定编`;
  }

  const orgOpinion =
    blockers.length === 0
      ? `组织编制司:工作量证据/重组已考量/预算有余${overHeadcount ? `,但占比 ${Math.round((laborCostRatio ?? 0) * 100)}% 偏高` : ''}`
      : `组织编制司:缺 ${blockers.join('、')}`;
  const financeOpinion =
    laborCostRatio != null
      ? `户部:增岗后人力成本占比 ≈ ${Math.round(laborCostRatio * 100)}%${incrementalRoi != null ? `,增量 ROI ${incrementalRoi}` : ''}`
      : postCost != null
        ? `户部:增岗后总人力成本 ≈ ${postCost} 元;给营收可算占比`
        : '户部:缺成本数据,占比待算';

  return { role: input.newRole, verdict, laborCostRatio, incrementalRoi, orgOpinion, financeOpinion, blockers, nextStep, missing };
}
