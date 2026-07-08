/**
 * 户部 · 财政数据契约
 *
 * 数据来源 (SoT): Turso → /api/court/hubu/overview
 * 旧的 build-budget.ts mock 常量已被此契约取代。
 */

export type FinanceProjectStatus = 'pending_review' | 'approved' | 'needs_rework';
export type FinanceRiskLevel = 'low' | 'medium' | 'high' | 'critical';

export const FINANCE_RISK_LABEL: Record<FinanceRiskLevel, string> = {
  low: '低',
  medium: '中',
  high: '高',
  critical: '紧急',
};

export const FINANCE_STATUS_LABEL: Record<FinanceProjectStatus, string> = {
  pending_review: '待批',
  approved: '已准',
  needs_rework: '退回补充',
};

/** 户部投资/建设项目 */
export interface HubuProject {
  id: string;
  title: string;
  target_dept: string;
  owner_dept: string;
  status: FinanceProjectStatus;
  requested_budget: string;
  estimated_roi: string;
  payback_window: string;
  cash_flow_pressure: string;
  priority: 'P0' | 'P1' | 'P2';
  risk_level: FinanceRiskLevel;
  recommendation: string;
  command: string;
  acceptance_criteria: string[];
  created_at: string;
  updated_at: string;
}

/** 户部财政总览摘要 */
export interface HubuSummary {
  total_requested: string;
  approved_this_week: string;
  pending_count: number;
  avg_roi: string;
  cash_reserve: string;
  recommendation: string;
  generated_at: string;
  source: 'turso' | 'fallback';
}

/** 带 citations 的 LLM 增强建议条目 */
export interface HubuCitation {
  index: number;
  label: string;
  href?: string;
}

export interface HubuLlmAdvice {
  summary: string;
  citations: HubuCitation[];
  generated_at: string;
}

/** /api/court/hubu/overview 的完整响应 */
export interface HubuOverview {
  summary: HubuSummary;
  projects: HubuProject[];
  llm_advice: HubuLlmAdvice | null;
}

/**
 * 旧版 ensureSeedData 写进 hubu_projects 的元演示种子固定 id(已废除)。
 * SSOT:overview 路由据此自愈清除历史种子;projects 路由据此拒绝占用,防误删用户项目。
 */
export const RESERVED_HUBU_PROJECT_IDS = [
  'build-hubu-v1',
  'build-gongbu-workflow',
  'build-jinyiwei-intel',
  'build-shiguan-review',
] as const;

export type HubuPaymentAction =
  | 'approve'
  | 'archive_preview'
  | 'block'
  | 'confirm_with_risk_gate'
  | 'return_for_correction'
  | 'return_for_council_review'
  | 'return_for_evidence'
  | 'return_for_legal_review'
  | 'save_draft'
  | string;

export type HubuPaymentRecommendation =
  | 'approve'
  | 'needs_confirmation'
  | 'needs_evidence'
  | 'legal_review'
  | 'council_review'
  | 'blocked';

export interface HubuPaymentFactPack {
  caseId: string;
  title: string;
  decisionType: 'payment';
  knownFacts: string[];
  accounting: Record<string, unknown>;
  treasury: Record<string, unknown>;
  budget: Record<string, unknown>;
  paymentRequest: Record<string, unknown>;
  relatedPastCases?: unknown[];
}

export interface HubuPaymentDecision {
  recommendation: HubuPaymentRecommendation;
  riskLevel: FinanceRiskLevel;
  riskGates: string[];
  missingEvidence: string[];
  nextActions: string[];
  reason?: string;
}

export interface HubuPaymentDecisionActions {
  primaryAction: HubuPaymentAction;
  allowedActions: HubuPaymentAction[];
  blockedActions: HubuPaymentAction[];
  requiresSecondConfirmation: boolean;
  archiveEligible: boolean;
  ownerHint: string;
  buttonLabels: Partial<Record<HubuPaymentAction, string>>;
}

export interface HubuPaymentArchiveDraft {
  archiveMode: 'draft_only';
  archiveEligible: boolean;
  archiveId: string;
  evidenceChain: unknown[];
  auditTrail: unknown[];
  sourceLabelSummary?: Record<string, string[]>;
  decisionReason?: string;
  archiveBlockedReasons?: string[];
  [key: string]: unknown;
}

