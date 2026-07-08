/**
 * 吏部 · 铨叙司 · 转正评估引擎（2026-06-28）
 *
 * 吏部第一条真数据闭环（复刻户部成本司范式）：真转正评价表(评价维度+分值+评分) →
 * 总分/满分 + 转正建议 + 缺证(未评分维度)。纯函数本地，缺评分则标缺、绝不替老板打分。
 * 解析按表头关键词定位列（鲁棒：跨不同部门转正表通用）。
 */

export interface ReviewDim {
  dimension: string;
  maxScore: number;
  score: number | null; // 未评分 → null(缺证)
}

export type PromotionVerdict = 'promote' | 'extend' | 'reject' | 'insufficient';

export const PROMOTION_VERDICT_CN: Record<PromotionVerdict, string> = {
  promote: '准予转正',
  extend: '延长试用',
  reject: '不予转正',
  insufficient: '评分不全·待补',
};

export interface PromotionReview {
  candidate: string;
  totalScore: number | null;
  maxTotal: number;
  scorePct: number | null;
  verdict: PromotionVerdict;
  dims: ReviewDim[];
  missing: string[];
  note: string;
}

const HEADER_KEYS = {
  dimension: ['评价维度', '维度', '考核项', '项目', '内容'],
  max: ['分值', '满分', '标准分', '权重'],
  score: ['评分', '得分', '实际得分'],
};

function matchCol(cell: unknown, keys: string[]): boolean {
  const s = String(cell ?? '').replace(/\s|\n/g, '');
  return keys.some((k) => s.includes(k));
}
function toNum(v: unknown): number | null {
  if (typeof v === 'number' && isFinite(v)) return v;
  const s = String(v ?? '').replace(/[,，\s分]/g, '');
  if (!s || !/[\d.]/.test(s)) return null;
  const n = Number(s);
  return isFinite(n) ? n : null;
}

/** 解析转正评价表 rows → 评分 + 转正建议。纯函数。promoteAt/extendAt 为达标阈值(百分比)。 */
export function parsePromotionRows(rows: unknown[][], candidate = '', promoteAt = 80, extendAt = 60): PromotionReview {
  let headerIdx = -1;
  let col = { dimension: -1, max: -1, score: -1 };
  for (let i = 0; i < Math.min(rows.length, 12); i++) {
    const r = rows[i] ?? [];
    const dimC = r.findIndex((c) => matchCol(c, HEADER_KEYS.dimension));
    const maxC = r.findIndex((c) => matchCol(c, HEADER_KEYS.max));
    if (dimC >= 0 && maxC >= 0) {
      headerIdx = i;
      col = { dimension: dimC, max: maxC, score: r.findIndex((c) => matchCol(c, HEADER_KEYS.score)) };
      break;
    }
  }
  if (headerIdx < 0) {
    return { candidate, totalScore: null, maxTotal: 0, scorePct: null, verdict: 'insufficient', dims: [], missing: ['未识别到转正评价表头(评价维度+分值列)'], note: '认不出评分表' };
  }

  const dims: ReviewDim[] = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i] ?? [];
    const dimension = String(r[col.dimension] ?? '').trim();
    const maxScore = toNum(r[col.max]);
    if (maxScore == null || maxScore <= 0) continue; // 非评分行(签字/备注)跳过
    const score = col.score >= 0 ? toNum(r[col.score]) : null;
    dims.push({ dimension: dimension || `维度${dims.length + 1}`, maxScore, score });
  }
  if (dims.length === 0) {
    return { candidate, totalScore: null, maxTotal: 0, scorePct: null, verdict: 'insufficient', dims: [], missing: ['表里没有可识别的评分维度'], note: '无评分维度' };
  }

  const maxTotal = dims.reduce((s, d) => s + d.maxScore, 0);
  const scored = dims.filter((d) => d.score != null);
  const missing = dims.filter((d) => d.score == null).map((d) => d.dimension);
  const totalScore = scored.length ? Math.round(scored.reduce((s, d) => s + (d.score as number), 0) * 10) / 10 : null;
  const scorePct = totalScore != null && maxTotal > 0 ? Math.round((totalScore / maxTotal) * 1000) / 10 : null;

  // 评分不全(超过一半维度没打分)→ insufficient,不替老板下结论
  let verdict: PromotionVerdict;
  if (scorePct == null || missing.length > dims.length / 2) verdict = 'insufficient';
  else if (scorePct >= promoteAt) verdict = 'promote';
  else if (scorePct >= extendAt) verdict = 'extend';
  else verdict = 'reject';

  const note =
    verdict === 'insufficient'
      ? `评分不全（${missing.length}/${dims.length} 维度未打分），吏部不替你打分——先补评分`
      : `总分 ${totalScore}/${maxTotal}（${scorePct}%）→ ${PROMOTION_VERDICT_CN[verdict]}` + (missing.length ? `（${missing.length} 项未评，已标缺）` : '');

  return { candidate, totalScore, maxTotal, scorePct, verdict, dims, missing, note };
}
