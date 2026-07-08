/**
 * 户部 · 一句话决策抽取器（2026-06-28）
 *
 * 降低小老板门槛：从"填一堆表单字段" → "说一句话，AI 帮你抽字段"。
 * 确定性正则解析（单位互不重叠：万 / 倍·% / 个月 / 现金关键词 / 风险关键词），
 * 即时、免费、不调 LLM、不联网。抽完字段可编辑（人校正），再交户部引擎裁决。
 */

export type ExtractedRisk = 'low' | 'medium' | 'high' | 'critical';

export interface ExtractedDecision {
  title: string;
  budget: string;
  roi: string;
  payback: string;
  cash: string;
  risk: ExtractedRisk;
}

function first(text: string, re: RegExp): string {
  const m = text.match(re);
  return m ? m[1].replace(/\s+/g, '') : '';
}

/** 从一句自然语言里抽出户部决策字段。纯函数，零副作用。 */
export function extractDecisionFromText(text: string): ExtractedDecision {
  const t = (text ?? '').trim();

  // 金额：数字 + 万/万元/w（元单独太泛，要求带"万"或 w）
  const budget = first(t, /(\d+(?:\.\d+)?\s*(?:万元|万|[wW]))/);
  // 回报：数字 + 倍/x/×/%/个点（不与"个月"冲突）
  const roi = first(t, /(\d+(?:\.\d+)?\s*(?:倍|[xX×]|%|个点))/);
  // 回收期：数字 + 个月/月/年/周
  const payback = first(t, /(\d+(?:\.\d+)?\s*(?:个月|月|年|周))/);

  // 现金影响：关键词
  let cash = '';
  if (/现金[^，。]{0,5}(充裕|充足|够|可覆盖|没问题)|付得起|够付/.test(t)) cash = '现金充裕';
  else if (/现金[^，。]{0,5}(紧|吃紧|不够|压力|周转)|要借|要贷|分期|贷款/.test(t)) cash = '现金紧张';

  // 风险：关键词（紧急/不可逆 > 高 > 低 > 默认中）
  let risk: ExtractedRisk = 'medium';
  if (/紧急|不可逆|押上|all.?in|赌一把|生死|身家/i.test(t)) risk = 'critical';
  else if (/高风险|风险高|很险|没把握|不确定性?大|可能亏/.test(t)) risk = 'high';
  else if (/低风险|风险低|稳|保险|有把握|妥/.test(t)) risk = 'low';

  // 标题：取第一小句（逗号/句号前），截断 40 字
  const head = t.split(/[，,。;；\n]/)[0] || t;
  const title = head.slice(0, 40);

  return { title, budget, roi, payback, cash, risk };
}
