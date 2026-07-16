import type {
  ShangshufangReviewMemorial,
  ShangshufangSourceLabel,
  ShangshufangTaskStatusResponse,
} from '@/lib/jiqun-api';
import {
  DEPARTMENT_IDENTITIES,
  MINISTRY_IDS,
  resolveCanonicalDepartment,
  type MinistryId,
} from '@/lib/contracts/dept';

type CanonicalSignal = 'GREEN' | 'YELLOW' | 'RED' | 'GRAY';
type CanonicalGateStatus = 'passed' | 'blocked' | 'unknown';

interface CanonicalFormalQuoteBrief {
  decision: string;
  primaryAction: string;
  riskLevel: 'RED' | 'YELLOW' | 'GREEN';
  materialActions: string[];
  missingEvidence: string[];
  safeReplyDraft: string;
}

interface CanonicalWorksDeliveryBrief {
  signal: string;
  crossDepartmentReviews: string[];
  forbiddenCommitments: string[];
  nextAction: string;
  needsHumanConfirmation: boolean;
}

export interface CanonicalDepartmentCard {
  ministryId: MinistryId;
  mainThesis: string;
  deputyChallenge: string;
  disputeFocus: string;
  ruling: string;
  signal: CanonicalSignal;
  conditionsToProceed: string[];
  missingEvidence: string[];
  sourceLabel: ShangshufangSourceLabel;
}

export interface CanonicalCourtProjection {
  kind: 'formal' | 'candidate';
  sourceLabel: ShangshufangSourceLabel;
  selectedDepartments: MinistryId[];
  trace: string[];
  review: {
    selectedMinistries: MinistryId[];
    cards: CanonicalDepartmentCard[];
    vetoes: MinistryId[];
    conflicts: Array<{ between: [MinistryId, MinistryId]; summary: string }>;
    overallSignal: CanonicalSignal;
    sourceLabel: ShangshufangSourceLabel;
  };
  gate: {
    status: CanonicalGateStatus;
    passed?: boolean;
    blockingIssues: string[];
    warnings: string[];
    needsHumanConfirmation: boolean;
  };
  audit: {
    passed?: boolean;
    blockingIssues: string[];
    warnings: string[];
    requiredActions: string[];
    needsHumanConfirmation: boolean;
    sourceLabel: ShangshufangSourceLabel;
  };
  report: {
    verdict?: string;
    summary?: string;
    oneSentence?: string;
    nextAction?: string;
    missingEvidence: string[];
    risks: string[];
    sourceLabel: ShangshufangSourceLabel;
    needsHumanConfirmation: boolean;
  };
  unified: {
    formalQuoteDecisionBrief?: CanonicalFormalQuoteBrief;
    memorialScroll: {
      seal: '奏折' | '機密';
      verdict: string;
      oneSentence: string;
      ministrySignals: Array<{ id: string; name: string; signal: string; summary: string }>;
      redBlueHighlights: Array<{ department: string; main: string; deputy: string }>;
      conflicts: string[];
      evidence: string[];
      missingEvidence: string[];
      risks: string[];
      nextAction: string;
      qualityGate: {
        status: '通过' | '阻断' | '未知';
        blockingIssues: string[];
        warnings: string[];
      };
      sourceLabel: string;
      needsHumanConfirmation: boolean;
      decisionActions: string[];
    };
    worksDeliveryBrief?: CanonicalWorksDeliveryBrief;
    evidenceGaps: string[];
    risks: string[];
    qualityGateStatus: CanonicalGateStatus;
  };
  source: 'shangshufang';
}

function unique(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))];
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function ministryId(value: string): MinistryId | null {
  const canonical = resolveCanonicalDepartment(value);
  if (!canonical) return null;
  const identity = DEPARTMENT_IDENTITIES[canonical];
  const id = 'ministryId' in identity ? identity.ministryId : undefined;
  return id && MINISTRY_IDS.includes(id as MinistryId) ? (id as MinistryId) : null;
}

function explicitSignal(value: unknown): CanonicalSignal | null {
  return value === 'GREEN' || value === 'YELLOW' || value === 'RED' || value === 'GRAY'
    ? value
    : null;
}

function selectedFromReview(
  status: ShangshufangTaskStatusResponse,
  memorial: ShangshufangReviewMemorial,
): MinistryId[] {
  const routing = status.review?.routing_plan;
  const routed = routing && Array.isArray(routing.selected_departments)
    ? routing.selected_departments
    : routing && Array.isArray(routing.ministry_candidates)
      ? routing.ministry_candidates
      : [];
  return unique([
    ...routed.filter((value): value is string => typeof value === 'string'),
    ...(memorial.department_memorials ?? []).map((item) => item.department_id),
    ...memorial.ministry_outputs.map((item) => item.department),
  ]).map(ministryId).filter((value): value is MinistryId => value !== null);
}

function cardsFromMemorial(memorial: ShangshufangReviewMemorial): CanonicalDepartmentCard[] {
  if (memorial.department_memorials?.length) {
    return memorial.department_memorials.flatMap((item) => {
      const id = ministryId(item.department_id);
      if (!id) return [];
      return [{
        ministryId: id,
        mainThesis: item.summary,
        deputyChallenge: '',
        disputeFocus: item.risks[0] ?? item.missing_evidence[0] ?? '',
        ruling: item.summary,
        signal: item.signal,
        conditionsToProceed: unique([item.next_order, ...item.missing_evidence]),
        missingEvidence: unique(item.missing_evidence),
        sourceLabel: item.source_label,
      }];
    });
  }

  return memorial.ministry_outputs.flatMap((item) => {
    const id = ministryId(item.department);
    if (!id) return [];
    return [{
      ministryId: id,
      mainThesis: item.opinion,
      deputyChallenge: '',
      disputeFocus: item.focus,
      ruling: item.opinion,
      signal: explicitSignal(item.status) ?? 'GRAY',
      conditionsToProceed: [],
      missingEvidence: [],
      sourceLabel: item.source_label,
    }];
  });
}

