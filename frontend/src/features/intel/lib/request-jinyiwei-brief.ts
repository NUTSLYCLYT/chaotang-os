import type {
  JinyiweiBrief,
  JinyiweiBriefEnvelope,
  JinyiweiFindingInput,
} from './jinyiwei-brief-contract';

export type JinyiweiBriefRequest = (path: string, init: RequestInit) => Promise<Response>;

export async function requestJinyiweiBrief(
  query: string,
  findings: JinyiweiFindingInput[] | undefined,
  request: JinyiweiBriefRequest,
): Promise<JinyiweiBrief> {
  const normalized = query.trim();
  if (normalized.length < 4) throw new Error('请写明要核查的项目、竞品、风险或外部信号。');
  const response = await request('/api/intel/brief', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: normalized, ...(findings?.length ? { findings } : {}) }),
  });
  const envelope = (await response.json().catch(() => null)) as JinyiweiBriefEnvelope | null;
  if (!response.ok || !envelope?.success || !envelope.data) {
    throw new Error(envelope?.message || envelope?.error || `锦衣卫采证失败（HTTP ${response.status}）`);
  }
  return envelope.data;
}
