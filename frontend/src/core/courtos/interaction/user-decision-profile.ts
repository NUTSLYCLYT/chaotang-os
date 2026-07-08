/**
 * UserDecisionProfile（V3 Prompt 4，阶段 B）：记录用户决策偏好，供"越用越准"。
 * 纯数据 + 不可变更新；不接真实存储（caller 负责持久化）。
 */
export type DecisionActionKind = 'accept' | 'request_evidence' | 'recheck' | 'reject' | 'follow_up';
export type ReportDepth = 'brief' | 'standard' | 'detailed';

export interface UserDecisionProfile {
  userId: string;
  reportDepthPref: ReportDepth;
  riskAppetite: 'conservative' | 'balanced' | 'aggressive';
  actionCounts: Record<DecisionActionKind, number>;
  rejectReasonCounts: Record<string, number>;
  preferredEvidenceTypes: string[];
  topicCounts: Record<string, number>;
  ministryWeights: Record<string, number>;
  secretEdictCount: number;
  historyAskCount: number;
  flags: {
    earlyEvidencePrompt: boolean;
    moreSpecificReports: boolean;
    offerSecretEdict: boolean;
    prioritizeHistory: boolean;
  };
  updatedAt?: string | null;
}

export function createDefaultProfile(userId: string): UserDecisionProfile {
  return {
    userId,
    reportDepthPref: 'standard',
    riskAppetite: 'balanced',
    actionCounts: { accept: 0, request_evidence: 0, recheck: 0, reject: 0, follow_up: 0 },
    rejectReasonCounts: {},
    preferredEvidenceTypes: [],
    topicCounts: {},
    ministryWeights: { finance: 1, justice: 1, war: 1, ritual: 1, works: 1, personnel: 1 },
    secretEdictCount: 0,
    historyAskCount: 0,
    flags: {
      earlyEvidencePrompt: false,
      moreSpecificReports: false,
      offerSecretEdict: false,
      prioritizeHistory: false,
    },
    updatedAt: null,
  };
}
