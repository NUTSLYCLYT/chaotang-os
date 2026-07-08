/**
 * 吏部 · 培训发展司 · 培训前算账(L&D · 2026-07-01)
 *
 * 杀手场景:一道"给X做个培训"的旨 → 培前先算:值不值 + 缺不缺三件套。
 * 小老板培训最容易踩的雷:没技能gap评估/没计划/没成效标准就砸钱培,培完看不出变化。
 * 质门:培训必须有 技能gap评估 + 培训计划 + 成效衡量标准,否则"先定清楚再培"。
 * ROI = 预期能力提升带来的年增量价值 / 培训投入。纯函数,缺则标缺不替判(铁律9,数据不出浏览器)。
 */

import { resolveDecisionLadder, type DecisionRung } from '@/features/shared/office-kit/office-review';
import { computeRoi } from '@/features/shared/office-kit/finance-capability';

export interface TrainingInput {
  role: string; // 培训对象(岗位/人/团队)
  trainingCost: number | null; // 培训投入(元)
  expectedUpliftValue: number | null; // 预期能力提升带来的年增量价值(元,可选)
  hasGapAssessed: boolean; // 有无技能 gap 评估
  hasPlan: boolean; // 有无培训计划(内容/周期/讲师)
  hasSuccessMetric: boolean; // 有无成效衡量标准(培完怎么算成)
}

export type TrainingVerdict = 'train' | 'define_first' | 'not_worth' | 'insufficient';

export const TRAINING_VERDICT_CN: Record<TrainingVerdict, string> = {
  train: '值得培',
  define_first: '先定清楚再培',
  not_worth: '不值·别砸钱',
  insufficient: '缺证·先补',
};

export interface TrainingReview {
  role: string;
  verdict: TrainingVerdict;
  /** ROI = 预期年增量价值 / 培训投入。 */
  roi: number | null;
  /** 培训发展司:gap/计划/标准齐不齐。 */
  ldOpinion: string;
  /** 户部:投入/ROI。 */
  financeOpinion: string;
  blockers: string[];
  nextStep: string;
  missing: string[];
}

export function reviewTraining(input: TrainingInput): TrainingReview {
  const missing: string[] = [];
  if (input.trainingCost == null || input.trainingCost <= 0) missing.push('培训投入');

  const roi = computeRoi(input.expectedUpliftValue, input.trainingCost); // 点用户部 ROI 能力

  const blockers: string[] = [];
  if (!input.hasGapAssessed) blockers.push('没技能gap评估');
  if (!input.hasPlan) blockers.push('没培训计划');
  if (!input.hasSuccessMetric) blockers.push('没成效衡量标准');

  const RUNG: Record<DecisionRung, TrainingVerdict> = { ok: 'train', gate_fail: 'define_first', value_fail: 'not_worth', insufficient: 'insufficient' };
  const verdict: TrainingVerdict = RUNG[resolveDecisionLadder({ missing, blockers, roi })];
  let nextStep: string;
  if (verdict === 'insufficient') {
    nextStep = '先补:' + missing.join('、');
  } else if (verdict === 'define_first') {
    nextStep = `培之前先定:${blockers.join('、')}——没成效标准的培训=看不出变化的花钱`;
  } else if (verdict === 'not_worth') {
    nextStep = `预期年增量 ${input.expectedUpliftValue} 元 < 投入 ${input.trainingCost} 元(ROI ${roi})——不值,换更省的提升方式`;
  } else {
    nextStep = roi != null ? `投入 ${input.trainingCost} 元,ROI ${roi},值得培——按计划+成效标准执行` : `三件套齐,值得培——按计划执行`;
  }

  const ldOpinion = blockers.length === 0 ? '培训发展司:gap评估/计划/成效标准齐' : `培训发展司:缺 ${blockers.join('、')}`;
  const financeOpinion =
    input.trainingCost != null
      ? `户部:培训投入 ${input.trainingCost} 元${roi != null ? `,ROI ${roi}(预期增量/投入)` : ';给预期年增量可算 ROI'}`
      : '户部:缺培训投入,ROI 待算';

  return { role: input.role, verdict, roi, ldOpinion, financeOpinion, blockers, nextStep, missing };
}
