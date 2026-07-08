/**
 * 朝堂 OS · LLM Router · 主入口
 *
 * 业务方只跟这一个文件打交道：
 *   const r = await callLLM(intent, prompt, opts)
 *
 * 内部流程：
 *   validate → triage(可选) → route → call → telemetry
 *
 * 失败策略：
 *   - 每个 candidate 试一次 · 5xx 重试一次（同 provider）
 *   - 三层 candidate 全失败 → scripted fallback
 *   - 永远返回 CallResult（即使全挂）· 业务无需写 try/catch
 */

import { logger } from '@/lib/logger';
import {
  type CallOptions,
  type CallResult,
  type LlmIntent,
  type ModelDef,
  type RoutingDecision,
  LlmRouterError,
} from './types';
import { enabledModels, estimateCost, getModel } from './registry';
import { triagePrompt } from './triage';
import { recordCall } from './telemetry';
import { diversifyChain } from './chain-diversifier';
import { checkBudget, recordSpend } from './user-budget';
import { estimateCostAdaptive, updateRatio } from './cost-estimator';
import { getScoreWeights } from './score-weights';
import { evaluateModelGovernance } from './model-governor';
import { callAnthropic } from './providers/anthropic';
import { callOpenAI } from './providers/openai';
import { callDeepSeek } from './providers/deepseek';
import { callLegalAgent } from './providers/legal-agent';
import { callScripted } from './providers/scripted';

/* ==========================================================================
 * 全局开关 · 出问题可一键 disable router
 * ========================================================================== */
const ROUTER_DISABLED = process.env.LLM_ROUTER_DISABLED === 'true';

/* ==========================================================================
 * 路由决策 · 纯函数 · 易测
 * ========================================================================== */

interface ScoreInput {
  model: ModelDef;
  intent: LlmIntent;
  triageVerdict?: 'simple' | 'complex' | 'skipped';
}

function scoreModel({ model, intent, triageVerdict }: ScoreInput): number {
  // 必备 cap 缺一票否决
  for (const cap of intent.requires) {
    if (!model.caps.includes(cap)) return -Infinity;
  }
  // context 不够也否决
  if (intent.estimatedInputTokens > model.contextWindow) return -Infinity;

  // 成本超标否决 · 用 EMA-adaptive cost
  const { costUsd: estCost } = estimateCostAdaptive(model, intent.estimatedInputTokens);
  if (intent.maxCostUsd !== undefined && estCost > intent.maxCostUsd) {
    return -Infinity;
  }

  // 基础分：质量 - 成本 · 权重从 score-weights.ts 拉
  const W = getScoreWeights();
  let score = model.qualityScore - estCost * W.costPenalty;

  // prefer 加分 · 每个匹配 +preferBonus
  for (const cap of intent.prefers ?? []) {
    if (model.caps.includes(cap)) score += W.preferBonus;
  }

  // triage verdict 影响
  if (triageVerdict === 'simple' && model.caps.includes('cheap')) {
    score += W.triageSimpleCheapBonus;
  }
  if (triageVerdict === 'complex' && model.caps.includes('reasoning')) {
    score += W.triageComplexReasoningBonus;
  }

  // 延迟微调（fast 加分）
  if (model.p50LatencyMs < 1000) score += W.fastBonus;

  return score;
}

