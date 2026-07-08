/**
 * lifu-attribution —— 礼部流量增长司·归因 + 单位经济学(吸收业界标准,纯函数闭式)。
 *
 * 吸收(开源研究 块1,捞公式非整搬):
 *  · 启发式多触点归因 first/last/linear/time-decay/U-shaped(GA/Ads 事实标准定义)。
 *    time-decay 半衰期 H=7 天:wᵢ=2^(-Δtᵢ/H);U-shaped 40/20/40。
 *  · 单位经济学:LTV=ARPA×毛利率/月流失率;LTV:CAC(3:1 地板,Skok);回收期=CAC/(月ARPA×毛利)。
 *  · 病毒系数 K=邀请数×邀请转化率(K>1 自增长,McClure/First Round)。
 * 纯函数闭式·零依赖。**Markov removal-effect / Shapley 需重数据,留后端(铁律9),前端不硬造。**
 * 诚实:缺输入返回 null 不编;归因模型选择会影响结论,标 model。
 */

export type AttributionModel = 'first' | 'last' | 'linear' | 'time_decay' | 'u_shaped';

export interface Touchpoint {
  channel: string;
  /** 距转化的天数(0=转化当天)。 */
  daysBeforeConversion: number;
}

const HALF_LIFE_DAYS = 7;

/** 单条转化旅程 → 各渠道功劳(0-1,和为1)。 */
export function attributeJourney(journey: Touchpoint[], model: AttributionModel): Record<string, number> {
  const credit: Record<string, number> = {};
  const n = journey.length;
  if (n === 0) return credit;

  let weights: number[];
  if (model === 'first') weights = journey.map((_, i) => (i === 0 ? 1 : 0));
  else if (model === 'last') weights = journey.map((_, i) => (i === n - 1 ? 1 : 0));
  else if (model === 'linear') weights = journey.map(() => 1 / n);
  else if (model === 'time_decay') {
    const raw = journey.map((t) => Math.pow(2, -t.daysBeforeConversion / HALF_LIFE_DAYS));
    const sum = raw.reduce((a, b) => a + b, 0) || 1;
    weights = raw.map((w) => w / sum);
  } else {
    // u_shaped 40/20/40
    if (n === 1) weights = [1];
    else if (n === 2) weights = [0.5, 0.5];
    else {
      const mid = (0.2 / (n - 2));
      weights = journey.map((_, i) => (i === 0 || i === n - 1 ? 0.4 : mid));
    }
  }
  journey.forEach((t, i) => {
    credit[t.channel] = (credit[t.channel] ?? 0) + weights[i];
  });
  return credit;
}

export interface UnitEconomicsInput {
  /** 单用户月均收入。 */
  arpa: number;
  /** 毛利率 0-1。 */
  grossMargin: number;
  /** 月流失率 0-1。 */
  monthlyChurn: number;
  /** 获客成本。 */
  cac: number;
}

export interface UnitEconomics {
  ltv: number | null;
  ltvCacRatio: number | null;
  paybackMonths: number | null;
  verdict: 'healthy' | 'ok' | 'unhealthy' | 'insufficient';
  note: string;
}

export function unitEconomics(i: UnitEconomicsInput): UnitEconomics {
  if (!(i.arpa > 0) || !(i.grossMargin > 0) || !(i.monthlyChurn > 0) || !(i.cac > 0)) {
    return { ltv: null, ltvCacRatio: null, paybackMonths: null, verdict: 'insufficient', note: '输入不全(ARPA/毛利/流失/CAC),先补数据' };
  }
  const ltv = Math.round((i.arpa * i.grossMargin) / i.monthlyChurn);
  const ratio = Math.round((ltv / i.cac) * 10) / 10;
  const payback = Math.round((i.cac / (i.arpa * i.grossMargin)) * 10) / 10;
  const verdict = ratio >= 3 ? 'healthy' : ratio >= 1 ? 'ok' : 'unhealthy';
  const note = verdict === 'healthy' ? `LTV:CAC ${ratio}:1 健康(≥3地板)` : verdict === 'ok' ? `LTV:CAC ${ratio}:1 偏低,优化获客或留存` : `LTV:CAC ${ratio}:1 亏,获客不可持续`;
  return { ltv, ltvCacRatio: ratio, paybackMonths: payback, verdict, note };
}

/** 病毒系数 K=邀请数×邀请转化率;K>1 自增长。 */
export function kFactor(invitesPerUser: number, inviteConversionRate: number): { k: number; viral: boolean } {
  const k = Math.round(invitesPerUser * inviteConversionRate * 100) / 100;
  return { k, viral: k > 1 };
}
