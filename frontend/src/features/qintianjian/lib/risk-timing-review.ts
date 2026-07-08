/**
 * 钦天监 · 观天台 · 决策前看证据(非ROI · 2026-07-01)
 *
 * 观天台 = 观星研判台,不是水晶球:给证据充分度/粗置信/最坏情况,绝不"预测一切"(塔勒布)。
 * 真·大数据预测归后端钦天监先知蜂群(铁律9),前端观天台只观测+研判,真预测来了带 sourceLabel 展示。
 * 压测套件通用性:观天台不算钱、算"证据够不够、时机稳不稳"。同一套件(VerdictCard+契约),
 * 走**第二种阶梯** `resolveEvidenceLadder`(证据/置信),而非户部的 ROI 阶梯。
 * 老板输入一个待决策 + 支持信号 + 风险信号 + 尽调质门 → 判可行动/再观察/慎行/缺据。
 * 塔勒布视角:预测=不确定性,绝不替老板给"一定会"的假确定;缺据标缺,风险信号一票拉高不确定。
 * 纯函数,数据不出浏览器(铁律9);真实数据=老板自己的决策情境输入。
 */

import { resolveEvidenceLadder, type EvidenceRung } from '@/features/shared/office-kit/office-review';

export interface RiskTimingInput {
  decision: string; // 待决策(如:现在要不要扩产/进这个大客户)
  supportingSignals: string[]; // 支持"该做"的信号(需求、现金、验证过的样本…)
  explicitRedFlags: string[]; // 明确的风险/反向信号
  hasBaseline: boolean; // 有基线数据(不是拍脑袋)
  hasWorstCase: boolean; // 想过最坏情况
  hasReversibility: boolean; // 评估过可逆性(错了能不能退)
}

export type RiskTimingVerdict = 'act' | 'watch' | 'high_risk' | 'insufficient';

export const RISK_TIMING_VERDICT_CN: Record<RiskTimingVerdict, string> = {
  act: '证据充分·可行动',
  watch: '证据偏薄·再观察',
  high_risk: '高不确定·小注试错',
  insufficient: '缺据·先补',
};

export interface RiskTimingReview {
  decision: string;
  verdict: RiskTimingVerdict;
  /** 粗置信度 = 支持信号 /(支持+风险);无据则 null。绝不当"一定"。 */
  confidence: number | null;
  timingOpinion: string;
  riskOpinion: string;
  redFlags: string[];
  nextStep: string;
  missing: string[];
}

const RUNG_TO_VERDICT: Record<EvidenceRung, RiskTimingVerdict> = {
  ample: 'act',
  thin: 'watch',
  high_uncertainty: 'high_risk',
  insufficient: 'insufficient',
};

export function reviewRiskTiming(input: RiskTimingInput): RiskTimingReview {
  // 未做的尽调 = 风险信号(塔勒布:没想过最坏情况,本身就是最大的风险)。
  const gateFlags: string[] = [];
  if (!input.hasBaseline) gateFlags.push('没基线数据');
  if (!input.hasWorstCase) gateFlags.push('没想过最坏情况');
  if (!input.hasReversibility) gateFlags.push('没评估可逆性');
  const redFlags = [...input.explicitRedFlags, ...gateFlags];

  const missing: string[] = [];
  if (input.supportingSignals.length === 0 && input.explicitRedFlags.length === 0) missing.push('判断依据/信号');

  const supportN = input.supportingSignals.length;
  const rung = resolveEvidenceLadder({ missing, supportingSignals: supportN, redFlags });
  const verdict = RUNG_TO_VERDICT[rung];

  const totalN = supportN + redFlags.length;
  const confidence = missing.length === 0 && totalN > 0 ? Math.round((supportN / totalN) * 100) / 100 : null;

  let nextStep: string;
  if (verdict === 'insufficient') {
    nextStep = '先补:' + missing.join('、') + '——没依据的时机判断=赌';
  } else if (verdict === 'high_risk') {
    nextStep = `高不确定源:${redFlags.join('、')}——别重注,先小注试错/补尽调再放大`;
  } else if (verdict === 'watch') {
    nextStep = `支持信号偏少(${supportN} 条)——再观察/多收一两个信号确认,别急动`;
  } else {
    nextStep = `支持信号 ${supportN} 条、尽调齐、无红旗——可行动,但仍设好退出线(塔勒布:留可逆)`;
  }

  const timingOpinion =
    supportN > 0 ? `观天台:支持信号 ${supportN} 条${confidence != null ? `,粗置信 ${confidence}` : ''}` : '观天台:暂无支持信号';
  const riskOpinion = redFlags.length > 0 ? `观天台:不确定源 ${redFlags.length} 项——${redFlags.join('、')}` : '观天台:未见明显风险信号(不等于没有)';

  return { decision: input.decision, verdict, confidence, timingOpinion, riskOpinion, redFlags, nextStep, missing };
}
