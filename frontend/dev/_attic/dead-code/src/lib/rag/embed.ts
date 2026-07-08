/**
 * 朝堂 OS · RAG · Embedding
 *
 * embedText() 调 OpenAI text-embedding-3-small（1536 维）
 * 返回 Float32Array，调用方负责序列化成 BLOB（Buffer.from(arr.buffer)）
 *
 * 注意：
 * - OPENAI_API_KEY 必须在环境变量中
 * - OPENAI_EMBED_MODEL 可覆盖默认模型
 * - OPENAI_BASE_URL 可覆盖 base URL（走 LiteLLM 网关等）
 */

const DEFAULT_MODEL = 'text-embedding-3-small';
const DEFAULT_BASE = 'https://api.openai.com/v1';

/**
 * 将文本向量化，返回 Float32Array（1536 维或模型默认维数）
 * @throws Error 当 API key 缺失或请求失败时
 */
export async function embedText(text: string): Promise<Float32Array> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not set');

  const base = (process.env.OPENAI_BASE_URL ?? DEFAULT_BASE).replace(/\/$/, '');
  const model = process.env.OPENAI_EMBED_MODEL ?? DEFAULT_MODEL;

  // 截断超长输入（text-embedding-3-small 最大 8191 tokens ≈ ~24000 字符）
  const input = text.slice(0, 24_000);

  const res = await fetch(`${base}/embeddings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, input }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`OpenAI embeddings ${res.status} · ${body.slice(0, 200)}`);
  }

  const json = (await res.json()) as {
    data: Array<{ embedding: number[] }>;
  };

  const embedding = json.data[0]?.embedding;
  if (!embedding || embedding.length === 0) {
    throw new Error('OpenAI embeddings: empty response');
  }

  return new Float32Array(embedding);
}

/**
 * Float32Array → Buffer（用于 Turso BLOB 存储）
 */
export function float32ToBuffer(arr: Float32Array): Buffer {
  return Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength);
}

/**
 * Buffer（BLOB 读回）→ Float32Array
 */
export function bufferToFloat32(buf: Buffer): Float32Array {
  // 确保字节对齐
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  return new Float32Array(ab);
}
