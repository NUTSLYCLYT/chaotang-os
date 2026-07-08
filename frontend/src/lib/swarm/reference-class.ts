/**
 * reference-class —— 钦天监杀手锏:史馆当沙盘,参照类预测(Kahneman 外部视角)。
 *
 * 决策结果预测不让 LLM 拍脑袋:从史馆捞 K 个最相似旧案 + 它们真实兑现的结果,
 * 按 相似度×新近×已兑现 加权 → 给"你自己历史上这么干的真实结局分布(base rate)"。
 *
 * 三条护栏(都在本算法里):
 *  - 数据厚度门:相似案 < thinThreshold → 只给"参考类比",**不给概率分布**(防 3 样本假统计)。
 *  - 信任加权:已兑现(confirmed)旧案权重 > 待验;近 > 远。
 *  - 可溯源(铁律2):usedCaseIds 列出凭哪几条案算的。
 *
 * 纯函数、不调 Date(now 由调用方传,可测)、不读库(cases 由调用方按租户过滤后传入)。
 */

import type { CaseOutcome } from '@/lib/contracts/archive';

export interface PastCase {
  id: string;
  /** 用于相似度匹配的文本(命令/事由摘要)。 */
  summary: string;
  outcome: CaseOutcome; // 'success' | 'blocked' | 'failed' | 'pending'
  /** 决策时间 ISO(算新近权重)。 */
  decidedAt: string;
  /** 结果是否已兑现核实(信任加权)。 */
  confirmed: boolean;
}

export interface ReferenceClassResult {
  /** 数据厚度。 */
  thickness: 'thin' | 'medium' | 'thick';
  /** thin → 只给类比;否则给 base_rate 概率分布。 */
  mode: 'analogy_only' | 'base_rate';
  /** 各结果的加权占比(mode=base_rate 时有效;analogy_only 时为空对象)。 */
  distribution: Partial<Record<CaseOutcome, number>>;
  /** 用到的相似旧案 id(可溯源 → evidenceIds)。 */
  usedCaseIds: string[];
  /** 加权有效样本数。 */
  effectiveN: number;
  rationale: string;
}

/** 字符二元组 Jaccard 相似度(中文零依赖标准法;可换 embedding)。 */
function similarity(a: string, b: string): number {
  const grams = (s: string) => {
    const clean = s.toLowerCase().replace(/[\s,，。;；、/]+/g, '');
    const set = new Set<string>();
    for (let i = 0; i < clean.length - 1; i++) set.add(clean.slice(i, i + 2));
    return set;
  };
  const A = grams(a);
  const B = grams(b);
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return inter / (A.size + B.size - inter);
}

/** 新近权重:指数衰减,半衰期 90 天。 */
function recencyWeight(decidedAt: string, nowIso: string): number {
  const days = (Date.parse(nowIso) - Date.parse(decidedAt)) / 86_400_000;
  if (!Number.isFinite(days) || days < 0) return 1;
  return Math.pow(0.5, days / 90);
}

export interface ReferenceClassOpts {
  /** 取前 K 相似案。 */
  k?: number;
  /** 相似度下限(低于此不算同类)。 */
  minSim?: number;
  /** 数据厚度门:有效相似案 < 此值 → analogy_only。 */
  thinThreshold?: number;
  /** 当前时间 ISO(算新近)。 */
  nowIso: string;
}

export function referenceClass(
  query: string,
  cases: PastCase[],
  opts: ReferenceClassOpts,
): ReferenceClassResult {
  const k = opts.k ?? 12;
  const minSim = opts.minSim ?? 0.12;
  const thin = opts.thinThreshold ?? 5;

  const scored = cases
    .map((c) => {
      const sim = similarity(query, c.summary);
      const rec = recencyWeight(c.decidedAt, opts.nowIso);
      const trust = c.confirmed ? 1 : 0.4; // 待验案权重打折
      return { c, sim, weight: sim * rec * trust };
    })
    .filter((s) => s.sim >= minSim)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, k);

  const similarCount = scored.length;
  const thickness: ReferenceClassResult['thickness'] =
    similarCount >= 15 ? 'thick' : similarCount >= thin ? 'medium' : 'thin';

  const usedCaseIds = scored.map((s) => s.c.id);

  if (similarCount < thin) {
    return {
      thickness: 'thin',
      mode: 'analogy_only',
      distribution: {},
      usedCaseIds,
      effectiveN: similarCount,
      rationale: `史馆同类案仅 ${similarCount} 条(< ${thin}),样本不足 → 只给参考类比,不给概率分布(防假统计)。`,
    };
  }

  // base rate:已兑现案才计入结果分布(待验不计 outcome,但算厚度)。
  const confirmed = scored.filter((s) => s.c.confirmed);
  const totalW = confirmed.reduce((sum, s) => sum + s.weight, 0) || 1;
  const dist: Partial<Record<CaseOutcome, number>> = {};
  for (const s of confirmed) {
    dist[s.c.outcome] = (dist[s.c.outcome] ?? 0) + s.weight / totalW;
  }

  return {
    thickness,
    mode: 'base_rate',
    distribution: dist,
    usedCaseIds,
    effectiveN: confirmed.length,
    rationale: `综合 ${similarCount} 条史馆同类案(其中 ${confirmed.length} 条已兑现),按相似度×新近×已兑现加权得 base rate。先看这个外部视角,再判这次哪里不同。`,
  };
}
