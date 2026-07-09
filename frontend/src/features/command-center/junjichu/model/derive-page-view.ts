import { buildJunjichuActionPolicy } from './action-policy';
import { deriveJunjichuStage } from './derive-stage';
import { normalizeJunjichuSourceLabel } from './source-label';
import type {
  ArchiveView,
  CaseIdentityView,
  CouncilView,
  EvidenceView,
  GovernanceGateView,
  JunjichuPageView,
  JunjichuSourceLabel,
  QualityGateView,
  RoutingView,
  StreamView,
  SummonView,
  SwarmRunView,
} from './types';

export interface DeriveJunjichuPageViewInput {
  caseIdentity: CaseIdentityView;
  sourceLabel?: unknown;
  routing?: Partial<RoutingView>;
  summons?: SummonView[];
  evidence?: Partial<EvidenceView>;
  stream?: Partial<StreamView>;
  council?: Partial<CouncilView>;
  swarmRun?: SwarmRunView | null;
  gate?: Partial<QualityGateView>;
  governance?: Partial<GovernanceGateView>;
  decision?: Partial<JunjichuPageView['decision']>;
  archive?: Partial<ArchiveView>;
}

export function deriveJunjichuPageView(input: DeriveJunjichuPageViewInput): JunjichuPageView {
  const sourceLabel = normalizeJunjichuSourceLabel(input.sourceLabel, input.caseIdentity.hasRealTask ? 'MIXED' : 'DEMO');
  const summons = input.summons ?? [];
  const evidence: EvidenceView = {
    known: input.evidence?.known ?? [],
    missing: input.evidence?.missing ?? [],
    blocking: input.evidence?.blocking ?? false,
    owner: input.evidence?.owner,
    rerunScope: input.evidence?.rerunScope,
  };
  const stream: StreamView = {
    active: input.stream?.active ?? false,
    ministersCount: input.stream?.ministersCount ?? summons.length,
    groupsCount: input.stream?.groupsCount ?? 0,
    risksCount: input.stream?.risksCount ?? 0,
    councilSummary: input.stream?.councilSummary,
  };
  const gate: QualityGateView = {
    status: input.gate?.status ?? (input.caseIdentity.hasRealTask ? 'idle' : 'blocked'),
    blockingReasons: input.gate?.blockingReasons ?? [],
    warnings: input.gate?.warnings ?? [],
    sourceLabel: normalizeJunjichuSourceLabel(input.gate?.sourceLabel, sourceLabel),
    canAdopt: input.gate?.canAdopt ?? false,
    requiresHumanConfirmation: input.gate?.requiresHumanConfirmation ?? false,
  };
  const governance: GovernanceGateView = {
    waiting: input.governance?.waiting ?? false,
    reason: input.governance?.reason,
    proceedLabel: input.governance?.proceedLabel ?? '圣裁放行',
    nextAfterProceed: input.governance?.nextAfterProceed,
  };
  const decision = {
    written: input.decision?.written ?? false,
    decisionId: input.decision?.decisionId,
    reviewId: input.decision?.reviewId,
    canWriteBackendDecision: input.decision?.canWriteBackendDecision ?? input.caseIdentity.hasRealTask,
    note: input.decision?.note ?? (input.caseIdentity.hasRealTask ? '真实任务裁决将写回后端' : '当前仅为待接案视图'),
  };
  const archive: ArchiveView = {
    archived: input.archive?.archived ?? false,
    archiveId: input.archive?.archiveId,
    similarCases: input.archive?.similarCases ?? [],
    retrospectiveStatus: input.archive?.retrospectiveStatus ?? (decision.written ? 'available' : 'hidden'),
    knowledgeFeedbackStatus: input.archive?.knowledgeFeedbackStatus ?? (decision.written ? 'available' : 'hidden'),
  };
  const routing: RoutingView = {
    mode: input.routing?.mode ?? (input.caseIdentity.hasRealTask ? 'junjichu' : 'unknown'),
    reason: input.routing?.reason ?? (input.caseIdentity.hasRealTask ? '本案进入军机处会审' : '待上书房或圣旨立案后进入军机处'),
    recommendedDepartments: input.routing?.recommendedDepartments ?? summons.map((item) => item.name),
    abstainedDepartments: input.routing?.abstainedDepartments ?? [],
    sourceLabel: normalizeJunjichuSourceLabel(input.routing?.sourceLabel, sourceLabel),
  };
  const council: CouncilView = {
    ministers: input.council?.ministers ?? summons,
    conflicts: input.council?.conflicts ?? [],
    risks: input.council?.risks ?? [],
    verdict: input.council?.verdict,
    requiresHumanConfirmation: input.council?.requiresHumanConfirmation ?? gate.requiresHumanConfirmation,
  };
  const stage = deriveJunjichuStage({
    hasTask: Boolean(input.caseIdentity.taskId),
    hasRouting: routing.recommendedDepartments.length > 0,
    stream,
    gate,
    swarmRun: input.swarmRun ?? null,
    evidenceBlocking: evidence.blocking,
    decisionWritten: decision.written,
    archived: archive.archived,
  });

  return {
    caseIdentity: input.caseIdentity,
    stage,
    sourceLabel: sourceLabel as JunjichuSourceLabel,
    routing,
    summons,
    evidence,
    stream,
    council,
    swarmRun: input.swarmRun ?? null,
    gate,
    governance,
    decision,
    archive,
    actions: buildJunjichuActionPolicy({
      stage,
      gate,
      hasTask: Boolean(input.caseIdentity.taskId),
      canWriteBackendDecision: decision.canWriteBackendDecision,
      governanceWaiting: governance.waiting,
    }),
  };
}
