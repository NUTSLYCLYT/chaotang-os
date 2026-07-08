import type { CallOptions } from '../types';

// baseURL 可配：指向本机 LiteLLM(:4444/v1, Claude via OAuth) 或直连 OpenAI。
const BASE = process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1';
const API = `${BASE.replace(/\/$/, '')}/chat/completions`;

export async function callOpenAI(
  modelId: string,
  prompt: string,
  opts: CallOptions,
): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not set');

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
    const res = await fetch(API, {
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
      throw new Error(`openai ${res.status} · ${txt.slice(0, 200)}`);
    }

    const data = (await res.json()) as {
      choices: Array<{ message: { content: string } }>;
      usage: { prompt_tokens: number; completion_tokens: number };
    };
    const text = data.choices[0]?.message.content ?? '';
    return {
      text,
      inputTokens: data.usage.prompt_tokens,
      outputTokens: data.usage.completion_tokens,
    };
  } finally {
    clearTimeout(timer);
  }
}
