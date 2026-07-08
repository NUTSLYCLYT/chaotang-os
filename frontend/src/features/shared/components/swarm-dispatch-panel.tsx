'use client';

/**
 * 各级直调蜂群 · 统一原语(P3 · 2026-07-01)
 *
 * 任意部/司页面拖入 <SwarmDispatchPanel deptCode="xing_bu" /> 即获得一致的"派蜂群→真回执"能力。
 * 全走唯一出口 `/api/court/dept/swarm-dispatch`(→ dispatchDeptToSwarm → 唯一桥 + 兑现核验)。
 * 能力发现:DEPT_ENTRY_SWARM 显"本部→哪个蜂群";未接蜂群的部诚实标灰、禁点。
 * 铁律6 产线一个出口 · 铁律9 真算后端 · 诚实 sourceLabel(LIVE_SWARM/MIXED/FALLBACK)不伪造。
 */

import { useCallback, useState } from 'react';
import { Loader2, Zap } from 'lucide-react';
import { withBasePath } from '@/lib/base-path';
import { DEPT_ENTRY_SWARM } from '@/core/courtos/runtime/dept-entry-swarm';
import type { DeptDispatchOutcome } from '@/core/courtos/runtime/dept-swarm-dispatch';

const C = { warm: '#EAF3EE', dim: '#a7b3ac', muted: '#7a8a82', faint: '#5a6a62', gold: '#F0C66A', blue: '#4A82F0', gong: '#7FC9A8', amber: '#E5B84D', border: '#2A2350' };

function labelMeta(sl: string | undefined): { text: string; color: string } {
  if (sl === 'LIVE_SWARM' || sl === 'LIVE') return { text: '真 · 后端蜂群实算(已兑现核验)', color: C.gong };
  if (sl === 'MIXED') return { text: '混合 · 未过兑现核验,不盖 LIVE', color: C.amber };
  return { text: '降级 · 后端不可达,未真算', color: C.amber };
}

/** 各级直调 hook:任意 deptCode → 统一派蜂群 + 能力发现。 */
export function useSwarmDispatch(deptCode: string) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<DeptDispatchOutcome | null>(null);
  const entrySwarm = DEPT_ENTRY_SWARM[deptCode]; // 能力:本部→哪个蜂群(undefined=未接)

  const dispatch = useCallback(async (question: string) => {
    if (question.trim().length < 4 || busy) return;
    setBusy(true);
    setResult(null);
    try {
      const r = await fetch(withBasePath('/api/court/dept/swarm-dispatch'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ deptCode, question: question.trim() }),
      });
      setResult((await r.json()) as DeptDispatchOutcome);
    } catch {
      setResult({ ok: false, sourceLabel: 'FALLBACK', summary: '网络异常,后端未应答', findings: [], missingCapabilities: [], adapterState: 'unknown', verified: false });
    } finally {
      setBusy(false);
    }
  }, [deptCode, busy]);

  return { entrySwarm, canDispatch: Boolean(entrySwarm), dispatch, busy, result };
}

export function SwarmDispatchPanel({ deptCode, deptName }: { deptCode: string; deptName?: string }) {
  const { entrySwarm, canDispatch, dispatch, busy, result } = useSwarmDispatch(deptCode);
  const [q, setQ] = useState('');
  const meta = result ? labelMeta(result.sourceLabel) : null;

  return (
    <div className="mt-3 rounded-[16px] border px-4 py-3.5" style={{ borderColor: `${C.blue}30`, background: `linear-gradient(180deg, ${C.blue}10 0%, rgba(6,8,14,0.92) 100%)` }}>
      <div className="flex flex-wrap items-center gap-2">
        <Zap size={14} style={{ color: C.blue }} />
        <span className="display-serif text-[14px]" style={{ color: C.warm }}>派蜂群 · 后端真算</span>
        {/* 能力发现:本部→哪个蜂群 */}
        {canDispatch ? (
          <span className="rounded-full px-1.5 py-0.5 text-[10px]" style={{ border: `1px solid ${C.gong}44`, color: C.gong, background: `${C.gong}12` }}>
            本部 → {entrySwarm} 蜂群
          </span>
        ) : (
          <span className="rounded-full px-1.5 py-0.5 text-[10px]" style={{ border: `1px solid ${C.faint}55`, color: C.faint }}>
            本部暂未接蜂群(咨询态)
          </span>
        )}
      </div>
      <p className="mt-1 text-[11.5px]" style={{ color: C.faint }}>
        {canDispatch
          ? `输入需求,经唯一桥派 ${entrySwarm} 蜂群实算;真成本/交付后端算,前端不编(铁律9)。`
          : `${deptName ?? '本部'}目前是本地咨询,未接后端蜂群;接通前此处禁用(不空转)。`}
      </p>

      {canDispatch && (
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void dispatch(q); }}
            placeholder="输入需求,派后端蜂群实算…"
            className="min-w-[240px] flex-1 rounded-[9px] border bg-transparent px-3 py-2 text-[13px] outline-none"
            style={{ borderColor: C.border, color: C.warm }}
          />
          <button
            onClick={() => void dispatch(q)}
            disabled={busy || q.trim().length < 4}
            className="inline-flex items-center gap-1.5 rounded-[9px] px-4 py-2 text-[13px] font-semibold transition disabled:opacity-45"
            style={{ background: `linear-gradient(135deg, ${C.blue}, #3A6FD8)`, color: '#EAF3EE' }}
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
            {busy ? '后端核算中…' : '派蜂群'}
          </button>
        </div>
      )}

      {result && meta && (
        <div className="mt-3 rounded-[12px] border px-3 py-2.5" style={{ borderColor: '#ffffff12', background: '#ffffff05' }}>
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: meta.color }} />
            <span className="text-[11px] font-medium" style={{ color: meta.color }}>{meta.text}</span>
            {result.adapterState && <span className="text-[10px]" style={{ color: C.faint }}>· adapter {result.adapterState}</span>}
          </div>
          <p className="mt-1.5 text-[12.5px] leading-relaxed" style={{ color: C.dim }}>{result.summary || '后端未返回摘要。'}</p>
          {result.findings.length > 0 && (
            <ul className="mt-2 space-y-1">
              {result.findings.map((f, i) => (
                <li key={i} className="flex items-start gap-1.5 text-[11.5px]" style={{ color: C.dim }}>
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full" style={{ background: C.blue }} />{f}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
