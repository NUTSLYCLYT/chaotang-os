/**
 * 兵部 · 真销售决策（替演示卡 · 2026-06-28）
 *
 * "不改变UI结构 只改变展示内容"：兵部决策卡布局不动，数据换成价格体系真输出。
 * 毛利天然归宿在兵部(销售)——把真毛利塞进现有"金额"槽显形。
 * 字段=真实数据：充电器 卖 2500(销售订单) − 买 1500(采购台账) = 毛利 1000 元(40%)。
 * 价格体系合龙的真证明：买价(户部采购价库)+卖价(兵部销售价库) → 毛利显形(用户原则)。
 */
import type { BingbuSalesItem } from '@/lib/contracts/bingbu-sales';
import { marginHealth, competitiveEdge } from '@/features/jinyiwei/lib/competitive-edge';
import { mergeStamps } from '@/core/courtos/primitives/stamp-pipeline';

// 锦衣卫竞争优势：毛利健康(内部真信号🟢) + 售价竞争(外部⚪待核实,不编竞品价)。
const CHARGER_HEALTH = marginHealth(40);
const CHARGER_EDGE = competitiveEdge('sell', 2500, null);

// 定价会审：兵部复用通用盖章流水线原语(推广primitives到兵部)。
const CHARGER_REVIEW = mergeStamps('充电器定价', [
  { dept: 'hubu', role: '户部·成本', verdict: 'pass', finding: '采购真价1500' },
  { dept: 'bingbu', role: '兵部·毛利', verdict: 'pass', finding: '卖2500毛利40%健康' },
  { dept: 'jinyiwei', role: '锦衣卫·竞品', verdict: 'caution', finding: '缺竞品成品价(待核实,不编)' },
]);
const CHARGER_REVIEW_TAG = CHARGER_REVIEW.overall === 'conditional' ? '🟡有条件' : CHARGER_REVIEW.overall === 'approved' ? '🟢通过' : '🔴驳回';

export const CHARGER_MARGIN_DECISION: BingbuSalesItem = {
  id: 'real-charger-margin',
  title: '充电器定价复核 · 真毛利显形',
  command: '充电器卖 2500、采购 1500，毛利 40%——这个定价合理吗？要不要调价？',
  status: 'pending_review',
  priority: 'P1',
  counterparty: '部队直采(历史成交)',
  stage: '定价复核',
  amount: `报价 2500 元/台 · 毛利 1000(40%)真 · ${CHARGER_HEALTH.cn} · 竞争优势 ${CHARGER_EDGE.cn}`,
  risk_level: 'low',
  recommendation: `定价会审 ${CHARGER_REVIEW_TAG}：户部成本✓ · 兵部毛利40%✓ · 锦衣卫竞品待核实。毛利健康，价格体系已接通(买价=采购台账、卖价=销售订单)，可作定价基准`,
  terms: [],
  industry: '储能/动力电池',
  delivery: '—',
  prepayment: '—',
  asked_count: 1,
  created_at: '2026-06-28T00:00:00.000Z',
  updated_at: '2026-06-28T00:00:00.000Z',
};

/** 注入真销售决策 + 隐去历史演示卡。其余真实事项原样保留。 */
export function withRealSalesItems(apiItems: BingbuSalesItem[]): BingbuSalesItem[] {
  const real = apiItems.filter((i) => !i.title.includes('演示') && i.id !== CHARGER_MARGIN_DECISION.id);
  return [CHARGER_MARGIN_DECISION, ...real];
}
