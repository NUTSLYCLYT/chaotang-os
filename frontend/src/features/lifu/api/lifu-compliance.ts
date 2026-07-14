import { backendFetch } from '@/lib/backend-api';

export const LIFU_COMPLIANCE_REPORT_PATH = '/api/swarm/lipu/compliance-report';
export const LIFU_COMPLIANCE_TIMEOUT_MS = 8_000;

export type LipuHardGateLight = 'green' | 'yellow' | 'red' | 'black';
export type LipuComplianceSourceLabel = 'DETERMINISTIC_GATE' | 'LLM_ONLY' | 'ENGINE_BACKED';

export interface LipuComplianceItem {
  level: 'green' | 'yellow' | 'red';
  title: string;
  fix: string | null;
  evidence_ref: string;
}

export interface LipuReviewOpinion {
  text: string;
  source_label: LipuComplianceSourceLabel;
}

export interface LipuXhsMonitorOpinion extends LipuReviewOpinion {
  run_id: string;
}

export interface LipuComplianceReport {
  light: LipuHardGateLight;
  headline: string;
  items: LipuComplianceItem[];
  source_label: LipuComplianceSourceLabel;
  deterministic_gated: true;
  review_opinion: LipuReviewOpinion | null;
  xhs_monitor_opinion: LipuXhsMonitorOpinion | null;
  missing_coverage: string[];
}

export type LipuComplianceOutcome =
  | { status: 'success'; sourceLabel: string; report: LipuComplianceReport }
  | { status: 'fallback'; sourceLabel: 'FALLBACK'; error: string };

export type LipuComplianceTransport = (
  path: string,
  init?: RequestInit,
) => Promise<Response>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isComplianceSourceLabel(value: unknown): value is LipuComplianceSourceLabel {
  return value === 'DETERMINISTIC_GATE' || value === 'LLM_ONLY' || value === 'ENGINE_BACKED';
}

function isOpinion(value: unknown): value is LipuReviewOpinion {
  return isRecord(value) && isNonEmptyString(value.text) && isComplianceSourceLabel(value.source_label);
}

function isXhsOpinion(value: unknown): value is LipuXhsMonitorOpinion {
  return isRecord(value) && isOpinion(value) && isNonEmptyString(value.run_id);
}

function isComplianceItem(value: unknown): value is LipuComplianceItem {
  if (!isRecord(value)) return false;
  return (
    (value.level === 'green' || value.level === 'yellow' || value.level === 'red') &&
    isNonEmptyString(value.title) &&
    (value.fix === null || typeof value.fix === 'string') &&
    typeof value.evidence_ref === 'string'
  );
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function parseLipuComplianceReport(value: unknown): LipuComplianceReport {
  if (!isRecord(value)) throw new Error('响应不是对象');
  const light = value.light;
  const reviewOpinion = value.review_opinion;
  const xhsMonitorOpinion = value.xhs_monitor_opinion;
  const missingCoverage = value.missing_coverage;
  const validLight = light === 'green' || light === 'yellow' || light === 'red' || light === 'black';

  if (
    !validLight ||
    typeof value.headline !== 'string' ||
    !Array.isArray(value.items) ||
    !value.items.every(isComplianceItem) ||
    !isComplianceSourceLabel(value.source_label) ||
    value.deterministic_gated !== true ||
    !(reviewOpinion === null || isOpinion(reviewOpinion)) ||
    !(xhsMonitorOpinion === null || isXhsOpinion(xhsMonitorOpinion)) ||
    !isStringArray(missingCoverage)
  ) {
    throw new Error('响应字段不符合礼部合规契约');
  }

  return {
    light,
    headline: value.headline,
    items: value.items,
    source_label: value.source_label,
    deterministic_gated: true,
    review_opinion: reviewOpinion,
    xhs_monitor_opinion: xhsMonitorOpinion,
    missing_coverage: missingCoverage,
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function requestLifuComplianceReport(
  taskInput: string,
  transport: LipuComplianceTransport = backendFetch,
  timeoutMs: number = LIFU_COMPLIANCE_TIMEOUT_MS,
): Promise<LipuComplianceOutcome> {
  try {
    const signal = AbortSignal.timeout(timeoutMs);
    const transportPromise = transport(LIFU_COMPLIANCE_REPORT_PATH, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ task_input: taskInput, archive: false }),
      signal,
    });
    const response = await new Promise<Response>((resolve, reject) => {
      const onAbort = () => reject(signal.reason ?? new Error(`request timed out after ${timeoutMs}ms`));
      signal.addEventListener('abort', onAbort, { once: true });
      transportPromise.then(resolve, reject).finally(() => signal.removeEventListener('abort', onAbort));
    });
    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`.trim());
    }
    const report = parseLipuComplianceReport(await response.json());
    return { status: 'success', sourceLabel: report.source_label, report };
  } catch (error) {
    return {
      status: 'fallback',
      sourceLabel: 'FALLBACK',
      error: `礼部真实合规引擎未能返回可用结果：${errorMessage(error)}`,
    };
  }
}
