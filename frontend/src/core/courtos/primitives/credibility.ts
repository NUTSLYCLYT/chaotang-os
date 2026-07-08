/**
 * 可信度加权（达利欧 · 吏部护城河 · 2026-06-29）
 *
 * 天才设计④：吏部沉淀"谁的判断历来准"——推荐人/面试官的历史命中率 → 加权系数。
 * 时间越久越准，是别人抄不走的复利数据资产。纯函数。样本不足则不加权(不冤枉新人)。
 */
export interface JudgeRecord {
  judge: string;
  decisions: number; // 历史判断次数(推荐/面试通过)
  correct: number; // 后来证明对的(留存/绩优)
}
export type CredTier = 'trusted' | 'normal' | 'questionable' | 'unproven';
export const CRED_TIER_CN: Record<CredTier, string> = { trusted: '可信·加权', normal: '一般', questionable: '存疑·降权', unproven: '样本不足·暂不加权' };
export interface CredibilityScore {
  judge: string;
  hitRate: number | null;
  weight: number; // 加权系数
  tier: CredTier;
  note: string;
}
export function credibilityWeight(r: JudgeRecord, minSample = 5): CredibilityScore {
  if (r.decisions < minSample) {
    return { judge: r.judge, hitRate: r.decisions ? Math.round((r.correct / r.decisions) * 100) / 100 : null, weight: 1.0, tier: 'unproven', note: `${r.judge}：仅 ${r.decisions} 次判断，样本不足，暂不加权` };
  }
  const hitRate = Math.round((r.correct / r.decisions) * 100) / 100;
  const tier: CredTier = hitRate >= 0.8 ? 'trusted' : hitRate >= 0.5 ? 'normal' : 'questionable';
  const weight = hitRate >= 0.8 ? 1.5 : hitRate >= 0.5 ? 1.0 : 0.6;
  return { judge: r.judge, hitRate, weight, tier, note: `${r.judge}：判 ${r.decisions} 中 ${r.correct}（命中 ${Math.round(hitRate * 100)}%）→ ${CRED_TIER_CN[tier]}(×${weight})` };
}
/** 加权合并一组带可信度的判断(分数)。 */
export function weightedScore(opinions: { score: number; weight: number }[]): number | null {
  const totalW = opinions.reduce((s, o) => s + o.weight, 0);
  if (totalW === 0) return null;
  return Math.round(opinions.reduce((s, o) => s + o.score * o.weight, 0) / totalW);
}
