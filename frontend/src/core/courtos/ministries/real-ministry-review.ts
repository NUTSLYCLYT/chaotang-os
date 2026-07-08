/**
 * 真 agent 版六部会审（2026-06-24 · 缺口#3 · 价值解锁）。
 *
 * 与纯 runMinistryReview 同形,但指定的「真 agent 部门」走 runRealMinistryCard(真 LLM 推理,
 * 失败回退 heuristic),其余部门仍走确定性 runRedBlueLoop。汇总复用同一纯 aggregateMinistryCards
 * (确定性·不让 agent 判 agent)。诚实分层:真部 LIVE / 规则部 FALLBACK → 聚合 MIXED。
 * server-only(runRealMinistryCard 命中 callLLM)。
 */
import 'server-only';
import type { MinistryId, MinistryReviewResult } from './ministry-types';
import type { SourceLabel } from '../types';
import { selectMinistries, type SelectionInput } from './ministry-selector';
import { runRedBlueLoop } from './red-blue-loop';
import { runRealMinistryCard } from './real-ministry-card';
import { aggregateMinistryCards } from './ministry-review-loop';

export async function runMinistryReviewWithRealAgents(
  input: SelectionInput & { taskId: string; sourceLabel?: SourceLabel },
  realCodes: ReadonlyArray<MinistryId>,
): Promise<MinistryReviewResult> {
  const { selectedMinistries, reasons } = selectMinistries(input);
  const text = [input.originalQuestion, input.refinedIntent, input.evidenceSummary].filter(Boolean).join('\n');
  const realSet = new Set(realCodes);

  const cards = await Promise.all(
    selectedMinistries.map((ministryId) => {
      const base = { taskId: input.taskId, ministryId, text, sourceLabel: input.sourceLabel };
      return realSet.has(ministryId)
        ? runRealMinistryCard(base)
        : Promise.resolve(runRedBlueLoop(base));
    }),
  );

  return aggregateMinistryCards(input.taskId, selectedMinistries, reasons, cards);
}
