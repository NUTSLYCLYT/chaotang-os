'use client';

import { useCallback, useState } from 'react';
import { searchJunjichuArchive } from '../api/archive';

export function useArchiveFlywheel(taskId: string | null, title: string) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<unknown>(null);

  const searchSimilar = useCallback(async () => {
    setPending(true);
    setError(null);
    try {
      const next = await searchJunjichuArchive(title, taskId ?? undefined);
      setResult(next);
      return next;
    } catch (err) {
      const message = err instanceof Error ? err.message : '旧案搜索失败';
      setError(message);
      throw err;
    } finally {
      setPending(false);
    }
  }, [taskId, title]);

  return { pending, error, result, searchSimilar };
}
