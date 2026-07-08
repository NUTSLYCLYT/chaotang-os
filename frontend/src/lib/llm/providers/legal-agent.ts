/**
 * 朝堂 OS · legal-agent provider
 * 走 BFF /api/consult · 不直连 18003
 */

import type { CallOptions } from '../types';
import { callUpstream } from '@/lib/api/upstream-client';

interface ConsultUpstream {
  session_id: string;
  user_visible_summary: string;
  routing: { primary_manor: string };
  manor_result?: { summary?: string } | null;
}

export async function callLegalAgent(
  prompt: string,
  opts: CallOptions,
): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  const { data } = await callUpstream<ConsultUpstream>('/consult', {
    method: 'POST',
    body: { situation: prompt },
    requestId: opts.requestId,
    timeoutMs: opts.timeoutMs ?? 30_000,
    signal: opts.signal,
  });

  const text =
    data.manor_result?.summary ??
    data.user_visible_summary ??
    `（${data.routing.primary_manor}）暂无可读结论`;

  // legal-agent 不返 token usage · 估算（4 字 ≈ 1 token 中文经验）
  return {
    text,
    inputTokens: Math.ceil(prompt.length / 4),
    outputTokens: Math.ceil(text.length / 4),
  };
}
