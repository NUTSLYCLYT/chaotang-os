/**
 * TrustExperienceGuard（V3 Prompt 4）：交互层的信任地板守卫。
 * 检查 sourceLabel、DEMO/FALLBACK 不伪装、高风险人工确认、缺证不给确定结论、
 * 惊喜洞察必须有 whyItMatters + suggestedAction。
 */
import type { SourceLabel } from '../types.ts';

export interface TrustCheckInput {
  sourceLabel?: SourceLabel;
  needsHumanConfirmation?: boolean;
  isHighRisk?: boolean;
  /** 是否给出了证据或缺口说明。 */
  hasEvidenceOrGap?: boolean;
  /** 是否给出确定性结论。 */
  isCertaintyClaim?: boolean;
  /** 是否被当作真实(LIVE)呈现。 */
  presentedAsLive?: boolean;
  surpriseInsights?: Array<{ whyItMatters?: string; suggestedAction?: string }>;
}

export interface TrustViolation {
  rule: string;
  detail: string;
}

export function checkTrust(x: TrustCheckInput): { ok: boolean; violations: TrustViolation[] } {
  const v: TrustViolation[] = [];
  if (!x.sourceLabel) v.push({ rule: 'source_label_required', detail: '缺 sourceLabel' });
  if ((x.sourceLabel === 'DEMO' || x.sourceLabel === 'FALLBACK') && x.presentedAsLive) {
    v.push({ rule: 'no_fake_live', detail: 'DEMO/FALLBACK 不得伪装成 LIVE' });
  }
  if (x.sourceLabel === 'FALLBACK' && x.isCertaintyClaim) {
    v.push({ rule: 'no_fallback_certainty', detail: 'FALLBACK 不得作为最终确定结论' });
  }
  if (x.isHighRisk && !x.needsHumanConfirmation) {
    v.push({ rule: 'high_risk_requires_human_confirmation', detail: '高风险必须人工确认' });
  }
  if (x.isCertaintyClaim && x.hasEvidenceOrGap === false) {
    v.push({ rule: 'no_certainty_without_evidence', detail: '缺证不得给确定性结论' });
  }
  for (const s of x.surpriseInsights ?? []) {
    if (!s.whyItMatters || !s.suggestedAction) {
      v.push({ rule: 'surprise_needs_why_and_action', detail: '惊喜洞察必须有 whyItMatters + suggestedAction' });
    }
  }
  return { ok: v.length === 0, violations: v };
}
