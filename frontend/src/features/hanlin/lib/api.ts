import { backendFetch } from '@/lib/backend-api';

export function fetchHanlin(path: string, init: RequestInit = {}): Promise<Response> {
  return backendFetch(path, init);
}

export async function fetchHanlinJson<T>(path: string): Promise<T> {
  const response = await fetchHanlin(path, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText} — ${path}`);
  }
  return response.json() as Promise<T>;
}
