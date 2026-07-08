/**
 * 御史巡城兵#2 · 兵部报价合理性巡查（quote-sanity）
 *
 * 御史台监察制衡①层（巡城·确定性·零LLM）。对标户部 cost-sanity，盯兵部域的"明显错"：
 * 报价低于成本 = 亏本（最毒，按此外发直接亏钱）；毛利低于红线 = 风险；报价畸高 = 脱离市场。
 *
 * 只采证+评级，不定性（侦查/审判分离·定性归御史台）。纯函数、可单测。
 * 毛利率约定 = 毛利 / 售价（兵部对外口径，与 marginToDocument 一致）。
 */
export type QuoteSanityLevel = 'ok' | 'warn' | 'flag';

export interface QuoteSanityFinding {
  level: QuoteSanityLevel;
  code: string;
  message: string;
}

const yuan = (n: number): string => `¥${Math.round(n).toLocaleString('zh-CN')}`;

/**
 * 巡查一档报价（cost 成本、sell 售价、marginFloorPct 毛利红线%）。
 * 任一为空不评——巡城兵不对没数的事说话。
 */
export function assessQuoteSanity(cost: number | null, sell: number | null, marginFloorPct = 20): QuoteSanityFinding[] {
  if (cost == null || sell == null) return [];
  const findings: QuoteSanityFinding[] = [];

  // ① 报价 ≤ 成本 = 亏本（最毒，对外即亏钱）→ flag 拦
  if (sell <= cost) {
    findings.push({
      level: 'flag',
      code: 'below_cost',
      message: `报价 ${yuan(sell)} ≤ 成本 ${yuan(cost)} —— 亏本对外！御史拦，禁外发，转户部+兵部联审。`,
    });
  } else {
    // ② 毛利低于红线 = 风险
    const marginPct = ((sell - cost) / sell) * 100;
    if (marginPct < marginFloorPct) {
      findings.push({
        level: 'warn',
        code: 'thin_margin',
        message: `毛利 ${marginPct.toFixed(1)}% 低于 ${marginFloorPct}% 红线，御史提示复核（薄利/抢单需老板朱批）。`,
      });
    }
  }

  // ③ 报价畸高（> 成本 5 倍 = 毛利 80%+）→ 提示核竞品，免脱离市场
  if (sell > cost * 5) {
    findings.push({
      level: 'warn',
      code: 'over_priced',
      message: `报价是成本的 ${(sell / cost).toFixed(1)} 倍，毛利畸高，御史提示核竞品价，免报价脱离市场被弃单。`,
    });
  }

  return findings.length
    ? findings
    : [{ level: 'ok', code: 'sane', message: `报价 ${yuan(sell)} 健康：高于成本、毛利达红线、未脱离市场。` }];
}

/** 一句话总评。flag > warn > ok。 */
export function quoteSanityVerdict(findings: QuoteSanityFinding[]): QuoteSanityLevel {
  if (findings.some((f) => f.level === 'flag')) return 'flag';
  if (findings.some((f) => f.level === 'warn')) return 'warn';
  return 'ok';
}
