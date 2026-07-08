'use client';

/**
 * 刑部法律会诊真链卡 · 灰徽转帝金 + 后果性条款需人工确认
 *
 * 老板下合同/法律问题 → POST /api/court/dept/xing-bu/legal(真启 flow_legal,已金标4.71)
 * → 验真承重墙核 → 轮询 result 取分类后产出。
 * 诚实闸:验真过+跑完才亮 LIVE_SWARM 帝金;否则 FALLBACK 灰、不冒充。
 * 刑部命门:定性字段(consult)可读;后果性字段(consequentialFields)body 可读供研判,
 * 但显式标「需人工确认·禁一键采纳」(humanConfirmationRequired,后端单点裁决,前端无裁量)。
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import { withBasePath } from '@/lib/base-path';
import { ConfidenceSourceBadge } from '@/features/personnel/components/confidence-source-badge';

const ACCENT = '#F0C66A';
const RED = '#F43F5E';
const POLL_INTERVAL_MS = 8_000;
const MAX_POLLS = 14;

type Phase = 'idle' | 'running' | 'done' | 'fallback';

interface ConsequentialField {
  field: string;
  body: string;
  humanConfirmationRequired: boolean;
  blastRadius: 'internal' | 'external' | 'irreversible';
  triggers: string[];
}

interface LegalResult {
  sourceLabel?: string;
  status?: string;
  consult?: Record<string, string> | null;
  consequentialFields?: ConsequentialField[];
  humanConfirmationRequired?: boolean;
  blastRadius?: string;
  qualityScore?: number | null;
  message?: string;
}

interface LiveLegalPanelProps {
  defaultInput?: string;
}

export function LiveLegalPanel({ defaultInput = '' }: LiveLegalPanelProps) {
  const [input, setInput] = useState(defaultInput);
  const [phase, setPhase] = useState<Phase>('idle');
  const [result, setResult] = useState<LegalResult | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const run = useCallback(async () => {
    const taskInput = input.trim();
    if (!taskInput || phase === 'running') return;
    setPhase('running');
    setResult(null);
    setNote('法务合规蜂群运算中(约 1 分钟)…');
    try {
      const fireRes = await fetch(withBasePath('/api/court/dept/xing-bu/legal'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_input: taskInput }),
      });
      const fire = (await fireRes.json()) as { sourceLabel?: string; trace_id?: string; message?: string };
      const traceId = fire.trace_id;
      if (fire.sourceLabel !== 'LIVE_SWARM' || !traceId) {
        setResult({ sourceLabel: fire.sourceLabel, message: fire.message });
        setPhase('fallback');
        setNote(null);
        return;
      }
      let polls = 0;
      const poll = async (): Promise<void> => {
        polls += 1;
        const res = await fetch(
          withBasePath(`/api/court/dept/xing-bu/legal/result?sid=${encodeURIComponent(traceId)}`),
        );
        const json = (await res.json()) as LegalResult;
        if (json.status === 'completed' || polls >= MAX_POLLS) {
          setResult(json);
          const ok = json.sourceLabel === 'LIVE_SWARM' && Boolean(json.consult);
          setPhase(ok ? 'done' : 'fallback');
          setNote(ok ? null : json.message ?? '蜂群未在预期内产出');
          return;
        }
        timer.current = setTimeout(() => void poll(), POLL_INTERVAL_MS);
      };
      await poll();
    } catch (e) {
      setResult({ message: e instanceof Error ? e.message : String(e) });
      setPhase('fallback');
      setNote(null);
    }
  }, [input, phase]);

  const consult = result?.consult ?? null;
  const consequential = result?.consequentialFields ?? [];
  const quality = result?.qualityScore ?? null;

  return (
    <div
      className="flex flex-col gap-3 rounded-md border p-4"
      style={{ borderColor: 'rgba(240,198,106,0.28)', background: 'rgba(20,22,30,0.5)' }}
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-[0.22em] text-[#8f835f]">真链 · 刑部法务蜂群</div>
          <div className="display-serif text-[15px] text-[#e7dcc0]">法律会诊(LIVE)</div>
        </div>
        {phase === 'fallback' && <ConfidenceSourceBadge confidence={0.3} sourceLabel="FALLBACK" />}
      </div>

      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="输入合同条款/法律问题,如:对方要求独家供货2年、违约金合同额30%、付款账期90天、IP归对方,该注意什么、哪些条款要改"
        rows={3}
        disabled={phase === 'running'}
        className="w-full resize-none rounded bg-black/30 px-3 py-2 text-[12px] text-[#c6bb9d] outline-none transition-colors placeholder:text-[#6a6450] focus:ring-1"
        style={{ border: '1px solid rgba(240,198,106,0.18)' }}
      />

      <button
        type="button"
        onClick={() => void run()}
        disabled={phase === 'running' || !input.trim()}
        className="self-start rounded px-4 py-1.5 text-[12px] font-medium transition-all disabled:opacity-40"
        style={{ background: phase === 'running' ? 'rgba(240,198,106,0.15)' : ACCENT, color: phase === 'running' ? ACCENT : '#1a1206' }}
      >
        {phase === 'running' ? '蜂群运算中…' : '会诊(真启蜂群)'}
      </button>

      {note && <div className="text-[11px] text-[#b6ab8c]">{note}</div>}

      {phase === 'done' && consult && (
        <div className="flex flex-col gap-3">
          <div className="text-[12px] text-[#c6bb9d]">
            已生成法律会诊 · <span style={{ color: ACCENT }}>验真已兑现</span>
            {typeof quality === 'number' && (
              <span className="text-[#8f835f]">（蜂群质量 {quality.toFixed(2)}/5）</span>
            )}
          </div>

          {/* 定性字段:可读,chip 点开展全文 */}
          <div className="flex flex-wrap gap-1.5">
            {Object.keys(consult).map((field) => {
              const on = expanded === field;
              return (
                <button
                  key={field}
                  type="button"
                  onClick={() => setExpanded(on ? null : field)}
                  className="rounded-full border px-2.5 py-1 text-[11px] transition-colors"
                  style={{
                    borderColor: on ? ACCENT : 'rgba(240,198,106,0.28)',
                    color: on ? '#1a1206' : ACCENT,
                    background: on ? ACCENT : 'transparent',
                  }}
                >
                  {field}
                </button>
              );
            })}
          </div>
          {expanded && consult[expanded] && (
            <div className="max-h-[260px] overflow-y-auto rounded border-l-2 pl-3 pr-1" style={{ borderColor: 'rgba(240,198,106,0.4)' }}>
              <div className="whitespace-pre-wrap text-[12px] leading-relaxed text-[#c6bb9d]">{consult[expanded]}</div>
            </div>
          )}

          {/* 命门:后果性字段——可读供研判,但显式标"需人工确认,禁一键采纳" */}
          {consequential.length > 0 && (
            <div className="flex flex-col gap-2 rounded-md border p-3" style={{ borderColor: `${RED}44`, background: `${RED}0c` }}>
              <div className="flex items-center gap-2 text-[11px] font-semibold" style={{ color: RED }}>
                <span>⚠ 后果性法律结论 · 需人工确认(禁一键采纳)</span>
              </div>
              {consequential.map((c) => (
                <details key={c.field} className="rounded border-l-2 pl-3" style={{ borderColor: `${RED}66` }}>
                  <summary className="cursor-pointer text-[11px] font-medium" style={{ color: '#FCA5A5' }}>
                    {c.field}
                    <span className="ml-2 text-[10px] text-[#8f835f]">
                      {c.blastRadius === 'irreversible' ? '不可逆' : '对外'} · {c.triggers.slice(0, 2).join('/')}
                    </span>
                  </summary>
                  <div className="mt-1 whitespace-pre-wrap text-[12px] leading-relaxed text-[#c6bb9d]">{c.body}</div>
                  <div className="mt-1.5 text-[10px] text-[#8f835f]">此为高风险法律建议(§8.7),须经人工确认后方可据以行动;AI 不替你对外盖章。</div>
                </details>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
