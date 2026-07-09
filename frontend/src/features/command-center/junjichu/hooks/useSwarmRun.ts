'use client';

import { useCallback, useState } from 'react';
import { createSwarmRun, retrySwarmRun } from '../api/swarm-runs';
import type { SwarmRunMode, SwarmRunView } from '../model/types';

export function useSwarmRun(initialRun: SwarmRunView | null = null) {
  const [run, setRun] = useState<SwarmRunView | null>(initialRun);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = useCallback(async (payload: { task_id?: string; command?: string; mode?: SwarmRunMode; departments?: string[] }) => {
    setPending(true);
    setError(null);
    try {
      const next = await createSwarmRun(payload);
      setRun(next);
      return next;
    } catch (err) {
      const message = err instanceof Error ? err.message : '启动蜂群失败';
      setError(message);
      throw err;
    } finally {
      setPending(false);
    }
  }, []);

  const retry = useCallback(async () => {
    if (!run?.id) return null;
    setPending(true);
    setError(null);
    try {
      const next = await retrySwarmRun(run.id);
      setRun(next);
      return next;
    } catch (err) {
      const message = err instanceof Error ? err.message : '重跑蜂群失败';
      setError(message);
      throw err;
    } finally {
      setPending(false);
    }
  }, [run?.id]);

  return { run, setRun, pending, error, start, retry };
}
