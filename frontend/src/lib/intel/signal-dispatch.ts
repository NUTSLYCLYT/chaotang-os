import type { AgentCode } from '@/lib/contracts/agent';
import type { IntelSignal } from '@/lib/contracts/intel';
import type { SourceLabel } from '@/core/courtos/types';
import {
  buildEvidenceBoundSwarmRun,
  type EvidenceBoundSwarmRun,
  type EvidenceClaimType,
  type EvidenceRef,
  type JinyiweiEvidencePackForSwarm,
} from '@/core/courtos/runtime/evidence-bound-swarm-run';

export type IntelSignalDataSource = 'turso' | 'fallback';

export interface IntelDispatchContext {
  source: IntelSignalDataSource;
  targetAgents: AgentCode[];
  note?: string | null;
}

export interface IntelDispatchPlan {
  command: string;
  entrySwarm: string;
  swarmBundles: string[];
  evidenceBoundRun: EvidenceBoundSwarmRun;
  sourceLabel: SourceLabel;
}

const PACK_KEYWORDS = [
  'pack',
  'battery',
  'cell',
  'bms',
  '储能',
  '电池',
  '电芯',
  '模组',
  '锂电',
  '磷酸铁锂',
];

function stableHash(value: string): string {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).padStart(7, '0');
}

function uniq<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

function clip(value: string, max = 320): string {
  return value.length > max ? `${value.slice(0, max - 1)}...` : value;
}

function textForRouting(signal: IntelSignal): string {
  return `${signal.title}\n${signal.summary}\n${signal.industry}`.toLowerCase();
}

function containsPackSignal(signal: IntelSignal): boolean {
  const text = textForRouting(signal);
  return PACK_KEYWORDS.some((keyword) => text.includes(keyword.toLowerCase()));
}

export function sourceLabelForSignalSource(source: IntelSignalDataSource): SourceLabel {
  return source === 'turso' ? 'LIVE' : 'FALLBACK';
}

export function claimTypeForSignal(signal: IntelSignal): EvidenceClaimType {
  if (signal.credibility === 'verified') return 'FACT';
  if (signal.credibility === 'high' || signal.credibility === 'medium') return 'CLAIM';
  return 'RUMOR';
}

export function entrySwarmForIntelDispatch(signal: IntelSignal, targetAgents: AgentCode[]): string {
  const targets = new Set(targetAgents);
  if (targets.has('xing_bu')) return 'legal';
  if (targets.has('hu_bu')) return 'finance';
  if (targets.has('gong_bu')) return containsPackSignal(signal) ? 'pack_rd' : 'sdlc';
  if (targets.has('li_bu_rites')) return 'xiaohongshu';
  if (targets.has('bing_bu')) return 'opc';
  return 'ai_ops';
}

export function swarmBundlesForIntelDispatch(targetAgents: AgentCode[]): string[] {
  const bundles = targetAgents.map((agent) => `intel_route:${agent}`);
  return uniq(['jinyiwei_evidence_check', 'evidence_gap_check', ...bundles]);
}

function isOlderThanDays(value: string, days: number): boolean {
  const date = Date.parse(value);
  if (!Number.isFinite(date)) return false;
  return Date.now() - date > days * 24 * 60 * 60 * 1000;
}

export function missingEvidenceForIntelDispatch(signal: IntelSignal): string[] {
  const missing: string[] = [];
  if (signal.sources.length === 0) {
    missing.push('no_source_attached_to_signal');
  }
  if (!signal.sources.some((source) => Boolean(source.url?.trim()))) {
    missing.push('source_url_missing');
  }
  if (signal.credibility !== 'verified') {
    missing.push(`credibility_not_verified:${signal.credibility}`);
  }
  if (signal.sources.length < 2) {
    missing.push('single_source_or_less');
  }
  if (isOlderThanDays(signal.lastUpdatedAt, 30)) {
    missing.push('signal_older_than_30_days');
  }
  if (signal.level === 'critical' && signal.credibility !== 'verified') {
    missing.push('critical_signal_requires_second_confirmation');
  }
  return uniq(missing);
}

export function forbiddenOutputsForIntelDispatch(targetAgents: AgentCode[]): string[] {
  const base = [
    'do_not_claim_unverified_facts_as_true',
    'do_not_issue_external_commitment',
    'do_not_lock_supplier_or_customer_terms',
    'do_not_generate_binding_quote',
  ];
  if (targetAgents.includes('xing_bu')) {
    base.push('do_not_provide_final_legal_opinion_without_human_review');
  }
  if (targetAgents.includes('hu_bu')) {
    base.push('do_not_approve_payment_budget_or_margin_without_finance_confirmation');
  }
  return uniq(base);
}

