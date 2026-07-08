import type { SourceLabel } from '../types';
import type { IntelligencePack, UnifiedDraftEdict, UnifiedSignal, UnifiedVerdict } from '../unified/unified-types.ts';

export type GongbuDeliveryQuestionType =
  | 'STORAGE_OR_HARDWARE_PROJECT'
  | 'BOM_SUPPLY_CHAIN'
  | 'TECHNICAL_FEASIBILITY'
  | 'MVP_SCOPE'
  | 'SCHEDULE_CAPACITY'
  | 'QUALITY_ACCEPTANCE'
  | 'FIELD_IMPLEMENTATION'
  | 'DELIVERY_COMMITMENT'
  | 'SCOPE_CHANGE'
  | 'DELIVERY_REVIEW'
  | 'OTHER_DELIVERY_RISK';

export type GongbuSubOfficeId =
  | 'cto_cpo_chief'
  | 'solution_architecture'
  | 'bom_supply_chain'
  | 'schedule_capacity'
  | 'quality_acceptance'
  | 'field_implementation'
  | 'delivery_operations'
  | 'delivery_commitment_gate';

export type GongbuCrossDepartmentReview = 'finance' | 'war' | 'personnel' | 'justice' | 'ritual' | 'jinyiwei';
export type GongbuPosition = '准奏' | '补证' | '复核' | '驳回';
export type GongbuConfidence = '高' | '中' | '低';

export interface GongbuDeliveryEvidence {
  title: string;
  sourceType: 'USER_INPUT' | 'USER_UPLOAD' | 'ARCHIVE' | 'WIKI_RULE' | 'TOOL_RESULT' | 'MODEL_INFERENCE' | 'FALLBACK';
  sourceRef?: string;
  usable: boolean;
  confidence: GongbuConfidence;
}

export interface GongbuGeneratedArtifact {
  type: string;
  title: string;
  status: 'draft' | 'needs_human_review' | 'needs_cross_review' | 'blocked';
  content: string;
  forbiddenActions: string[];
  requiresHumanConfirmation: boolean;
  requiresCrossReview: GongbuCrossDepartmentReview[];
  sourceLabel: SourceLabel;
}

export interface GongbuSubOfficeOpinion {
  officeId: GongbuSubOfficeId;
  officeName: string;
  position: GongbuPosition;
  finding: string;
  evidenceUsed: GongbuDeliveryEvidence[];
  missingEvidence: string[];
  risks: string[];
  forbiddenCommitments: string[];
  requiredCrossReviews: GongbuCrossDepartmentReview[];
  requiresHumanConfirmation: boolean;
  nextBestAction: string;
  sourceLabel: SourceLabel;
  source_label: SourceLabel;
}

export interface GongbuCTOCPOOpinion {
  department: '工部';
  ctoCpoPosition: GongbuPosition;
  confidence: GongbuConfidence;
  executiveSummary: string;
  deliveryQuestionType: GongbuDeliveryQuestionType;
  deliveryCommitmentRisk: boolean;
  requiredSubOffices: GongbuSubOfficeId[];
  subOfficeOpinions: GongbuSubOfficeOpinion[];
  evidenceUsed: GongbuDeliveryEvidence[];
  missingEvidence: string[];
  assumptions: string[];
  riskRegister: string[];
  forbiddenActions: string[];
  crossDepartmentReviews: GongbuCrossDepartmentReview[];
  recommendedNextAction: string;
  generatedArtifactsAvailable: string[];
  generatedArtifacts: GongbuGeneratedArtifact[];
  questionsForEmperor: string[];
  humanConfirmationRequired: boolean;
  sourceLabel: SourceLabel;
  source_label: SourceLabel;
}

export interface GongbuQualityGateResult {
  passed: boolean;
  signal: UnifiedSignal;
  verdict: UnifiedVerdict;
  gateResults: Array<{ gate: string; status: 'pass' | 'block' | 'warn' | 'n/a'; detail: string }>;
  blockingIssues: string[];
  warnings: string[];
  humanConfirmationRequired: boolean;
  sourceLabel: SourceLabel;
}

export interface GongbuDepartmentWorkOrder {
  taskId?: string;
  departmentId: 'works';
  focusQuestion?: string;
  requiredEvidence?: string[];
  expectedOutputs?: string[];
  sourceLabel?: SourceLabel;
}

export interface GongbuCTOCPOOfficeLoopInput {
  confirmedEdict: UnifiedDraftEdict;
  intelligencePack?: IntelligencePack;
  departmentWorkOrder?: GongbuDepartmentWorkOrder;
  sourceLabel?: SourceLabel;
}

export interface GongbuCTOCPOOfficeLoopResult {
  loopId: 'gongbu_cto_cpo_delivery_office_loop_v1';
  opinion: GongbuCTOCPOOpinion;
  qualityGate: GongbuQualityGateResult;
}
