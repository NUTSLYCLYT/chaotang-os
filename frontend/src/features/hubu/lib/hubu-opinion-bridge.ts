/**
 * 户部真数字 → 合奏部门意见 桥(接点① · 2026-07-01)
 *
 * 铁律6「一个领域一个 owner」:跨部合奏(unified-decision-loop)里的户部声音,
 * 不再用 hubu-cfo-office 的纯文本推断,而是读我这套真主库数字裁决(evaluateProject)。
 * 一个户部脑(features/hubu/evaluateProject)同时供户部页 + 丞相跨部合奏,消灭双脑。
 *
 * 纯函数,可单测(铁律4)。不变量:缺证/单向门/现金压力 → 绝不 GREEN/APPROVE(fail-safe)。
 */

import type { HubuEvaluation } from '@/features/hubu/lib/hubu-engines';
import type { DepartmentOpinion, UnifiedSignal, UnifiedVerdict } from '@/core/courtos/unified/unified-types';
import type { SourceLabel } from '@/core/courtos/types';

/** 由真户部裁决推导合奏信号(缺证/单向门/现金 → 永不放行)。 */
export function hubuEvaluationToOpinion(
  ev: HubuEvaluation,
  sourceLabel: SourceLabel,
): DepartmentOpinion {
  const blocked = ev.oneWayDoor.oneWay || ev.cashStress || ev.verdict === 'reject';
  const hasGaps = ev.missing.length > 0 || ev.quality.missing > 0;

  // 信号:fail-safe——任何阻断/缺证都压不到 GREEN。
  const signal: UnifiedSignal =
    sourceLabel === 'FALLBACK' || sourceLabel === 'DEMO'
      ? 'GRAY'
      : ev.verdict === 'reject'
        ? 'RED'
        : blocked
          ? 'RED'
          : hasGaps || ev.verdict === 'hold' || ev.verdict === 'adjust'
            ? 'YELLOW'
            : 'GREEN';

  const verdict: UnifiedVerdict =
    ev.verdict === 'reject'
      ? 'REJECT'
      : blocked
        ? 'RECHECK'
        : hasGaps || ev.verdict === 'hold' || ev.verdict === 'adjust'
          ? 'NEED_EVIDENCE'
          : 'APPROVE';

  const evidence = [
    `户部三引擎评分 ${ev.score ?? '缺'} · 敞口 ${ev.exposure ?? '缺'}`,
    ...(ev.roiMultiple != null ? [`回报 ${ev.roiMultiple}x`] : []),
    `证据接地 ${ev.quality.grounded}/${ev.quality.total}`,
  ];

  const risks = [
    ...(ev.cashStress ? ['现金断流风险(小老板头号死法)'] : []),
    ...(ev.oneWayDoor.oneWay ? [`单向门:${ev.oneWayDoor.reasons.join('、')} · 需亲裁`] : []),
  ];

  return {
    departmentId: 'finance',
    signal,
    verdict,
    summary: `户部:${ev.verdictCn} — 评分 ${ev.score ?? '缺'} / 敞口 ${ev.exposure ?? '缺'}${ev.cashStress ? ' · 现金紧' : ''}`,
    evidence,
    missingEvidence: ev.missing,
    risks,
    nextAction: ev.missing[0] ? `补齐${ev.missing[0]}` : ev.verdictCn,
    needsHumanConfirmation: ev.oneWayDoor.oneWay || ev.cashStress,
    sourceLabel,
  };
}
