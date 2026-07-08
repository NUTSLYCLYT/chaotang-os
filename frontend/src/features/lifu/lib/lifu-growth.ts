/**
 * lifu-growth —— 礼部「流量增长司」本命:渠道 ROI 决策(看真数据投,不凭感觉)。
 *
 * 接地点=老板真实营销账号数据(公众号/视频号/抖音/SEM/线下展会的 投入/转化/营收)。
 * 纯函数·零副作用。定量本命(礼部的"户部 NPV"等价物,但算营销 ROI 不是财务)。
 * 诚实:转化样本太薄(<阈值)不给定论(同 reference-class 防小样本假精确);缺数据标 insufficient,不编。
 * 边界:这是"咨询决策"(看哪个渠道值得投),不替代真投放执行(铁律9)。
 */

export interface ChannelMetrics {
  /** 渠道名(公众号/视频号/抖音/SEM/线下展会…)。 */
  channel: string;
  /** 投入(元)。 */
  spend: number;
  /** 转化数(成交/有效留资)。 */
  conversions: number;
  /** 带来营收(元,可缺)。 */
  revenue?: number;
  /** 点击/曝光(可缺,用于转化率)。 */
  clicks?: number;
}

export type ChannelVerdict = 'scale' | 'keep' | 'cut' | 'insufficient';

export interface ChannelROI {
  channel: string;
  /** 获客成本 = spend/conversions。 */
  cac: number | null;
  /** 广告支出回报 = revenue/spend。 */
  roas: number | null;
  /** 投资回报率 = (revenue-spend)/spend。 */
  roi: number | null;
  conversionRate: number | null;
  /** 转化样本太薄,结论不可尽信。 */
  thin: boolean;
  verdict: ChannelVerdict;
  reason: string;
}

/** 转化样本厚度阈值(低于此只观察不下定论)。 */
const THIN_CONVERSIONS = 10;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function channelROI(m: ChannelMetrics): ChannelROI {
  const cac = m.conversions > 0 ? round2(m.spend / m.conversions) : null;
  const roas = m.revenue != null && m.spend > 0 ? round2(m.revenue / m.spend) : null;
  const roi = m.revenue != null && m.spend > 0 ? round2((m.revenue - m.spend) / m.spend) : null;
  const conversionRate = m.clicks != null && m.clicks > 0 ? round2(m.conversions / m.clicks) : null;
  const thin = m.conversions < THIN_CONVERSIONS;

  let verdict: ChannelVerdict;
  let reason: string;
  if (roas == null) {
    verdict = 'insufficient';
    reason = '缺营收数据,无法判 ROAS,先补数据';
  } else if (thin) {
    verdict = 'keep';
    reason = `转化样本薄(${m.conversions}<${THIN_CONVERSIONS}),先观察不重投也不砍`;
  } else if (roas >= 2) {
    verdict = 'scale';
    reason = `ROAS ${roas} 高,加投`;
  } else if (roas >= 1) {
    verdict = 'keep';
    reason = `ROAS ${roas} 打平偏正,维持优化`;
  } else {
    verdict = 'cut';
    reason = `ROAS ${roas} 亏,砍预算`;
  }
  return { channel: m.channel, cac, roas, roi, conversionRate, thin, verdict, reason };
}

export interface GrowthDecision {
  ranked: ChannelROI[];
  recommendation: string;
}

/** 按 ROAS 排序 + 给"预算搬家"建议(看真数据投,薄数据明示)。 */
export function rankChannels(list: ChannelMetrics[]): GrowthDecision {
  const ranked = list
    .map(channelROI)
    .sort((a, b) => (b.roas ?? -Infinity) - (a.roas ?? -Infinity));

  const scale = ranked.filter((r) => r.verdict === 'scale').map((r) => r.channel);
  const cut = ranked.filter((r) => r.verdict === 'cut').map((r) => r.channel);
  const thinN = ranked.filter((r) => r.thin && r.roas != null).length;

  let rec: string;
  if (scale.length === 0 && cut.length === 0) {
    rec = '暂无明确加投/砍仓信号(多为数据不足或打平),先把转化数据补厚再决策。';
  } else {
    const parts: string[] = [];
    if (cut.length && scale.length) parts.push(`把预算从【${cut.join('、')}】搬到【${scale.join('、')}】`);
    else if (scale.length) parts.push(`加投【${scale.join('、')}】`);
    else if (cut.length) parts.push(`砍【${cut.join('、')}】预算`);
    if (thinN) parts.push(`另有 ${thinN} 个渠道样本薄,先观察不下定论`);
    rec = parts.join(';') + '。';
  }
  return { ranked, recommendation: rec };
}
