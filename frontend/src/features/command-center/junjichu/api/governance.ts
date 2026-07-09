import { fetchLocalCourtApi } from '@/lib/jiqun-api';

export async function proceedJunjichuDecree(taskId: string, note?: string): Promise<unknown> {
  const res = await fetchLocalCourtApi(`/api/chaotang/decree/${encodeURIComponent(taskId)}/proceed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ note }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `governance proceed failed with ${res.status}`);
  }
  return res.json().catch(() => ({}));
}
