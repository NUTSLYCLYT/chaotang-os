import { backendJson } from '@/lib/backend-api';
import type { ApiEnvelope, BackendEnvelope } from '@/lib/contracts/api-envelope';
import type { BureauAction, BureauDepartmentCode, BureauPageView } from '@/lib/contracts/bureau-page-view';
import type { DeptOverview } from '@/lib/contracts/dept';

export interface BureauActionInput {
  viewId: string;
  action: BureauAction['id'];
  intent?: BureauAction['intent'];
  reason?: string;
  evidenceIds?: string[];
}

export interface BureauActionResult {
  accepted?: boolean;
  taskId?: string;
  status?: string;
  sourceLabel?: string;
  error?: string;
}

export interface LegalVerdictFromTextInput {
  text: string;
  case_id?: string;
}

export type LegalVerdictFromTextResult = Record<string, unknown>;

export function bureauOverviewPath(code: BureauDepartmentCode | string): string {
  return `/api/chaotang/dept/${encodeURIComponent(code)}/overview`;
}

export function bureauActionPath(department: string, bureau: string): string {
  return `/api/court/bureaus/${encodeURIComponent(department)}/${encodeURIComponent(bureau)}/actions`;
}

export const bureauApiPaths = {
  legalVerdictFromText: '/api/legal/verdict/from-text',
} as const;

export async function getBureauDepartmentOverview(
  code: BureauDepartmentCode | string,
): Promise<ApiEnvelope<DeptOverview>> {
  return backendJson<ApiEnvelope<DeptOverview>>(bureauOverviewPath(code));
}

export async function runBureauAction(
  department: string,
  bureau: string,
  input: BureauActionInput,
): Promise<ApiEnvelope<BureauActionResult>> {
  return backendJson<ApiEnvelope<BureauActionResult>>(bureauActionPath(department, bureau), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export async function createLegalVerdictFromText(
  input: LegalVerdictFromTextInput,
): Promise<ApiEnvelope<LegalVerdictFromTextResult>> {
  return backendJson<ApiEnvelope<LegalVerdictFromTextResult>>(bureauApiPaths.legalVerdictFromText, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export type BureauPageViewEnvelope = BackendEnvelope<BureauPageView>;
