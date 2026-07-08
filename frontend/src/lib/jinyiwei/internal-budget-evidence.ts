import type { SourceLabel } from '@/core/courtos/types';

export type ResearchBudgetLineItemCategory =
  | 'headcount'
  | 'equipment'
  | 'cloud'
  | 'software'
  | 'supplier'
  | 'prototype'
  | 'other';

export interface ResearchBudgetLineItem {
  id: string;
  category: ResearchBudgetLineItemCategory;
  title: string;
  amount: number;
  currency: string;
  evidenceRefs: string[];
  confidence: 'low' | 'medium' | 'high';
}

export interface InternalBudgetEvidenceRef {
  id: string;
  label: string;
  kind: 'historical_spend' | 'supplier_quote' | 'cloud_bill' | 'owner_signoff' | 'milestone_plan' | 'uploaded_file';
  url?: string;
  sourceLabel: 'INTERNAL_LEDGER' | 'UPLOADED_EVIDENCE' | 'OWNER_ATTESTATION';
}

export interface ResearchBudgetRequest {
  department: string;
  owner: string;
  budgetPeriod: string;
  requestedAmount: number;
  currency: string;
  purpose: string;
  lineItems: ResearchBudgetLineItem[];
  evidenceRefs: InternalBudgetEvidenceRef[];
  riskThresholdAmount: number;
}

export interface InternalBudgetEvidencePack {
  packType: 'internal_research_budget';
  sourceLabel: SourceLabel;
  evidenceMode: 'INTERNAL_LEDGER' | 'UPLOADED_EVIDENCE' | 'MISSING_EVIDENCE';
  department: string;
  owner: string;
  budgetPeriod: string;
  requestedAmount: number;
  currency: string;
  purpose: string;
  lineItems: ResearchBudgetLineItem[];
  evidenceRefs: InternalBudgetEvidenceRef[];
  missingEvidence: string[];
  evidenceCompleteness: number;
  riskGate: {
    approvalThresholdAmount: number;
    manualConfirmationRequired: boolean;
    reason: string;
  };
  blockedActions: string[];
  sourceUrls: string[];
  createdAt: string;
}

function slug(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'item';
}

function readAmount(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, value);
  if (typeof value !== 'string') return 0;
  const normalized = value.replace(/,/g, '').trim();
  const match = normalized.match(/(\d+(?:\.\d+)?)/);
  if (!match) return 0;
  const amount = Number(match[1]);
  return Number.isFinite(amount) ? amount : 0;
}

function normalizeCategory(value: unknown): ResearchBudgetLineItemCategory {
  return value === 'headcount'
    || value === 'equipment'
    || value === 'cloud'
    || value === 'software'
    || value === 'supplier'
    || value === 'prototype'
    || value === 'other'
    ? value
    : 'other';
}

function normalizeEvidenceKind(value: unknown): InternalBudgetEvidenceRef['kind'] {
  return value === 'historical_spend'
    || value === 'supplier_quote'
    || value === 'cloud_bill'
    || value === 'owner_signoff'
    || value === 'milestone_plan'
    || value === 'uploaded_file'
    ? value
    : 'uploaded_file';
}

