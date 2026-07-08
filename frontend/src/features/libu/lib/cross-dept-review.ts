/**
 * 吏部 · 跨部门会审编排（2026-06-29）
 *
 * 天才设计③的 HR 实例：复用通用「盖章流水线」原语(core/courtos/primitives/stamp-pipeline)，
 * 只写"招人/辞退该召哪些部门、各盖什么章"的 HR 编排。原语不重写(铁律2)。
 */
import { mergeStamps, type Stamp, type StampReview } from '@/core/courtos/primitives/stamp-pipeline';

export type { Stamp, StampReview } from '@/core/courtos/primitives/stamp-pipeline';

export interface HiringCrossInput {
  role: string;
  talentMatch: number | null; // 选才司:画像匹配 0-100
  backgroundClear: boolean | null; // 锦衣卫:背调
  roi: number | null; // 户部:ROI
  hasBudget: boolean;
  competeRisk: boolean; // 刑部:竞业
}

/** 招人盖章流水线：选才司 + 锦衣卫 + 户部 + 刑部 各盖章 → 合并。 */
export function reviewHiringCrossDept(input: HiringCrossInput): StampReview {
  const stamps: Stamp[] = [
    {
      dept: 'libu', role: '选才司·画像匹配',
      verdict: input.talentMatch == null ? 'caution' : input.talentMatch >= 70 ? 'pass' : input.talentMatch >= 45 ? 'caution' : 'block',
      finding: input.talentMatch == null ? '缺画像评估' : `画像匹配 ${input.talentMatch}`,
    },
    {
      dept: 'jinyiwei', role: '锦衣卫·背调',
      verdict: input.backgroundClear == null ? 'caution' : input.backgroundClear ? 'pass' : 'block',
      finding: input.backgroundClear == null ? '背调待做' : input.backgroundClear ? '背调无异常' : '背调发现异常',
    },
    {
      dept: 'hubu', role: '户部·预算/ROI',
      verdict: !input.hasBudget ? 'block' : input.roi == null ? 'caution' : input.roi >= 1 ? 'pass' : 'block',
      finding: !input.hasBudget ? '没预算' : input.roi == null ? '缺ROI测算' : input.roi >= 1 ? `ROI ${input.roi} 划算` : `ROI ${input.roi} 养不起`,
    },
    {
      dept: 'xingbu', role: '刑部·竞业/劳动合规',
      verdict: input.competeRisk ? 'caution' : 'pass',
      finding: input.competeRisk ? '候选人在竞品在职→查竞业限制再接触' : '无竞业风险',
    },
  ];
  return mergeStamps(`招聘 ${input.role}`, stamps);
}
