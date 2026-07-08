/**
 * 吏部 · 激励司 · 销售提成方案（2026-06-29）
 *
 * 专业提成实务：累进阶梯(每档业绩按该档率) + 回款挂钩(提成×回款率) + 封顶。
 * 防"为冲业绩乱让价/赊销"——回款挂钩是关键。纯函数。
 */
export interface CommissionTier { from: number; rate: number; } // 业绩区间起点 → 该段费率
export interface CommissionInput {
  sales: number;              // 业绩(签单额)
  collected?: number | null;  // 回款额(提成挂回款,防赊销)
  tiers: CommissionTier[];    // 累进阶梯(按from升序)
  cap?: number | null;        // 提成封顶
}
export interface CommissionResult {
  grossCommission: number;    // 阶梯算出的毛提成
  collectionRatio: number;    // 回款率
  payable: number;            // 实发(×回款率,封顶)
  effectiveRate: number;      // 实际提成率
  note: string;
}
export function calcCommission(input: CommissionInput): CommissionResult {
  const tiers = [...input.tiers].sort((a, b) => a.from - b.from);
  let gross = 0;
  for (let i = 0; i < tiers.length; i++) {
    const from = tiers[i].from;
    const to = i + 1 < tiers.length ? tiers[i + 1].from : Infinity;
    if (input.sales > from) {
      const portion = Math.min(input.sales, to) - from;
      gross += portion * tiers[i].rate;
    }
  }
  gross = Math.round(gross);
  const collectionRatio = input.collected != null && input.sales > 0 ? Math.round((input.collected / input.sales) * 100) / 100 : 1;
  let payable = Math.round(gross * collectionRatio);
  if (input.cap != null && payable > input.cap) payable = input.cap;
  const effectiveRate = input.sales > 0 ? Math.round((payable / input.sales) * 1000) / 10 : 0;
  const note =
    `毛提成 ${gross}` +
    (input.collected != null ? ` × 回款率 ${Math.round(collectionRatio * 100)}% = ${Math.round(gross * collectionRatio)}` : '') +
    (input.cap != null && Math.round(gross * collectionRatio) > input.cap ? `（封顶 ${input.cap}）` : '') +
    ` → 实发 ${payable}（实际率 ${effectiveRate}%）`;
  return { grossCommission: gross, collectionRatio, payable, effectiveRate, note };
}