function normalizeSourceLabel(value: unknown): InternalBudgetEvidenceRef['sourceLabel'] {
  return value === 'INTERNAL_LEDGER' || value === 'UPLOADED_EVIDENCE' || value === 'OWNER_ATTESTATION'
    ? value
    : 'UPLOADED_EVIDENCE';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function normalizeResearchBudgetRequest(input: unknown): ResearchBudgetRequest {
  const body = isRecord(input) ? input : {};
  const rawLineItems = Array.isArray(body.lineItems) ? body.lineItems : [];
  const currency = typeof body.currency === 'string' && body.currency.trim() ? body.currency.trim().toUpperCase() : 'CNY';
  const lineItems = rawLineItems
    .filter(isRecord)
    .map((item, index): ResearchBudgetLineItem => {
      const title = typeof item.title === 'string' && item.title.trim() ? item.title.trim() : `Budget line ${index + 1}`;
      const amount = readAmount(item.amount);
      return {
        id: typeof item.id === 'string' && item.id.trim() ? item.id.trim() : `${slug(title)}_${index + 1}`,
        category: normalizeCategory(item.category),
        title,
        amount,
        currency: typeof item.currency === 'string' && item.currency.trim() ? item.currency.trim().toUpperCase() : currency,
        evidenceRefs: Array.isArray(item.evidenceRefs) ? item.evidenceRefs.map(String).filter(Boolean) : [],
        confidence: item.confidence === 'high' || item.confidence === 'medium' || item.confidence === 'low'
          ? item.confidence
          : 'low',
      };
    });
  const requestedAmount = readAmount(body.requestedAmount) || lineItems.reduce((sum, item) => sum + item.amount, 0);
  const evidenceRefs = (Array.isArray(body.evidenceRefs) ? body.evidenceRefs : [])
    .filter(isRecord)
    .map((item, index): InternalBudgetEvidenceRef => ({
      id: typeof item.id === 'string' && item.id.trim() ? item.id.trim() : `evidence_${index + 1}`,
      label: typeof item.label === 'string' && item.label.trim() ? item.label.trim() : `Evidence ${index + 1}`,
      kind: normalizeEvidenceKind(item.kind),
      url: typeof item.url === 'string' && /^https?:\/\//i.test(item.url.trim()) ? item.url.trim() : undefined,
      sourceLabel: normalizeSourceLabel(item.sourceLabel),
    }));

  return {
    department: typeof body.department === 'string' && body.department.trim() ? body.department.trim() : '研发部',
    owner: typeof body.owner === 'string' && body.owner.trim() ? body.owner.trim() : '',
    budgetPeriod: typeof body.budgetPeriod === 'string' && body.budgetPeriod.trim() ? body.budgetPeriod.trim() : '',
    requestedAmount,
    currency,
    purpose: typeof body.purpose === 'string' && body.purpose.trim() ? body.purpose.trim() : '研发预算申请',
    lineItems,
    evidenceRefs,
    riskThresholdAmount: readAmount(body.riskThresholdAmount) || 500_000,
  };
}

export function buildInternalBudgetEvidencePack(
  request: ResearchBudgetRequest,
  now = new Date().toISOString(),
): InternalBudgetEvidencePack {
  const missing = new Set<string>();
  if (!request.owner) missing.add('owner_signoff_required');
  if (!request.budgetPeriod) missing.add('budget_period_required');
  if (request.lineItems.length === 0) missing.add('line_items_required');
  if (!request.evidenceRefs.some((item) => item.kind === 'historical_spend')) missing.add('historical_spend_required');
  if (!request.evidenceRefs.some((item) => item.kind === 'supplier_quote' || item.kind === 'cloud_bill')) {
    missing.add('supplier_quote_or_cloud_bill_required');
  }
  for (const item of request.lineItems) {
    if (item.amount <= 0) missing.add(`line_item_amount_required:${item.id}`);
    if (item.evidenceRefs.length === 0) missing.add(`line_item_evidence_required:${item.id}`);
  }

  const missingEvidence = Array.from(missing);
  const requiredCount = 5 + request.lineItems.length;
  const evidenceCompleteness = Math.max(0, Math.min(100, Math.round(((requiredCount - missingEvidence.length) / requiredCount) * 100)));
  const sourceUrls = request.evidenceRefs.map((item) => item.url).filter((url): url is string => Boolean(url));
  const manualConfirmationRequired = request.requestedAmount >= request.riskThresholdAmount;

  return {
    packType: 'internal_research_budget',
    sourceLabel: missingEvidence.length ? 'FALLBACK' : 'MIXED',
    evidenceMode: missingEvidence.length ? 'MISSING_EVIDENCE' : 'INTERNAL_LEDGER',
    department: request.department,
    owner: request.owner,
    budgetPeriod: request.budgetPeriod,
    requestedAmount: request.requestedAmount,
    currency: request.currency,
    purpose: request.purpose,
    lineItems: request.lineItems,
    evidenceRefs: request.evidenceRefs,
    missingEvidence,
    evidenceCompleteness,
    riskGate: {
      approvalThresholdAmount: request.riskThresholdAmount,
      manualConfirmationRequired,
      reason: manualConfirmationRequired
        ? `requested_amount_gte_${request.riskThresholdAmount}`
        : 'below_manual_confirmation_threshold',
    },
    blockedActions: missingEvidence.length ? ['issue_decree'] : [],
    sourceUrls,
    createdAt: now,
  };
}

export function formatBudgetAmount(amount: number, currency: string): string {
  return `${currency} ${Math.round(amount).toLocaleString('en-US')}`;
}
