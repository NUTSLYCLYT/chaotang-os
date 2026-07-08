/**
 * 钦天监事件预测 · 部门学习溯源 + 情报来源可靠度回溯（2026-07-04）
 *
 * 铁律5 边界(2026-06-20 会审冻结)：部门学习整体"停一切新投入"，是指别再给它建新版面/接 cron；
 * 本文件不建版面、不建 cron——只给已存在的 department_learning 记录补一个可选字段的用法(哪些
 * IntelSignal 被引用)，并提供一个纯函数把已有记录 + 已有情报信号汇总成"按来源的可靠度"，供
 * 溶解进现有周报飞轮面板(department-flywheel-recap.tsx)展示，不新增页面(见该组件改动)。
 *
 * 两个纯函数：
 * - buildQintianPredictionRecord：把一次 forecastPriceTrend/forecastNewEnergyTopic 的产出
 *   包装成 DepartmentLearningRecord(verdict 恒为 'observing'——预测刚产生，不能自称已验证)。
 * - computeSignalSourceReliability：按 IntelSignal.sources[0].name 分组，统计该来源支持的
 *   预测里 confirmed vs refuted 的比例；样本不足(confirmed+refuted===0)诚实标"暂无足够样本"，
 *   不编 0% 或 NaN。
 */
import { AGENT_META } from '@/lib/contracts/agent';
import type { DepartmentLearningRecord } from '@/lib/contracts/department-learning';
import type { IntelSignal } from '@/lib/contracts/intel';
import { contradictingSignal, type PriceTrendForecast, type TrendDir } from '@/features/qintian/lib/price-forecast';

/** 预测记录 id：同一话题重复预测覆盖同一条记录，不无限堆积(与 loop.ts 的 department_learning_${agentCode} 风格一致)。 */
export function qintianPredictionRecordId(topic: string): string {
  const slug = topic
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9一-龥]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60) || 'unknown_topic';
  return `qintian_prediction_${slug}`;
}

/**
 * 把一次钦天监事件预测包装成 DepartmentLearningRecord。
 * verdict 恒为 'observing'：预测刚产生，尚无结果源可验证，绝不能自称 confirmed/refuted
 * (与 loop.ts buildDepartmentLearningRecord 的诚实基线一致)。
 */
export function buildQintianPredictionRecord(
  topic: string,
  forecast: PriceTrendForecast,
  now = new Date(),
): DepartmentLearningRecord {
  const meta = AGENT_META.qin_tian_jian;
  const due = new Date(now);
  due.setDate(due.getDate() + 14);

  return {
    id: qintianPredictionRecordId(topic),
    agentCode: 'qin_tian_jian',
    agentName: meta.nameCn,
    calibrationTarget: `「${topic}」${forecast.directionCn}预测是否兑现`,
    metricName: 'forecast_trigger_hit_rate',
    sourceLabel: forecast.citedSignalIds.length > 0 ? 'PRIMARY' : 'RULE_SEED',
    verdict: 'observing',
    dueAt: due.toISOString(),
    nextLesson: `下一课：两周后核对「${topic}」是否兑现${forecast.directionCn}，据证伪条件改判。`,
    calibrationDelta: `预测刚生成，尚待结果源核验：${forecast.falsifiedBy}`,
    evidence: forecast.reasons.map((r) => (r.signalId ? `signal:${r.signalId}:${r.text}` : `${r.source}:${r.text}`)),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    confirmedCount: 0,
    refutedCount: 0,
    citedSignalIds: forecast.citedSignalIds,
  };
}

/**
 * 渲染时有效判决(2026-07-04 · 任务5+6)：不改后端、不接 cron，纯在渲染时据最新信号 + 当前时间算。
 * - 任务5：证伪条件自动生效——引用来源冒出反向信号 → 自动从 observing 翻 'refuted'，不等人发现。
 * - 任务6：预测过期——过了 dueAt 窗口仍没定论 → 标 'stale'(已过期待复核)，逼这条被处理，不永远挂"观察中"。
 * 已人工/结果源定论(confirmed/refuted)的记录不动。这是**展示态**，不写库(持久化仍归后端结果源)。
 */
export type EffectiveVerdict = 'observing' | 'confirmed' | 'refuted' | 'stale';

