/**
 * 吏部 · 选才司 · 招人跨部门会审（2026-06-28）
 *
 * 杀手场景②：一道"招个X"的旨 → **选才司 + 户部预算/ROI** 确定性会审 → 招之前先算账。
 * 小老板招人最容易踩的雷：没预算/没成功标准就招，三个月发现养不起。本引擎在招之前显形。
 * 质门(spec §5)：招人必须有预算 + 90天成功标准 + 岗位画像，否则"先定清楚再招"，不是直接招。
 * 含户部年成本逻辑(月薪×12×社保系数)。纯函数，缺则标缺不替判。
 */

import { resolveDecisionLadder, type DecisionRung } from '@/features/shared/office-kit/office-review';
import { annualLaborCost, computeRoi } from '@/features/shared/office-kit/finance-capability';

export interface HiringInput {
  role: string;
  monthlySalary: number | null; // 拟定月薪(元)
  expectedAnnualValue: number | null; // 这岗位预期年产出/价值(元)
  hasBudget: boolean; // 有无预算
  has90DayGoal: boolean; // 有无90天成功标准
  hasJD: boolean; // 有无岗位画像/JD
}

export type HiringVerdict = 'hire' | 'define_first' | 'too_expensive' | 'insufficient';

export const HIRING_VERDICT_CN: Record<HiringVerdict, string> = {
  hire: '可招',
  define_first: '先定清楚再招',
  too_expensive: '养不起·别招',
  insufficient: '缺证·先补',
};

export interface HiringReview {
  role: string;
  verdict: HiringVerdict;
  /** 户部：年成本(月薪×12×1.4社保公积金系数)。 */
  annualCost: number | null;
  /** 户部：ROI = 预期年价值 / 年成本。 */
  roi: number | null;
  /** 选才司：JD/成功标准齐不齐。 */
  selectionOpinion: string;
  /** 户部：成本/ROI。 */
  financeOpinion: string;
  blockers: string[];
  nextStep: string;
  missing: string[];
}

export function reviewHiring(input: HiringInput): HiringReview {
  const missing: string[] = [];
  if (input.monthlySalary == null || input.monthlySalary <= 0) missing.push('拟定月薪');

  // 点用户部能力(铁律6:钱只户部算,吏部不重造 ×1.4/ROI 逻辑)。
  const annualCost = annualLaborCost(input.monthlySalary);
  const roi = computeRoi(input.expectedAnnualValue, annualCost);

  const blockers: string[] = [];
  if (!input.hasBudget) blockers.push('没预算');
  if (!input.has90DayGoal) blockers.push('没90天成功标准');
  if (!input.hasJD) blockers.push('没岗位画像/JD');

  // 裁决阶梯收口到套件(缺证/缺质门/ROI<1/准),各司只映射标签(设计②)。
  const RUNG: Record<DecisionRung, HiringVerdict> = { ok: 'hire', gate_fail: 'define_first', value_fail: 'too_expensive', insufficient: 'insufficient' };
  const verdict: HiringVerdict = RUNG[resolveDecisionLadder({ missing, blockers, roi })];
  let nextStep: string;
  if (verdict === 'insufficient') {
    nextStep = '先补：' + missing.join('、');
  } else if (verdict === 'define_first') {
    nextStep = `招之前先定：${blockers.join('、')}——人事决策最忌"先招了再说"`;
  } else if (verdict === 'too_expensive') {
    nextStep = `这岗位年成本 ${annualCost} 元 > 预期年产出 ${input.expectedAnnualValue} 元（ROI ${roi}）——养不起，重新想清楚要不要招`;
  } else {
    nextStep = roi != null ? `年成本 ${annualCost} 元，ROI ${roi}，可招——按 JD+90天标准招` : `年成本 ${annualCost} 元，预算/标准齐，可招`;
  }

  const selectionOpinion = blockers.length === 0 ? '选才司：JD/90天标准/预算齐' : `选才司：缺 ${blockers.join('、')}`;
  const financeOpinion =
    annualCost != null
      ? `户部：年成本 ≈ ${annualCost} 元（月薪×12×1.4社保）${roi != null ? `，ROI ${roi}（预期产出/成本）` : '；给预期年产出可算 ROI'}`
      : '户部：缺月薪，成本待算';

  return { role: input.role, verdict, annualCost, roi, selectionOpinion, financeOpinion, blockers, nextStep, missing };
}
