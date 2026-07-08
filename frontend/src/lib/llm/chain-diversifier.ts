/**
 * 朝堂 OS · Fallback Chain Diversifier
 *
 * 修复 v1.1 的最大软肋：fallback 链全是同一个 provider · 整 provider 挂时穿透
 *
 * 规则：
 *   1. 候选数 ≤ 1：原样返回（无可分散）
 *   2. 候选数 ≥ 2：第 1 名 = 原最高分；第 2 名必须是不同 provider 的最高分
 *   3. 候选数 ≥ 3：第 3 名必须与前两名都不同 provider（如有）
 *   4. scripted 永远是终点 · 由 router 自己保证
 *
 * 原理：
 *   候选 [Sonnet, Haiku, GPT-mini, legal-agent, scripted]
 *   diversify → [Sonnet, GPT-mini, legal-agent]   (跨 3 个 provider)
 *
 * 这样 anthropic 全挂时 · 第 2 跳就跳到 OpenAI · 不会被同 incident 拖垮
 */

import type { ModelDef, ProviderId } from './types';

export interface CandidateScored {
  model: ModelDef;
  score: number;
}

export function diversifyChain(
  candidates: CandidateScored[],
  maxDepth = 3,
): CandidateScored[] {
  if (candidates.length <= 1) return candidates.slice(0, maxDepth);

  const result: CandidateScored[] = [];
  const usedProviders = new Set<ProviderId>();

  // 第 1 位：原最高分
  const head = candidates[0]!;
  result.push(head);
  usedProviders.add(head.model.provider);

  // 第 2..N 位：贪心选异 provider 中得分最高的
  while (result.length < maxDepth) {
    // 优先选 provider 不重复的
    const diff = candidates.find(
      (c) => !result.includes(c) && !usedProviders.has(c.model.provider),
    );
    if (diff) {
      result.push(diff);
      usedProviders.add(diff.model.provider);
      continue;
    }
    // provider 已经覆盖完 · 找剩下的最高分（不强制 diff）
    const next = candidates.find((c) => !result.includes(c));
    if (!next) break;
    result.push(next);
  }

  return result;
}

/**
 * 校验：candidates 经 diversify 后 · 同 provider 占比是否超过 50%
 * 用于 telemetry · 不阻断业务
 */
export function diversityRatio(chain: CandidateScored[]): {
  uniqueProviders: number;
  topProviderShare: number;
} {
  if (chain.length === 0) return { uniqueProviders: 0, topProviderShare: 0 };
  const counts = new Map<ProviderId, number>();
  for (const c of chain) {
    counts.set(c.model.provider, (counts.get(c.model.provider) ?? 0) + 1);
  }
  const top = Math.max(...counts.values());
  return {
    uniqueProviders: counts.size,
    topProviderShare: top / chain.length,
  };
}
