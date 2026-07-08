/**
 * 朝堂 OS · 自适应 Cost 估算
 *
 * 老办法：output = input × 0.6 · 真实误差 30%
 * 新办法：每模型维护一个 EMA(output/input ratio) · 用真实历史校准
 *
 * EMA 公式：ratio_new = α × this_call + (1 - α) × ratio_prev
 *   α = 0.1 · 慢学习 · 抗噪
 *
 * 启动：从 audit jsonl 重建（最近 N 条）
 * 运行：每次 LLM 调用结束 · update(modelId, inT, outT)
 * 估算：estimateCostAdaptive(model, inT) 用最新 ratio
 *
 * 实测 Anthropic 推理类约 0.4-1.2 · 摘要类 0.1-0.3 · 翻译类 0.6-0.9
 */

import type { ModelDef } from './types';

const ALPHA = 0.1;
const DEFAULT_RATIO = 0.6;

/**
 * 离群上界：observed ratio 超过此值视为异常长输出样本
 *  · 旧实现直接丢弃 → 高 ratio 样本永远学不到 → 系统性低估
 *  · 现改为 clamp 入 EMA（保留信号、压制噪声），并计 clamp 次数
 */
const OUTLIER_CLAMP = 5;

/**
 * 预算估算安全系数：传入 maxOutputTokens 时，把 EMA 预测放大一点
 *  · 让预算偏保守（宁可高估）而非低估
 */
const BUDGET_SAFETY_FACTOR = 1.25;

/** 预算估算下界：避免 input 极小时把 output 估成 0 导致预算穿底 */
const BUDGET_MIN_OUTPUT_TOKENS = 16;

/** 被 clamp 的离群样本计数（仅观测用，不影响估算签名） */
let outlierClampCount = 0;

/** modelId → 最新 ratio + 样本数 */
const ratios = new Map<string, { ratio: number; n: number }>();

/**
 * 单次调用更新 EMA
 *  · 调用应在 router 拿到真实 token 数后立即调
 *  · 输入或输出为 0 跳过 · 防 division by zero
 */
export function updateRatio(modelId: string, inputTokens: number, outputTokens: number): void {
  if (inputTokens <= 0 || outputTokens <= 0) return;
  const raw = outputTokens / inputTokens;
  // 离群保护：单次 > OUTLIER_CLAMP 视为异常（如 prompt 1 字、output 100 字）
  //  · 旧实现直接丢弃 → 真实的长输出样本被系统性剔除 → 高 ratio 永远学不到 → 低估
  //  · 改为 clamp 后入 EMA：保留"这是个长输出"的信号，同时压住极端噪声
  const observed = raw > OUTLIER_CLAMP ? OUTLIER_CLAMP : raw;
  if (raw > OUTLIER_CLAMP) outlierClampCount += 1;

  const cur = ratios.get(modelId);
  if (!cur) {
    // 冷启动：第 1 次直接用观测值（已 clamp）
    ratios.set(modelId, { ratio: observed, n: 1 });
    return;
  }
  const next = ALPHA * observed + (1 - ALPHA) * cur.ratio;
  ratios.set(modelId, { ratio: next, n: cur.n + 1 });
}

/**
 * 估算 · n < 5 时仍用 default · 5 后切换到 EMA
 *  · 这是为了避免冷启动单点剧烈波动
 */
export function getOutputRatio(modelId: string): { ratio: number; samples: number; warm: boolean } {
  const cur = ratios.get(modelId);
  if (!cur || cur.n < 5) {
    return { ratio: DEFAULT_RATIO, samples: cur?.n ?? 0, warm: false };
  }
  return { ratio: cur.ratio, samples: cur.n, warm: true };
}

/**
 * 自适应 cost · 替换 registry.estimateCost 在 router 里的用法
 *
 * @param maxOutputTokens 可选 · 调用方的 max_tokens 上界
 *   · 不传 → 维持旧行为（outputTokens = ceil(input × ratio)），向后兼容
 *   · 传入 → 预算偏保守：outputTokens = clamp(
 *       ceil(input × ratio × BUDGET_SAFETY_FACTOR),
 *       下界 BUDGET_MIN_OUTPUT_TOKENS,
 *       上界 maxOutputTokens,
 *     )
 *     既纳入 max_tokens 上界封顶，又用安全系数 + 下界防止系统性低估
 */
export function estimateCostAdaptive(
  model: ModelDef,
  inputTokens: number,
  maxOutputTokens?: number,
): {
  costUsd: number;
  ratio: number;
  warm: boolean;
} {
  const { ratio, warm } = getOutputRatio(model.id);
  const outputTokens = resolveOutputTokens(inputTokens, ratio, maxOutputTokens);
  const costUsd =
    (inputTokens / 1_000_000) * model.costPerMTokenIn +
    (outputTokens / 1_000_000) * model.costPerMTokenOut;
  return { costUsd, ratio, warm };
}

/**
 * 由 EMA ratio 推算用于成本估算的 output token 数
 *  · 无 maxOutputTokens：旧行为，纯 EMA 预测（向后兼容）
 *  · 有 maxOutputTokens：保守预算 = clamp(预测×安全系数, 下界, max 上界)
 */
function resolveOutputTokens(
  inputTokens: number,
  ratio: number,
  maxOutputTokens?: number,
): number {
  if (maxOutputTokens === undefined || !Number.isFinite(maxOutputTokens) || maxOutputTokens <= 0) {
    return Math.ceil(inputTokens * ratio);
  }
  const predicted = Math.ceil(inputTokens * ratio * BUDGET_SAFETY_FACTOR);
  const lowerBounded = Math.max(predicted, BUDGET_MIN_OUTPUT_TOKENS);
  return Math.min(lowerBounded, Math.floor(maxOutputTokens));
}

/** 给 /api/llm/stats 看的快照 */
export function snapshotRatios(): Array<{ modelId: string; ratio: number; samples: number; warm: boolean }> {
  return Array.from(ratios.entries()).map(([modelId, v]) => ({
    modelId,
    ratio: v.ratio,
    samples: v.n,
    warm: v.n >= 5,
  }));
}

/**
 * 离群 clamp 次数 · 供监控判断"长输出样本被压制"的频率
 *  · 独立新增 getter，不改 snapshotRatios 既有数组形状
 */
export function getOutlierClampCount(): number {
  return outlierClampCount;
}

/** Test-only */
export function _resetForTest(): void {
  ratios.clear();
  outlierClampCount = 0;
}
