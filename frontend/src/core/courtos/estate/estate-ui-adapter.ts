import type { EstateDispatchTrace, SecretEdict, SecretMemo } from './estate-types.ts';
import type { SourceLabel } from '../types';
import { listFormations } from './formation-registry.ts';
import { listSwarmCapabilities } from './swarm-capability-registry.ts';

export interface EstateDashboardViewModel {
  swarmCapabilityGroups: Array<{
    title: string;
    swarms: Array<{ id: string; name: string; activity: string; riskLevel: string; sourceLabelRequired: boolean }>;
  }>;
  activeFormations: Array<{ id: string; name: string; purpose: string; asyncRequired: boolean; humanApprovalRequired: boolean }>;
  secretEdictQueue: SecretEdict[];
  emperorReviewQueue: SecretMemo[];
  yushitaiAuditQueue: SecretEdict[];
  promotedToCourtQueue: SecretMemo[];
  sealedArchiveCount: number;
  swarmHealth: Array<{ id: string; name: string; status: 'online' | 'audit_required'; sourceLabel: SourceLabel }>;
  latestDispatchTraces: EstateDispatchTrace[];
}

const TECH_LOG_PATTERNS = [/agent_\d+/i, /tool_/i, /embedding/i, /node_\d+/i, /trace_id/i, /called/i];

function isBusinessReadable(activity: string): boolean {
  return !TECH_LOG_PATTERNS.some((pattern) => pattern.test(activity));
}

function groupTitle(id: string): string {
  if (id.includes('yushitai') || id.includes('redteam') || id.includes('worst_case')) return '红队与审计蜂群';
  if (id.includes('finance') || id.includes('justice') || id.includes('works') || id.includes('ritual') || id.includes('war') || id.includes('personnel')) return '六部蜂群';
  if (id.includes('contract') || id.includes('equity') || id.includes('cashflow') || id.includes('bom') || id.includes('customer') || id.includes('message')) return '专项蜂群';
  return '核心蜂群';
}

export function buildEstateDashboardViewModel(params: {
  secretEdicts?: SecretEdict[];
  secretMemos?: SecretMemo[];
  dispatchTraces?: EstateDispatchTrace[];
  sourceLabel?: SourceLabel;
} = {}): EstateDashboardViewModel {
  const sourceLabel = params.sourceLabel ?? 'MIXED';
  const grouped = new Map<string, ReturnType<typeof listSwarmCapabilities>>();
  for (const swarm of listSwarmCapabilities()) {
    const title = groupTitle(swarm.id);
    grouped.set(title, [...(grouped.get(title) ?? []), swarm]);
  }
  const safeTraces = (params.dispatchTraces ?? []).filter((trace) => isBusinessReadable(trace.activity));

  return {
    swarmCapabilityGroups: Array.from(grouped.entries()).map(([title, swarms]) => ({
      title,
      swarms: swarms.map((swarm) => ({
        id: swarm.id,
        name: swarm.name,
        activity: swarm.userFacingActivity,
        riskLevel: swarm.riskLevel,
        sourceLabelRequired: swarm.sourceLabelRequired,
      })),
    })),
    activeFormations: listFormations().map((formation) => ({
      id: formation.id,
      name: formation.name,
      purpose: formation.purpose,
      asyncRequired: formation.asyncRequired,
      humanApprovalRequired: formation.humanApprovalRequired,
    })),
    secretEdictQueue: (params.secretEdicts ?? []).filter((item) => !['PROMOTED_TO_COURT', 'SEALED_ARCHIVE', 'DISMISSED'].includes(item.status)),
    emperorReviewQueue: (params.secretMemos ?? []).filter((item) => item.needsHumanConfirmation || item.recommendation === 'PROMOTE_TO_COURT'),
    yushitaiAuditQueue: (params.secretEdicts ?? []).filter((item) => item.auditRequired && item.status !== 'SEALED_ARCHIVE'),
    promotedToCourtQueue: (params.secretMemos ?? []).filter((item) => item.recommendation === 'PROMOTE_TO_COURT'),
    sealedArchiveCount: (params.secretEdicts ?? []).filter((item) => item.status === 'SEALED_ARCHIVE').length,
    swarmHealth: listSwarmCapabilities().map((swarm) => ({
      id: swarm.id,
      name: swarm.name,
      status: swarm.requiresAudit ? 'audit_required' : 'online',
      sourceLabel,
    })),
    latestDispatchTraces: safeTraces,
  };
}
