'use client';

/**
 * 兵部 · 报价红线深度复核(2026-07-09)
 *
 * deal-verdict.ts(quote-sanity + payment-compliance)是快速确定性预检，不重算、不调 LLM。
 * 这里是另一档：真派后端 flow_quotation 蜂群（真实 LLM，非确定性），出毛利率/数字一致性等
 * 硬核查(C1-C10)判决——两者不是同一个问题的两个冲突答案，是"秒回预检"与"深度复核"两档，
 * 仿刑部 XingbuLegalSwarmPanel 同一模式。
 */
import { useState } from 'react';
import { Loader2, ShieldAlert, TrendingUp } from 'lucide-react';
import { backendFetch } from '@/lib/backend-api';

const ACCENT = '#3E6E8E';
const C = { warm: '#DCE6EE', dim: '#9AAABB', faint: '#78889A', border: `${ACCENT}30`, live: '#7FC9A8', amber: '#E5B84D', danger: '#E5847A' };

interface QuotationFinding {
  level?: 'red' | 'yellow' | 'green';
  title?: string;
  fix?: string | null;
}

interface QuotationVerdictDoc {
  light?: 'red' | 'yellow' | 'green';
  headline?: string;
  items?: QuotationFinding[];
  source_label?: string;
  provenance?: { gate?: 'passed' | 'pending' };
}

type PanelPhase = 'idle' | 'running' | 'done' | 'error';

const LIGHT_COLOR: Record<string, string> = { red: C.danger, yellow: C.amber, green: C.live };

function labelMeta(sourceLabel: string | undefined, gate: string | undefined): { text: string; color: string } {
  if (gate === 'pending') return { text: '数据不全，判决降级待核', color: C.amber };
  if (sourceLabel === 'LIVE_SWARM' || sourceLabel === 'LIVE') return { text: '真 · 后端 flow_quotation 蜂群实算', color: C.live };
  return { text: '降级 · 未验真', color: C.amber };
}

export function BingbuQuotationVerdictPanel() {
  const [taskInput, setTaskInput] = useState('');
  const [phase, setPhase] = useState<PanelPhase>('idle');
  const [result, setResult] = useState<QuotationVerdictDoc | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  const busy = phase === 'running';
  const canDispatch = taskInput.trim().length >= 4 && !busy;

  async function runVerdict() {
    const task_input = taskInput.trim();
    if (!task_input) return;
    setPhase('running');
    setErrorMessage('');
    try {
      const res = await backendFetch('/api/quotation/verdict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_input }),
      });
      const json = (await res.json().catch(() => ({}))) as { success?: boolean; data?: QuotationVerdictDoc; error?: string };
      if (!res.ok || !json.success || !json.data) {
        setErrorMessage(json.error ?? '报价复核生成失败');
        setPhase('error');
        return;
      }
      setResult(json.data);
      setPhase('done');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
      setPhase('error');
    }
  }

  return (
    <div className="mt-3 rounded-[16px] border px-4 py-3.5" style={{ borderColor: C.border, background: `linear-gradient(180deg, ${ACCENT}10 0%, rgba(6,8,14,0.92) 100%)` }}>
      <div className="flex items-center gap-2">
        <TrendingUp size={14} style={{ color: ACCENT }} />
        <span className="display-serif text-[14px]" style={{ color: C.warm }}>进阶：报价红线深度复核(真 flow_quotation 蜂群)</span>
        <span className="rounded-full px-1.5 py-0.5 text-[10px]" style={{ border: `1px solid ${C.live}44`, color: C.live, background: `${C.live}12` }}>兵部真链</span>
      </div>
      <p className="mt-1 text-[11.5px]" style={{ color: C.faint }}>
        描述这笔报价的商机背景，真派后端跑毛利率/数字一致性硬核查，出红黄绿判决，非本地秒回预检。
      </p>

      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <input
          value={taskInput}
          onChange={(e) => setTaskInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void runVerdict(); }}
          placeholder="如：100kWh工商业储能系统报价，成本38万，客户要求毛利率不低于20%"
          disabled={busy}
          className="min-w-[260px] flex-1 rounded-[9px] border bg-transparent px-3 py-2 text-[13px] outline-none disabled:opacity-60"
          style={{ borderColor: C.border, color: C.warm }}
        />
        <button
          type="button"
          onClick={() => void runVerdict()}
          disabled={!canDispatch}
          className="inline-flex items-center gap-1.5 rounded-[9px] px-4 py-2 text-[13px] font-semibold transition disabled:opacity-45"
          style={{ background: `linear-gradient(135deg, ${ACCENT}, #86A9F2)`, color: '#04101a' }}
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <TrendingUp size={14} />}
          {busy ? '复核生成中…' : '生成深度复核'}
        </button>
      </div>

      {phase === 'error' && (
        <p className="mt-3 text-[12.5px]" style={{ color: C.danger }}>{errorMessage}</p>
      )}

      {phase === 'done' && result && (
        <div className="mt-3 rounded-[12px] border px-3 py-2.5" style={{ borderColor: '#ffffff12', background: '#ffffff05' }}>
          {(() => {
            const meta = labelMeta(result.source_label, result.provenance?.gate);
            return (
              <div className="flex items-center gap-2">
                <span className="inline-block h-2 w-2 rounded-full" style={{ background: meta.color }} />
                <span className="text-[11px] font-medium" style={{ color: meta.color }}>{meta.text}</span>
              </div>
            );
          })()}
          <p className="mt-1.5 text-[12.5px] leading-relaxed" style={{ color: C.dim }}>
            {result.headline || '后端未返回摘要。'}
          </p>

          {result.items && result.items.length > 0 && (
            <div className="mt-3 space-y-1.5">
              {result.items.map((f, index) => (
                <div
                  key={`${f.title ?? 'finding'}-${index}`}
                  className="rounded-[10px] border px-2.5 py-2"
                  style={{ borderColor: `${LIGHT_COLOR[f.level ?? 'yellow']}30`, background: `${LIGHT_COLOR[f.level ?? 'yellow']}0a` }}
                >
                  <div className="flex items-start gap-1.5 text-[11.5px]" style={{ color: C.dim }}>
                    {f.level === 'red' && <ShieldAlert size={13} className="mt-0.5 shrink-0" style={{ color: C.danger }} />}
                    <span><strong style={{ color: C.warm }}>{f.title ?? '核查项'}</strong></span>
                  </div>
                  {f.fix && <p className="mt-1 text-[11px]" style={{ color: C.faint }}>建议：{f.fix}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
