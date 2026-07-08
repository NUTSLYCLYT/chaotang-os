/**
 * 兵部 · 单据跨部裁决合成（deal-verdict）· 2026-07-01
 *
 * 护城河：读一个 deal（将来自 Twenty opportunity + 户部成本 + 合同条款），
 * 合成「兵部报价 + 刑部合规 + 一句裁决」——这是 CRM 永远没有的跨部御前裁决。
 *
 * 铁律6：调各部真引擎（quote-sanity 兵、payment-compliance 刑），**不重算**。
 * 纯函数、可单测；将来 twenty-client 读 opportunity 填 DealInput、把 verdict 写回。
 */
import { assessQuoteSanity, quoteSanityVerdict, type QuoteSanityLevel } from './quote-sanity';
import { assessPaymentCompliance, paymentComplianceVerdict, type PaymentRiskLevel } from '../../xingbu/lib/payment-compliance';

export interface DealInput {
  opportunityName: string;
  customer: string;
  /** 户部真成本（¥/台）；null=未核定，兵部不编报价。 */
  cost: number | null;
  /** 毛利红线%，默认 20。 */
  marginFloorPct?: number;
  /** 合同付款条款（刑部合规看，可空）。 */
  paymentTerms?: string;
}

export interface QuoteTier {
  tier: string;
  marginPct: number;
  sell: number;
  verdict: QuoteSanityLevel;
}

export interface DealVerdict {
  opportunityName: string;
  customer: string;
  /** 兵部三档报价（成本派生 + 御史巡查）；成本缺则空。 */
  quotes: QuoteTier[];
  /** 刑部合规裁决。 */
  compliance: { verdict: PaymentRiskLevel; messages: string[] };
  /** 建议档位（标准档），成本缺则 null。 */
  recommendedTier: string | null;
  /** 一句跨部裁决合成。 */
  recommendation: string;
  /** 写回 Twenty opportunity 的字段（幂等、标 source）。 */
  writeBack: Record<string, string | number | null>;
}

const TIERS = [
  { tier: '抢单', marginPct: 20 },
  { tier: '标准', marginPct: 30 },
  { tier: '保守', marginPct: 40 },
] as const;

/** 跨部合成：户部成本→兵部报价(御史巡查) + 刑部合规 → 一句裁决。 */
export function synthesizeDealVerdict(input: DealInput): DealVerdict {
  const floor = input.marginFloorPct ?? 20;

  // 兵部：成本 → 三档报价 + 御史 quote-sanity
  const quotes: QuoteTier[] = input.cost == null
    ? []
    : TIERS.map((t) => {
        const sell = Math.round(input.cost! / (1 - t.marginPct / 100));
        return { tier: t.tier, marginPct: t.marginPct, sell, verdict: quoteSanityVerdict(assessQuoteSanity(input.cost, sell, floor)) };
      });
  const recommendedTier = quotes.length ? '标准' : null;
  const stdQuote = quotes.find((q) => q.tier === '标准') ?? null;

  // 刑部：合规
  const complianceRisks = input.paymentTerms ? assessPaymentCompliance(input.paymentTerms) : [];
  const complianceVerdict = input.paymentTerms ? paymentComplianceVerdict(complianceRisks) : 'ok';

  // 合成一句裁决
  const parts: string[] = [];
  if (input.cost == null) {
    parts.push('成本未核定，兵部不出报价——先补户部真成本。');
  } else {
    parts.push(`报${recommendedTier}档 ¥${stdQuote?.sell.toLocaleString('zh-CN')}（毛利 30%）`);
  }
  if (complianceVerdict === 'flag') parts.push('刑部拦：账期/条款高风险 → 先锁违约金、缩账期');
  else if (complianceVerdict === 'warn') parts.push('刑部提示：回款账期偏长，注意跟催');
  const recommendation = parts.join('；') + '。';

  return {
    opportunityName: input.opportunityName,
    customer: input.customer,
    quotes,
    compliance: { verdict: complianceVerdict, messages: complianceRisks.map((r) => r.message) },
    recommendedTier,
    recommendation,
    writeBack: {
      chaotang_cost: input.cost,
      chaotang_quote_std: stdQuote?.sell ?? null,
      chaotang_compliance: complianceVerdict,
      chaotang_verdict: recommendation,
      chaotang_source: '朝堂·御前裁决', // 标 source（铁律13.2.2），幂等按 opportunity id 覆盖
    },
  };
}
