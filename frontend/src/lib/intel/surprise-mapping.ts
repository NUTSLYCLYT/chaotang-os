import type { InsightCandidate } from '@/core/courtos/interaction/surprise-insight-engine';
import type { IntelSignal } from '@/lib/contracts/intel';
import type { SourceLabel } from '@/core/courtos/types';

/** level→严重度一句话，直接来自真实level字段，不编造具体数字预测。 */
const WHY_IT_MATTERS_BY_LEVEL: Record<IntelSignal['level'], string> = {
  info: '常规信息，暂无需紧急处理',
  watch: '需要持续关注，可能影响近期决策',
  warning: '已达预警级别，建议尽快评估影响',
  critical: '已达严重级别，建议立即评估是否需要响应',
};

const SUGGESTED_ACTION_BY_CATEGORY: Record<IntelSignal['category'], string> = {
  risk: '评估该风险对当前决策的影响，视情况转交相关部门处理',
  opportunity: '评估是否值得推进，转交相关部门跟进',
  neutral: '归档留存，暂无需主动处理',
};

/**
 * 把真实IntelSignal转成SurpriseInsightEngine要的InsightCandidate。
 * evidence/whyItMatters/suggestedAction全部来自信号自身的真实字段(sources/level/category)，
 * 不调用LLM编造文本——诚实原则：宁可平淡真实，不要生动虚构。
 */
export function intelSignalToInsightCandidate(signal: IntelSignal, sourceLabel: SourceLabel): InsightCandidate {
  const evidence = signal.sources.map((s) => s.name).filter(Boolean);
  return {
    id: signal.id,
    text: signal.title,
    evidence: evidence.length > 0 ? evidence : undefined,
    whyItMatters: WHY_IT_MATTERS_BY_LEVEL[signal.level],
    suggestedAction: SUGGESTED_ACTION_BY_CATEGORY[signal.category],
    sourceLabel,
  };
}
