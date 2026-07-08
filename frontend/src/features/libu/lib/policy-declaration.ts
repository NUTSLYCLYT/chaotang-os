/**
 * 吏部 · 申报司 · 高新技术企业认定 资格自检（2026-06-28）
 *
 * 真金白银：高新认定后企业所得税 25% → 15%（省 10 个点）。多数小老板漏报。
 * 按国家高新认定**公开标准**做规则自检（不是数据表解析，是条件核对）：
 *   研发费占比(按收入分档) / 高新产品收入占比≥60% / 科技人员占比≥10% / 自主知识产权≥1。
 * 纯函数本地。缺数据 → 标缺不替你判达标(费曼)。达标≠已认定，仍需走申报流程(诚实)。
 */

export interface GaoxinInput {
  revenue: number | null; // 年销售收入(元)
  rdExpense: number | null; // 近三年年均研发费(元)
  hiTechRevenue: number | null; // 高新技术产品收入(元)
  totalStaff: number | null; // 职工总数
  techStaff: number | null; // 科技人员数
  ipCount: number | null; // 自主知识产权数
  taxableProfit?: number | null; // 应纳税所得额(元,可选,算省税)
}

export interface GaoxinCriterion {
  name: string;
  required: string;
  actual: string;
  pass: boolean | null; // null=缺数据
}

export interface GaoxinCheck {
  eligible: boolean | null;
  criteria: GaoxinCriterion[];
  missing: string[];
  /** 估算年省税(元)：应纳税所得额 × (25%-15%)；缺利润则 null。 */
  taxSaving: number | null;
  note: string;
}

/** 研发费占比门槛按收入分档（国家标准）。 */
function rdThreshold(revenue: number): number {
  if (revenue <= 50_000_000) return 0.05; // ≤5000万 → 5%
  if (revenue <= 200_000_000) return 0.04; // 5000万-2亿 → 4%
  return 0.03; // >2亿 → 3%
}

function pct(n: number): string {
  return `${Math.round(n * 1000) / 10}%`;
}

export function checkGaoxinEligibility(input: GaoxinInput): GaoxinCheck {
  const missing: string[] = [];
  const criteria: GaoxinCriterion[] = [];

  // 1. 研发费占比
  if (input.revenue == null || input.revenue <= 0) missing.push('年销售收入');
  if (input.rdExpense == null) missing.push('研发费');
  if (input.revenue && input.revenue > 0 && input.rdExpense != null) {
    const ratio = input.rdExpense / input.revenue;
    const th = rdThreshold(input.revenue);
    criteria.push({ name: '研发费占比', required: `≥${pct(th)}(按收入分档)`, actual: pct(ratio), pass: ratio >= th });
  } else {
    criteria.push({ name: '研发费占比', required: '≥3-5%(按收入分档)', actual: '缺数据', pass: null });
  }

  // 2. 高新产品收入占比 ≥60%
  if (input.hiTechRevenue == null) missing.push('高新产品收入');
  if (input.revenue && input.revenue > 0 && input.hiTechRevenue != null) {
    const ratio = input.hiTechRevenue / input.revenue;
    criteria.push({ name: '高新产品收入占比', required: '≥60%', actual: pct(ratio), pass: ratio >= 0.6 });
  } else {
    criteria.push({ name: '高新产品收入占比', required: '≥60%', actual: '缺数据', pass: null });
  }

  // 3. 科技人员占比 ≥10%
  if (input.totalStaff == null || input.totalStaff <= 0) missing.push('职工总数');
  if (input.techStaff == null) missing.push('科技人员数');
  if (input.totalStaff && input.totalStaff > 0 && input.techStaff != null) {
    const ratio = input.techStaff / input.totalStaff;
    criteria.push({ name: '科技人员占比', required: '≥10%', actual: pct(ratio), pass: ratio >= 0.1 });
  } else {
    criteria.push({ name: '科技人员占比', required: '≥10%', actual: '缺数据', pass: null });
  }

  // 4. 自主知识产权 ≥1
  if (input.ipCount == null) missing.push('知识产权数');
  criteria.push({ name: '自主知识产权', required: '≥1项', actual: input.ipCount == null ? '缺数据' : `${input.ipCount}项`, pass: input.ipCount == null ? null : input.ipCount >= 1 });

  const anyNull = criteria.some((c) => c.pass === null);
  const allPass = criteria.every((c) => c.pass === true);
  const eligible = anyNull ? null : allPass;

  const taxSaving = eligible === true && input.taxableProfit != null ? Math.round(input.taxableProfit * 0.1) : null;

  const failedNames = criteria.filter((c) => c.pass === false).map((c) => c.name);
  const note =
    eligible === null
      ? `资格待定：缺${missing.join('、')}——补齐再判（吏部不替你判达标）`
      : eligible
        ? `4 项全达标，建议申报高新（所得税 25%→15%）${taxSaving != null ? `，估年省税 ${Math.round(taxSaving / 10000)} 万` : '；给应纳税所得额可算省税'}。注：达标≠已认定，仍需走申报流程`
        : `未达标：${failedNames.join('、')} 不够，先补这些再申报`;

  return { eligible, criteria, missing, taxSaving, note };
}
