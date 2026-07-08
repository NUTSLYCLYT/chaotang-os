/**
 * 朝堂 OS · Anthropic Provider
 * 直连 messages API · 不抽象掉 provider-specific 字段
 *
 * 2026-07-03: 无 ANTHROPIC_API_KEY 时经本机 LiteLLM(:4444) 的 Anthropic-format
 * passthrough 兜底，用 OPENAI_BASE_URL/OPENAI_API_KEY(已在 .env.local 配好且在跑)，
 * 并把裸模型名映射到 LiteLLM 已注册的 swarm-* 别名，走真 Claude(OAuth 后端)而非
 * fallback 到 openai.ts 的 heuristic/mock 判断。
 */

import type { CallOptions } from '../types';

const DIRECT_API = 'https://api.anthropic.com/v1/messages';

const GATEWAY_MODEL_MAP: Record<string, string> = {
  'claude-sonnet-4-6': 'swarm-strong',
  'claude-opus-4-8': 'swarm-strong',
  'claude-haiku-4-5-20251001': 'swarm-haiku',
  'claude-haiku-4-5': 'swarm-haiku',
};

interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AnthropicResponse {
  content: Array<{ type: string; text?: string }>;
  usage: { input_tokens: number; output_tokens: number };
}

export async function callAnthropic(
  modelId: string,
  prompt: string,
  opts: CallOptions,
): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  const directKey = process.env.ANTHROPIC_API_KEY;
  const gatewayBase = process.env.OPENAI_BASE_URL;
  const gatewayKey = process.env.OPENAI_API_KEY;

  const useGateway = !directKey && !!gatewayBase && !!gatewayKey;
  if (!directKey && !useGateway) throw new Error('ANTHROPIC_API_KEY not set');

  const API = useGateway ? `${gatewayBase!.replace(/\/$/, '')}/messages` : DIRECT_API;
  const apiKey = useGateway ? gatewayKey! : directKey!;
  const model = useGateway ? (GATEWAY_MODEL_MAP[modelId] ?? modelId) : modelId;

  const body = {
    model,
    max_tokens: 2048,
    system: opts.system,
    messages: [{ role: 'user', content: prompt } satisfies AnthropicMessage],
  };

  const timeout = opts.timeoutMs ?? 30_000;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  const signal =
    opts.signal && !opts.signal.aborted
      ? AbortSignal.any([ctrl.signal, opts.signal])
      : ctrl.signal;

  try {
    const res = await fetch(API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        ...(opts.requestId ? { 'X-Request-Id': opts.requestId } : {}),
      },
      body: JSON.stringify(body),
      signal,
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`anthropic ${res.status} · ${txt.slice(0, 200)}`);
    }

    const data = (await res.json()) as AnthropicResponse;
    const text = data.content.map((c) => c.text ?? '').join('');
    return {
      text,
      inputTokens: data.usage.input_tokens,
      outputTokens: data.usage.output_tokens,
    };
  } finally {
    clearTimeout(timer);
  }
}
