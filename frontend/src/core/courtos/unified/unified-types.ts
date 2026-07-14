import type { SourceLabel } from '../types';
import type { BingbuCROOpinion, BingbuDepartmentWorkOrder } from '../bingbu/bingbu-types.ts';
import type { GongbuCTOCPOOpinion, GongbuDepartmentWorkOrder } from '../gongbu/gongbu-types.ts';
import type { HubuCFOOpinion, HubuDepartmentWorkOrder } from '../hubu/hubu-types.ts';
import type { RitesCMOCCOOpinion, RitesDepartmentWorkOrder } from '../rites/rites-types.ts';
import type { XingbuCLOCCOOpinion, XingbuDepartmentWorkOrder } from '../xingbu/xingbu-types.ts';
import type { UnifiedDepartmentId as ContractUnifiedDepartmentId } from '@/lib/contracts/dept';

export type UnifiedDepartmentId = ContractUnifiedDepartmentId;

export type UnifiedLoopState =
  | 'DAILY_PREP'
  | 'HOME_READY'
  | 'INTAKE_RECEIVED'
  | 'DRAFT_READY'
  | 'EMPEROR_CONFIRMED'
  | 'REVIEW_PLANNED'
  | 'INTELLIGENCE_READY'
  | 'DEPARTMENTS_REVIEWED'
  | 'SWARM_REVIEWED'
  | 'EVIDENCE_AUDITED'
  | 'CONFLICTS_IDENTIFIED'
  | 'INTERACTION_CHECKPOINT'
  | 'MEMORIAL_READY'
  | 'QUALITY_GATED'
  | 'CHANCELLOR_BRIEFED'
  | 'USER_DECIDED'
  | 'ARCHIVED'
  | 'EVOMAP_RECORDED';

export type UnifiedSignal = 'GREEN' | 'YELLOW' | 'RED' | 'GRAY';
export type UnifiedVerdict = 'APPROVE' | 'NEED_EVIDENCE' | 'RECHECK' | 'REJECT';

export interface DepartmentCapability {
  id: UnifiedDepartmentId;
  name: string;
  modernRole: string;
  mission: string;
  enabled: boolean;
  category: 'intelligence' | 'finance' | 'growth' | 'organization' | 'risk' | 'communication' | 'delivery';
  triggerKeywords: string[];
  requiredEvidence: string[];
  highRiskKeywords: string[];
  outputContract: 'IntelligencePackV1' | 'DepartmentOpinionV1';
  sourceLabelRequired: boolean;
}

export interface UnifiedDraftEdict {
  originalQuestion: string;
  refinedQuestion: string;
  decisionType: string;
  knownFacts: string[];
  unknownGaps: string[];
  expectedOutput: string[];
  sourceLabel: SourceLabel;
}

export interface UnifiedReviewPlan {
  taskId: string;
  selectedDepartments: UnifiedDepartmentId[];
  reasons: Partial<Record<UnifiedDepartmentId, string>>;
  interactionQuestion?: string;
  sourceLabel: SourceLabel;
}

export interface IntelligencePack {
  departmentId: 'jinyiwei';
  facts: string[];
  evidenceBasis: string[];
  missingEvidence: string[];
  unsupportedClaims: string[];
  sourceLabel: SourceLabel;
}

export interface DepartmentOpinion {
  departmentId: UnifiedDepartmentId;
  signal: UnifiedSignal;
  verdict: UnifiedVerdict;
  summary: string;
  evidence: string[];
  missingEvidence: string[];
  risks: string[];
  nextAction: string;
  needsHumanConfirmation: boolean;
  sourceLabel: SourceLabel;
  cfoOpinion?: HubuCFOOpinion;
  warOpinion?: BingbuCROOpinion;
  gongbuOpinion?: GongbuCTOCPOOpinion;
  ritesOpinion?: RitesCMOCCOOpinion;
  xingbuOpinion?: XingbuCLOCCOOpinion;
}

export interface UnifiedDepartmentWorkOrders {
  finance?: HubuDepartmentWorkOrder;
  war?: BingbuDepartmentWorkOrder;
  justice?: XingbuDepartmentWorkOrder;
  ritual?: RitesDepartmentWorkOrder;
  works?: GongbuDepartmentWorkOrder;
}

export interface UnifiedConflict {
  between: [UnifiedDepartmentId, UnifiedDepartmentId];
  summary: string;
}

export interface InteractionCard {
  id: string;
  question: string;
  reason: string;
  actions: Array<'UPLOAD_EVIDENCE' | 'ANSWER_TEXT' | 'CONTINUE_WITH_GAPS'>;
  sourceLabel: SourceLabel;
}

export interface UnifiedMemorial {
  verdict: UnifiedVerdict;
  oneSentence: string;
  departmentSummaries: DepartmentOpinion[];
  intelligencePack: IntelligencePack;
  conflicts: UnifiedConflict[];
  evidence: string[];
  missingEvidence: string[];
  risks: string[];
  nextAction: string;
  qualityGate: {
    passed: boolean;
    blockingIssues: string[];
    warnings: string[];
  };
  sourceLabel: SourceLabel;
  needsHumanConfirmation: boolean;
}

export interface EvoMapEvent {
  schema_version: 'EvoMapEventV1';
  event_id: string;
  task_id: string;
  loop_trace_id: string;
  loop_id: 'court_unified_decision_loop_v1';
  user_action: 'accept' | 'reject' | 'request_evidence' | 'request_recheck' | 'follow_up';
  learned_preference: string;
  recommended_change: string;
  failure_mode?: string;
  source_label: SourceLabel;
  created_at: string;
  auto_apply: false;
  /** Compatibility aliases for the older in-process unified learning API. */
  taskId: string;
  loopTraceId: string;
  loopId: 'court_unified_decision_loop_v1';
  userAction: 'accept' | 'reject' | 'request_evidence' | 'request_recheck' | 'follow_up';
  learnedPreference: string;
  failureMode?: string;
  recommendedChange: string;
  sourceLabel: SourceLabel;
}

export interface UnifiedLoopResult {
  taskId: string;
  loopTraceId: string;
  loopId: 'court_unified_decision_loop_v1';
  states: UnifiedLoopState[];
  draftEdict: UnifiedDraftEdict;
  reviewPlan: UnifiedReviewPlan;
  intelligencePack: IntelligencePack;
  departmentWorkOrders: UnifiedDepartmentWorkOrders;
  departmentOpinions: DepartmentOpinion[];
  conflicts: UnifiedConflict[];
  interactionCard?: InteractionCard;
  memorial: UnifiedMemorial;
  sourceLabel: SourceLabel;
}
