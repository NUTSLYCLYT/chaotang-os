/**
 * 六部选择 Loop（Loop1）—— 问题/拟旨 → 关键词 → 选部 + 理由。
 * 纯函数，无 @/ 运行时依赖 → 可离线单测。默认至少 户/刑/工。
 */
import type { MinistryId } from './ministry-types.ts';
import { MINISTRY_IDS } from './ministry-types.ts';
import { MINISTRY_REGISTRY } from './ministry-registry.ts';

export const DEFAULT_MINISTRIES: readonly MinistryId[] = ['finance', 'justice', 'works'] as const;

export interface SelectionInput {
  originalQuestion: string;
  refinedIntent?: string;
  evidenceSummary?: string;
}

export interface SelectionResult {
  selectedMinistries: MinistryId[];
  reasons: Partial<Record<MinistryId, string>>;
}

export function normalizeTaskText(input: SelectionInput): string {
  return [input.originalQuestion, input.refinedIntent, input.evidenceSummary]
    .filter(Boolean)
    .join('\n');
}

export function selectMinistries(input: SelectionInput): SelectionResult {
  const text = normalizeTaskText(input);
  const selected = new Set<MinistryId>();
  const reasons: Partial<Record<MinistryId, string>> = {};

  for (const id of MINISTRY_IDS) {
    const meta = MINISTRY_REGISTRY[id];
    const hits = meta.riskKeywords.filter((kw) => text.includes(kw));
    if (hits.length) {
      selected.add(id);
      reasons[id] = `命中${meta.nameCn}关键词：${hits.slice(0, 4).join('、')}`;
    }
  }

  // 默认兜底（户/刑/工）：保证财务、风险、交付永远有人看。
  for (const id of DEFAULT_MINISTRIES) {
    if (!selected.has(id)) {
      selected.add(id);
      reasons[id] = reasons[id] ?? `默认参审（${MINISTRY_REGISTRY[id].nameCn}：财务/风险/交付兜底）`;
    }
  }

  // 稳定顺序（按 MINISTRY_IDS）。
  const selectedMinistries = MINISTRY_IDS.filter((id) => selected.has(id));
  return { selectedMinistries, reasons };
}

export function getDefaultMinistries(): MinistryId[] {
  return [...DEFAULT_MINISTRIES];
}
