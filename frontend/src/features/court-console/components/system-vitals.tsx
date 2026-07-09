'use client';

/**
 * SystemVitals —— 系统体征灯(可观测性·Charity Majors:不能观测=黑暗飞行)。
 * 轮询 /api/health,把三服务红绿摆出来,让人一眼看到"谁断了"。
 * 诚实:关键依赖(后端/产线)down=红;LLM down=黄(降级,咨询仍可用);不掩盖。
 */

import { useCallback, useEffect, useState } from 'react';
import { backendFetch } from '@/lib/backend-api';

type Light = 'ok' | 'down' | 'unknown';

interface HealthBody {
  status: 'ok' | 'degraded';
  ts: string;
  deps: { jiqunHealth: Light; swarmConfig: Light; taskRegistry: Light; legalAgent: Light };
  optionalDeps: { legalAgent: Light; llm: Light };
}

const DOT: Record<Light, { color: string; label: string }> = {
  ok: { color: '#3DD68C', label: '正常' },
  down: { color: '#E5484D', label: '下线' },
  unknown: { color: '#6a7080', label: '未知' },
};

function Row({ name, light, note, degradeOnly }: { name: string; light: Light; note: string; degradeOnly?: boolean }) {
  // LLM 这类非关键依赖 down 显黄(降级)而非红(故障)
  const shown = light === 'down' && degradeOnly ? '#E0B450' : DOT[light].color;
  return (
    <div className="flex items-center justify-between rounded-[10px] border px-3.5 py-2.5" style={{ borderColor: '#ffffff0c', background: 'rgba(6,8,14,0.4)' }}>
      <div className="flex items-center gap-2.5">
        <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: shown, boxShadow: `0 0 8px ${shown}66` }} />
        <span className="text-[12.5px] text-[#E9DDBE]">{name}</span>
      </div>
      <span className="text-[11px]" style={{ color: shown }}>
        {light === 'down' && degradeOnly ? '降级' : DOT[light].label}
        <span className="ml-2 text-[#6a7080]">{note}</span>
      </span>
    </div>
  );
}

export function SystemVitals() {
  const [data, setData] = useState<HealthBody | null>(null);
  const [err, setErr] = useState(false);
  const [checkedAt, setCheckedAt] = useState<string>('');

  const refresh = useCallback(async () => {
    try {
      const res = await backendFetch('/api/health', { cache: 'no-store' });
      const body = (await res.json()) as HealthBody;
      setData(body);
      setErr(false);
      setCheckedAt(new Date().toLocaleTimeString('zh-CN'));
    } catch {
      setErr(true);
      setCheckedAt(new Date().toLocaleTimeString('zh-CN'));
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 30_000);
    return () => clearInterval(id);
  }, [refresh]);

  const backend: Light = data ? data.deps.jiqunHealth : err ? 'down' : 'unknown';
  const swarm: Light = data ? data.deps.swarmConfig : err ? 'down' : 'unknown';
  const llm: Light = data ? data.optionalDeps.llm : err ? 'down' : 'unknown';

  return (
    <div className="mx-auto max-w-[560px]">
      <div className="mb-3 flex items-baseline justify-between">
        <h1 className="display-serif text-[20px] text-[#F5E9C9]">系统体征</h1>
        <button type="button" onClick={refresh} className="rounded-[8px] border px-2.5 py-1 text-[11px] text-[#b6ab8c] focus:outline-none focus-visible:ring-1 focus-visible:ring-[#F0C66A]" style={{ borderColor: '#F0C66A33' }}>
          立即刷新
        </button>
      </div>
      <div className="space-y-2">
        <Row name="前端 (本页可见即在线)" light="ok" note=":3050" />
        <Row name="后端 jiqun (登录/产线/蜂群)" light={backend} note=":8081 · 关键" />
        <Row name="蜂群配置" light={swarm} note=":8081/swarm" />
        <Row name="LLM 网关 (军机处拟旨/会审)" light={llm} note=":4444 · 降级则咨询仍可用" degradeOnly />
      </div>
      <p className="mt-3 text-[11px] text-[#6a7080]">
        {data?.status === 'degraded'
          ? '⚠ 部分关键依赖降级 —— 已诚实标注,自愈守护会自动重启崩溃服务。'
          : err
            ? '⚠ 体征接口不可达(前端或网络问题)。'
            : '系统正常。'}
        {checkedAt && <span className="ml-2">· 最后检查 {checkedAt}(每 30s 自动刷新)</span>}
      </p>
    </div>
  );
}
