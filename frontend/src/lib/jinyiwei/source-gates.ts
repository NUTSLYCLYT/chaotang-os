import type { SourceLabel } from '@/core/courtos/types';

export type FinancialSourceType =
  | 'official_filing'
  | 'regulator'
  | 'exchange'
  | 'market_data'
  | 'third_party_normalized'
  | 'news'
  | 'database';

export interface FinancialSourceRef {
  name: string;
  url: string;
  sourceType: FinancialSourceType;
  credibility: 'low' | 'medium' | 'high' | 'verified';
  publishedAt?: string;
  capturedAt: string;
  fields?: string[];
}

const LIVE_SOURCE_TYPES = new Set<FinancialSourceType>([
  'official_filing',
  'regulator',
  'exchange',
  'market_data',
]);

export function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

export function assertLiveSourcesHaveUrls(params: {
  sourceLabel: SourceLabel;
  sources: FinancialSourceRef[];
}): void {
  if (params.sourceLabel !== 'LIVE' && params.sourceLabel !== 'LIVE_SWARM') return;
  if (params.sources.length === 0) {
    throw new Error('LIVE source requires at least one public source URL');
  }
  const missingUrl = params.sources.find((source) => !source.url || !isValidHttpUrl(source.url));
  if (missingUrl) {
    throw new Error(`LIVE source has invalid public URL: ${missingUrl.name || 'unknown'}`);
  }
  if (!params.sources.some((source) => LIVE_SOURCE_TYPES.has(source.sourceType))) {
    throw new Error('LIVE financial source requires official_filing, regulator, exchange, or market_data source');
  }
}

export function sourceUrls(sources: FinancialSourceRef[]): string[] {
  return Array.from(new Set(sources.map((source) => source.url).filter(isValidHttpUrl)));
}

export function normalizeFinancialSourceType(value: string | null | undefined): FinancialSourceType {
  return value === 'official_filing'
    || value === 'regulator'
    || value === 'exchange'
    || value === 'market_data'
    || value === 'third_party_normalized'
    || value === 'news'
    || value === 'database'
    ? value
    : 'database';
}

export function normalizeFinancialSourceCredibility(
  value: string | null | undefined,
): FinancialSourceRef['credibility'] {
  return value === 'low' || value === 'medium' || value === 'high' || value === 'verified'
    ? value
    : 'medium';
}
