/**
 * HabitLearner（V3 Prompt 4，阶段 B）：根据用户裁决信号更新画像。
 * 规则：多次补证→更早提示补证；多次驳回"太泛"→报告更具体；关注 ROI→提高户部权重；
 * 关注合同/股权→提前提示刑部；常追问旧案→优先历史镜鉴；常密旨→默认提供转密旨。
 * 铁律：不因一次行为过度改变画像（阈值 THRESHOLD）。
 */
import type { DecisionActionKind, UserDecisionProfile } from './user-decision-profile.ts';

export interface DecisionSignal {
  action: DecisionActionKind;
  rejectReason?: string;
  topic?: string;
  focusedOn?: string[];
  usedSecretEdict?: boolean;
  askedHistory?: boolean;
}

const THRESHOLD = 3;

export function updateProfileFromDecision(profile: UserDecisionProfile, signal: DecisionSignal): UserDecisionProfile {
  const next: UserDecisionProfile = {
    ...profile,
    actionCounts: { ...profile.actionCounts },
    rejectReasonCounts: { ...profile.rejectReasonCounts },
    topicCounts: { ...profile.topicCounts },
    ministryWeights: { ...profile.ministryWeights },
    flags: { ...profile.flags },
  };

  next.actionCounts[signal.action] = (next.actionCounts[signal.action] ?? 0) + 1;
  if (signal.rejectReason) {
    next.rejectReasonCounts[signal.rejectReason] = (next.rejectReasonCounts[signal.rejectReason] ?? 0) + 1;
  }
  if (signal.topic) next.topicCounts[signal.topic] = (next.topicCounts[signal.topic] ?? 0) + 1;
  for (const f of signal.focusedOn ?? []) {
    if (/ROI|预算|成本|现金|回本/.test(f)) next.ministryWeights.finance += 0.5;
    if (/合同|股权|法务|合规|对外承诺/.test(f)) next.ministryWeights.justice += 0.5;
  }
  if (signal.usedSecretEdict) next.secretEdictCount += 1;
  if (signal.askedHistory) next.historyAskCount += 1;

  // 仅在累计达阈值后改 flags —— 不因单次行为过度反应。
  if (next.actionCounts.request_evidence >= THRESHOLD) next.flags.earlyEvidencePrompt = true;
  if ((next.rejectReasonCounts['太泛'] ?? 0) >= THRESHOLD) next.flags.moreSpecificReports = true;
  if (next.secretEdictCount >= THRESHOLD) next.flags.offerSecretEdict = true;
  if (next.historyAskCount >= THRESHOLD) next.flags.prioritizeHistory = true;

  return next;
}
