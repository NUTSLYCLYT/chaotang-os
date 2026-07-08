/**
 * 刑部 · 合同付款合规巡查（payment-compliance）
 *
 * 接真数据：H盘 各部门备份/市场部/销售合同统计表 的「付款方式」列。
 * 刑部合规视角（卖方风险）：长账期=回款/垫资风险；低预付=垫资风险；条款不明=合规缺口。
 * 对标御史巡城兵：只采证评级，不替判定；纯函数、可单测。
 *
 * 铁律6：刑部读同一份合同，看「合规风险」视角（≠礼部看客户经营），不重算、各取所需。
 */
export type PaymentRiskLevel = 'ok' | 'warn' | 'flag';

export interface PaymentRisk {
  level: PaymentRiskLevel;
  code: string;
  message: string;
}

const norm = (s: unknown): string => String(s ?? '').replace(/\s+/g, '');

/** 从付款条款文本抽预付款% 与 回款账期(月)。 */
export function extractTerms(terms: string): { prepayPct: number | null; accountMonths: number | null } {
  const t = norm(terms);
  const pct = t.match(/(\d+)%/); // 首个百分比 ≈ 预付比例
  const mMonth = t.match(/(?:余款|收到货物后|货到)[^月]*?(\d+)\s*个月/);
  const mDay = t.match(/(?:余款|收到货物后|货到)[^天]*?(\d+)\s*天/);
  const accountMonths = mMonth ? Number(mMonth[1]) : mDay ? Math.round(Number(mDay[1]) / 30) : null;
  return { prepayPct: pct ? Number(pct[1]) : null, accountMonths };
}

/**
 * 巡查一份合同付款条款（卖方合规风险）。
 * 长账期(≥3月)→flag回款风险；低预付(<30%)→warn垫资；条款空→flag合规缺口。
 */
export function assessPaymentCompliance(terms: string): PaymentRisk[] {
  const t = norm(terms);
  if (!t) return [{ level: 'flag', code: 'no_terms', message: '付款条款空白，合规缺口——刑部拦，须补明付款/违约条款。' }];

  const { prepayPct, accountMonths } = extractTerms(terms);
  const out: PaymentRisk[] = [];

  if (accountMonths != null && accountMonths >= 3) {
    out.push({ level: 'flag', code: 'long_receivable', message: `余款账期 ${accountMonths} 个月，回款/垫资风险高——刑部提示锁违约金/缩账期。` });
  } else if (accountMonths != null && accountMonths >= 1) {
    out.push({ level: 'warn', code: 'receivable', message: `余款账期 ${accountMonths} 个月，注意回款跟催。` });
  }

  if (prepayPct != null && prepayPct < 30) {
    out.push({ level: 'warn', code: 'low_prepay', message: `预付仅 ${prepayPct}%，垫资风险，刑部建议提预付比例。` });
  }

  return out.length ? out : [{ level: 'ok', code: 'sound', message: `付款条款稳健${prepayPct != null ? `（预付 ${prepayPct}%）` : ''}。` }];
}

/** 一句话总评。flag > warn > ok。 */
export function paymentComplianceVerdict(risks: PaymentRisk[]): PaymentRiskLevel {
  if (risks.some((r) => r.level === 'flag')) return 'flag';
  if (risks.some((r) => r.level === 'warn')) return 'warn';
  return 'ok';
}

export interface ContractComplianceItem {
  customer: string;
  amount: number | null;
  terms: string;
  verdict: PaymentRiskLevel;
  risks: PaymentRisk[];
}

export interface ComplianceScan {
  items: ContractComplianceItem[];
  /** 有 flag 风险（刑部须处理）。 */
  flagged: ContractComplianceItem[];
  summary: { total: number; flag: number; warn: number; ok: number; flaggedAmount: number };
}

/** 批量合同 → 合规巡查（flag 优先，按金额降序=大单风险先看）。 */
export function buildComplianceScan(contracts: Array<{ customer: string; amount: number | null; terms: string }>): ComplianceScan {
  const items: ContractComplianceItem[] = contracts.map((c) => {
    const risks = assessPaymentCompliance(c.terms);
    return { customer: c.customer, amount: c.amount, terms: c.terms, verdict: paymentComplianceVerdict(risks), risks };
  });
  const flagged = items.filter((i) => i.verdict === 'flag').sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0));
  return {
    items,
    flagged,
    summary: {
      total: items.length,
      flag: items.filter((i) => i.verdict === 'flag').length,
      warn: items.filter((i) => i.verdict === 'warn').length,
      ok: items.filter((i) => i.verdict === 'ok').length,
      flaggedAmount: flagged.reduce((s, i) => s + (i.amount ?? 0), 0),
    },
  };
}
