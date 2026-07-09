import type { SourceLabel } from '@/core/courtos/types';

export type JunjichuStage =
  | 'empty'
  | 'accepted'
  | 'routing'
  | 'deliberating'
  | 'evidence_blocked'
  | 'quality_ready'
  | 'decision_written'
  | 'archived';

export type JunjichuSourceLabel = Extract<SourceLabel, 'LIVE' | 'LIVE_SWARM' | 'MIXED' | 'FALLBACK' | 'DEMO'>;

export type QualityGateStatus = 'idle' | 'passed' | 'warning' | 'blocked';

export type SwarmRunStatus = 'idle' | 'running' | 'completed' | 'quality_blocked' | 'failed';

export type SwarmRunMode = 'dry_run' | 'standard' | 'deep' | 'live_swarm';

export interface ActionState {
  enabled: boolean;
  label: string;
  disabledReason?: string;
  requiresReason?: boolean;
  requiresHumanConfirmation?: boolean;
}

export interface JunjichuActionPolicy {
  issueEdict: ActionState;
  unfoldCase: ActionState;
  summonCouncil: ActionState;
  startSwarm: ActionState;
  archive: ActionState;
  adopt: ActionState;
  requestEvidence: ActionState;
  recheck: ActionState;
  reject: ActionState;
  followup: ActionState;
  proceed: ActionState;
}

export interface CaseIdentityView {
  taskId: string | null;
  title: string;
  rawCommand?: string;
  intent?: string;
  status?: string;
  runId?: string;
  updatedAt?: string;
  hasRealTask: boolean;
}

export interface RoutingView {
  mode: 'direct' | 'junjichu' | 'unknown';
  reason: string;
  recommendedDepartments: string[];
  abstainedDepartments: string[];
  sourceLabel: JunjichuSourceLabel;
}

export interface SummonView {
  id: string;
  name: string;
  status: 'summoned' | 'waiting' | 'abstained' | 'not_applicable';
  thesis?: string;
  sourceLabel: JunjichuSourceLabel;
}

export interface EvidenceView {
  known: string[];
  missing: string[];
  blocking: boolean;
  owner?: string;
  rerunScope?: string;
}

export interface StreamView {
  active: boolean;
  ministersCount: number;
  groupsCount: number;
  risksCount: number;
  councilSummary?: string;
}

export interface CouncilView {
  ministers: SummonView[];
  conflicts: string[];
  risks: string[];
  verdict?: string;
  requiresHumanConfirmation: boolean;
}

export interface QualityGateView {
  status: QualityGateStatus;
  blockingReasons: string[];
  warnings: string[];
  sourceLabel: JunjichuSourceLabel;
  canAdopt: boolean;
  requiresHumanConfirmation: boolean;
}

export interface SwarmTaskRunView {
  id: string;
  name: string;
  status: string;
  summary?: string;
}

export interface SwarmRunView {
  id: string;
  mode: SwarmRunMode;
  status: SwarmRunStatus;
  progressUrl?: string;
  briefUrl?: string;
  taskRuns: SwarmTaskRunView[];
  qualityResult: QualityGateView | null;
  sourceLabel: JunjichuSourceLabel;
}

export interface GovernanceGateView {
  waiting: boolean;
  reason?: string;
  proceedLabel: string;
  nextAfterProceed?: string;
}

export interface DecisionView {
  written: boolean;
  decisionId?: string;
  reviewId?: string;
  canWriteBackendDecision: boolean;
  note: string;
}

export interface ArchiveView {
  archived: boolean;
  archiveId?: string;
  similarCases: string[];
  retrospectiveStatus: 'hidden' | 'available' | 'written';
  knowledgeFeedbackStatus: 'hidden' | 'available' | 'submitted';
}

export interface JunjichuPageView {
  caseIdentity: CaseIdentityView;
  stage: JunjichuStage;
  sourceLabel: JunjichuSourceLabel;
  routing: RoutingView;
  summons: SummonView[];
  evidence: EvidenceView;
  stream: StreamView;
  council: CouncilView;
  swarmRun: SwarmRunView | null;
  gate: QualityGateView;
  governance: GovernanceGateView;
  decision: DecisionView;
  archive: ArchiveView;
  actions: JunjichuActionPolicy;
}
