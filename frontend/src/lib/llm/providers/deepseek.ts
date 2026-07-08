import type { CallOptions } from '../types';
import { loadSharedLlmEnv } from '../shared-env';

const DEFAULT_BASE = 'https://api.deepseek.com/v1';

function deepseekBase(): string {
  return (process.env.DEEPSEEK_BASE_URL ?? DEFAULT_BASE).replace(/\/$/, '');
}

function deepseekApiKey(): string | undefined {
  loadSharedLlmEnv();
  return process.env.DEEPSEEK_API_KEY ?? (
    process.env.OPENAI_BASE_URL?.includes('deepseek') ? process.env.OPENAI_API_KEY : undefined
  );
}

export async function callDeepSeek(
  modelId: string,
  prompt: string,
  opts: CallOptions,
): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  const apiKey = deepseekApiKey();
  if (!apiKey) throw new Error('DEEPSEEK_API_KEY not set');

  const messages = [
    ...(opts.system ? [{ role: 'system', content: opts.system }] : []),
    { role: 'user', content: prompt },
  ];

  const timeout = opts.timeoutMs ?? 30_000;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  const signal =
    opts.signal && !opts.signal.aborted
      ? AbortSignal.any([ctrl.signal, opts.signal])
      : ctrl.signal;

  try {
    const res = await fetch(`${deepseekBase()}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        ...(opts.requestId ? { 'X-Request-Id': opts.requestId } : {}),
      },
      body: JSON.stringify({ model: modelId, messages, max_tokens: 2048 }),
      signal,
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`deepseek ${res.status} · ${txt.slice(0, 200)}`);
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    return {
      text: data.choices?.[0]?.message?.content ?? '',
      inputTokens: data.usage?.prompt_tokens ?? Math.ceil(prompt.length / 3),
      outputTokens: data.usage?.completion_tokens ?? 0,
    };
  } finally {
    clearTimeout(timer);
  }
}
