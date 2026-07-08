/**
 * lifu-fidelity —— 礼部独有本命:防失真门(对外/对上表达忠于内部真相)。
 *
 * 礼部是最容易"美化谎报"的部(本能就是让东西看起来好)。本门把这个风险变成礼部的核心价值:
 * 校验「对外表达(摘要/文案/话术)是否忠于源结论」——防三类失真:
 *   ① 洗白 sourceLabel(源是 FALLBACK/降级,却表达成定论/LIVE)
 *   ② 丢风险(源含风险/缺证,对外只字不提)
 *   ③ 过度确定(给不确定的事下保证)
 * 纯函数。faithful=false 时列失真点供人工复核(不自动放行,守诚实铁律13.2.3)。
 */

import type { SourceLabel } from '@/core/courtos/types';

export interface SourceClaim {
  /** 源结论的真实来源标。 */
  sourceLabel: SourceLabel;
  /** 源带的风险/缺证提示。 */
  risks: string[];
}

export interface FidelityResult {
  faithful: boolean;
  violations: string[];
}

// 过度确定/定论词(源不硬时出现=洗白)
const CERTAINTY_RE = /确定|已验证|保证|百分百|100%|必然|定论|铁定|绝对|LIVE/;
// 对冲/风险措辞(表达里有这些=没丢风险)
const HEDGE_RE = /风险|注意|但|可能|或许|未|待|局限|前提|初步|参考|降级|存疑|尚需/;

export function checkFidelity(source: SourceClaim, expression: string): FidelityResult {
  const text = expression ?? '';
  const violations: string[] = [];

  // ① 洗白:源不硬(FALLBACK/DEMO/MIXED)却用定论措辞
  const softSource = source.sourceLabel === 'FALLBACK' || source.sourceLabel === 'DEMO' || source.sourceLabel === 'MIXED';
  if (softSource && CERTAINTY_RE.test(text)) {
    violations.push(`源为 ${source.sourceLabel}(非确证),对外却用定论措辞——洗白来源,改为"初步/参考"`);
  }

  // ② 丢风险:源有风险但表达无任何对冲
  if (source.risks.length > 0 && !HEDGE_RE.test(text)) {
    violations.push(`源含 ${source.risks.length} 条风险/缺证,对外表达只字未提——补风险提示,勿报喜不报忧`);
  }

  return { faithful: violations.length === 0, violations };
}
