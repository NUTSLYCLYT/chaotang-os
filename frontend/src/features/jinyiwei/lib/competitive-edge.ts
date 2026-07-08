/**
 * 锦衣卫 · 竞争优势灯（2026-06-28）
 *
 * 用户原则：锦衣卫比对我们的价格(买/卖)是否有竞争优势，销售和供应链都比。
 * 两类灯：
 *   ① 毛利健康灯：内部真信号(我们自己的毛利率)，现在就能亮，不需外部。
 *   ② 竞争优势灯：需锦衣卫的外部市场价 → 比对。无外部价 → 诚实⚪「缺外部基准·待锦衣卫核实」，
 *      **绝不编竞品价**(铁律13.2红线：编一个外部价让老板误判，是灾难)。
 * 纯函数本地。
 */

export type EdgeLight = 'good' | 'mid' | 'bad' | 'unknown';

export const EDGE_DOT: Record<EdgeLight, string> = { good: '#5FB97A', mid: '#E5B84D', bad: '#E5604D', unknown: '#8B93A7' };

export interface EdgeResult {
  light: EdgeLight;
  cn: string;
  note: string;
}

/** 毛利健康灯（内部真信号）：>30%🟢健康 / 15-30%🟡偏薄 / <15%🔴危险。 */
export function marginHealth(marginPct: number | null): EdgeResult {
  if (marginPct == null) return { light: 'unknown', cn: '⚪毛利待裁', note: '缺买价或卖价，毛利待补' };
  if (marginPct >= 30) return { light: 'good', cn: '🟢毛利健康', note: `毛利 ${marginPct}% 健康，有让利/抗涨空间` };
  if (marginPct >= 15) return { light: 'mid', cn: '🟡毛利偏薄', note: `毛利 ${marginPct}% 偏薄，慎让价` };
  return { light: 'bad', cn: '🔴毛利危险', note: `毛利 ${marginPct}% 过薄，一让价就亏` };
}

/**
 * 竞争优势灯：我方价 vs 锦衣卫外部市场价。
 * 买侧：我们买得更便宜=优势；卖侧：我们卖价不高于市场=有竞争力。
 * 无外部价 → ⚪缺外部基准(不编竞品价)。
 */
export function competitiveEdge(side: 'buy' | 'sell', ourPrice: number | null, marketPrice: number | null): EdgeResult {
  if (ourPrice == null) return { light: 'unknown', cn: '⚪缺我方价', note: '我方价待补' };
  if (marketPrice == null) return { light: 'unknown', cn: '⚪缺外部基准', note: '锦衣卫尚无该品外部市场价，竞争优势待核实(不编竞品价)' };
  const ratio = ourPrice / marketPrice;
  if (side === 'buy') {
    // 买得越便宜越好
    if (ratio <= 0.95) return { light: 'good', cn: '🟢采购有优势', note: `我们买 ${ourPrice} vs 市场 ${marketPrice} → 便宜 ${Math.round((1 - ratio) * 100)}%` };
    if (ratio <= 1.05) return { light: 'mid', cn: '🟡采购持平', note: `我们买 ${ourPrice} ≈ 市场 ${marketPrice}` };
    return { light: 'bad', cn: '🔴采购吃亏', note: `我们买 ${ourPrice} > 市场 ${marketPrice}，贵 ${Math.round((ratio - 1) * 100)}%，该换供应商/议价` };
  }
  // 卖侧：卖价不高于市场=有竞争力(太高=客户跑)
  if (ratio <= 1.0) return { light: 'good', cn: '🟢售价有竞争力', note: `我们卖 ${ourPrice} ≤ 市场 ${marketPrice}，价格有竞争力` };
  if (ratio <= 1.1) return { light: 'mid', cn: '🟡售价略高', note: `我们卖 ${ourPrice} 略高于市场 ${marketPrice}` };
  return { light: 'bad', cn: '🔴售价偏高', note: `我们卖 ${ourPrice} 明显高于市场 ${marketPrice}，客户可能流失` };
}
