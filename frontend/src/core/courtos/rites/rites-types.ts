import type { SourceLabel } from '../types';
import type { IntelligencePack, UnifiedDraftEdict, UnifiedSignal, UnifiedVerdict } from '../unified/unified-types.ts';

export type RitesBrandCommsQuestionType =
  | '客户回复'
  | '销售话术'
  | '招商材料'
  | '品牌定位'
  | '官网/宣传资料'
  | '公关媒体'
  | '危机沟通'
  | '竞品回应'
  | '正式报价表达'
  | '客户案例授权'
  | 'AI生成内容审查'
  | '其他品牌传播问题';

export type RitesSubOfficeId =
  | 'rites_cmo_cco_chief'
  | 'rites_brand_strategy'
  | 'rites_customer_insight'
  | 'rites_content_copy'
  | 'rites_partnership_pitch'
  | 'rites_pr_reputation'
  | 'rites_channel_campaign'
  | 'rites_message_quality_gate';

export type RitesPosition = '可作为草稿' | '先改稿' | '补证' | '复核' | '禁止外发';
export type RitesConfidence = '高' | '中' | '低';
export type RitesMessageRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'BLOCKED';

export interface RitesEvidence {
  title: string;
  sourceType: 'USER_INPUT' | 'USER_UPLOAD' | 'ARCHIVE' | 'WIKI_RULE' | 'TOOL_RESULT' | 'MODEL_INFERENCE' | 'FALLBACK';
  sourceRef?: string;
  usable: boolean;
  confidence: RitesConfidence;
}

export interface RitesGeneratedArtifact {
  artifactType: string;
  audience: string;
  goal: string;
  channel: string;
  draftStatus: 'DRAFT_ONLY' | 'NEEDS_REVIEW' | 'BLOCKED';
  contentOutline: string[];
  evidenceUsed: RitesEvidence[];
  missingEvidence: string[];
  riskFlags: string[];
  requiredReviews: string[];
  mayPublish: false;
  sourceLabel: SourceLabel;
}

export interface RitesSubOfficeOpinion {
  officeId: RitesSubOfficeId;
  officeName: string;
  position: RitesPosition;
  finding: string;
  evidenceUsed: RitesEvidence[];
  missingEvidence: string[];
  forbiddenExpressions: string[];
  risks: string[];
  requiredCrossReviews: string[];
}

export interface RitesCMOCCOOpinion {
  department: '礼部';
  position: RitesPosition;
  confidence: RitesConfidence;
  executiveSummary: string;
  brandCommsQuestionType: RitesBrandCommsQuestionType;
  requiredSubOffices: RitesSubOfficeId[];
  audience: string;
  goal: string;
  channel: string;
  messageRiskLevel: RitesMessageRiskLevel;
  keyMessages: string[];
  subOfficeOpinions: RitesSubOfficeOpinion[];
  generatedArtifacts: RitesGeneratedArtifact[];
  evidenceUsed: RitesEvidence[];
  missingEvidence: string[];
  forbiddenExpressions: string[];
  requiredCrossReviews: string[];
  riskRegister: string[];
  nextBestAction: string;
  questionsForEmperor: string[];
  highRiskRequiresHumanConfirmation: boolean;
  mayPublish: false;
  archiveReady: boolean;
  sourceLabel: SourceLabel;
  source_label: SourceLabel;
}

export interface RitesQualityGateResult {
  passed: boolean;
  signal: UnifiedSignal;
  verdict: UnifiedVerdict;
  blockingIssues: string[];
  warnings: string[];
  requiredActions: string[];
  highRiskRequiresHumanConfirmation: boolean;
  mayPublish: false;
  sourceLabel: SourceLabel;
}

export interface RitesDepartmentWorkOrder {
  taskId?: string;
  departmentId: 'ritual';
  audience?: string;
  goal?: string;
  channel?: string;
  requestedArtifacts?: string[];
  requiredEvidence?: string[];
  expectedOutputs?: string[];
  sourceLabel?: SourceLabel;
}

export interface RitesBrandCommsOfficeLoopInput {
  confirmedEdict: UnifiedDraftEdict;
  intelligencePack?: IntelligencePack;
  departmentWorkOrder?: RitesDepartmentWorkOrder;
  sourceLabel?: SourceLabel;
}

export interface RitesBrandCommsOfficeLoopResult {
  loopId: 'rites_brand_comms_office_loop_v1';
  opinion: RitesCMOCCOOpinion;
  qualityGate: RitesQualityGateResult;
}
