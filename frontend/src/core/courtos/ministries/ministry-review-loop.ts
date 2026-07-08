/**
 * 六部会审总 Loop（Loop3+编排）—— 选部 → 各部红蓝 → 汇总否决/冲突/缺证/总灯号。
 * 不强行平均分歧（冲突摊给老板）。纯函数，无 @/ 运行时依赖 → 可离线单测。
 */
import type {
  MinistryId,
  MinistrySignal,
  RedBlueCard,
  MinistryConflict,
  MinistryReviewResult,
} from './ministry-types.ts';
import type { SourceLabel } from '../types';
import { MINISTRY_REGISTRY } from './ministry-registry.ts';
import { selectMinistries, type SelectionInput } from './ministry-selector.ts';
import { runRedBlueLoop } from './red-blue-loop.ts';
import { mergeSourceLabels } from '../source-label.ts';

function computeOverall(cards: RedBlueCard[]): MinistrySignal {
  if (cards.some((c) => c.signal === 'RED')) return 'RED';
  if (cards.some((c) => c.signal === 'YELLOW')) return 'YELLOW';
  if (cards.filter((c) => c.signal === 'GRAY').length >= 2) return 'GRAY';
  if (cards.some((c) => c.signal === 'GRAY')) return 'YELLOW';
  return 'GREEN';
}

/** 冲突：一部推进(GREEN) 撞 另一部红/黄(风险/缺证)。不平均，点名摊出。 */
function detectConflicts(cards: RedBlueCard[]): MinistryConflict[] {
  const conflicts: MinistryConflict[] = [];
  const greens = cards.filter((c) => c.signal === 'GREEN');
  const blockers = cards.filter((c) => c.signal === 'RED' || c.signal === 'YELLOW');
  for (const g of greens) {
    for (const b of blockers) {
      if (g.ministryId === b.ministryId) continue;
      conflicts.push({
        between: [g.ministryId, b.ministryId],
        summary: `${MINISTRY_REGISTRY[g.ministryId].nameCn}主张推进，但${MINISTRY_REGISTRY[b.ministryId].nameCn}${b.signal === 'RED' ? '亮红灯' : '要求补证'}：${b.disputeFocus}`,
      });
    }
  }
  return conflicts;
}

export function runMinistryReview(
  input: SelectionInput & {
    taskId: string;
    sourceLabel?: SourceLabel;
    /**
     * 真引擎卡覆盖（断点B · 一案穿堂）：有专属确定性引擎的部（如户部 evaluateProject）由 caller 预先
     * 算好该部 RedBlueCard 传入，替掉通用 synth；没传的部继续走 runRedBlueLoop（分层，不删 synth）。
     */
    cardOverrides?: Partial<Record<MinistryId, RedBlueCard>>;
  },
): MinistryReviewResult {
  const { selectedMinistries, reasons } = selectMinistries(input);
  const text = [input.originalQuestion, input.refinedIntent, input.evidenceSummary].filter(Boolean).join('\n');

  const cards: RedBlueCard[] = selectedMinistries.map(
    (ministryId) =>
      input.cardOverrides?.[ministryId] ??
      runRedBlueLoop({ taskId: input.taskId, ministryId, text, sourceLabel: input.sourceLabel }),
  );

  return aggregateMinistryCards(input.taskId, selectedMinistries, reasons, cards);
}

/**
 * 纯·汇总:给定一组红蓝卡 → 否决/冲突/缺证/总灯号/合并源标。引擎无关(规则卡或真 agent 卡都喂这)。
 * 提取此函数,使"真 agent 版会审"(real-ministry-review)能复用同一确定性汇总(不让 agent 判 agent)。
 */
export function aggregateMinistryCards(
  taskId: string,
  selectedMinistries: MinistryId[],
  reasons: MinistryReviewResult['selectionReasons'],
  cards: RedBlueCard[],
): MinistryReviewResult {
  const vetoes: MinistryId[] = cards
    .filter((c) => c.signal === 'RED' && MINISTRY_REGISTRY[c.ministryId].vetoPower)
    .map((c) => c.ministryId);

  const conflicts = detectConflicts(cards);
  const missingEvidence = [...new Set(cards.flatMap((c) => c.missingEvidence))];
  const humanApprovalRequired = cards.some((c) => c.needsHumanConfirmation);
  const overallSignal = computeOverall(cards);
  const sourceLabel = mergeSourceLabels(cards.map((c) => c.sourceLabel));

  const overallSuggestion =
    overallSignal === 'RED'
      ? `有部门亮红灯(${vetoes.map((v) => MINISTRY_REGISTRY[v].nameCn).join('、') || '见红蓝卡'})，不得直接准奏，需消解或人工确认。`
      : overallSignal === 'GREEN'
        ? '六部基本放行，可进入裁决。'
        : '存在缺证/黄灯，建议补证或复核后再裁决。';

  return {
    taskId,
    selectedMinistries,
    selectionReasons: reasons,
    cards,
    vetoes,
    conflicts,
    missingEvidence,
    humanApprovalRequired,
    overallSignal,
    overallSuggestion,
    sourceLabel,
  };
}
