'use client';

import { useCallback, useState } from 'react';

import { fetchLocalCourtApi } from '@/lib/jiqun-api';

import {
  deriveBriefPhase,
  type JinyiweiBrief,
  type JinyiweiBriefPhase,
  type JinyiweiFindingInput,
} from '../lib/jinyiwei-brief-contract';
import { requestJinyiweiBrief } from '../lib/request-jinyiwei-brief';

export interface UseJinyiweiBriefResult {
  brief: JinyiweiBrief | null;
  phase: JinyiweiBriefPhase;
  error: string | null;
  startedAt: string | null;
  completedAt: string | null;
  run: (query: string, findings?: JinyiweiFindingInput[]) => Promise<void>;
  clear: () => void;
}

export function useJinyiweiBrief(): UseJinyiweiBriefResult {
  const [brief, setBrief] = useState<JinyiweiBrief | null>(null);
  const [phase, setPhase] = useState<JinyiweiBriefPhase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [completedAt, setCompletedAt] = useState<string | null>(null);

  const run = useCallback(async (query: string, findings?: JinyiweiFindingInput[]) => {
    const normalized = query.trim();
    if (normalized.length < 4) {
      setError('请写明要核查的项目、竞品、风险或外部信号。');
      setPhase('error');
      return;
    }

    setPhase('collecting');
    setError(null);
    setStartedAt(new Date().toISOString());
    try {
      const result = await requestJinyiweiBrief(normalized, findings, fetchLocalCourtApi);
      setBrief(result);
      setPhase(deriveBriefPhase(result));
      setCompletedAt(new Date().toISOString());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '锦衣卫采证失败');
      setPhase('error');
      setCompletedAt(new Date().toISOString());
    }
  }, []);

  const clear = useCallback(() => {
    setBrief(null);
    setPhase('idle');
    setError(null);
  }, []);

  return { brief, phase, error, startedAt, completedAt, run, clear };
}
