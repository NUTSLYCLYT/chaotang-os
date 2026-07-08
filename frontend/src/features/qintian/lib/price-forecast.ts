/**
 * 钦天监 · 价格涨跌逻辑 + 新能源产业事件预测（2026-06-28 起，2026-07-04 扩）
 *
 * 用户原则：查不到真采购价时，钦天监据「相关行业信息 + 相关部门」预测**价格趋势与涨跌逻辑**。
 * 死红线（铁律13.2 + 芒格逆向）：预测是 🟡，**永远不是真价**，永远不能直接拿去报价/拍板。
 *   - 给的是「方向 + 逻辑(为什么涨/跌) + 建议」，**不是一个假精确数字**(方向逻辑比假数字诚实)。
 *   - 每条理由挂来源(价库历史/锦衣卫情报/相关部门)，可追溯。
 *   - label 恒为「预测·非真价」；真价仍待补(把🔴升到🟡，永远升不到🟢)。
 * 纯函数本地。
 *
 * 2026-07-04 塔勒布证伪性扩展：每条预测必须自带 falsifiedBy——具体到"引用了哪些理由/来源"，
 * 不是到处复用的一句空话；同时保留 forecastPriceTrend 原签名(industryNotes: string[])向后兼容
 * (户部 real-decisions.ts 现有调用零改动)，新增可选 industrySignals(IntelSignal[]) 输入以保留
 * 锦衣卫信号 id，供 citedSignalIds 做部门学习记录溯源。forecastNewEnergyTopic 是薄封装，把"任意
 * 话题 + 情报信号"泛化成钦天监事件预测入口(仍domain-scope在电池/新能源产业，非全品类通用，按
 * 用户MVP边界决定，不做无限泛化)。
 */
import type { IntelSignal } from '@/lib/contracts/intel';

export type TrendDir = 'up' | 'down' | 'stable' | 'unknown';

export interface PriceTrendReason {
  text: string;
  source: string;
  /** 引用的锦衣卫 IntelSignal id(仅当理由来自 industrySignals 时存在，供部门学习溯源)。 */
  signalId?: string;
}

export interface PriceTrendInput {
  material: string;
  /** 价库历史趋势（即使已过期，方向仍有参考；来自 queryPrice.trend）。 */
  libraryTrend?: 'up' | 'down' | 'flat' | 'single' | null;
  /** 锦衣卫行业信息（如"碳酸锂价近期反弹"），每条一句，带其自身来源说明。 */
  industryNotes?: string[];
  /**
   * 锦衣卫真实 IntelSignal（保留 id，供 citedSignalIds 溯源）。与 industryNotes 可同时传入，
   * 两者各自贡献理由，互不覆盖——调用方按拥有的数据形态选一种或都传。
   */
  industrySignals?: IntelSignal[];
  /** 相关部门输入（工部用量/旺季备货等）。 */
  deptNotes?: string[];
}

export interface PriceTrendForecast {
  direction: TrendDir;
  directionCn: string;
  /** 预测信心：永不为 high（这是预测，不是真账）；无信号支撑时诚实降为 unknown。 */
  confidence: 'low' | 'medium' | 'unknown';
  /** 涨跌逻辑：每条理由 + 来源（可追溯）。 */
  reasons: PriceTrendReason[];
  /** 该怎么办（锁价/观望/询价）。 */
  advice: string;
  /** 恒为🟡：永远不是真价。 */
  label: '预测·非真价';
  /** 塔勒布证伪性：具体到本次引用了什么，什么信号出现即证伪此预测。 */
  falsifiedBy: string;
  /** 本次预测实际引用的 IntelSignal id 列表(去重)；无 industrySignals 输入时恒为空数组。 */
  citedSignalIds: string[];
}

const UP_RE = /涨|上行|反弹|上涨|紧缺|缺货|涨价|走高|抬升|加价|供不应求/;
const DOWN_RE = /跌|下行|回落|下跌|过剩|降价|走低|跳水|让利|供过于求/;
const DEMAND_UP_RE = /旺季|备货|扩产|加单|放量|抢装|赶工/;
const DEMAND_DOWN_RE = /淡季|减产|砍单|去库存|停产/;