export interface HubuPaymentPreview {
  previewOnly: true;
  executionAllowed: false;
  sideEffects: 'none';
  caseId: string;
  decision: HubuPaymentDecision;
  decisionActions: HubuPaymentDecisionActions;
  archiveDraft: HubuPaymentArchiveDraft;
}

export interface HubuPaymentDecisionInput {
  action: HubuPaymentAction;
  decidedBy: string;
  reason: string;
  confirmedRiskGates?: string[];
}

export interface HubuPaymentDecisionReceipt {
  receiptId: string;
  action: HubuPaymentAction;
  actionLabel: string;
  accepted: boolean;
  decidedBy: string;
  reason: string;
  requiresSecondConfirmation: boolean;
  confirmedRiskGates: string[];
  nextState: string;
}

export interface HubuPaymentDecisionPreview {
  previewOnly: true;
  executionAllowed: false;
  sideEffects: 'none';
  decisionReceipt: HubuPaymentDecisionReceipt;
  archiveDraft: HubuPaymentArchiveDraft;
}

export type HubuReportingAction =
  | 'archive_preview'
  | 'return_for_audit_review'
  | 'return_for_evidence'
  | 'prepare_financing_materials'
  | 'save_draft'
  | string;

export interface HubuReportingFactPack {
  caseId: string;
  title: string;
  period: string;
  currency: 'CNY' | string;
  knownFacts: string[];
  trialBalance: Record<string, unknown>;
  comparatives?: Record<string, unknown>;
  cashFlow: Record<string, unknown>;
  auditInputs?: Record<string, unknown>;
  sources: Record<string, { sourceLabel: string; ref?: string }>;
  relatedPastCases?: unknown[];
}

export interface HubuReportingDecisionActions {
  primaryAction: HubuReportingAction;
  allowedActions: HubuReportingAction[];
  blockedActions: HubuReportingAction[];
  requiresSecondConfirmation: boolean;
  archiveEligible: boolean;
  ownerHint: string;
  buttonLabels: Partial<Record<HubuReportingAction, string>>;
}

export interface HubuReportingDecisionInput {
  action: HubuReportingAction;
  decidedBy: string;
  reason: string;
}

export interface HubuReportingDecisionReceipt {
  receiptId: string;
  action: HubuReportingAction;
  actionLabel: string;
  accepted: boolean;
  decidedBy: string;
  reason: string;
  requiresSecondConfirmation: boolean;
  confirmedRiskGates: string[];
  nextState: string;
}

export interface HubuReportingPreview {
  previewOnly: true;
  executionAllowed: false;
  sideEffects: 'none';
  officeChain: string[];
  caseId: string;
  title: string;
  reportingPeriod: string;
  currency: string;
  sourceLabelSummary: Record<string, number>;
  statements: {
    incomeStatement: Record<string, string | null>;
    balanceSheet: Record<string, string | null>;
    cashFlowStatement: Record<string, string | null>;
  };
  auditFindings: Array<{
    id: string;
    severity: FinanceRiskLevel | 'blocked' | string;
    title: string;
    detail: string;
    requiredAction: string;
    paths: string[];
  }>;
  bossBrief: {
    verdict: 'healthy' | 'watch' | 'blocked' | string;
    riskLevel: FinanceRiskLevel | 'blocked' | string;
    oneSentence: string;
    keyRisks: string[];
    nextActions: string[];
  };
  financingMaterials: {
    fundingNeed: string;
    suggestedUseOfFunds: string[];
    repaymentSource: string[];
    riskNotes: string[];
  };
  loanApplicationDraft: {
    requestedAmount: string;
    purpose: string;
    requiredDocuments: string[];
    manualReviewRequired: boolean;
    [key: string]: unknown;
  };
  archiveDraft: HubuPaymentArchiveDraft;
  decisionActions: HubuReportingDecisionActions;
}

export interface HubuReportingDecisionPreview {
  previewOnly: true;
  executionAllowed: false;
  sideEffects: 'none';
  caseId: string;
  decisionReceipt: HubuReportingDecisionReceipt;
  bossBrief: HubuReportingPreview['bossBrief'];
  decisionActions: HubuReportingDecisionActions;
  archiveDraft: HubuPaymentArchiveDraft;
  financingMaterials: HubuReportingPreview['financingMaterials'];
  loanApplicationDraft: HubuReportingPreview['loanApplicationDraft'];
}
