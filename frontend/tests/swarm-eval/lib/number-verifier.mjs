/**
 * number-verifier.mjs —— 大神会审 #2(Karpathy/Jobs/张小龙)：把"对答案负责"从 prompt 变成确定性检查。
 *
 * 核心：answer 里出现的每个【有意义的数字】，必须能在喂给 agent 的 context 里逐字 grep 到，
 * 否则就是模型自己心算/脑补的"衍生量幻觉" → 打回重写，并把"找不到依据的数字"留痕成数据集
 * （别人偷不走的护城河：自动长出"模型在哪些衍生量上幻觉"的语料）。
 *
 * 纯函数、无依赖、可单测。
 */

// 数字 token：千分位/小数/单位。单位是"数据感"信号，用于判定"有意义"。
const UNIT = '(%|pct|‰|万元|亿元|万|亿|倍|x|天|个|人|元|¥|pp|bps)';
const NUM_RE = new RegExp(`(\\d{1,3}(?:,\\d{3})+|\\d+)(\\.\\d+)?\\s*${UNIT}?`, 'g');
const NORM = (s) => s.replace(/[,\s]/g, '');

/** 数字是否"有意义"（值得校验）：有小数、或带数据单位、或整数≥100。过滤散文里的序数/小计数(2步/3条)。 */
function significant(intPart, decPart, unit) {
  if (decPart) return true;
  if (unit) return true;
  return Number(intPart.replace(/,/g, '')) >= 100;
}

/** 抽取文本里所有"有意义"的数字 token（去重保留原文）。 */
export function extractNumbers(text) {
  const out = [];
  const seen = new Set();
  for (const m of String(text || '').matchAll(NUM_RE)) {
    const [raw, intPart, decPart = '', unit = ''] = m;
    if (!significant(intPart, decPart, unit)) continue;
    const core = NORM(intPart) + decPart; // 数值核心(不含单位/逗号)
    const k = core + '|' + unit;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ raw: raw.trim(), core, unit });
  }
  return out;
}

/**
 * 校验 answer 文本里的每个有意义数字能否在 context 里逐字找到。
 * @returns { total, grounded, ungrounded:[{raw,core,unit}], rate(0-1) }
 */
export function verifyNumbers(answerText, contextText) {
  const ctx = NORM(String(contextText || ''));
  const nums = extractNumbers(answerText);
  const ungrounded = [];
  for (const n of nums) {
    // 数值核心需作为子串出现在归一化 context（容忍单位/表述差异，严抓数值本身）
    if (!ctx.includes(n.core)) ungrounded.push(n);
  }
  const grounded = nums.length - ungrounded.length;
  return { total: nums.length, grounded, ungrounded, rate: nums.length ? grounded / nums.length : 1 };
}
