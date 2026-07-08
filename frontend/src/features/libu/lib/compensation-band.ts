/**
 * 吏部 · 薪酬司 · 宽带薪酬 + 定薪/调薪（2026-06-29）
 *
 * 专业薪酬实务：市场中位(50分位) → 带宽(min/mid/max) → 定薪(按经验定分位) → 调薪(绩效×当前分位矩阵)。
 * 纯函数。市场中位缺则标缺(可由锦衣卫填行业薪资基准)。
 */

export interface CompBand {
  level: string;
  min: number | null;
  mid: number | null;
  max: number | null;
  note: string;
}

/** 建薪酬带宽：mid=市场50分位，min/max=mid±bandWidth(默认±20%)。 */
export function buildCompBand(level: string, marketMid: number | null, bandWidth = 0.2): CompBand {
  if (marketMid == null || marketMid <= 0) {
    return { level, min: null, mid: null, max: null, note: `${level}：缺市场中位薪——可由锦衣卫填行业薪资基准` };
  }
  const min = Math.round(marketMid * (1 - bandWidth));
  const max = Math.round(marketMid * (1 + bandWidth));
  return { level, min, mid: marketMid, max, note: `${level} 带宽：${min} / ${marketMid} / ${max}（min/中位/max）` };
}

export type CandidateTier = 'junior' | 'experienced' | 'expert';

/** 定薪建议：新人定低分位，有经验定中位，专家定高分位。 */
export function suggestOffer(band: CompBand, tier: CandidateTier): { salary: number | null; percentile: string; note: string } {
  if (band.min == null || band.mid == null || band.max == null) {
    return { salary: null, percentile: '—', note: '缺带宽，无法定薪' };
  }
  const map: Record<CandidateTier, { salary: number; pct: string }> = {
    junior: { salary: Math.round((band.min + band.mid) / 2), pct: '25-50分位' },
    experienced: { salary: band.mid, pct: '50分位' },
    expert: { salary: Math.round((band.mid + band.max) / 2), pct: '50-75分位' },
  };
  const { salary, pct } = map[tier];
  return { salary, percentile: pct, note: `建议定薪 ${salary}（${pct}）——留出涨薪空间，别一上来顶格` };
}

export type Performance = 'A' | 'B' | 'C';

/** 调薪矩阵：高绩效+低分位涨最多；低绩效不涨。专业做法——让钱流向"绩优且低薪"的人。 */
export function meritIncrease(currentSalary: number, band: CompBand, performance: Performance): { newSalary: number; pct: number; note: string } {
  if (band.mid == null) return { newSalary: currentSalary, pct: 0, note: '缺带宽，调薪待定' };
  const position = currentSalary / band.mid; // <0.9低分位 / 0.9-1.1中 / >1.1高分位
  const MATRIX: Record<Performance, { low: number; mid: number; high: number }> = {
    A: { low: 0.15, mid: 0.1, high: 0.05 }, // 绩优:低分位涨15%,高分位也涨5%
    B: { low: 0.08, mid: 0.05, high: 0.02 },
    C: { low: 0, mid: 0, high: 0 }, // 绩差不涨
  };
  const bucket = position < 0.9 ? 'low' : position <= 1.1 ? 'mid' : 'high';
  const pct = MATRIX[performance][bucket];
  const newSalary = Math.round(currentSalary * (1 + pct));
  const note =
    pct === 0
      ? `绩效 ${performance}：不调薪`
      : `绩效 ${performance} + ${bucket === 'low' ? '低' : bucket === 'mid' ? '中' : '高'}分位 → 调 ${Math.round(pct * 100)}% 至 ${newSalary}`;
  return { newSalary, pct, note };
}