/**
 * 电池/新能源产业相关关键词——覆盖户部电芯采购与钦天监电动车/新能源产业趋势预测双场景。
 * 单一真相源(铁律2/6)：户部 real-decisions.ts 不再自维护平行关键词表，改 import filterNewEnergySignals。
 * 仍 domain-scoped 在电池/新能源(MVP边界，非全品类通用情报过滤)。
 */
const NEW_ENERGY_RE = /半导体|稀土|新能源|能源|资源|金属|大宗商品|电池|电芯|锂|材料|电动车|新能源车|动力电池|整车厂|车企/;

/** 从锦衣卫真实情报里筛出电池/新能源产业相关条目(纯函数)。 */
export function filterNewEnergySignals(signals: IntelSignal[]): IntelSignal[] {
  return signals.filter(
    (s) => NEW_ENERGY_RE.test(s.title) || NEW_ENERGY_RE.test(s.summary) || NEW_ENERGY_RE.test(s.industry),
  );
}

/** 据相关信息合成价格涨跌逻辑（纯函数）。无信号→unknown(诚实说不知道,不瞎猜方向)。 */
export function forecastPriceTrend(input: PriceTrendInput): PriceTrendForecast {
  const reasons: PriceTrendReason[] = [];
  let score = 0;

  // 1. 价库历史趋势
  if (input.libraryTrend === 'up') { score += 1; reasons.push({ text: '你历史采购价本身在涨', source: '价库历史趋势' }); }
  else if (input.libraryTrend === 'down') { score -= 1; reasons.push({ text: '你历史采购价在跌', source: '价库历史趋势' }); }

  // 2. 锦衣卫行业信息（文本形态，无 id）
  for (const note of input.industryNotes ?? []) {
    if (UP_RE.test(note)) { score += 1; reasons.push({ text: note, source: '锦衣卫行业情报' }); }
    else if (DOWN_RE.test(note)) { score -= 1; reasons.push({ text: note, source: '锦衣卫行业情报' }); }
  }

  // 2b. 锦衣卫真实 IntelSignal（保留 id，供 citedSignalIds 溯源）
  for (const signal of input.industrySignals ?? []) {
    const text = `${signal.title}：${signal.summary}`;
    if (UP_RE.test(text)) { score += 1; reasons.push({ text, source: '锦衣卫情报信号', signalId: signal.id }); }
    else if (DOWN_RE.test(text)) { score -= 1; reasons.push({ text, source: '锦衣卫情报信号', signalId: signal.id }); }
  }

  // 3. 相关部门（需求侧→价向）
  for (const note of input.deptNotes ?? []) {
    if (DEMAND_UP_RE.test(note)) { score += 1; reasons.push({ text: `${note}（需求上行推价）`, source: '相关部门' }); }
    else if (DEMAND_DOWN_RE.test(note)) { score -= 1; reasons.push({ text: `${note}（需求下行压价）`, source: '相关部门' }); }
  }

  const direction: TrendDir = reasons.length === 0 ? 'unknown' : score > 0 ? 'up' : score < 0 ? 'down' : 'stable';
  const confidence: 'low' | 'medium' | 'unknown' = reasons.length === 0 ? 'unknown' : reasons.length >= 2 ? 'medium' : 'low';
  const directionCn =
    direction === 'up' ? '⬆️ 大概率上行' : direction === 'down' ? '⬇️ 大概率下行' : direction === 'stable' ? '➡️ 大致平稳' : '❔ 信息不足，方向不明';
  const advice =
    direction === 'up'
      ? '建议锁价优先、别等——成本可能上行；尽快向供应商询真价锁定'
      : direction === 'down'
        ? '可观望 / 分批采购——成本可能下行；但仍需补真采购价确认'
        : direction === 'stable'
          ? '价大致平稳，按正常节奏询真价采购即可'
          : '信息不足，钦天监不瞎判方向——直接向供应商询真价';

  const citedSignalIds = Array.from(new Set(reasons.map((r) => r.signalId).filter((id): id is string => Boolean(id))));

  return {
    direction,
    directionCn,
    confidence,
    reasons,
    advice,
    label: '预测·非真价',
    falsifiedBy: buildFalsifiedBy(input.material, direction, reasons),
    citedSignalIds,
  };
}

