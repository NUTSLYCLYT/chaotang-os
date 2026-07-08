'use client';

/**
 * 引擎健康灯（2026-06-24 · 融合·可见性支柱）。
 *
 * 朝堂顶栏的"引擎仪表盘":三色点显咨询/执行(jiqun)/法务三引擎 live + 熔断。
 * 装了熔断却看不见 = 有刹车没仪表盘;这盏灯让皇帝一眼知道"执行引擎是否在线"。
 * 只显示、不操作;轮询 30s。
 */

import { useEffect, useState } from 'react';
import { withBasePath } from '@/lib/base-path';

interface Engine {
  key: string;
  role: string;
  live: boolean;
  ms: number;
  breaker: 'closed' | 'open';
}

function dotColor(e: Engine): string {
  if (e.breaker === 'open') return '#F0C66A'; // 熔断开:帝金警示
  return e.live ? '#34D399' : '#6B7280'; // 活:翠绿 / 离线:灰
}

export function EngineHealthBadge() {
  const [engines, setEngines] = useState<Engine[] | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch(withBasePath('/api/court/upstreams-health'), { cache: 'no-store' });
        if (!res.ok) return;
        const body = (await res.json()) as { data?: { engines?: Engine[] } };
        if (alive && body.data?.engines) setEngines(body.data.engines);
      } catch {
        /* 健康灯本身失败不打扰用户;保持上次状态 */
      }
    };
    load();
    const id = window.setInterval(load, 30_000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, []);

  if (!engines) return null;

  const title = engines
    .map((e) => `${e.role}: ${e.breaker === 'open' ? '熔断' : e.live ? '在线' : '离线'}${e.live ? ` ${e.ms}ms` : ''}`)
    .join(' · ');

  return (
    <div
      className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.035] px-2.5 py-1.5"
      title={`引擎 — ${title}`}
      aria-label={`引擎健康:${title}`}
    >
      <span className="text-[10px] tracking-[0.14em] text-[#8A8470]">引擎</span>
      <span className="flex items-center gap-1">
        {engines.map((e) => (
          <span
            key={e.key}
            className="h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: dotColor(e), boxShadow: e.live ? `0 0 5px ${dotColor(e)}` : 'none' }}
          />
        ))}
      </span>
    </div>
  );
}
