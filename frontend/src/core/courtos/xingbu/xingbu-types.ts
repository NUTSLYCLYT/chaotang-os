import type { SourceLabel } from '../types';
import type { IntelligencePack, UnifiedDraftEdict, UnifiedSignal, UnifiedVerdict } from '../unified/unified-types.ts';

export type XingbuLegalRiskQuestionType =
  | 'CONTRACT_REVIEW'
  | 'FORMAL_QUOTE_OR_EXTERNAL_COMMITMENT'
  | 'CORPORATE_GOVERNANCE'
  | 'COMPLIANCE_REVIEW'
  | 'DISPUTE_LITIGATION'
  | 'EMPLOYMENT_LAW'
  | 'IP_CONFIDENTIALITY'
  | 'LEGAL_OPERATIONS'
  | 'PAYMENT_OR_PENALTY'
  | 'AI_AGENT_EXTERNAL_OUTPUT'
  | 'OTHER_LEGAL_RISK';

export type XingbuSubOfficeId =
  | 'clo_cco_chief'
  | 'contract_office'
  | 'corporate_governance'
  | 'compliance'
  | 'dispute_litigation'
  | 'employment_law'
  | 'ip_confidentiality'
  | 'legal_operations';

export type XingbuCrossDepartmentReview = 'finance' | 'war' | 'personnel' | 'jinyiwei' | 'ritual' | 'works';
export type XingbuPosition = '准奏' | '补证' | '复核' | '驳回';
export type XingbuConfidence = '高' | '中' | '低';

export interface XingbuLegalEvidence {
  title: string;
  sourceType: 'USER_INPUT' | 'USER_UPLOAD' | 'ARCHIVE' | 'WIKI_RULE' | 'TOOL_RESULT' | 'MODEL_INFERENCE' | 'FALLBACK';
  sourceRef?: string;
  usable: boolean;
  confidence: XingbuConfidence;
}

export interface XingbuGeneratedArtifact {
  type: string;
  title: string;
  status: 'draft' | 'needs_human_review' | 'needs_cross_review' | 'blocked';
  content: string;
  forbiddenActions: string[];
  requiresHumanConfirmation: boolean;
  requiresCrossReview: XingbuCrossDepartmentReview[];
  sourceLabel: SourceLabel;
}

export interface XingbuSubOfficeOpinion {
  officeId: XingbuSubOfficeId;
  officeName: string;
  position: XingbuPosition;
  finding: string;
  evidenceUsed: XingbuLegalEvidence[];
  missingEvidence: string[];
  jurisdictionOrScopeGap: boolean;
  assumptions: string[];
  risks: string[];
  forbiddenActions: string[];
  requiresCrossReview: XingbuCrossDepartmentReview[];
  requiresHumanConfirmation: boolean;
  nextBestAction: string;
  sourceLabel: SourceLabel;
  source_label: SourceLabel;
}

export interface XingbuCLOCCOOpinion {
  department: '刑部';
  cloCcoPosition: XingbuPosition;
  confidence: XingbuConfidence;
  executiveSummary: string;
  legalRiskQuestionType: XingbuLegalRiskQuestionType;
  jurisdictionOrScopeGap: boolean;
  requiredSubOffices: XingbuSubOfficeId[];
  subOfficeOpinions: XingbuSubOfficeOpinion[];
  evidenceUsed: XingbuLegalEvidence[];
  missingEvidence: string[];
  assumptions: string[];
  riskRegister: string[];
  forbiddenActions: string[];
  crossDepartmentReviews: XingbuCrossDepartmentReview[];
  recommendedNextAction: string;
  generatedArtifactsAvailable: string[];
  generatedArtifacts: XingbuGeneratedArtifact[];
  questionsForEmperor: string[];
  externalCounselRecommended: boolean;
  humanConfirmationRequired: boolean;
  sourceLabel: SourceLabel;
  source_label: SourceLabel;
}

export interface XingbuQualityGateResult {
  passed: boolean;
  signal: UnifiedSignal;
  verdict: UnifiedVerdict;
  gateResults: Array<{ gate: string; status: 'pass' | 'block' | 'warn' | 'n/a'; detail: string }>;
  blockingIssues: string[];
  warnings: string[];
  humanConfirmationRequired: boolean;
  sourceLabel: SourceLabel;
}

export interface XingbuDepartmentWorkOrder {
  taskId?: string;
  departmentId: 'justice';
  focusQuestion?: string;
  requiredEvidence?: string[];
  expectedOutputs?: string[];
  sourceLabel?: SourceLabel;
}

export interface XingbuCLOCCOOfficeLoopInput {
  confirmedEdict: UnifiedDraftEdict;
  intelligencePack?: IntelligencePack;
  departmentWorkOrder?: XingbuDepartmentWorkOrder;
  sourceLabel?: SourceLabel;
}

export interface XingbuCLOCCOOfficeLoopResult {
  loopId: 'xingbu_clo_cco_office_loop_v1';
  opinion: XingbuCLOCCOOpinion;
  qualityGate: XingbuQualityGateResult;
}