function explicitGate(memorial: ShangshufangReviewMemorial) {
  const gatePassed = typeof memorial.quality_gate.passed === 'boolean'
    ? memorial.quality_gate.passed
    : typeof memorial.swarm_quality_result?.passed === 'boolean'
      ? memorial.swarm_quality_result.passed
      : undefined;
  const status: CanonicalGateStatus = gatePassed === true
    ? 'passed'
    : gatePassed === false
      ? 'blocked'
      : 'unknown';
  const blockingIssues = unique([
    ...(memorial.quality_gate.blocking_issues ?? []),
    ...(memorial.swarm_quality_result?.blocking_reasons ?? []),
  ]);
  const warnings = unique([
    ...(memorial.quality_gate.warnings ?? []),
    ...(memorial.swarm_quality_result?.warnings ?? []),
  ]);
  const needsHumanConfirmation =
    memorial.human_confirmation_required === true ||
    memorial.quality_gate.human_confirmation_required === true ||
    memorial.quality_gate.human_signoff_required === true;
  return { status, passed: gatePassed, blockingIssues, warnings, needsHumanConfirmation };
}

/**
 * Court-owned status → presentation-only view model.
 *
 * This function intentionally has no question-text heuristics. It may select the immutable formal
 * snapshot over its mutable review, group explicit backend arrays, and map explicit enums to visual
 * states. Missing backend facts stay missing.
 */
export function projectCanonicalCourtStatus(
  status: ShangshufangTaskStatusResponse | null,
): CanonicalCourtProjection | null {
  if (!status) return null;
  const formal = status.formal_memorial;
  const memorial = formal?.memorial ?? status.review?.memorial ?? null;
  if (!memorial) return null;

  const kind = formal ? 'formal' : 'candidate';
  const sourceLabel = formal?.source_label ?? memorial.source_label;
  const gate = explicitGate(memorial);
  const selectedDepartments = selectedFromReview(status, memorial);
  const cards = cardsFromMemorial(memorial);
  const missingEvidence = unique([
    ...(memorial.missing_evidence ?? []),
    ...memorial.evidence_gaps,
    ...(memorial.swarm_brief_for_junjichu?.missing_evidence ?? []),
  ]);
  const risks = unique([
    ...(memorial.risk_register ?? []),
    ...memorial.risk_flags,
    ...(memorial.swarm_brief_for_junjichu?.risk_register ?? []).map((item) =>
      typeof item === 'string' ? item : JSON.stringify(item),
    ),
  ]);
  const nextAction = text(memorial.next_order)
    ?? text(memorial.swarm_brief_for_junjichu?.recommended_next_action)
    ?? text(memorial.next_best_action);
  const verdict = text(memorial.verdict);
  const oneSentence = text(memorial.executive_summary) ?? text(memorial.summary);
  const conflicts = memorial.conflict_summary.flatMap((item) => {
    const ids = unique(item.departments).map(ministryId).filter((value): value is MinistryId => value !== null);
    return ids.length >= 2 ? [{ between: [ids[0], ids[1]] as [MinistryId, MinistryId], summary: item.summary }] : [];
  });
  const vetoes = cards.filter((card) => card.signal === 'RED').map((card) => card.ministryId);
  const overallSignal: CanonicalSignal = gate.passed === true ? 'GREEN' : gate.passed === false ? 'RED' : 'GRAY';
  const requiredActions = unique([memorial.next_order, memorial.swarm_brief_for_junjichu?.recommended_next_action]);
  const trace = unique(memorial.swarm_trace_summary?.findings ?? []);
  const evidence = unique((memorial.evidence_chain ?? []).map((item) => item.summary));

  return {
    kind,
    sourceLabel,
    selectedDepartments,
    trace,
    review: {
      selectedMinistries: selectedDepartments,
      cards,
      vetoes,
      conflicts,
      overallSignal,
      sourceLabel,
    },
    gate,
    audit: {
      passed: gate.passed,
      blockingIssues: gate.blockingIssues,
      warnings: gate.warnings,
      requiredActions,
      needsHumanConfirmation: gate.needsHumanConfirmation,
      sourceLabel,
    },
    report: {
      verdict,
      summary: oneSentence,
      oneSentence,
      nextAction,
      missingEvidence,
      risks,
      sourceLabel,
      needsHumanConfirmation: gate.needsHumanConfirmation,
    },
    unified: {
      memorialScroll: {
        seal: kind === 'formal' ? '奏折' : '機密',
        verdict: verdict ?? '',
        oneSentence: oneSentence ?? '',
        ministrySignals: cards.map((card) => ({
          id: card.ministryId,
          name: DEPARTMENT_IDENTITIES[resolveCanonicalDepartment(card.ministryId)!].nameCn,
          signal: card.signal,
          summary: card.ruling,
        })),
        redBlueHighlights: [],
        conflicts: conflicts.map((item) => item.summary),
        evidence,
        missingEvidence,
        risks,
        nextAction: nextAction ?? '',
        qualityGate: {
          status: gate.status === 'passed' ? '通过' : gate.status === 'blocked' ? '阻断' : '未知',
          blockingIssues: gate.blockingIssues,
          warnings: gate.warnings,
        },
        sourceLabel,
        needsHumanConfirmation: gate.needsHumanConfirmation,
        decisionActions: memorial.decision_options.filter((item) => item.enabled).map((item) => item.label),
      },
      evidenceGaps: missingEvidence,
      risks,
      qualityGateStatus: gate.status,
    },
    source: 'shangshufang',
  };
}
