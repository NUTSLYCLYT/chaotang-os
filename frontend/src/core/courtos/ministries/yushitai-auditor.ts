/**
 * @deprecated P4c: test/eval-only decision engine; production imports are forbidden.
 * 御史台审计 Loop（Loop6）—— 全局红队，审最终结论有没有"装懂/冒进/绕过风险"。
 * 纯函数，无 @/ 运行时依赖 → 可离线单测。
 */
import type { MinistryReviewResult, YushitaiAuditResult } from './ministry-types.ts';
import type { SourceLabel } from '../types';
import { MINISTRY_REGISTRY } from './ministry-registry.ts';

export interface YushitaiInput {
  review: MinistryReviewResult;
  /** 拟最终结论(若已有)，用于检查 sourceLabel 是否被冒充。 */
  draftVerdict?: string;
  draftSourceLabel?: SourceLabel;
}

export function runYushitaiAudit(input: YushitaiInput): YushitaiAuditResult {
  const { review } = input;
  const blockingIssues: string[] = [];
  const warnings: string[] = [];
  const requiredActions: string[] = [];

  // 1. sourceLabel 必须存在
  if (!review.sourceLabel) blockingIssues.push('缺 sourceLabel');

  // 2. FALLBACK/DEMO 不能被冒充成 LIVE
  const reviewLabel = review.sourceLabel;
  if (
    (reviewLabel === 'FALLBACK' || reviewLabel === 'DEMO') &&
    (input.draftSourceLabel === 'LIVE' || input.draftSourceLabel === 'LIVE_SWARM')
  ) {
    blockingIssues.push(`六部来源为 ${reviewLabel}，最终却标 ${input.draftSourceLabel}（禁伪装 LIVE）`);
  }

  // 3. 红灯部门不能被静默忽略 / 无条件准奏
  if (review.vetoes.length > 0) {
    const names = review.vetoes.map((v) => MINISTRY_REGISTRY[v].nameCn).join('、');
    if (input.draftVerdict && /准奏|批准|通过|APPROVE/i.test(input.draftVerdict)) {
      blockingIssues.push(`${names}亮红灯，不得无条件准奏`);
    } else {
      requiredActions.push(`消解${names}红灯或人工确认后方可推进`);
    }
  }

  // 4. 刑部 RED → 必须人工确认
  const justiceRed = review.cards.find((c) => c.ministryId === 'justice' && c.signal === 'RED');
  if (justiceRed && !review.humanApprovalRequired) {
    blockingIssues.push('刑部红灯但未要求人工确认');
  }

  // 5. 缺证 → 不能确定性结论
  if (review.missingEvidence.length > 0 && input.draftVerdict && /准奏|批准|APPROVE/i.test(input.draftVerdict)) {
    blockingIssues.push('缺证情况下出现准奏类结论');
  }

  // 6. 冲突必须展示（提示）
  if (review.conflicts.length > 0) {
    warnings.push(`存在 ${review.conflicts.length} 处部门冲突，最终奏折必须展示，不得平均`);
  }

  const needsHumanConfirmation = review.humanApprovalRequired || review.vetoes.length > 0;
  if (needsHumanConfirmation) requiredActions.push('高风险事项需人工确认');
  if (review.missingEvidence.length > 0) requiredActions.push(`补证：${review.missingEvidence.slice(0, 5).join('、')}`);

  return {
    passed: blockingIssues.length === 0,
    blockingIssues,
    warnings,
    requiredActions: [...new Set(requiredActions)],
    needsHumanConfirmation,
    sourceLabel: review.sourceLabel,
  };
}
