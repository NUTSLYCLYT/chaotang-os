/**
 * number-verifier —— 把"对答案负责"从 prompt 变成确定性检查（产品版，移植自
 * tests/swarm-eval/lib/number-verifier.mjs）。
 *
 * 核心：answer 里出现的每个【有意义的数字】，必须能在喂给 agent 的 context 里逐字 grep 到，
 * 否则就是模型自己心算/脑补的"衍生量幻觉" → 打回重写。纯函数、无依赖、可单测。
 */

// 数字 token：千分位/小数/单位。单位是"数据感"信号，用于判定"有意义"。
const UNIT = '(%|pct|‰|万元|亿元|万|亿|倍|x|天|个|人|元|¥|pp|bps)';
const NUM_RE = new RegExp(`(\\d{1,3}(?:,\\d{3})+|\\d+)(\\.\\d+)?\\s*${UNIT}?`, 'g');
const NORM = (s: string): string => s.replace(/[,\s]/g, '');

export interface NumberToken {
  raw: string;
  core: string;
  unit: string;
}

export interface GroundingResult {
  total: number;
  grounded: number;
  ungrounded: NumberToken[];
  rate: number;
}

/** 数字是否"有意义"（值得校验）：有小数、或带数据单位、或整数≥100。过滤散文里的序数/小计数。 */
function significant(intPart: string, decPart: string, unit: string): boolean {
  if (decPart) return true;
  if (unit) return true;
  return Number(intPart.replace(/,/g, '')) >= 100;
}

/** 抽取文本里所有"有意义"的数字 token（去重保留原文）。 */
export function extractNumbers(text: string): NumberToken[] {
  const out: NumberToken[] = [];
  const seen = new Set<string>();
  for (const m of String(text ?? '').matchAll(NUM_RE)) {
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
 * 校验 answer 文本里的每个有意义数字能否在 context 里逐字找到（溯源 provenance）。
 */
export function verifyNumbers(answerText: string, contextText: string): GroundingResult {
  const ctx = NORM(String(contextText ?? ''));
  const nums = extractNumbers(answerText);
  const ungrounded: NumberToken[] = [];
  for (const n of nums) {
    // 数值核心需作为子串出现在归一化 context（容忍单位/表述差异，严抓数值本身）
    if (!ctx.includes(n.core)) ungrounded.push(n);
  }
  const grounded = nums.length - ungrounded.length;
  return { total: nums.length, grounded, ungrounded, rate: nums.length ? grounded / nums.length : 1 };
}

/**
 * 证据绑定校验（会审升级：从"数字在 context 里存在"→"数字被绑进 agent 自己列的 evidence"）。
 * grep 只证溯源(provenance)不证用对(correctness)；强制 answer 里每个数字也必须出现在 evidence[]，
 * 等于逼模型为每个数字给出"它从哪条事实推来"的引用——比纯 context 子串更接近"数字↔断言绑定"。
 * 注意：这是更严的启发式，不是正确性证明；仅作为可信度的额外信号。
 */
export function verifyEvidenceBinding(answerText: string, evidence: string[]): GroundingResult {
  const evi = NORM((evidence ?? []).join('\n'));
  const nums = extractNumbers(answerText);
  const unbound: NumberToken[] = [];
  for (const n of nums) {
    if (!evi.includes(n.core)) unbound.push(n);
  }
  const bound = nums.length - unbound.length;
  return { total: nums.length, grounded: bound, ungrounded: unbound, rate: nums.length ? bound / nums.length : 1 };
}

export interface ReidentifyResult {
  flagged: string[]; // 答案里点名的、分母过小可反推到个人的子群
  safe: boolean;
}

/**
 * k-匿名硬门槛（Schneier 验收会审）：role 里的"绝不以小组粒度发布"是软约束，LLM 可能违反。
 * 这里做确定性后检——若答案点名了已知"分母过小、组织图一 join 即反推到个人"的子群，标记出来，
 * 调用方据此附脱敏/上卷提示，把"我没点名"实际等于"都知道是谁"的隐性再识别风险变成账面可见信号。
 * 纯函数、无依赖。
 */
export function flagReidentifiableSubgroup(answerText: string, smallGroups: string[]): ReidentifyResult {
  const t = String(answerText ?? '');
  const flagged = (smallGroups ?? []).filter((g) => g && t.includes(g));
  return { flagged, safe: flagged.length === 0 };
}
