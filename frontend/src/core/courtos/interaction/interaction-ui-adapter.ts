/**
 * InteractionUiAdapter（V3 Prompt 4/17）：把交互层输出投影成业务可读视图。
 * 只暴露 标题/为什么/下一步/来源，不含 agentId/toolCall/token 等技术字段（原则 9）。
 */
import type { SourceLabel } from '../types.ts';
import type { BriefingItem, ProactiveBriefing } from './interaction-types.ts';

export interface BriefingCardVM {
  id: string;
  title: string;
  whyNow: string;
  actionLabel: string;
  actionReason: string;
  sourceLabel: SourceLabel;
}

export interface BriefingViewModel {
  hasRealData: boolean;
  emptyHint?: string;
  topDecision: BriefingCardVM | null;
  pendingDecisions: BriefingCardVM[];
  pendingEvidence: BriefingCardVM[];
  risingRisks: BriefingCardVM[];
  historicalMirrors: BriefingCardVM[];
  sourceLabel: SourceLabel;
}

function toVM(i: BriefingItem): BriefingCardVM {
  return {
    id: i.id,
    title: i.title,
    whyNow: i.whyNow,
    actionLabel: i.primaryAction.label,
    actionReason: i.primaryAction.reason,
    sourceLabel: i.sourceLabel,
  };
}

export function toBriefingViewModel(b: ProactiveBriefing): BriefingViewModel {
  return {
    hasRealData: b.hasRealData,
    emptyHint: b.hasRealData ? undefined : b.sourceLabel === 'DEMO' ? '暂无真实建议（样板展示）' : '暂无真实建议',
    topDecision: b.topDecision ? toVM(b.topDecision) : null,
    pendingDecisions: b.pendingDecisions.map(toVM),
    pendingEvidence: b.pendingEvidence.map(toVM),
    risingRisks: b.risingRisks.map(toVM),
    historicalMirrors: b.historicalMirrors.map(toVM),
    sourceLabel: b.sourceLabel,
  };
}
