/**
 * ReportQualityGate（AGENTS.md §13.2 规则6）—— 奏折必须含八要素，否则非法。
 * 防 AI 生成"漂亮废话"。纯函数、无 @/ 运行时依赖 → 可离线单测。
 *
 * 八要素：圣裁(verdict) / 分奏(perspectives) / 证据或缺证 / 风险(risks) /
 *         后令(nextAction) / 质门(qualityGate) / 来源(sourceLabel) / summary。
 */
import type { CourtReportShape } from '../types';

export interface QualityResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  needsHumanConfirmation: boolean;
}

export const COURTOS_CORE_QUALITY_GATES = [
  'source_label_required',
  'no_demo_as_live',
  'no_fallback_as_final_certainty',
  'evidence_or_gap_required',
  'high_risk_requires_human_confirmation',
  'conflict_visible',
  'one_primary_action_required',
  'followup_must_inherit_context',
  'archive_required_after_decision',
  'missing_capability_must_be_disclosed',
] as const;

export type CourtOSCoreQualityGateId = typeof COURTOS_CORE_QUALITY_GATES[number];

function isHighRiskRisks(risks: unknown[] | undefined): boolean {
  if (!risks?.length) return false;
  return risks.some((r) => {
    const s = typeof r === 'string' ? r : JSON.stringify(r);
    return /不可逆|高风险|high|股权|合同|重大付款/.test(s);
  });
}

export function validateCourtReport(report: CourtReportShape): QualityResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!report.verdict) errors.push('缺圣裁(verdict)');
  if (!report.summary) errors.push('缺概要(summary)');
  if (!report.perspectives?.length) errors.push('缺分奏(perspectives)');
  const hasEvidence = (report.evidence?.length ?? 0) > 0;
  const hasMissing = (report.missingEvidence?.length ?? 0) > 0;
  if (!hasEvidence && !hasMissing) errors.push('缺证据链：既无 evidence 也无 missingEvidence');
  if (!report.risks?.length) errors.push('缺风险(risks)');
  if (!report.nextAction) errors.push('缺后令(nextAction)');
  if (!report.qualityGate) errors.push('缺质门(qualityGate)');
  if (!report.sourceLabel) errors.push('缺来源(sourceLabel)');

  // 来源与信任级一致性
  const trust = report.qualityGate?.trustLevel;
  if (
    (report.sourceLabel === 'FALLBACK' || report.sourceLabel === 'DEMO') &&
    trust === 'fully_trusted'
  ) {
    errors.push(`来源为 ${report.sourceLabel} 却标 fully_trusted（禁把不实当可信）`);
  }

  if (report.sourceLabel === 'DEMO') {
    errors.push('DEMO 不得进入真实裁决');
  }

  // 缺证不得无条件准奏
  if (hasMissing && report.verdict && /准奏|批准|通过/.test(report.verdict)) {
    warnings.push('缺证情况下出现"准奏"类圣裁，应改为补证/复核或加条件');
  }

  if (report.sourceLabel === 'FALLBACK' && report.verdict && /准奏|批准|通过/.test(report.verdict)) {
    errors.push('FALLBACK 不得作为最终确定性结论');
  }

  // 高风险必须要求人工确认
  const highRisk = isHighRiskRisks(report.risks);
  if (highRisk && !report.needsHumanConfirmation) {
    errors.push('风险含高风险项，但 needsHumanConfirmation 未置 true');
  }

  const needsHumanConfirmation = Boolean(report.needsHumanConfirmation) || highRisk;
  return { valid: errors.length === 0, errors, warnings, needsHumanConfirmation };
}