function evidenceRefsForSignal(signal: IntelSignal, sourceLabel: SourceLabel): EvidenceRef[] {
  const claimType = claimTypeForSignal(signal);
  const refs: EvidenceRef[] = [
    {
      id: `intel_signal:${signal.id}`,
      label: signal.title,
      claimType,
      sourceType: 'jinyiwei_intel_signal',
      sourceLabel,
      summary: clip(signal.summary),
    },
  ];

  signal.sources.forEach((source, index) => {
    const key = source.url?.trim() || `${source.name}:${source.publishedAt}:${index}`;
    refs.push({
      id: `intel_source:${signal.id}:${stableHash(key)}`,
      label: source.name || `source_${index + 1}`,
      claimType,
      sourceType: source.url ? 'external_url' : 'external_source',
      sourceLabel,
      summary: clip([source.name, source.publishedAt, source.url].filter(Boolean).join(' | ')),
    });
  });

  return refs;
}

export function buildIntelEvidencePack(
  signal: IntelSignal,
  context: IntelDispatchContext,
): JinyiweiEvidencePackForSwarm {
  const sourceLabel = sourceLabelForSignalSource(context.source);
  const evidenceRefs = evidenceRefsForSignal(signal, sourceLabel);
  const missingEvidence = missingEvidenceForIntelDispatch(signal);
  const sourceUrls = uniq(signal.sources.map((source) => source.url?.trim()).filter((url): url is string => Boolean(url)));
  const financialSources = signal.sources.map((source) => ({
    name: source.name,
    url: source.url,
    sourceType: 'official_filing',
    credibility: 'verified',
    publishedAt: source.publishedAt,
    capturedAt: signal.lastUpdatedAt,
  }));
  const unsupportedClaims = signal.credibility === 'verified'
    ? []
    : [`signal_claim_requires_verification_before_decision:${signal.id}`];

  return {
    schema_version: 'JinyiweiEvidencePackForSwarmV1',
    packId: `jinyiwei_intel_${signal.id}`,
    departmentId: 'jinyiwei',
    sourceLabel,
    sourceUrls,
    financialSources,
    facts: [
      `signal_id=${signal.id}`,
      `category=${signal.category}`,
      `level=${signal.level}`,
      `region=${signal.region}`,
      `credibility=${signal.credibility}`,
      `source_count=${signal.sources.length}`,
    ],
    evidenceRefs,
    missingEvidence,
    unsupportedClaims,
    forbiddenOutputs: forbiddenOutputsForIntelDispatch(context.targetAgents),
    qualityGates: [
      'source_label_required',
      'evidence_refs_or_missing_evidence_required',
      'no_external_commitment_without_human_confirmation',
      'reconcile_swarm_session_before_report_ready',
    ],
  };
}

export function buildIntelDispatchCommand(
  signal: IntelSignal,
  context: Pick<IntelDispatchContext, 'targetAgents' | 'note'>,
): string {
  const note = context.note?.trim();
  return [
    `Jinyiwei intel signal dispatch: ${signal.title}`,
    '',
    `Signal ID: ${signal.id}`,
    `Category: ${signal.category}`,
    `Level: ${signal.level}`,
    `Region: ${signal.regionLabel} (${signal.region})`,
    `Industry: ${signal.industry}`,
    `Credibility: ${signal.credibility}`,
    `Impact score: ${signal.impactScore ?? 'unknown'}`,
    '',
    'Summary:',
    signal.summary,
    '',
    `Target agents: ${context.targetAgents.join(', ')}`,
    note ? `Operator note: ${note}` : '',
    '',
    'Required output:',
    '- Verify what can be treated as evidence-bound fact.',
    '- List missing evidence and forbidden conclusions.',
    '- Return next actions only after preserving source labels.',
  ].filter(Boolean).join('\n');
}

export function buildIntelDispatchPlan(
  signal: IntelSignal,
  context: IntelDispatchContext,
): IntelDispatchPlan {
  const command = buildIntelDispatchCommand(signal, context);
  const entrySwarm = entrySwarmForIntelDispatch(signal, context.targetAgents);
  const intelligencePack = buildIntelEvidencePack(signal, context);
  const evidenceBoundRun = buildEvidenceBoundSwarmRun({
    taskInput: command,
    entrySwarm,
    providedIntelligencePack: intelligencePack,
    evidenceRefs: intelligencePack.evidenceRefs,
    missingEvidence: intelligencePack.missingEvidence,
  });

  return {
    command,
    entrySwarm,
    swarmBundles: swarmBundlesForIntelDispatch(context.targetAgents),
    evidenceBoundRun,
    sourceLabel: evidenceBoundRun.source_label,
  };
}