function route(
  intent: LlmIntent,
  triageVerdict?: 'simple' | 'complex' | 'skipped',
  forceCheap = false,
): RoutingDecision {
  const t0 = Date.now();
  const all = enabledModels();
  let scored = all
    .map((model) => ({ model, score: scoreModel({ model, intent, triageVerdict }) }))
    .filter((x) => x.score > -Infinity)
    .sort((a, b) => b.score - a.score);

  // 软预算超额 · 强制走 cheap-cap 候选
  if (forceCheap) {
    scored = scored.filter((x) => x.model.caps.includes('cheap'));
  }

  if (scored.length === 0) {
    throw new LlmRouterError(
      `no model satisfies intent ${intent.intent}`,
      'route',
      { requires: intent.requires, ctx: intent.estimatedInputTokens, forceCheap },
    );
  }

  // 跨 provider 分散 · 防同 incident 穿透
  const diversified = diversifyChain(scored, 3);
  const winner = diversified[0]!.model;
  const providers = Array.from(new Set(diversified.map((c) => c.model.provider)));
  const reason =
    `${winner.id} 以 ${diversified[0]!.score.toFixed(1)} 分胜出 · ` +
    (triageVerdict ? `triage=${triageVerdict} · ` : '') +
    (forceCheap ? `forceCheap · ` : '') +
    `候选 ${diversified.length} / ${all.length} · 跨 ${providers.length} provider`;

  return {
    selected: winner,
    candidates: diversified,
    reason,
    estimatedCostUsd: estimateCost(winner, intent.estimatedInputTokens),
    triageVerdict,
    decisionMs: Date.now() - t0,
  };
}

/* ==========================================================================
 * Provider 派发
 * ========================================================================== */

async function callProvider(
  model: ModelDef,
  prompt: string,
  opts: CallOptions,
): Promise<{ text: string; inputTokens: number; outputTokens: number; latencyMs: number }> {
  const t0 = Date.now();
  let result: { text: string; inputTokens: number; outputTokens: number };

  switch (model.provider) {
    case 'anthropic':
      result = await callAnthropic(model.id, prompt, opts);
      break;
    case 'openai':
      result = await callOpenAI(model.id, prompt, opts);
      break;
    case 'deepseek':
      result = await callDeepSeek(model.id, prompt, opts);
      break;
    case 'legal-agent':
      result = await callLegalAgent(prompt, opts);
      break;
    case 'scripted':
      result = await callScripted(prompt, opts);
      break;
  }

  return { ...result, latencyMs: Date.now() - t0 };
}

/* ==========================================================================
 * 同 provider 重试 · LLM-RETRY-04
 *   文档承诺「5xx 同 provider 重试一次」· 此前 callWithDecision 无重试。
 *   仅对 5xx / 网络类错误（timeout / ECONN / fetch failed / 5xx 状态码）
 *   重试一次（~300-500ms 指数退避）· 4xx（invalid / unauthorized / 4xx 状态码）
 *   不重试，直接落下一候选。
 * ========================================================================== */

const RETRY_BASE_DELAY_MS = 400;

function isRetriableError(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  // 明确不可重试：客户端类错误
  if (/\b4\d{2}\b/.test(msg) || msg.includes('invalid') || msg.includes('unauthorized')) {
    return false;
  }
  // 可重试：服务端 / 网络类
  return (
    /\b5\d{2}\b/.test(msg) ||
    msg.includes('timeout') ||
    msg.includes('econn') ||
    msg.includes('etimedout') ||
    msg.includes('fetch failed') ||
    msg.includes('socket hang up')
  );
}

async function callProviderWithRetry(
  model: ModelDef,
  prompt: string,
  opts: CallOptions,
): Promise<{ text: string; inputTokens: number; outputTokens: number; latencyMs: number }> {
  if (opts.signal?.aborted) throw new Error('call aborted');
  try {
    return await callProvider(model, prompt, opts);
  } catch (err) {
    if (opts.signal?.aborted) throw err;
    if (!isRetriableError(err)) throw err;
    await new Promise((resolve) =>
      setTimeout(resolve, RETRY_BASE_DELAY_MS + Math.floor(Math.random() * 200)),
    );
    if (opts.signal?.aborted) throw err;
    // 同 provider 重试一次 · 仍失败则抛给上层落下一候选
    return await callProvider(model, prompt, opts);
  }
}

/* ==========================================================================
 * 主入口
 * ========================================================================== */

