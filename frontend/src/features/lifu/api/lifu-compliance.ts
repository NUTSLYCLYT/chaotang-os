import { backendFetch } from '@/lib/backend-api';

export const LIFU_COMPLIANCE_REPORT_PATH = '/api/swarm/lipu/compliance-report';

export type LipuHardGateLight = 'green' | 'yellow' | 'red' | 'black';

export interface LipuComplianceItem {
  level: 'green' | 'yellow' | 'red';
  title: string;
  fix: string | null;
  evidence_ref: string;
}

export interface LipuReviewOpinion {
  text: string;
  source_label: string;
}

export interface LipuXhsMonitorOpinion extends LipuReviewOpinion {
  run_id: string;
}

export interface LipuComplianceReport {
  light: LipuHardGateLight;
  headline: string;
  items: LipuComplianceItem[];
  source_label: string;
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

function isOpinion(value: unknown): value is LipuReviewOpinion {
  return isRecord(value) && isNonEmptyString(value.text) && isNonEmptyString(value.source_label);
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

function parseLipuComplianceReport(value: unknown): LipuComplianceReport {
  if (!isRecord(value)) throw new Error('响应不是对象');
  const light = value.light;
  const validLight = light === 'green' || light === 'yellow' || light === 'red' || light === 'black';
  const validReview = value.review_opinion === null || isOpinion(value.review_opinion);
  const validXhs = value.xhs_monitor_opinion === null || isXhsOpinion(value.xhs_monitor_opinion);
  const validMissing = Array.isArray(value.missing_coverage) && value.missing_coverage.every((item) => typeof item === 'string');

  if (
    !validLight ||
    typeof value.headline !== 'string' ||
    !Array.isArray(value.items) ||
    !value.items.every(isComplianceItem) ||
    !isNonEmptyString(value.source_label) ||
    value.deterministic_gated !== true ||
    !validReview ||
    !validXhs ||
    !validMissing
  ) {
    throw new Error('响应字段不符合礼部合规契约');
  }

  return value as unknown as LipuComplianceReport;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function requestLifuComplianceReport(
  taskInput: string,
  transport: LipuComplianceTransport = backendFetch,
): Promise<LipuComplianceOutcome> {
  try {
    const response = await transport(LIFU_COMPLIANCE_REPORT_PATH, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ task_input: taskInput, archive: false }),
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
