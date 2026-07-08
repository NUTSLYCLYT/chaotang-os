/**
 * 朝堂 OS · Pre-flight Triage
 *
 * 用 Haiku 4.5 一次廉价调用判断：这个 prompt 真的需要 Sonnet/Opus 吗？
 * 输出二元：simple / complex
 *
 * 经验数据（Anthropic 2025-08 内部 blog）：
 *   60-70% 的请求其实 Haiku 就够 · 直接送 Sonnet 是浪费
 *   triage 自身成本 ~$0.0001 · 节省金额是它的 50-100 倍
 */

import { callAnthropic } from './providers/anthropic';
import { logger } from '@/lib/logger';

const TRIAGE_SYSTEM = `你是路由判官。判断一个请求需要"简单模型"还是"高级模型"。
判断标准：
- simple：事实查询、格式转换、短文生成、列举、翻译、摘要
- complex：多步推理、辩论、跨领域综合、长文档理解、复杂数学

输出 JSON：{"verdict":"simple"|"complex","reason":"<20字"}
不要任何其他内容。`;

export async function triagePrompt(
  prompt: string,
  requestId?: string,
): Promise<'simple' | 'complex'> {
  const log = logger.child({ requestId: requestId ?? 'triage' });

  if (!process.env.ANTHROPIC_API_KEY) {
    // 没 key 时保守判 complex
    return 'complex';
  }

  try {
    const sample = prompt.length > 800 ? prompt.slice(0, 800) + '...' : prompt;
    const { text } = await callAnthropic('claude-haiku-4-5-20251001', sample, {
      system: TRIAGE_SYSTEM,
      timeoutMs: 5000,
      requestId,
    });

    const json = text.match(/\{[\s\S]*\}/)?.[0];
    if (!json) return 'complex';
    const parsed = JSON.parse(json) as { verdict?: string };
    if (parsed.verdict === 'simple') return 'simple';
    return 'complex';
  } catch (err) {
    log.warn('triage failed · returning complex', {
      err: err instanceof Error ? err.message : String(err),
    });
    return 'complex';
  }
}
