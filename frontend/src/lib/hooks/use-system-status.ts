/**
 * useSystemStatus — 轮询 V1 /api/health 获取系统状态
 *
 * 在 TopBar / Settings 页用来显示 LLM provider 实时状态
 */

'use client';

import { useEffect, useState } from 'react';
import type { SystemStatus } from '@/lib/api/client';
import { withBasePath } from '@/lib/base-path';

interface HealthBody {
  status?: 'ok' | 'degraded' | 'down';
  ts?: string;
  deps?: {
    database?: 'ok' | 'down';
  };
}

async function fetchSystemStatus(): Promise<SystemStatus> {
  const res = await fetch(withBasePath('/api/health'), { cache: 'no-store' });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  const raw = (await res.json()) as HealthBody;
  return {
    status: raw.status ?? 'degraded',
    timestamp: raw.ts ?? new Date().toISOString(),
    services: {
      database: raw.deps?.database === 'down' ? 'disconnected' : 'connected',
      llm: {
        provider: process.env.NEXT_PUBLIC_OPENAI_CONFIGURED === 'true' ? 'openai' : 'mock',
        configured: process.env.NEXT_PUBLIC_OPENAI_CONFIGURED === 'true',
      },
    },
    stats: {
      totalTasks: 0,
      archivedTasks: 0,
    },
    uptime: 0,
  };
}

export function useSystemStatus(pollIntervalMs = 15000) {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    let timer: ReturnType<typeof setInterval> | null = null;

    const fetchOnce = async () => {
      try {
        const s = await fetchSystemStatus();
        if (mounted) {
          setStatus(s);
          setLoading(false);
        }
      } catch {
        if (mounted) setLoading(false);
      }
    };

    fetchOnce();
    timer = setInterval(fetchOnce, pollIntervalMs);

    return () => {
      mounted = false;
      if (timer) clearInterval(timer);
    };
  }, [pollIntervalMs]);

  return { status, loading };
}