/**
 * 证伪条件必须"具体到本次引用了什么"，不是到处复用的一句空话(用户要求)。
 * 用真实 reasons(理由文本 + 来源) 组句——换一批理由，falsifiedBy 也随之换。
 */
function buildFalsifiedBy(material: string, direction: TrendDir, reasons: PriceTrendReason[]): string {
  if (reasons.length === 0) {
    return `钦天监目前没有任何${material}相关信号支撑，此预测本身尚未成立——出现第一条相关信号前，无需谈证伪。`;
  }
  const sources = Array.from(new Set(reasons.map((r) => r.source)));
  const sample = reasons[0]!.text.length > 30 ? `${reasons[0]!.text.slice(0, 30)}…` : reasons[0]!.text;
  const sourceList = sources.join('、');
  if (direction === 'up') {
    return `本次上行判断引自「${sample}」等 ${reasons.length} 条理由(来源：${sourceList})——若这些来源在两周内转发同向下跌/回落信号，或不再有同来源新信号支撑同一判断，「${material}上行」预测视为证伪。`;
  }
  if (direction === 'down') {
    return `本次下行判断引自「${sample}」等 ${reasons.length} 条理由(来源：${sourceList})——若这些来源在两周内转发同向上涨/紧缺信号，或不再有同来源新信号支撑同一判断，「${material}下行」预测视为证伪。`;
  }
  if (direction === 'stable') {
    return `本次"平稳"判断由 ${reasons.length} 条互相抵消的理由(来源：${sourceList})撑起——若任一来源新增明确同向信号且不再被抵消，「${material}平稳」预测视为证伪。`;
  }
  return `钦天监信息不足，未给出方向性判断，不构成需证伪的结论。`;
}

/**
 * 钦天监事件预测入口(2026-07-04 泛化)：任意话题 + 相关部门输入 + 锦衣卫全量信号，
 * 内部先按电池/新能源关键词筛出相关信号，再委托 forecastPriceTrend 生成同一套诚实预测
 * (方向/证据/confidence/falsifiedBy/citedSignalIds)。domain 仍限定电池/新能源(MVP边界)。
 */
export function forecastNewEnergyTopic(
  topic: string,
  signals: IntelSignal[],
  deptNotes: string[] = [],
): PriceTrendForecast {
  const relevant = filterNewEnergySignals(signals).slice(0, 5);
  return forecastPriceTrend({ material: topic, industrySignals: relevant, deptNotes });
}

/**
 * 任务5(2026-07-04)：让证伪条件**自动生效**，不等人看。
 * buildFalsifiedBy 写的条件是"引用来源在两周内转发**同向反向**信号即证伪"——这里把那句话机器化：
 * 取本预测 citedSignalIds 对应的**来源**，在最新信号流里扫这些来源有没有冒出反向信号
 * (up 预测遇同来源下跌/回落信号 / down 预测遇同来源上涨/紧缺信号)→ 命中即证伪。
 * 纯函数，复用同一套 UP_RE/DOWN_RE(单一真相，不另写关键词)，供渲染时检查，不接 cron。
 * 原引用信号本身(up 预测引的是 up 信号)不会误触发——它匹配的是同向正则，不是反向正则。
 */
export function contradictingSignal(
  direction: TrendDir,
  citedSignalIds: string[],
  latestSignals: IntelSignal[],
): IntelSignal | null {
  if (direction !== 'up' && direction !== 'down') return null;
  if (citedSignalIds.length === 0) return null;
  const citedSources = new Set(
    latestSignals
      .filter((s) => citedSignalIds.includes(s.id))
      .map((s) => s.sources[0]?.name)
      .filter((n): n is string => Boolean(n)),
  );
  if (citedSources.size === 0) return null;
  const contradictRe = direction === 'up' ? DOWN_RE : UP_RE;
  return (
    latestSignals.find(
      (s) =>
        Boolean(s.sources[0]?.name && citedSources.has(s.sources[0]!.name)) &&
        contradictRe.test(`${s.title}：${s.summary}`),
    ) ?? null
  );
}

/** boolean 薄包装(单一逻辑在 contradictingSignal，此处只答"有没有")。 */
export function citedSourcesContradict(
  direction: TrendDir,
  citedSignalIds: string[],
  latestSignals: IntelSignal[],
): boolean {
  return contradictingSignal(direction, citedSignalIds, latestSignals) !== null;
}
