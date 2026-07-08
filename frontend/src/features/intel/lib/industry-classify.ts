/**
 * 锦衣卫 · 本产业(电池)分道 + 情报板块透镜分类（2026-07-05 · Phase 1 地基）
 *
 * 复用现有 intel_signals（无需后端）：
 *   - 产业五道 lane：把每条信号归到 竞品/上游/政策/客户/技术 之一（旗舰板块的行结构）。
 *   - 情报板块透镜 lens：政治/军事/金融/科技AI/人物 —— 只作**标签**汇入产业，不单独开版面（张小龙减法 + 铁律5）。
 * 纯函数、关键词匹配（对齐 JinyiweiPage 现有 MINISTRIES 模式），不碰后端 / 不接 cron（铁律9）。
 */
import type { IntelSignal } from '@/lib/contracts/intel';

export type LaneId = 'competitor' | 'upstream' | 'policy' | 'customer' | 'tech' | 'other';

export interface LaneDef {
  id: LaneId;
  label: string;
  icon: string;
  keywords: RegExp;
}

/** 产业五道（顺序即匹配优先级：竞品 > 上游 > 政策 > 客户 > 技术）。 */
export const INDUSTRY_LANES: LaneDef[] = [
  { id: 'competitor', label: '竞品动态', icon: '🥊', keywords: /宁德|比亚迪|中创新航|亿纬|国轩|欣旺达|蜂巢|LG|松下|三星SDI|SK|竞品|市占|份额|定点|扩线|良率|竞争|competitor/i },
  { id: 'upstream', label: '上游·原材料', icon: '⛏', keywords: /锂|钴|镍|锰|碳酸锂|氢氧化锂|正极|负极|隔膜|电解液|铜箔|矿|材料|lithium|cobalt|nickel|cathode|anode/i },
  { id: 'policy', label: '政策·法规', icon: '⚖', keywords: /政策|法规|监管|补贴|关税|碳足迹|碳关税|回收|标准|征求意见|许可|合规|制裁|出口管制|regulation|policy|tariff|compliance/i },
  { id: 'customer', label: '客户·招标·订单', icon: '🎯', keywords: /客户|招标|订单|集采|中标|采购|需求|储能|车企|整车|主机厂|供货|order|tender|procurement/i },
  { id: 'tech', label: '技术路线', icon: '🔬', keywords: /固态|半固态|钠电|钠离子|CTP|CTC|麒麟|刀片|快充|能量密度|循环寿命|技术|研发|工艺|solid.?state|sodium/i },
];

export type LensId = 'geopolitics' | 'military' | 'finance' | 'ai' | 'people';

export interface LensDef {
  id: LensId;
  label: string;
  icon: string;
  keywords: RegExp;
}

/** 情报板块透镜（可多标；只作标签汇入产业，不开版面）。 */
export const SECTOR_LENSES: LensDef[] = [
  { id: 'geopolitics', label: '国际政治', icon: '🏛️', keywords: /地缘|大选|贸易战|出口管制|制裁|外交|关税|政局|政府|欧盟|美国|印尼|geopolit|sanction|tariff/i },
  { id: 'military', label: '军事·地缘', icon: '⚔️', keywords: /军|国防|冲突|战争|军备|军工|defense|military/i },
  { id: 'finance', label: '金融·资本', icon: '💰', keywords: /融资|估值|股|市值|锂价|涨价|跌价|大宗|投资|IPO|财报|营收|利润|finance|valuation|funding/i },
  { id: 'ai', label: '科技·AI', icon: '🤖', keywords: /AI|人工智能|大模型|算法|机器学习|自动化|智能|芯片|数据中心|GPU/i },
  { id: 'people', label: '人物志', icon: '👤', keywords: /董事长|CEO|总裁|高管|创始人|任命|离职|换人|卸任|接任|executive|founder/i },
];

function textOf(signal: IntelSignal): string {
  return `${signal.title} ${signal.summary} ${signal.industry}`;
}

/** 归到产业五道之一；都不匹配 → 'other'（诚实兜底，不硬塞）。 */
export function classifyLane(signal: IntelSignal): LaneId {
  const text = textOf(signal);
  return INDUSTRY_LANES.find((lane) => lane.keywords.test(text))?.id ?? 'other';
}

/** 命中的情报板块透镜标签（可多个；无命中 → 空数组）。 */
export function classifyLenses(signal: IntelSignal): LensId[] {
  const text = textOf(signal);
  return SECTOR_LENSES.filter((lens) => lens.keywords.test(text)).map((lens) => lens.id);
}

/** 按五道分组（含 other），供旗舰板块渲染。顺序稳定＝INDUSTRY_LANES 顺序。 */
export function groupByLane(signals: IntelSignal[]): Map<LaneId, IntelSignal[]> {
  const groups = new Map<LaneId, IntelSignal[]>();
  for (const lane of INDUSTRY_LANES) groups.set(lane.id, []);
  groups.set('other', []);
  for (const signal of signals) {
    const lane = classifyLane(signal);
    groups.get(lane)!.push(signal);
  }
  return groups;
}
