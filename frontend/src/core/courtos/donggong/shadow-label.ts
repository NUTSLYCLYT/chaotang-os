/**
 * 朝堂 OS · 东宫核心原语「影子期标签工厂」(server-safe 纯函数,零副作用)
 *
 * 设计依据:dev/notes/donggong-design.md(张小龙/Jobs/Kahneman/Munger/Charity Majors 一致)。
 * 东宫=太子影子期容器,皇帝每次准/驳=给太子打的一个行为克隆训练标签。
 * 本模块只【判定】一个标签的可信度、一个簇能不能毕业、是不是在橡皮图章;不写库、不调模型。
 * 核心:橡皮图章会把训练信号悄悄变噪声→太子学到"皇帝会批一切"→某簇据此毕业=灾难。必须给标签分级。
 */

/** 四态裁决标签。ask=弃权升级(太子"我不敢动,你来"),最珍贵,单独入队不混进准/驳。 */
export type DecisionLabel = 'approve' | 'block' | 'ask' | 'changed';

/** 标签可信度:只有 high 进太子行为克隆的高质量训练集。 */
export type LabelConfidence = 'high' | 'low';

export interface DecisionContext {
  /** 是否盲审(先盖住太子建议让皇帝自己判)——盲审=唯一 high-confidence clean label */
  blindReview: boolean;
  /** 皇帝是否展开了"看依据" */
  evidenceExpanded: boolean;
  /** 决策时延 ms */
  decisionLatencyMs: number;
  /** 是否高风险件(L3-L4/产线/不可逆,来源 escalation-gate 独立分级,非太子自报) */
  highRisk: boolean;
}

/** 秒准阈值:低于此且未展开依据=疑似橡皮图章。 */
export const QUICK_DECISION_MS = 1500;

/**
 * 标签可信度分级(防橡皮图章污染训练集):
 *   - 盲审 → high(皇帝未被太子锚定,clean)
 *   - 高风险却秒准未展开依据 → low(rubber-stamp,最该警惕)
 *   - 秒准未展开依据 → low
 *   - 否则 → high
 */
export function classifyLabelConfidence(ctx: DecisionContext): LabelConfidence {
  if (ctx.blindReview) return 'high';
  const quick = ctx.decisionLatencyMs < QUICK_DECISION_MS;
  if (ctx.highRisk && quick && !ctx.evidenceExpanded) return 'low';
  if (quick && !ctx.evidenceExpanded) return 'low';
  return 'high';
}

export interface ClusterStats {
  /** high-confidence 标签数 */
  highConfidenceCount: number;
  /** 太子拟议与皇帝裁决一致率 0-1 */
  agreementRate: number;
  /** 误放出门数(本不该自动却放了);非零一律禁毕业 */
  escapedErrors: number;
}

export interface GraduateThreshold {
  minHighConfidence: number;
  minAgreementRate: number;
}

const DEFAULT_GRADUATE: GraduateThreshold = { minHighConfidence: 10, minAgreementRate: 0.95 };

/**
 * 某簇能否毕业(从 propose 升 auto):须 high-confidence 样本足量 + 一致率达标 + 零误放出门。
 * 只认 high-confidence 标签——秒准的 low-confidence 不算数(防"皇帝橡皮图章"喂出假毕业)。
 */
export function canGraduateCluster(
  stats: ClusterStats,
  threshold: GraduateThreshold = DEFAULT_GRADUATE,
): { ok: boolean; reason: string } {
  if (stats.escapedErrors > 0) return { ok: false, reason: `有 ${stats.escapedErrors} 次误放出门,禁毕业(不对称:错放损信任)` };
  if (stats.highConfidenceCount < threshold.minHighConfidence) {
    return { ok: false, reason: `high-confidence 样本 ${stats.highConfidenceCount}<${threshold.minHighConfidence}(秒准不算)` };
  }
  if (stats.agreementRate < threshold.minAgreementRate) {
    return { ok: false, reason: `一致率 ${stats.agreementRate.toFixed(2)}<${threshold.minAgreementRate}` };
  }
  return { ok: true, reason: `${stats.highConfidenceCount} 条 high-confidence、一致率 ${stats.agreementRate.toFixed(2)}、零误放,可申请毕业(仍须皇帝拍板)` };
}

/** 连续秒准阈值:达到即 corrigibility 告警(不当效率指标)。 */
export const RUBBER_STAMP_STREAK = 5;

/**
 * 橡皮图章检测:连续秒准达阈值=系统级 corrigibility 告警,强制下一张转盲审。
 * 橡皮图章是健康问题不是效率指标。
 */
export function isRubberStampPattern(
  consecutiveQuickApprovals: number,
  streak: number = RUBBER_STAMP_STREAK,
): { alarm: boolean; reason: string } {
  return consecutiveQuickApprovals >= streak
    ? { alarm: true, reason: `连续 ${consecutiveQuickApprovals} 次秒准≥${streak},corrigibility 告警:强制下一张转盲审` }
    : { alarm: false, reason: `连续秒准 ${consecutiveQuickApprovals}<${streak}` };
}
