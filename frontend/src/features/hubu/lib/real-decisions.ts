/**
 * 户部 · 真决策（替演示卡 · 2026-06-28）
 *
 * "不改变现有UI 只是把展示内容换成我们"：决策卡片布局/样式不动，数据换成本轮真引擎输出。
 * 字段=真实工作产出：BOM 引擎估总成本 1086 元/台、电芯占 73.7% 命脉、采购价库流水线判 3 项待裁
 * (台账无 LFP32Ah 等对应规格真采购价)。诚实标"待裁/缺证"，绝不冒充真台账价(铁律13.2)。
 * 早期立项,预算/回报本就缺证 → evaluateProject 自然落 hold(缓议补证),与真实状态一致。
 */
import type { HubuProject } from '@/lib/contracts/hubu';
import type { IntelSignal } from '@/lib/contracts/intel';
import { forecastPriceTrend, filterNewEnergySignals, type PriceTrendForecast } from '@/features/qintian/lib/price-forecast';
import { classifyDecree } from '@/core/courtos/decree-classifier';
import { projectMaturity } from '@/core/courtos/project-maturity';
import { mergeStamps } from '@/core/courtos/primitives/stamp-pipeline';

// 立项包多部门盖章会审（户部复用通用盖章流水线原语，推广 primitives）。
const TRICYCLE_REVIEW = mergeStamps('三轮电池包立项', [
  { dept: 'gongbu', role: '工部·配置', verdict: 'pass', finding: '60V32Ah LFP 已定' },
  { dept: 'hubu', role: '户部·成本', verdict: 'caution', finding: '估1086,电芯真采购价待裁' },
  { dept: 'bingbu', role: '兵部·市场', verdict: 'caution', finding: '缺目标客户/售价' },
  { dept: 'jinyiwei', role: '锦衣卫·竞品', verdict: 'caution', finding: '缺竞品行情' },
]);
const REVIEW_TAG = TRICYCLE_REVIEW.overall === 'blocked' ? '🔴驳回' : TRICYCLE_REVIEW.overall === 'conditional' ? '🟡有条件' : '🟢通过';

// 下旨分流：「做电动三轮电池包」含开创动词「做」→ 开创性下旨 → 诞生立项对象(下旨=立项)。
const TRICYCLE_DECREE = classifyDecree('做电动三轮电池包，核成本立项');

// 立项成熟度：早期立项,只产品配置已定,真采购价/售价/毛利/回报全待补 → 低成熟度,诚实。
const TRICYCLE_MATURITY = projectMaturity([
  { key: 'config', label: '产品配置(60V32Ah LFP)', filled: true },
  { key: 'cost', label: '电芯真采购价', filled: false },
  { key: 'price', label: '目标售价', filled: false },
  { key: 'margin', label: '毛利', filled: false },
  { key: 'roi', label: '预期回报', filled: false },
  { key: 'customer', label: '卖给谁(整车厂/后市场)', filled: false },
]);

/**
 * 从锦衣卫真实情报（Turso intel_signals，经 /api/court/intel/signals 读出）里筛出
 * 电池/新能源供应链相关条目，喂给 forecastPriceTrend 的 industrySignals 输入(保留信号 id，
 * 供部门学习记录溯源引用)。关键词表单一真相源在 qintian/price-forecast.ts 的
 * filterNewEnergySignals(铁律2/6：不在此再维护一份平行关键词表)。
 * 无匹配条目→返回空数组，forecastPriceTrend 会诚实落 direction='unknown'（不瞎猜方向）。
 */
export function deriveIndustrySignalsFromIntel(signals: IntelSignal[]): IntelSignal[] {
  return filterNewEnergySignals(signals).slice(0, 5);
}

/**
 * 电芯 LFP32Ah 涨跌逻辑单独导出(而非只在 buildTricycleDecision 内部私有)，供户部驾驶舱 UI
 * 渲染 falsifiedBy/citedSignalIds、以及触发部门学习记录写入——避免往 HubuProject 契约里
 * 夹带钦天监专属字段(HubuProject 是户部通用契约，别处也在用)。
 */
export function forecastTricycleCellPrice(industrySignals: IntelSignal[]): PriceTrendForecast {
  return forecastPriceTrend({
    material: '电芯 LFP32Ah',
    libraryTrend: 'up',
    industrySignals,
    deptNotes: ['三轮旺季备货'],
  });
}

/** 钦天监对命脉料「电芯」的涨跌逻辑 + 立项卡（industrySignals 为真锦衣卫情报，非硬编码）。 */
function buildTricycleDecision(industrySignals: IntelSignal[]): HubuProject {
  const cellForecast = forecastTricycleCellPrice(industrySignals);

  return {
    id: 'real-tricycle-60v32ah',
    title: '60V32Ah电动三轮电池包 · 成本立项',
    target_dept: '工部',
    owner_dept: '户部',
    status: 'pending_review',
    requested_budget: '约1086元/台(估·待核真采购价)',
    estimated_roi: '—',
    payback_window: '—',
    cash_flow_pressure: `立项包会审 ${REVIEW_TAG}：工部✓配置 · 户部成本待裁(估1086) · 兵部待补客户 · 锦衣卫待补竞品 ‖ 钦天监🟡电芯${cellForecast.directionCn}，建议锁价`,
    priority: 'P0',
    risk_level: 'medium',
    recommendation: `【${TRICYCLE_DECREE.kind === 'initiate' ? '下旨开创·立项' : '裁决'} · ${TRICYCLE_MATURITY.note}】补真采购价(电芯占成本 73.7% 是命脉)后核真成本，再谈定价/卖给谁`,
    command: '「60V32Ah 三轮电池包」成本待裁，电芯缺真采购价——该补哪些价才能核真成本？',
    acceptance_criteria: ['电芯 LFP32Ah 真采购价', '目标售价', '卖给整车厂还是后市场'],
    created_at: '2026-06-28T00:00:00.000Z',
    updated_at: '2026-06-28T00:00:00.000Z',
  };
}

/** 无实时情报可用时的默认卡（industrySignals=[]，钦天监诚实落 unknown，不编造"反弹/紧缺"）。 */
export const TRICYCLE_DECISION: HubuProject = buildTricycleDecision([]);

/**
 * 注入真决策 + 隐去历史演示卡（标题含"演示"）。其余真实项目原样保留。
 * @param industrySignals 真锦衣卫情报（用 deriveIndustrySignalsFromIntel 从 useIntelSignals() 派生）；
 *   不传或空数组时落回默认卡（direction=unknown，诚实不猜）。
 */
export function withRealDecisions(apiProjects: HubuProject[], industrySignals: IntelSignal[] = []): HubuProject[] {
  const decision = industrySignals.length > 0 ? buildTricycleDecision(industrySignals) : TRICYCLE_DECISION;
  const real = apiProjects.filter((p) => !p.title.includes('演示') && p.id !== decision.id);
  return [decision, ...real];
}
