import type { HanlinSourceLabel } from '@/features/hanlin/types';

interface HanlinLedgerView {
  sourceLabel: HanlinSourceLabel;
  isAvailable: boolean;
  totalEntries: number | null;
  deterministicEntries: number | null;
  passed: number | null;
  failed: number | null;
  passRate: number | null;
  authenticatedRatio: number | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

export function normalizeHanlinSourceLabel(value: unknown): HanlinSourceLabel {
  return value === 'TRUTH_LEDGER' ? 'TRUTH_LEDGER' : 'FALLBACK';
}

export function deriveHanlinLedgerView(value: unknown): HanlinLedgerView {
  const overview = isRecord(value) ? value : null;
  const ledger = overview && isRecord(overview.truthLedger) ? overview.truthLedger : null;
  const totalEntries = ledger ? finiteNumber(ledger.total_entries) : null;
  const deterministicEntries = ledger ? finiteNumber(ledger.deterministic_entries) : null;

  if (
    normalizeHanlinSourceLabel(overview?.sourceLabel) !== 'TRUTH_LEDGER' ||
    !ledger ||
    totalEntries === null ||
    totalEntries < 1 ||
    deterministicEntries === null ||
    deterministicEntries < 1
  ) {
    return {
      sourceLabel: 'FALLBACK',
      isAvailable: false,
      totalEntries: null,
      deterministicEntries: null,
      passed: null,
      failed: null,
      passRate: null,
      authenticatedRatio: null,
    };
  }

  return {
    sourceLabel: 'TRUTH_LEDGER',
    isAvailable: true,
    totalEntries,
    deterministicEntries,
    passed: finiteNumber(ledger.pass),
    failed: finiteNumber(ledger.fail),
    passRate: finiteNumber(ledger.pass_rate),
    authenticatedRatio: finiteNumber(ledger.authenticated_ratio),
  };
}
