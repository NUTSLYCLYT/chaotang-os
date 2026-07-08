import type { SourceLabel } from '../types';
import type { IntelligencePack, UnifiedDraftEdict, UnifiedSignal, UnifiedVerdict } from '../unified/unified-types.ts';

export type BingbuSalesRevenueQuestionType =
  | 'LEAD_QUALIFICATION'
  | 'OPPORTUNITY_REVIEW'
  | 'ACCOUNT_STRATEGY'
  | 'QUOTE_STRATEGY'
  | 'NEGOTIATION_STRATEGY'
  | 'CHANNEL_PARTNER'
  | 'FORECAST_REVIEW'
  | 'WIN_LOSS_REVIEW'
  | 'CUSTOMER_SUCCESS_GROWTH'
  | 'SALES_ORG_EXECUTION';

export type BingbuSubOfficeId =
  | 'cro_chief'
  | 'gtm_strategy'
  | 'opportunity_pipeline'
  | 'key_account_attack'
  | 'pricing_deal_desk'
  | 'channel_partner'
  | 'sales_revops'
  | 'customer_success_growth';

export type BingbuCrossDepartmentReview = 'finance' | 'justice' | 'ritual' | 'jinyiwei' | 'personnel' | 'works';
export type BingbuCROPosition = '推进' | '补证' | '复核' | '止损';
export type BingbuConfidence = '高' | '中' | '低';

export interface SalesEvidenceItem {
  title: string;
  sourceType: 'USER_INPUT' | 'USER_UPLOAD' | 'CRM' | 'MEETING_NOTE' | 'ARCHIVE' | 'TOOL_RESULT' | 'MODEL_INFERENCE' | 'FALLBACK';
  sourceRef?: string;
  usable: boolean;
  confidence: BingbuConfidence;
}

export interface BingbuGeneratedArtifact {
  type: string;
  title: string;
  status: 'draft' | 'needs_human_review' | 'needs_cross_review' | 'blocked';
  content: string;
  maySendExternally: false;
  requiresHumanConfirmation: boolean;
  requiresCrossReview: BingbuCrossDepartmentReview[];
  sourceLabel: SourceLabel;
}

export interface BingbuSubOfficeReview {
  officeId: BingbuSubOfficeId;
  officeName: string;
  position: BingbuCROPosition;
  finding: string;
  evidenceUsed: SalesEvidenceItem[];
  missingEvidence: string[];
  risks: string[];
  requiredCrossReviews: BingbuCrossDepartmentReview[];
  requiresHumanConfirmation: boolean;
  onePrimarySalesAction: string;
  sourceLabel: SourceLabel;
  source_label: SourceLabel;
}

export interface BingbuCROOpinion {
  department: '兵部';
  position: BingbuCROPosition;
  confidence: BingbuConfidence;
  executiveSummary: string;
  salesRevenueQuestionType: BingbuSalesRevenueQuestionType;
  salesOwnerOrGap: string;
  opportunityStageOrGap: string;
  requiredSubOffices: BingbuSubOfficeId[];
  subOfficeReviews: BingbuSubOfficeReview[];
  evidenceUsed: SalesEvidenceItem[];
  missingEvidence: string[];
  customerClaims: string[];
  riskRegister: string[];
  forbiddenActions: string[];
  crossDepartmentReviews: BingbuCrossDepartmentReview[];
  onePrimarySalesAction: string;
  generatedArtifactsAvailable: string[];
  generatedArtifacts: BingbuGeneratedArtifact[];
  questionsForEmperor: string[];
  humanConfirmationRequired: boolean;
  maySendExternally: false;
  sourceLabel: SourceLabel;
  source_label: SourceLabel;
}

export interface BingbuQualityGateResult {
  passed: boolean;
  signal: UnifiedSignal;
  verdict: UnifiedVerdict;
  gateResults: Array<{ gate: string; status: 'pass' | 'block' | 'warn' | 'n/a'; detail: string }>;
  blockingIssues: string[];
  warnings: string[];
  humanConfirmationRequired: boolean;
  sourceLabel: SourceLabel;
}

export interface BingbuDepartmentWorkOrder {
  taskId?: string;
  departmentId: 'war';
  focusQuestion?: string;
  requiredEvidence?: string[];
  expectedOutputs?: string[];
  requestedArtifacts?: string[];
  sourceLabel?: SourceLabel;
}

export interface BingbuCROSalesOfficeLoopInput {
  confirmedEdict: UnifiedDraftEdict;
  intelligencePack?: IntelligencePack;
  departmentWorkOrder?: BingbuDepartmentWorkOrder;
  sourceLabel?: SourceLabel;
}

export interface BingbuCROSalesOfficeLoopResult {
  loopId: 'bingbu_cro_sales_office_loop_v1';
  opinion: BingbuCROOpinion;
  qualityGate: BingbuQualityGateResult;
}