export async function callLLM(
  intent: LlmIntent,
  prompt: string,
  opts: CallOptions = {},
): Promise<CallResult> {
  const requestId = opts.requestId ?? crypto.randomUUID();
  const log = logger.child({ requestId });

  // 紧急开关
  if (ROUTER_DISABLED) {
    log.warn('llm router disabled · forcing scripted', { intent: intent.intent });
    return await fallbackScripted(intent, prompt, opts, requestId, 'router disabled');
  }

  // forceProvider 调试通道
  if (opts.forceProvider) {
    const forced = enabledModels().find((m) => m.provider === opts.forceProvider);
    if (forced) {
      const decision: RoutingDecision = {
        selected: forced,
        candidates: [{ model: forced, score: 0 }],
        reason: `forced provider=${opts.forceProvider}`,
        estimatedCostUsd: estimateCost(forced, intent.estimatedInputTokens),
        decisionMs: 0,
      };
      decision.governance = evaluateModelGovernance({
        intent,
        selected: forced,
        estimatedCostUsd: decision.estimatedCostUsd,
        fallbackUsed: false,
      });
      return await callWithDecision(decision, intent, prompt, opts, requestId);
    }
  }

  // 1. Pre-flight triage（可选）
  let triageVerdict: 'simple' | 'complex' | 'skipped' = 'skipped';
  if (intent.triage) {
    try {
      triageVerdict = await triagePrompt(prompt, requestId);
      log.info('triage done', { verdict: triageVerdict });
    } catch (err) {
      log.warn('triage failed · skipping', {
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // 2. 初选路由 · LLM-BUDGET-09: 先 route 拿到真实初选模型，
  //    再用 decision.selected 做预算估算，避免用 enabledModels()[0] 这种
  //    与实际选中无关的样本去估成本。
  const userId = opts.userId ?? 'anonymous';
  let decision: RoutingDecision;
  try {
    decision = route(intent, triageVerdict, false);
  } catch (err) {
    log.error('routing failed', {
      err: err instanceof Error ? err.message : String(err),
    });
    return await fallbackScripted(intent, prompt, opts, requestId, 'routing failed');
  }

  // 预算检查（per-user）· 用初选模型 + EMA-adaptive cost 估算
  const { costUsd: estCost } = estimateCostAdaptive(
    decision.selected,
    intent.estimatedInputTokens,
  );
  const verdict = await checkBudget(userId, estCost);

  if (!verdict.ok && verdict.reason === 'over_monthly') {
    log.warn('budget HARD limit · over monthly', {
      userId,
      snap: verdict.snapshot,
    });
    return await fallbackScripted(
      intent,
      prompt,
      opts,
      requestId,
      `over_monthly_${userId}`,
    );
  }
  if (!verdict.ok && verdict.reason === 'over_daily') {
    log.warn('budget SOFT limit · forcing cheap candidates', {
      userId,
      snap: verdict.snapshot,
    });
    // 3. 软限超额 · 重新路由到 cheap 候选（覆盖初选）
    try {
      decision = route(intent, triageVerdict, true);
    } catch (err) {
      log.error('routing failed (forceCheap)', {
        err: err instanceof Error ? err.message : String(err),
      });
      return await fallbackScripted(intent, prompt, opts, requestId, 'routing failed');
    }
  }

  return await callWithDecision(decision, intent, prompt, opts, requestId, userId);
}

/* ==========================================================================
 * 调用 + 重试 + fallback chain（最多 3 层）
 * ========================================================================== */

const MAX_FALLBACK_DEPTH = 3;

async function callWithDecision(
  decision: RoutingDecision,
  intent: LlmIntent,
  prompt: string,
  opts: CallOptions,
  requestId: string,
  userId = 'anonymous',
): Promise<CallResult> {
  const log = logger.child({ requestId });
  const candidates = decision.candidates.slice(0, MAX_FALLBACK_DEPTH);
  let attempts = 0;
  let lastErr: unknown;

  for (const { model } of candidates) {
    if (opts.signal?.aborted) break;
    attempts++;
    try {
      const { text, inputTokens, outputTokens, latencyMs } = await callProviderWithRetry(
        model,
        prompt,
        opts,
      );
      const costUsd =
        (inputTokens / 1_000_000) * model.costPerMTokenIn +
        (outputTokens / 1_000_000) * model.costPerMTokenOut;
      const fallbackUsed = attempts > 1 || model.provider === 'scripted';
      const governance = evaluateModelGovernance({
        intent,
        selected: model,
        estimatedCostUsd: costUsd,
        fallbackUsed,
      });

      const result: CallResult = {
        data: text,
        decision: { ...decision, selected: model, governance },
        upstream: model.provider === 'scripted' ? 'scripted' : 'live',
        upstreamMs: latencyMs,
        inputTokens,
        outputTokens,
        costUsd,
        attempts,
      };

      recordCall({
        requestId,
        intent: intent.intent,
        modelId: model.id,
        provider: model.provider,
        inputTokens,
        outputTokens,
        costUsd,
        latencyMs,
        attempts,
        ok: true,
        governance,
      });
      // 入账户预算 · LLM-SPEND-06: 不再 fire-and-forget 静默吞错。
      // await 记账并捕获失败，用 log.error 记录（含 userId/costUsd）以便告警。
      // LLM-BUDGET-02: 记账在 router 侧仅此一处单点调用，避免双重计费。
      try {
        await recordSpend(userId, costUsd);
      } catch (spendErr) {
        log.error('budget recordSpend failed · accounting may be inconsistent', {
          userId,
          costUsd,
          err: spendErr instanceof Error ? spendErr.message : String(spendErr),
        });
      }
      // 自适应：用真实 token 数更新 EMA ratio · 下次估算更准
      updateRatio(model.id, inputTokens, outputTokens);
      log.info('llm call ok', {
        intent: intent.intent,
        model: model.id,
        latencyMs,
        costUsd: costUsd.toFixed(4),
        attempts,
        userId,
      });
      return result;
    } catch (err) {
      if (opts.signal?.aborted) {
        lastErr = err;
        log.warn('llm call aborted · falling to scripted', {
          model: model.id,
          attempt: attempts,
          err: err instanceof Error ? err.message : String(err),
        });
        break;
      }
      lastErr = err;
      recordCall({
        requestId,
        intent: intent.intent,
        modelId: model.id,
        provider: model.provider,
        inputTokens: 0,
        outputTokens: 0,
        costUsd: 0,
        latencyMs: 0,
        attempts,
        ok: false,
        err: err instanceof Error ? err.message : String(err),
        governance: evaluateModelGovernance({
          intent,
          selected: model,
          estimatedCostUsd: 0,
          fallbackUsed: attempts > 1,
        }),
      });
      log.warn('llm candidate failed · trying next', {
        model: model.id,
        attempt: attempts,
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }

  log.error('all candidates failed · falling to scripted', {
    intent: intent.intent,
    attempts,
    lastErr: lastErr instanceof Error ? lastErr.message : String(lastErr),
  });
  return await fallbackScripted(intent, prompt, opts, requestId, 'all_failed', attempts);
}

async function fallbackScripted(
  intent: LlmIntent,
  prompt: string,
  opts: CallOptions,
  requestId: string,
  reason: string,
  prevAttempts = 0,
): Promise<CallResult> {
  const scripted = getModel('scripted-fallback');
  if (!scripted) {
    throw new LlmRouterError('scripted fallback model missing', 'all_failed');
  }
  const { text, inputTokens, outputTokens, latencyMs } = await callProvider(
    scripted,
    prompt,
    opts,
  );

  const decision: RoutingDecision = {
    selected: scripted,
    candidates: [{ model: scripted, score: 0 }],
    reason: `scripted fallback (${reason})`,
    estimatedCostUsd: 0,
    decisionMs: 0,
  };
  decision.governance = evaluateModelGovernance({
    intent,
    selected: scripted,
    estimatedCostUsd: 0,
    fallbackUsed: true,
  });

  recordCall({
    requestId,
    intent: intent.intent,
    modelId: scripted.id,
    provider: 'scripted',
    inputTokens,
    outputTokens,
    costUsd: 0,
    latencyMs,
    attempts: prevAttempts + 1,
    ok: true,
    fallback: true,
    governance: decision.governance,
  });

  return {
    data: text,
    decision,
    upstream: 'scripted',
    upstreamMs: latencyMs,
    inputTokens,
    outputTokens,
    costUsd: 0,
    attempts: prevAttempts + 1,
  };
}