export const EFFECTIVE_VERDICT_CN: Record<EffectiveVerdict, string> = {
  observing: '观察中',
  confirmed: '已兑现',
  refuted: '已证伪',
  stale: '已过期待复核',
};

/** 从记录的 calibrationTarget(含 directionCn)反解方向，供证伪判定复用 price-forecast 的反向检查。 */
function recordDirection(record: DepartmentLearningRecord): TrendDir {
  const target = record.calibrationTarget;
  if (target.includes('上行')) return 'up';
  if (target.includes('下行')) return 'down';
  return 'unknown';
}

export interface VerdictResult {
  verdict: EffectiveVerdict;
  /** 自动判决的证据链(observing 时为空):触发证伪的信号 / 逾期天数 / 人工定论——让自动翻案不是黑箱。 */
  reason: string;
}

export function effectiveVerdict(
  record: DepartmentLearningRecord,
  latestSignals: IntelSignal[],
  now = new Date(),
): VerdictResult {
  if (record.verdict === 'confirmed' || record.verdict === 'refuted') {
    return { verdict: record.verdict, reason: `已由结果源人工定论：${record.verdict === 'confirmed' ? '已兑现' : '已证伪'}` };
  }
  const hit = contradictingSignal(recordDirection(record), record.citedSignalIds ?? [], latestSignals);
  if (hit) {
    return { verdict: 'refuted', reason: `引用来源「${hit.sources[0]?.name ?? '未知来源'}」冒出反向信号：${hit.title}` };
  }
  const due = new Date(record.dueAt).getTime();
  if (due < now.getTime()) {
    const overdueDays = Math.max(0, Math.floor((now.getTime() - due) / 86_400_000));
    return { verdict: 'stale', reason: `已过预测窗口，逾期 ${overdueDays} 天仍无定论，待复核` };
  }
  return { verdict: 'observing', reason: '' };
}

export interface SignalSourceReliability {
  source: string;
  /** 引用过该来源的预测记录数(含 observing/unknown，仅作参考)。 */
  totalCitations: number;
  confirmed: number;
  refuted: number;
  /** confirmed / (confirmed+refuted)；样本不足(分母为0)时为 null，前端须显"暂无足够样本"，不得显 0%/NaN。 */
  reliabilityRate: number | null;
}

/**
 * 按 IntelSignal 的代表来源(sources[0].name)分组，统计"引用过该来源的部门学习记录"里
 * confirmed vs refuted 的占比。observing/unknown 记录只计入 totalCitations，不进分母
 * (铁律：样本不足诚实说不知道，不编造数字)。
 */
export function computeSignalSourceReliability(
  records: DepartmentLearningRecord[],
  signals: IntelSignal[],
): SignalSourceReliability[] {
  const signalSource = new Map<string, string>();
  for (const s of signals) {
    signalSource.set(s.id, s.sources[0]?.name ?? '未知来源');
  }

  const bySource = new Map<string, { totalCitations: number; confirmed: number; refuted: number }>();

  for (const record of records) {
    const citedIds = record.citedSignalIds ?? [];
    if (citedIds.length === 0) continue;
    // 同一条记录若引用了同一来源的多个信号，该来源本次只记一次引用(不重复计数)。
    const sourcesInThisRecord = new Set(
      citedIds.map((id) => signalSource.get(id)).filter((s): s is string => Boolean(s)),
    );
    for (const source of sourcesInThisRecord) {
      const bucket = bySource.get(source) ?? { totalCitations: 0, confirmed: 0, refuted: 0 };
      bucket.totalCitations += 1;
      if (record.verdict === 'confirmed') bucket.confirmed += 1;
      else if (record.verdict === 'refuted') bucket.refuted += 1;
      bySource.set(source, bucket);
    }
  }

  return Array.from(bySource.entries())
    .map(([source, bucket]) => {
      const denom = bucket.confirmed + bucket.refuted;
      return {
        source,
        totalCitations: bucket.totalCitations,
        confirmed: bucket.confirmed,
        refuted: bucket.refuted,
        reliabilityRate: denom === 0 ? null : Number((bucket.confirmed / denom).toFixed(4)),
      };
    })
    .sort((a, b) => b.totalCitations - a.totalCitations);
}
