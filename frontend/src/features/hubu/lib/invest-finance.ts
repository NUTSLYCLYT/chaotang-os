/**
 * 投资司 · 真财务计算引擎（NPV / IRR / 回收期）+ 内外对比 + 外部数据扣子（2026-06-28）
 *
 * 司三类模式里的「引擎司」模板：用确定性财务算法（numpy-financial 等价的纯函数），
 * 缺数据则诚实标缺、绝不编（费曼/铁律13.2）。
 *   - 内外对比：你的 IRR vs 资金成本/行业基准 → 划算不划算（不是只看"几倍回报"）。
 *   - 外部数据扣子：Benchmark.source 预留 connector，未来插行业数据/资金成本 API。
 * 其余引擎司（出纳/会计/预算/成本）照此 shape：纯函数算 + 内外对比 + 外部扣子 + 缺证诚实。
 */

/** 净现值：cashflows[0] 为初始投入(负)，后续为各期净回报。rate=每期贴现率。 */
export function npv(rate: number, cashflows: number[]): number {
  return cashflows.reduce((acc, cf, t) => acc + cf / Math.pow(1 + rate, t), 0);
}

/** 内部收益率：使 NPV=0 的 rate。二分法求解，无符号变化(永不回正/永不亏)→ null(不编)。 */
export function irr(cashflows: number[]): number | null {
  if (cashflows.length < 2) return null;
  const hasNeg = cashflows.some((c) => c < 0);
  const hasPos = cashflows.some((c) => c > 0);
  if (!hasNeg || !hasPos) return null; // 没有"先投后收"结构，IRR 无意义
  let lo = -0.9999;
  let hi = 10; // 上限 1000%/期
  const f = (r: number) => npv(r, cashflows);
  if (f(lo) * f(hi) > 0) return null; // 区间内无解
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    const v = f(mid);
    if (Math.abs(v) < 1e-6) return Math.round(mid * 10000) / 10000;
    if (f(lo) * v < 0) hi = mid;
    else lo = mid;
  }
  return Math.round(((lo + hi) / 2) * 10000) / 10000;
}

/** 回收期：累计现金流首次转正的期数（线性插值到小数期）。永不回正→ null。 */
export function paybackPeriod(cashflows: number[]): number | null {
  let cum = 0;
  for (let t = 0; t < cashflows.length; t++) {
    const prev = cum;
    cum += cashflows[t];
    if (cum >= 0 && t > 0) {
      const need = -prev;
      return Math.round((t - 1 + need / cashflows[t]) * 100) / 100;
    }
  }
  return null;
}

export type InvestVerdict = 'worth' | 'marginal' | 'not_worth' | 'insufficient_data';

export interface InvestInput {
  /** 初始投入（元，正数）。 */
  outlay: number | null;
  /** 各期净回报（元）。空或全 0 → 缺证。 */
  returns: number[];
  /** 每期贴现率（资金成本，小数；默认取 benchmark.hurdleRate）。 */
  discountRate?: number;
}

/** 外部数据扣子：行业/资金成本基准。source 标来源（含可信度链），预留 connector。 */
export interface Benchmark {
  source: 'user' | 'jinyiwei' | 'default';
  /** 门槛收益率（资金成本/最低可接受回报，每期小数）。 */
  hurdleRate: number;
  /** 行业平均 IRR（对比用，可选；来自锦衣卫核实的外部数据）。 */
  industryIrr?: number;
}

export interface InvestResult {
  npv: number | null;
  irr: number | null;
  payback: number | null;
  verdict: InvestVerdict;
  /** 内外对比一句话："你 IRR 18% vs 资金成本 8% / 行业 15% → 划算"。 */
  comparison: string | null;
  /** 缺哪些证据（显性，禁静默）。 */
  missing: string[];
  /** 外部数据扣子说明：当前基准来源 + 未来可插的 connector。 */
  externalHook: { benchmarkSource: string; pluggable: string[] };
}

const DEFAULT_BENCHMARK: Benchmark = { source: 'default', hurdleRate: 0.08 };

/** 评估一笔投资：真 NPV/IRR/回收期 + 内外对比 + 外部扣子。纯函数，缺则标缺不编。 */
export function evaluateInvestment(input: InvestInput, benchmark: Benchmark = DEFAULT_BENCHMARK): InvestResult {
  const missing: string[] = [];
  if (input.outlay == null || input.outlay <= 0) missing.push('初始投入金额');
  const realReturns = input.returns.filter((r) => r !== 0);
  if (realReturns.length === 0) missing.push('各期预期回报');

  const externalHook = {
    benchmarkSource: benchmark.source === 'default' ? '默认资金成本 8%（未接外部基准）' : `${benchmark.source} 基准`,
    pluggable: ['行业IRR(锦衣卫核实)', '真实资金成本(银行/财报)', '同行毛利(外部对标)'],
  };

  if (missing.length > 0) {
    return { npv: null, irr: null, payback: null, verdict: 'insufficient_data', comparison: null, missing, externalHook };
  }

  const rate = input.discountRate ?? benchmark.hurdleRate;
  const cashflows = [-(input.outlay as number), ...input.returns];
  const npvVal = Math.round(npv(rate, cashflows));
  const irrVal = irr(cashflows);
  const payback = paybackPeriod(cashflows);

  // 内外对比：IRR vs 资金成本(门槛) + 行业(若有外部数据)
  let comparison: string | null = null;
  let verdict: InvestVerdict = 'marginal';
  if (irrVal != null) {
    const irrPct = Math.round(irrVal * 100);
    const hurdlePct = Math.round(benchmark.hurdleRate * 100);
    const vsHurdle = irrVal >= benchmark.hurdleRate * 1.5 ? '远超' : irrVal >= benchmark.hurdleRate ? '高于' : '低于';
    verdict = irrVal < benchmark.hurdleRate ? 'not_worth' : irrVal >= benchmark.hurdleRate * 1.5 ? 'worth' : 'marginal';
    const indStr = benchmark.industryIrr != null ? ` / 行业 ${Math.round(benchmark.industryIrr * 100)}%` : '';
    comparison = `你的年化回报(IRR) ${irrPct}% ${vsHurdle}资金成本 ${hurdlePct}%${indStr} → ${verdict === 'worth' ? '划算' : verdict === 'not_worth' ? '不划算' : '临界·需补论证'}`;
  }

  return { npv: npvVal, irr: irrVal, payback, verdict, comparison, missing, externalHook };
}
