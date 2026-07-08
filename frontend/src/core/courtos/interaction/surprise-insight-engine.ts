/**
 * SurpriseInsightEngine（V3 Prompt 4）：惊喜必须来自真实高价值信息。
 * 规则：必须有证据 + whyItMatters + suggestedAction；最多 3 条；无合格则不生成（不泛泛而谈）；
 * DEMO 不伪装真实。
 */
import type { SourceLabel } from '../types.ts';

export interface InsightCandidate {
  id: string;
  text: string;
  evidence?: string[];
  whyItMatters?: string;
  suggestedAction?: string;
  sourceLabel: SourceLabel;
}

export interface SurpriseInsight {
  id: string;
  text: string;
  evidence: string[];
  whyItMatters: string;
  suggestedAction: string;
  sourceLabel: SourceLabel;
}

export function buildSurpriseInsights(candidates: InsightCandidate[]): SurpriseInsight[] {
  const out: SurpriseInsight[] = [];
  for (const c of candidates ?? []) {
    if (!c.evidence?.length || !c.whyItMatters || !c.suggestedAction) continue;
    out.push({
      id: c.id,
      text: c.text,
      evidence: c.evidence,
      whyItMatters: c.whyItMatters,
      suggestedAction: c.suggestedAction,
      sourceLabel: c.sourceLabel,
    });
    if (out.length >= 3) break;
  }
  return out;
}
