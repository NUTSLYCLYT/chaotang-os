/**
 * 朝堂 OS · ScoreModel 权重配置
 *
 * 把 v1.1 散落在 router.ts 的硬编码权重收拢到一处。
 * 设计意图：
 *   1. 权重必须可在 prod 通过 env 调 · 不需要发版
 *   2. 暴露 calibrate API · 当 telemetry 攒够数据时跑一次推荐新权重
 *   3. 修改权重 = 配置变更 · 必有 git commit + review trail（registry.ts 同款约束）
 *
 * 现状（v1.2）：默认权重是直觉值 · v1.3 应跑过校准后调
 */

export interface ScoreWeights {
  /** quality - costPenalty × estCost · 默认 50 */
  costPenalty: number;
  /** prefer cap 命中 · 每个 +N 分 · 默认 5 */
  preferBonus: number;
  /** triage=simple 时 cheap 模型加分 · 默认 20 */
  triageSimpleCheapBonus: number;
  /** triage=complex 时 reasoning 模型加分 · 默认 25 */
  triageComplexReasoningBonus: number;
  /** p50 < 1000ms 加分 · 默认 5 */
  fastBonus: number;
}

const DEFAULT_WEIGHTS: ScoreWeights = {
  costPenalty: Number(process.env.LLM_W_COST_PENALTY ?? 50),
  preferBonus: Number(process.env.LLM_W_PREFER_BONUS ?? 5),
  triageSimpleCheapBonus: Number(process.env.LLM_W_TRIAGE_SIMPLE ?? 20),
  triageComplexReasoningBonus: Number(process.env.LLM_W_TRIAGE_COMPLEX ?? 25),
  fastBonus: Number(process.env.LLM_W_FAST ?? 5),
};

let activeWeights: ScoreWeights = { ...DEFAULT_WEIGHTS };

export function getScoreWeights(): ScoreWeights {
  return activeWeights;
}

/** 运行时覆盖权重 · 用于 A/B 测或 hot reload */
export function setScoreWeights(patch: Partial<ScoreWeights>): void {
  activeWeights = { ...activeWeights, ...patch };
}

/** 重置 · 测试用 */
export function _resetWeightsForTest(): void {
  activeWeights = { ...DEFAULT_WEIGHTS };
}

/* ==========================================================================
 * 校准 · 用历史 telemetry 推荐新权重
 *   逻辑：找出"实际 fallback 数高 / 失败率高 / cost 偏离 EMA 大"的模型
 *        建议调权重 · 不自动应用 · 留人工 review
 * ========================================================================== */

export interface CalibrationInput {
  /** 每模型的真实 success rate · 0-1 */
  modelStats: Array<{
    modelId: string;
    callCount: number;
    failureRate: number;
    avgLatencyMs: number;
    avgCostUsd: number;
  }>;
}

export interface WeightSuggestion {
  current: ScoreWeights;
  suggested: ScoreWeights;
  reasons: string[];
  /** 校准是否有意义（数据量够吗） */
  meaningful: boolean;
}

const MIN_SAMPLES_FOR_CALIBRATION = 100;

export function suggestWeights(input: CalibrationInput): WeightSuggestion {
  const total = input.modelStats.reduce((s, m) => s + m.callCount, 0);
  const meaningful = total >= MIN_SAMPLES_FOR_CALIBRATION;

  const reasons: string[] = [];
  const suggested = { ...activeWeights };

  if (!meaningful) {
    reasons.push(`样本不足 ${total} < ${MIN_SAMPLES_FOR_CALIBRATION} · 不建议调权重`);
    return { current: activeWeights, suggested, reasons, meaningful: false };
  }

  // 启发式 1：如果失败率高的都是高分模型 · 说明 quality 权重过高
  const sortedByQ = [...input.modelStats].sort((a, b) => b.failureRate - a.failureRate);
  const top3 = sortedByQ.slice(0, 3);
  const highFailRate = top3.filter((m) => m.failureRate > 0.05);
  if (highFailRate.length >= 2) {
    suggested.costPenalty = activeWeights.costPenalty * 1.2;
    reasons.push(
      `${highFailRate.length}/3 顶部模型失败率 > 5% · 建议提高 costPenalty 到 ${suggested.costPenalty.toFixed(0)}（偏便宜健壮）`,
    );
  }

  // 启发式 2：如果总体平均延迟 > 2000ms · 说明 fast 权重过低
  const avgLat =
    input.modelStats.reduce((s, m) => s + m.avgLatencyMs * m.callCount, 0) / Math.max(total, 1);
  if (avgLat > 2000) {
    suggested.fastBonus = activeWeights.fastBonus + 5;
    reasons.push(
      `全局平均延迟 ${avgLat.toFixed(0)}ms > 2000 · 建议提高 fastBonus 到 ${suggested.fastBonus}（偏快）`,
    );
  }

  if (reasons.length === 0) {
    reasons.push('当前权重运行良好 · 无需调整');
  }

  return { current: activeWeights, suggested, reasons, meaningful: true };
}
