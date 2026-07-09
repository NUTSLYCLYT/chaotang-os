'use client';

/**
 * 刑部通电 · 法律会诊真链面板(2026-07-09 重接)
 *
 * 原实现调用 `/api/court/dept/xing-bu/legal`(+`/result` 轮询)——前端 BFF 层 2026-07-08
 * 退休后，这条路径在后端从未真实存在过，纯死链。改为直连已存在、已测试的真实端点
 * `POST /api/legal/verdict/from-text`(backend/web/routers/legal.py，同步返回，非
 * 派发轮询)：合同/条款全文 → LLM 抽 findings → 判决 court_doc(light/headline/items)。
 *
 * 命门保留：红色 finding(违约金/独家/诉讼等高风险条款)只读展示，不提供一键采纳——
 * 后端 `provenance.gate === 'pending'` 时前端强制显眼标"需人工/法务确认"，不绕开顶层
 * 单点裁决门(Russell:自动执行授权红线，§13.2#5/§8.7)。
 */
import { useState } from 'react';
import { Loader2, Scale, ShieldAlert } from 'lucide-react';
import { backendFetch } from '@/lib/backend-api';
import { ACCENT } from '@/features/xingbu/lib/xingbu-roster';

const C = { warm: '#EEDDD6', dim: '#b3a19b', faint: '#8a7a75', border: `${ACCENT}30`, live: '#7FC9A8', amber: '#E5B84D', danger: '#E5847A' };

interface LegalFinding {
  level?: 'red' | 'yellow' | 'green';
  title?: string;
  impact?: string;
  fix?: string;
  basis?: string;
}

interface LegalVerdictDoc {
  light?: 'red' | 'yellow' | 'green';
  headline?: string;
  items?: LegalFinding[];
  source_label?: string;
  provenance?: { gate?: 'passed' | 'pending' };
}

type PanelPhase = 'idle' | 'running' | 'done' | 'error';

const LIGHT_COLOR: Record<string, string> = { red: C.danger, yellow: C.amber, green: C.live };

function labelMeta(sourceLabel: string | undefined, gate: string | undefined): { text: string; color: string } {
  if (gate === 'pending') return { text: '未接地或未真跑，判决降级待核', color: C.amber };
  if (sourceLabel === 'LIVE_SWARM' || sourceLabel === 'LIVE') return { text: '真 · 后端法务判决(已接地)', color: C.live };
  return { text: '降级 · 未验真', color: C.amber };
}

export function XingbuLegalSwarmPanel() {
  const [taskInput, setTaskInput] = useState('');
  const [phase, setPhase] = useState<PanelPhase>('idle');
  const [result, setResult] = useState<LegalVerdictDoc | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  const busy = phase === 'running';
  const canDispatch = taskInput.trim().length >= 4 && !busy;

  async function runVerdict() {
    const text = taskInput.trim();
    if (!text) return;
    setPhase('running');
    setErrorMessage('');
    try {
      const res = await backendFetch('/api/legal/verdict/from-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const json = (await res.json().catch(() => ({}))) as { success?: boolean; data?: LegalVerdictDoc; error?: string };
      if (!res.ok || !json.success || !json.data) {
        setErrorMessage(json.error ?? '判决生成失败');
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
        <Scale size={14} style={{ color: ACCENT }} />
        <span className="display-serif text-[14px]" style={{ color: C.warm }}>进阶：真判决(LLM 抽 findings + 法条核验)</span>
        <span className="rounded-full px-1.5 py-0.5 text-[10px]" style={{ border: `1px solid ${C.live}44`, color: C.live, background: `${C.live}12` }}>刑部真链</span>
      </div>
      <p className="mt-1 text-[11.5px]" style={{ color: C.faint }}>
        上面是本地条款扫描；这里真派后端 /api/legal/verdict/from-text 判决。红色 finding 只读展示，禁一键采纳。
      </p>

      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <input
          value={taskInput}
          onChange={(e) => setTaskInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void runVerdict(); }}
          placeholder="贴合同/条款全文，如：这份独家供货协议有没有法律风险，重点看违约金和解约条款"
          disabled={busy}
          className="min-w-[260px] flex-1 rounded-[9px] border bg-transparent px-3 py-2 text-[13px] outline-none disabled:opacity-60"
          style={{ borderColor: C.border, color: C.warm }}
        />
        <button
          type="button"
          onClick={() => void runVerdict()}
          disabled={!canDispatch}
          className="inline-flex items-center gap-1.5 rounded-[9px] px-4 py-2 text-[13px] font-semibold transition disabled:opacity-45"
          style={{ background: `linear-gradient(135deg, ${ACCENT}, #B5786B)`, color: '#1a0d0a' }}
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Scale size={14} />}
          {busy ? '判决生成中…' : '生成真判决'}
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
                    <span>
                      <strong style={{ color: C.warm }}>{f.title ?? '风险点'}</strong>
                      {f.impact ? `：${f.impact}` : ''}
                    </span>
                  </div>
                  {f.fix && <p className="mt-1 text-[11px]" style={{ color: C.faint }}>建议：{f.fix}</p>}
                  {f.basis && <p className="mt-0.5 text-[10.5px]" style={{ color: ACCENT }}>法条：{f.basis}</p>}
                  {f.level === 'red' && (
                    <p className="mt-1 text-[10px] font-semibold" style={{ color: C.danger }}>
                      需人工/法务确认，此处只读，不提供一键采纳
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
