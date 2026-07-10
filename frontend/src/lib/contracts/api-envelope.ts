export type ApiSourceLabel = 'LIVE' | 'LIVE_SWARM' | 'MIXED' | 'DEMO' | 'FALLBACK';

export interface ApiEnvelope<T> {
  success: boolean;
  data: T | null;
  error: string | null;
  message?: string | null;
  source_label?: ApiSourceLabel;
  sourceLabel?: ApiSourceLabel;
  generated_at?: string;
  generatedAt?: string;
}

export interface LegacyOkEnvelope<T> {
  ok: boolean;
  data?: T;
  error?: string | null;
  source_label?: ApiSourceLabel;
  sourceLabel?: ApiSourceLabel;
}

export type BackendEnvelope<T> = ApiEnvelope<T> | LegacyOkEnvelope<T> | T;
