import type { SourceLabel } from '../types';

export type AuthorityActor =
  | 'EMPEROR'
  | 'CHANCELLOR'
  | 'GRAND_COUNCIL'
  | 'MINISTER'
  | 'DEPUTY'
  | 'YUSHITAI';

export type CommandType =
  | 'PUBLIC_DECREE'
  | 'SECRET_EDICT'
  | 'MINISTRY_REQUEST'
  | 'AUDIT_ORDER'
  | 'TRAINING_ORDER';

export type FormationType =
  | 'SCOUT'
  | 'RED_BLUE'
  | 'EVIDENCE'
  | 'RISK'
  | 'CAMPAIGN'
  | 'DELIVERY'
  | 'WAR_ROOM';

export type EstateRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';
export type SecrecyLevel = 'PRIVATE' | 'CONFIDENTIAL' | 'TOP_SECRET';

export type SecretEdictStatus =
  | 'SECRET_DRAFT'
  | 'SECRET_SCOPING'
  | 'SECRET_SWARMING'
  | 'SECRET_REDTEAMING'
  | 'SECRET_AUDITING'
  | 'SECRET_MEMO_READY'
  | 'EMPEROR_REVIEW'
  | 'PROMOTED_TO_COURT'
  | 'SEALED_ARCHIVE'
  | 'DISMISSED';

export type SecretMemoRecommendation =
  | 'PROMOTE_TO_COURT'
  | 'REQUEST_MORE_EVIDENCE'
  | 'KEEP_SECRET'
  | 'DISMISS';

export interface SwarmCapabilityCard {
  id: string;
  name: string;
  capabilityTags: string[];
  supportedMinistries: string[];
  allowedCommandTypes: CommandType[];
  riskLevel: EstateRiskLevel;
  canRunSecret: boolean;
  requiresAudit: boolean;
  requiresHumanApproval: boolean;
  outputTypes: string[];
  sourceLabelRequired: boolean;
  userFacingActivity: string;
}

export interface SwarmFormation {
  id: string;
  formationType: FormationType;
  name: string;
  purpose: string;
  requiredSwarms: string[];
  optionalSwarms: string[];
  maxRuntimeSeconds: number;
  asyncRequired: boolean;
  humanApprovalRequired: boolean;
  outputs: string[];
}

export interface CommandSeal {
  id: string;
  actor: AuthorityActor;
  commandType: CommandType;
  allowedFormationTypes: FormationType[];
  allowedRiskLevel: EstateRiskLevel;
  canBypassPublicCourt: boolean;
  canApproveHighRisk: boolean;
  auditRequired: boolean;
}

export interface SecretEdict {
  id: string;
  title: string;
  originalText: string;
  issuer: AuthorityActor;
  secrecyLevel: SecrecyLevel;
  purpose: string;
  formationType: FormationType;
  selectedSwarms: string[];
  forbiddenActions: string[];
  status: SecretEdictStatus;
  sourceLabel: SourceLabel;
  needsHumanConfirmation: boolean;
  createdAt: string;
  auditRequired: boolean;
  auditTrail: string[];
}

export interface SecretMemo {
  id: string;
  secretEdictId: string;
  chancellorSummary: string;
  swarmFindings: string[];
  redTeamChallenges: string[];
  missingEvidence: string[];
  risks: string[];
  yushitaiAudit: string[];
  recommendation: SecretMemoRecommendation;
  nextAction: string;
  sourceLabel: SourceLabel;
  needsHumanConfirmation: boolean;
}

export interface EstateDispatchTrace {
  actor: AuthorityActor;
  formationType: FormationType;
  activity: string;
  sourceLabel: SourceLabel;
}

export interface EstateDispatchResult {
  selectedFormation: SwarmFormation;
  selectedSwarms: SwarmCapabilityCard[];
  forbiddenActions: string[];
  requiresAudit: boolean;
  requiresHumanApproval: boolean;
  dispatchTraces: EstateDispatchTrace[];
  sourceLabel: SourceLabel;
}

export interface PromotedCourtTaskInput {
  commandType: 'PUBLIC_DECREE';
  originalSecretEdictId: string;
  rawQuestion: string;
  evidence: string[];
  risks: string[];
  sourceLabel: SourceLabel;
  needsHumanConfirmation: boolean;
}
