import { backendJson } from '@/lib/backend-api';
import type { ApiEnvelope } from '@/lib/contracts/api-envelope';
import type {
  ShangshufangBriefing,
  ShangshufangEdictReturn,
} from '@/lib/contracts/shangshufang';
import type {
  ShangshufangConfirmResponse,
  ShangshufangDraftEdict,
  ShangshufangDraftResponse,
  ShangshufangFinanceReportingLoopResponse,
  ShangshufangHomeResponse,
  ShangshufangPackSwarmLoopResponse,
  ShangshufangSwarmDeepenResponse,
  ShangshufangTaskDecisionResult,
  ShangshufangTaskStatusResponse,
} from '@/lib/jiqun-api';

export interface ShangshufangDraftInput {
  raw_question: string;
  mode?: 'order' | 'secret';
  attachments?: unknown[];
}

export interface ShangshufangConfirmInput {
  task_id: string;
  confirmed: boolean;
  edited_edict?: ShangshufangDraftEdict | null;
}

export interface ShangshufangTaskDecisionInput {
  action: string;
  reason?: string;
  human_confirmed?: boolean;
}

export const shangshufangApiPaths = {
  home: '/api/shangshufang/home',
  draftEdict: '/api/shangshufang/draft-edict',
  confirmEdict: '/api/shangshufang/confirm-edict',
  packSwarmLoop: '/api/shangshufang/pack-swarm-loop',
  financeReportingLoop: '/api/shangshufang/finance-reporting-loop',
  edictReturn: '/api/shangshufang/edict-return',
} as const;

export function shangshufangTaskStatusPath(taskId: string): string {
  return `/api/shangshufang/tasks/${encodeURIComponent(taskId)}/status`;
}

export function shangshufangTaskDecisionPath(taskId: string): string {
  return `/api/shangshufang/tasks/${encodeURIComponent(taskId)}/decision`;
}

export function shangshufangSwarmDeepenPath(taskId: string): string {
  return `/api/shangshufang/tasks/${encodeURIComponent(taskId)}/swarm-deepen`;
}

export function shangshufangBriefDecisionAdvancePath(briefId: string): string {
  return `/api/shangshufang/briefs/${encodeURIComponent(briefId)}/decision/advance`;
}

export async function getShangshufangHome(): Promise<ApiEnvelope<ShangshufangHomeResponse | ShangshufangBriefing>> {
  return backendJson<ApiEnvelope<ShangshufangHomeResponse | ShangshufangBriefing>>(shangshufangApiPaths.home);
}

export async function draftShangshufangEdict(input: ShangshufangDraftInput): Promise<ApiEnvelope<ShangshufangDraftResponse>> {
  return backendJson<ApiEnvelope<ShangshufangDraftResponse>>(shangshufangApiPaths.draftEdict, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export async function confirmShangshufangEdict(input: ShangshufangConfirmInput): Promise<ApiEnvelope<ShangshufangConfirmResponse>> {
  return backendJson<ApiEnvelope<ShangshufangConfirmResponse>>(shangshufangApiPaths.confirmEdict, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export async function getShangshufangTaskStatus(taskId: string): Promise<ApiEnvelope<ShangshufangTaskStatusResponse>> {
  return backendJson<ApiEnvelope<ShangshufangTaskStatusResponse>>(shangshufangTaskStatusPath(taskId));
}

export async function decideShangshufangTask(
  taskId: string,
  input: ShangshufangTaskDecisionInput,
): Promise<ApiEnvelope<ShangshufangTaskDecisionResult>> {
  return backendJson<ApiEnvelope<ShangshufangTaskDecisionResult>>(shangshufangTaskDecisionPath(taskId), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export async function deepenShangshufangSwarm(taskId: string): Promise<ApiEnvelope<ShangshufangSwarmDeepenResponse>> {
  return backendJson<ApiEnvelope<ShangshufangSwarmDeepenResponse>>(shangshufangSwarmDeepenPath(taskId), {
    method: 'POST',
  });
}

export async function packShangshufangSwarmLoop(input: Record<string, unknown>): Promise<ApiEnvelope<ShangshufangPackSwarmLoopResponse>> {
  return backendJson<ApiEnvelope<ShangshufangPackSwarmLoopResponse>>(shangshufangApiPaths.packSwarmLoop, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export async function runShangshufangFinanceReportingLoop(
  input: Record<string, unknown>,
): Promise<ApiEnvelope<ShangshufangFinanceReportingLoopResponse>> {
  return backendJson<ApiEnvelope<ShangshufangFinanceReportingLoopResponse>>(shangshufangApiPaths.financeReportingLoop, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export async function persistShangshufangEdictReturn(
  input: Record<string, unknown>,
): Promise<ApiEnvelope<ShangshufangEdictReturn>> {
  return backendJson<ApiEnvelope<ShangshufangEdictReturn>>(shangshufangApiPaths.edictReturn, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}
