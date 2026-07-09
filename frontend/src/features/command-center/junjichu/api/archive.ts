import { fetchLocalCourtApi } from '@/lib/jiqun-api';

async function readJson<T>(res: Response, label: string): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `${label} failed with ${res.status}`);
  }
  return (await res.json()) as T;
}

export async function searchJunjichuArchive(query: string, taskId?: string): Promise<unknown> {
  const params = new URLSearchParams();
  if (query.trim()) params.set('q', query.trim());
  if (taskId) params.set('task_id', taskId);
  const res = await fetchLocalCourtApi(`/api/chaotang/archive/search?${params.toString()}`);
  return readJson<unknown>(res, 'archive search');
}

export async function getJunjichuKnowledgeCount(): Promise<unknown> {
  const res = await fetchLocalCourtApi('/api/chaotang/archive/knowledge/count');
  return readJson<unknown>(res, 'knowledge count');
}

export async function submitJunjichuKnowledgeFeedback(payload: {
  task_id: string;
  note: string;
  outcome?: string;
}): Promise<unknown> {
  const res = await fetchLocalCourtApi('/api/chaotang/archive/knowledge/feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return readJson<unknown>(res, 'knowledge feedback');
}
