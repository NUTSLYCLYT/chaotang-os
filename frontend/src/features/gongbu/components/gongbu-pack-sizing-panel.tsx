'use client';

/**
 * 工部杀手锏 · PACK 可行性核算(接点③ · 2026-07-01)
 *
 * 户部给不出的东西:一条**后端蜂群真算过**的可行性回执。输入工程需求(电压/容量/温度/场景)→
 * 真派 `/api/court/gongbu/pack-sizing` → jiqun pack_rd 蜂群 → 诚实回传 sourceLabel(LIVE_SWARM/FALLBACK)。
 * 铁律9:真 sizing 在后端算,前端只编排+诚实显来源,绝不在前端编数字。
 */

import { useState } from 'react';
import { Loader2, Cpu } from 'lucide-react';
import { backendFetch } from '@/lib/backend-api';

const C = { warm: '#EAF3EE', dim: '#a7b3ac', muted: '#7a8a82', faint: '#5a6a62', gong: '#7FC9A8', blue: '#4A82F0', amber: '#E5B84D', border: '#22402f' };

interface PackResult {
  ok?: boolean;
  sourceLabel?: string;
  summary?: string;
  findings?: string[];
  missingCapabilities?: string[];
  adapterState?: string;
  error?: string;
}

function labelMeta(sl: string | undefined): { text: string; color: string } {
  if (sl === 'LIVE_SWARM' || sl === 'LIVE') return { text: '真 · 后端蜂群实算', color: C.gong };
  if (sl === 'MIXED') return { text: '混合 · 部分真算', color: C.amber };
  return { text: '降级 · 后端不可达,未出真 sizing', color: C.amber };
}

export function GongbuPackSizingPanel() {
  const [req, setReq] = useState('');
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<PackResult | null>(null);

  async function dispatch() {
    const requirement = req.trim();
    if (requirement.length < 4 || busy) return;
    setBusy(true);
    setRes(null);
    try {
      const r = await backendFetch('/api/court/gongbu/pack-sizing', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ requirement }),
      });
      setRes((await r.json()) as PackResult);
    } catch {
      setRes({ ok: false, sourceLabel: 'FALLBACK', summary: '网络异常,后端蜂群未应答,本次未出真 sizing。', findings: [] });
    } finally {
      setBusy(false);
    }
  }

  const meta = res ? labelMeta(res.sourceLabel) : null;

  return (
    <div className="mt-3 rounded-[16px] border px-4 py-3.5" style={{ borderColor: `${C.blue}30`, background: `linear-gradient(180deg, ${C.blue}10 0%, rgba(6,8,14,0.92) 100%)` }}>
      <div className="flex items-center gap-2">
        <Cpu size={14} style={{ color: C.blue }} />
        <span className="display-serif text-[14px]" style={{ color: C.warm }}>PACK 可行性核算 · 真派后端蜂群</span>
        <span className="rounded-full px-1.5 py-0.5 text-[10px]" style={{ border: `1px solid ${C.gong}44`, color: C.gong, background: `${C.gong}12` }}>工部独有</span>
      </div>
      <p className="mt-1 text-[11.5px]" style={{ color: C.faint }}>输入工程需求,派 jiqun pack_rd 蜂群实算——真成本/BOM/交期后端算,前端不编(铁律9)。</p>

      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <input
          value={req}
          onChange={(e) => setReq(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void dispatch(); }}
          placeholder="如:60V 32Ah 三轮车电池包,-20℃ 低温启动,循环 ≥1500"
          className="min-w-[260px] flex-1 rounded-[9px] border bg-transparent px-3 py-2 text-[13px] outline-none"
          style={{ borderColor: C.border, color: C.warm }}
        />
        <button
          onClick={() => void dispatch()}
          disabled={busy || req.trim().length < 4}
          className="inline-flex items-center gap-1.5 rounded-[9px] px-4 py-2 text-[13px] font-semibold transition disabled:opacity-45"
          style={{ background: `linear-gradient(135deg, ${C.gong}, #4FA986)`, color: '#06110b' }}
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Cpu size={14} />}
          {busy ? '后端核算中…' : '派 pack_rd 核算'}
        </button>
      </div>

      {res && meta && (
        <div className="mt-3 rounded-[12px] border px-3 py-2.5" style={{ borderColor: '#ffffff12', background: '#ffffff05' }}>
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: meta.color }} />
            <span className="text-[11px] font-medium" style={{ color: meta.color }}>{meta.text}</span>
            {res.adapterState && <span className="text-[10px]" style={{ color: C.faint }}>· adapter {res.adapterState}</span>}
          </div>
          {res.error ? (
            <p className="mt-1.5 text-[12.5px]" style={{ color: '#E5847A' }}>{res.error}</p>
          ) : (
            <p className="mt-1.5 text-[12.5px] leading-relaxed" style={{ color: C.dim }}>{res.summary || '后端未返回摘要。'}</p>
          )}
          {res.findings && res.findings.length > 0 && (
            <ul className="mt-2 space-y-1">
              {res.findings.map((f, i) => (
                <li key={i} className="flex items-start gap-1.5 text-[11.5px]" style={{ color: C.dim }}>
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full" style={{ background: C.blue }} />{f}
                </li>
              ))}
            </ul>
          )}
          {res.missingCapabilities && res.missingCapabilities.length > 0 && (
            <p className="mt-2 text-[11px]" style={{ color: C.amber }}>后端缺能力:{res.missingCapabilities.join('、')}</p>
          )}
        </div>
      )}
    </div>
  );
}
