/**
 * 吏部 · 激励司 · 期权激励 ESOP（2026-06-29）
 *
 * 专业期权实务：期权池 → 授予 → 4年vesting+1年cliff归属 → 行权成本 → 账面收益。
 * 🔴 红线(铁律9)：期权涉真股权=不可逆+法律，本引擎只做**方案咨询/测算**，真授股必须转刑部+专业律师。
 * 纯函数。缺关键参数则标缺不替判。
 */
export interface EsopInput {
  totalShares: number;        // 总股本
  poolPct: number;            // 期权池占比(建议0.1-0.2)
  grantShares: number;        // 本次授予数
  strikePrice: number;        // 行权价(元/股,应≥授予时公允价)
  vestYears?: number;         // 归属年限,默认4
  cliffMonths?: number;       // cliff,默认12
  monthsElapsed: number;      // 已过月数
  currentValuation?: number | null; // 当前每股估值(算账面收益)
}
export interface EsopResult {
  poolShares: number;
  grantPctOfCompany: number;  // 占公司比例(%)
  vestedShares: number;
  vestedPct: number;          // 归属进度%
  exerciseCost: number;       // 行权成本=已归属×行权价
  paperGain: number | null;   // 账面收益=(估值-行权价)×已归属
  note: string;
  redline: string;
}
export function calcEsop(input: EsopInput): EsopResult {
  const vestYears = input.vestYears ?? 4;
  const cliffMonths = input.cliffMonths ?? 12;
  const totalMonths = vestYears * 12;
  const poolShares = Math.round(input.totalShares * input.poolPct);
  const grantPctOfCompany = Math.round((input.grantShares / input.totalShares) * 10000) / 100;

  // 归属:未过cliff=0;过cliff后按月线性,封顶授予数
  let vestedShares = 0;
  if (input.monthsElapsed >= cliffMonths) {
    vestedShares = Math.min(input.grantShares, Math.round(input.grantShares * (input.monthsElapsed / totalMonths)));
  }
  const vestedPct = Math.round((vestedShares / input.grantShares) * 1000) / 10;
  const exerciseCost = Math.round(vestedShares * input.strikePrice);
  const paperGain = input.currentValuation != null ? Math.round((input.currentValuation - input.strikePrice) * vestedShares) : null;

  const note =
    input.monthsElapsed < cliffMonths
      ? `未过 ${cliffMonths} 月 cliff，归属 0（满1年才解锁首批）`
      : `授予 ${input.grantShares} 股(占公司${grantPctOfCompany}%)，已归属 ${vestedShares}(${vestedPct}%)，行权成本 ${exerciseCost} 元` + (paperGain != null ? `，账面收益 ${paperGain} 元` : '');
  return {
    poolShares, grantPctOfCompany, vestedShares, vestedPct, exerciseCost, paperGain,
    note,
    redline: '🔴 期权=真股权,不可逆+法律风险:行权价须≥公允价(税务)、设离职回购、并购/IPO加速条款——真授股必转刑部+律师,前端只测算',
  };
}
