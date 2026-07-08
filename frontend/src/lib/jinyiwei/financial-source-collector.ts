import type { SourceLabel } from '@/core/courtos/types';
import {
  assertLiveSourcesHaveUrls,
  type FinancialSourceRef,
} from './source-gates';

export interface FinancialSourceCollectionInput {
  ticker: string;
  market?: string | null;
  taskId?: string | null;
  issueId?: string | null;
  preferredSources?: string[];
  manualSources?: Array<{ name?: string; url: string; sourceType?: string; credibility?: string }>;
}

export interface FinancialSourceCollection {
  signalId: string;
  sourceLabel: SourceLabel;
  ticker: string;
  market: string;
  title: string;
  summary: string;
  sources: FinancialSourceRef[];
  missingEvidence: string[];
  unsupportedClaims: string[];
}

interface SecTickerRow {
  cik_str?: number;
  ticker?: string;
  title?: string;
}

const KNOWN_CIK: Record<string, { cik: string; title: string }> = {
  AAPL: { cik: '0000320193', title: 'Apple Inc.' },
  MSFT: { cik: '0000789019', title: 'Microsoft Corporation' },
  NVDA: { cik: '0001045810', title: 'NVIDIA Corporation' },
  TSLA: { cik: '0001318605', title: 'Tesla, Inc.' },
  AMZN: { cik: '0001018724', title: 'Amazon.com, Inc.' },
  GOOGL: { cik: '0001652044', title: 'Alphabet Inc.' },
  META: { cik: '0001326801', title: 'Meta Platforms, Inc.' },
};

function normalizeTicker(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9.-]/g, '');
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10).replace(/-/g, '');
}

function padCik(value: number | string): string {
  return String(value).replace(/\D/g, '').padStart(10, '0');
}

async function lookupSecTicker(ticker: string): Promise<{ cik: string; title: string } | null> {
  const known = KNOWN_CIK[ticker];
  if (known) return known;

  const response = await fetch('https://www.sec.gov/files/company_tickers.json', {
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      'User-Agent': 'chaotang-web-lyt contact@example.com',
    },
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) return null;

  const data = (await response.json()) as Record<string, SecTickerRow>;
  for (const row of Object.values(data)) {
    if (row.ticker?.toUpperCase() === ticker && row.cik_str) {
      return { cik: padCik(row.cik_str), title: row.title ?? ticker };
    }
  }
  return null;
}

export async function collectFinancialSources(
  input: FinancialSourceCollectionInput,
): Promise<FinancialSourceCollection> {
  const ticker = normalizeTicker(input.ticker);
  if (!ticker) throw new Error('ticker_required');

  const market = (input.market ?? 'US').trim().toUpperCase() || 'US';
  if (market !== 'US') {
    throw new Error('only_us_market_supported_in_mvp');
  }

  const sec = await lookupSecTicker(ticker);
  if (!sec) {
    throw new Error(`sec_cik_not_found:${ticker}`);
  }

  const capturedAt = new Date().toISOString();
  const companyFactsUrl = `https://data.sec.gov/api/xbrl/companyfacts/CIK${sec.cik}.json`;
  const submissionsUrl = `https://data.sec.gov/submissions/CIK${sec.cik}.json`;
  const sources: FinancialSourceRef[] = [
    {
      name: 'SEC EDGAR companyfacts',
      url: companyFactsUrl,
      sourceType: 'official_filing',
      credibility: 'verified',
      capturedAt,
      fields: ['Revenue', 'NetIncomeLoss', 'Assets', 'OperatingCashFlow'],
    },
    {
      name: 'SEC EDGAR submissions',
      url: submissionsUrl,
      sourceType: 'official_filing',
      credibility: 'verified',
      capturedAt,
      fields: ['10-K', '10-Q', '8-K'],
    },
  ];
  for (const [index, source] of (input.manualSources ?? []).entries()) {
    const url = source.url.trim();
    if (!/^https?:\/\//i.test(url)) continue;
    sources.push({
      name: source.name?.trim() || `User supplied source ${index + 1}`,
      url,
      sourceType: 'database',
      credibility: 'medium',
      capturedAt,
      fields: ['user_supplied_context'],
    });
  }

  const sourceLabel: SourceLabel = input.manualSources?.length ? 'MIXED' : 'LIVE';
  assertLiveSourcesHaveUrls({ sourceLabel, sources });

  return {
    signalId: `intel_fin_${ticker.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${todayKey()}`,
    sourceLabel,
    ticker,
    market,
    title: `${ticker} financial source collection`,
    summary: `${ticker} (${sec.title}) public SEC EDGAR financial sources collected for Hu Bu valuation workflow.`,
    sources,
    missingEvidence: [],
    unsupportedClaims: [],
  };
}
