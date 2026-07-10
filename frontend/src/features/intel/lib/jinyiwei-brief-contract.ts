import type { IntelSignal } from '@/types/intel';

export type JinyiweiSourceLabel = 'LIVE_SEARCH' | 'CALLER_FINDINGS' | 'FALLBACK';
export type JinyiweiLight = 'green' | 'yellow' | 'red' | 'black';
export type JinyiweiDecision = '入库' | '待核' | '拒';
export type JinyiweiBriefPhase = 'idle' | 'collecting' | 'ready' | 'empty' | 'error';
export type JinyiweiAuxView = 'scroll' | 'industry' | 'map' | 'queue';

export interface JinyiweiFindingInput {
  claim: string;
  sources: Array<{ name: string; url?: string; tier?: string }>;
}

export interface JinyiweiBriefItem {
  level: JinyiweiLight;
  title: string;
  odds?: string | null;
  impact?: JinyiweiDecision | string;
  evidence_ref?: string | null;
  primary_source?: boolean;
  distinct_sources?: number;
  hard_claim?: boolean;
  vet_reason?: string;
  sources?: Array<{ name: string; url?: string | null; tier?: string | null; published_at?: string | null }>;
  fix?: string | null;
}

export interface JinyiweiBrief {
  doc_type: string;
  dept: 'jinyiwei';
  case_id: string;
  light: JinyiweiLight;
  headline: string;
  shielded?: string | null;
  items: JinyiweiBriefItem[];
  actions?: string[];
  sourceLabel?: JinyiweiSourceLabel;
  source_label?: string;
  provenance?: {
    advisors?: string[];
    archive_id?: string | null;
    gate?: 'passed' | 'pending' | string;
    deterministic_gated?: boolean | null;
    grounding?: string;
  };
}

export interface JinyiweiBriefEnvelope {
  success: boolean;
  data?: JinyiweiBrief;
  error?: string | null;
  message?: string | null;
}

export interface JinyiweiSignalStats {
  total: number;
  real: number;
  sourceUrls: number;
  alerts: number;
  pending: number;
}

export function resolveBriefSourceLabel(brief: JinyiweiBrief | null): JinyiweiSourceLabel {
  if (!brief) return 'FALLBACK';
  return brief.sourceLabel ?? 'FALLBACK';
}

export function isLiveBrief(brief: JinyiweiBrief | null): boolean {
  const label = resolveBriefSourceLabel(brief);
  return label === 'LIVE_SEARCH' || label === 'CALLER_FINDINGS';
}

export function deriveBriefPhase(brief: JinyiweiBrief): JinyiweiBriefPhase {
  return brief.items.length > 0 ? 'ready' : 'empty';
}

export function countSignalStats(signals: IntelSignal[], source: 'turso' | 'fallback'): JinyiweiSignalStats {
  const sourceUrls = signals.reduce(
    (total, signal) => total + signal.sources.filter((item) => Boolean(item.url)).length,
    0,
  );
  return {
    total: signals.length,
    real: source === 'turso' ? signals.filter((signal) => signal.sources.some((item) => Boolean(item.url))).length : 0,
    sourceUrls: source === 'turso' ? sourceUrls : 0,
    alerts: signals.filter((signal) => signal.level === 'warning' || signal.level === 'critical').length,
    pending: signals.filter((signal) => signal.credibility === 'low' || signal.credibility === 'medium').length,
  };
}

export function nextRouteForLight(light: JinyiweiLight): { label: string; reason: string } {
  if (light === 'green') return { label: '钦天监', reason: '情报可信，可进入预测与方向判断。' };
  if (light === 'yellow') return { label: '御史', reason: '可参考但仍需全局风险与证据复核。' };
  if (light === 'red') return { label: '锦衣卫补证', reason: '证据不足或情报不可信，继续采证。' };
  return { label: '刑部', reason: '重大或不可逆风险，进入安全与合规处置。' };
}

export function evidenceHref(value: string | null | undefined): string | null {
  if (!value) return null;
  return /^https?:\/\//i.test(value) ? value : null;
}
