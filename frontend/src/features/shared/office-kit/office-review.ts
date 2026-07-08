/**
 * 建部套件 · 通用司引擎契约(设计② · 2026-07-01)
 *
 * 各部各司"决策前算账"引擎共享同一条**裁决阶梯**(缺硬数字→缺证 / 缺质门→先定清楚 /
 * 价值不足→不值 / else→准)。招/培/编制曾各抄一份 if-ladder = 同卡片 6 份复制一样的漂移债。
 * 此处收口成一个纯函数;各司只映射自己的 verdict 标签 + 文案,不再重写阶梯逻辑。
 */

/** 四级裁决阶梯(通用形状;各司映射成自己的 verdict 标签)。 */
export type DecisionRung = 'ok' | 'gate_fail' | 'value_fail' | 'insufficient';

export function resolveDecisionLadder(params: {
  /** 缺的硬数字(如月薪/成本)——最优先,判"缺证"。 */
  missing: string[];
  /** 缺的质门(人工判断项,如预算/JD)——判"先定清楚"。 */
  blockers: string[];
  /** 价值比(如 ROI);< roiFloor 判"不值"。可空(没给不判此级)。 */
  roi?: number | null;
  /** 价值比下限,默认 1。 */
  roiFloor?: number;
  /** 额外的"价值不足"触发(如编制占比超警戒线且无明确增量)。 */
  extraValueFail?: boolean;
}): DecisionRung {
  if (params.missing.length > 0) return 'insufficient';
  if (params.blockers.length > 0) return 'gate_fail';
  const roiFail = params.roi != null && params.roi < (params.roiFloor ?? 1);
  if (roiFail || params.extraValueFail === true) return 'value_fail';
  return 'ok';
}

/**
 * 第二种阶梯:证据/置信(非 ROI)。用于"没法算钱、只能看证据够不够"的决策(风险时机/合规/情报)。
 * 缺据→insufficient / 有风险信号→高不确定 / 支持信号太少→证据薄 / else→证据充分。
 * 证明套件不是"算账专用":同一 VerdictCard/契约,既吃 ROI 阶梯也吃证据阶梯。
 */
export type EvidenceRung = 'ample' | 'thin' | 'high_uncertainty' | 'insufficient';

export function resolveEvidenceLadder(params: {
  /** 缺的关键判断依据 → 缺据。 */
  missing: string[];
  /** 支持该判断的信号数。 */
  supportingSignals: number;
  /** 风险/反向信号(含未做的尽调)→ 高不确定。 */
  redFlags: string[];
  /** 判"证据充分"所需最少支持信号,默认 2。 */
  minSignals?: number;
}): EvidenceRung {
  if (params.missing.length > 0) return 'insufficient';
  if (params.redFlags.length > 0) return 'high_uncertainty';
  if (params.supportingSignals < (params.minSignals ?? 2)) return 'thin';
  return 'ample';
}

/** 司引擎统一输出契约(可选采用;VerdictCard 直接吃它)。 */
export interface OfficeReview<V extends string> {
  title: string;
  verdict: V;
  verdictCn: string;
  metrics: string[];
  nextStep: string;
  opinions: string[];
  blockers: string[];
  missing: string[];
  sourceNote: string;
}
