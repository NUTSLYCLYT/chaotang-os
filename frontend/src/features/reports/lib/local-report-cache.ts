import type { Report } from '@/types/report';

const LOCAL_REPORT_CACHE_PREFIX = 'chaotang:local-report:';

function isReportLike(value: unknown): value is Report {
  if (!value || typeof value !== 'object') return false;
  const report = value as Partial<Report>;
  return (
    typeof report.id === 'string' &&
    typeof report.title === 'string' &&
    typeof report.createdAt === 'string' &&
    Array.isArray(report.sections)
  );
}

export function saveLocalReport(report: Report): void {
  if (typeof window === 'undefined') return;
  const payload = JSON.stringify(report);
  const key = `${LOCAL_REPORT_CACHE_PREFIX}${report.id}`;
  try {
    window.sessionStorage.setItem(key, payload);
  } catch {
    /* storage may be unavailable in hardened browser contexts */
  }
  try {
    window.localStorage.setItem(key, payload);
  } catch {
    /* storage may be unavailable in hardened browser contexts */
  }
}

export function readLocalReport(id: string): Report | null {
  if (typeof window === 'undefined') return null;
  const key = `${LOCAL_REPORT_CACHE_PREFIX}${id}`;
  let raw: string | null = null;
  try {
    raw = window.sessionStorage.getItem(key);
  } catch {
    raw = null;
  }
  if (!raw) {
    try {
      raw = window.localStorage.getItem(key);
    } catch {
      raw = null;
    }
  }
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as unknown;
    return isReportLike(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
