import { backendJson } from '@/lib/backend-api';
import type { ApiEnvelope } from '@/lib/contracts/api-envelope';
import type { DadianFeedResponse, DadianPulseData } from '@/lib/contracts/dadian';

export interface DadianDecisionJudgmentStats {
  count: number;
  helpfulRate: number | null;
}

export interface DadianDecisionJudgmentInput {
  question?: string;
  verdict?: string;
  taskId?: string;
  helpful: boolean;
  note?: string;
}

export interface DadianDecisionJudgmentRecorded extends DadianDecisionJudgmentStats {
  recorded: true;
}

export const dadianApiPaths = {
  pulse: '/api/court/dadian/pulse',
  feed: '/api/court/dadian/feed',
  decisionJudgment: '/api/court/decision-judgment',
} as const;

export async function getDadianPulse(): Promise<ApiEnvelope<DadianPulseData>> {
  return backendJson<ApiEnvelope<DadianPulseData>>(dadianApiPaths.pulse);
}

export async function getDadianFeed(): Promise<ApiEnvelope<DadianFeedResponse>> {
  return backendJson<ApiEnvelope<DadianFeedResponse>>(dadianApiPaths.feed);
}

export async function getDadianDecisionJudgment(): Promise<ApiEnvelope<DadianDecisionJudgmentStats>> {
  return backendJson<ApiEnvelope<DadianDecisionJudgmentStats>>(dadianApiPaths.decisionJudgment);
}

export async function recordDadianDecisionJudgment(
  input: DadianDecisionJudgmentInput,
): Promise<ApiEnvelope<DadianDecisionJudgmentRecorded>> {
  return backendJson<ApiEnvelope<DadianDecisionJudgmentRecorded>>(dadianApiPaths.decisionJudgment, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}
