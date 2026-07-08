/**
 * ProactiveBriefingLoop（V3 Prompt 4，阶段 A 锚点）：
 * 让用户进上书房 10 秒内知道"今天最该处理什么 + 为什么(whyNow)"。
 *
 * 规则：whyNow 必填；无真实数据不伪装(hasRealData=false, sourceLabel=DEMO)；
 * 优先级 高风险 > 待裁决 > 待补证；旧案作为历史镜鉴。
 */
import type { SourceLabel } from '../types.ts';
import { mergeSourceLabels } from '../source-label.ts';
import type { BriefingItem, PendingTaskSnapshot, ProactiveBriefing } from './interaction-types.ts';
import { nextBestAction } from './next-best-action-engine.ts';

export interface PriorCaseRef {
  id: string;
  title: string;
  outcome: string;
  sourceLabel: SourceLabel;
}

export interface BriefingInput {
  pendingTasks: PendingTaskSnapshot[];
  similarPriorCases?: PriorCaseRef[];
}

function toItem(t: PendingTaskSnapshot, whyNow: string): BriefingItem {
  return { id: t.id, title: t.title, whyNow, primaryAction: nextBestAction(t), sourceLabel: t.sourceLabel };
}

export function buildProactiveBriefing(input: BriefingInput): ProactiveBriefing {
  const tasks = input.pendingTasks ?? [];
  const hasRealData = tasks.some((t) => t.sourceLabel === 'LIVE' || t.sourceLabel === 'LIVE_SWARM');

  const risks = tasks.filter((t) => t.riskLevel === 'high' || t.needsHumanConfirmation);
  const decisions = tasks.filter((t) => t.phase === 'WAITING_FOR_DECISION' || t.phase === 'REPORT_READY');
  const evidence = tasks.filter((t) => t.phase === 'WAITING_FOR_EVIDENCE' || t.phase === 'EVIDENCE_CHECKING');

  const mirrors: BriefingItem[] = (input.similarPriorCases ?? []).map((c) => ({
    id: c.id,
    title: c.title,
    whyNow: `历史镜鉴可引用：${c.outcome}`,
    primaryAction: { actionId: 'review_report', label: '查看旧案', reason: '上次同类问题的结论可参考。' },
    sourceLabel: c.sourceLabel,
  }));

  // 今日一号决策：高风险 > 待裁决 > 待补证
  const topDecision =
    risks[0] ? toItem(risks[0], '风险上升且涉及高风险/需人工确认，今天最该先处理。') :
    decisions[0] ? toItem(decisions[0], '奏折已生成，正等待你的裁决。') :
    evidence[0] ? toItem(evidence[0], '缺关键证据，补齐后才能继续推进。') :
    null;

  const labels: SourceLabel[] = tasks.length ? tasks.map((t) => t.sourceLabel) : ['DEMO'];

  return {
    topDecision,
    pendingDecisions: decisions.map((t) => toItem(t, '奏折已就绪，等待裁决。')),
    pendingEvidence: evidence.map((t) => toItem(t, '缺关键证据，等待补证。')),
    risingRisks: risks.map((t) => toItem(t, '高风险 / 需人工确认。')),
    historicalMirrors: mirrors,
    hasRealData,
    // 无真实数据 → DEMO，不伪装成真实经营洞察。
    sourceLabel: hasRealData ? mergeSourceLabels(labels) : 'DEMO',
  };
}
