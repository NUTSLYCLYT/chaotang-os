/**
 * 立项成熟度（2026-06-28）
 *
 * 天才设计：立项不是静态报告，是**活对象**——成熟度 = 真字段 / 总字段(🟢占比)。
 * 从 30% 一项项填到 90%，直到能拍板。把"感觉差不多了"变成"数字到 90% 了"(Deming:数字说话)。
 * 纯函数。filled 由各维度是否有真数据(非缺证/待裁)决定。
 */

export interface MaturityDim {
  key: string;
  label: string;
  /** 该维度是否已有真数据（非缺证/待裁/估算）。 */
  filled: boolean;
}

export interface ProjectMaturity {
  pct: number;
  filled: number;
  total: number;
  /** 下一个最该补的维度（未填里第一个）。 */
  nextToFill: string | null;
  /** 能否拍板：成熟度达阈值(默认 80%)且关键维度齐。 */
  decidable: boolean;
  note: string;
}

export function projectMaturity(dims: MaturityDim[], threshold = 80): ProjectMaturity {
  const total = dims.length;
  const filledDims = dims.filter((d) => d.filled);
  const filled = filledDims.length;
  const pct = total === 0 ? 0 : Math.round((filled / total) * 100);
  const nextDim = dims.find((d) => !d.filled);
  const nextToFill = nextDim ? nextDim.label : null;
  const decidable = pct >= threshold;
  const note = decidable
    ? `立项成熟度 ${pct}% — 已可拍板`
    : `立项成熟度 ${pct}%（${filled}/${total}真）· 下一步补「${nextToFill}」`;
  return { pct, filled, total, nextToFill, decidable, note };
}
