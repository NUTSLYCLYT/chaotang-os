'use client';

import type {
  HubuPaymentDecisionInput,
  HubuPaymentDecisionPreview,
  HubuPaymentFactPack,
  HubuPaymentPreview,
  HubuReportingDecisionInput,
  HubuReportingDecisionPreview,
  HubuReportingFactPack,
  HubuReportingPreview,
} from '@/lib/contracts/hubu';

const BASE_PATH = (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_BASE_PATH) ?? '';

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE_PATH}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  });

  const json = (await res.json()) as { success?: boolean; data?: T; error?: string };
  if (!res.ok || json.success === false) {
    throw new Error(json.error ?? `${path}: ${res.status} ${res.statusText}`);
  }

  if (json.data === undefined) {
    throw new Error(`${path}: response missing data`);
  }

  return json.data;
}

export function previewHubuPayment(factPack: HubuPaymentFactPack) {
  return postJson<HubuPaymentPreview>('/api/court/chaotang/hubu/payment/preview', factPack);
}

export function previewHubuPaymentDecision(factPack: HubuPaymentFactPack, decision: HubuPaymentDecisionInput) {
  return postJson<HubuPaymentDecisionPreview>('/api/court/chaotang/hubu/payment/decision/preview', {
    factPack,
    decisionInput: decision,
  });
}

export function previewHubuFinanceReporting(factPack: HubuReportingFactPack) {
  return postJson<HubuReportingPreview>('/api/court/chaotang/hubu/finance/reporting/preview', factPack);
}

export function previewHubuFinanceReportingDecision(factPack: HubuReportingFactPack, decision: HubuReportingDecisionInput) {
  return postJson<HubuReportingDecisionPreview>('/api/court/chaotang/hubu/finance/reporting/decision/preview', {
    factPack,
    decisionInput: decision,
  });
}
