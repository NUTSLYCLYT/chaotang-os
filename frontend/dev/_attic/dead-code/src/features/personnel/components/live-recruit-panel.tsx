'use client';

/**
 * 吏部真链招聘卡 · 灰徽转帝金的实体
 *
 * 老板下招聘需求 → POST /api/court/dept/li-bu/recruit(真启吏部人才蜂群,entry_swarm=libu)
 * → 验真承重墙核 session 可向后端兑现 → 轮询 result 取真方案。
 * 诚实闸:验真过 + 跑完才亮 LIVE_SWARM 帝金 + 出完整方案;否则 FALLBACK 灰、不冒充。
 * 边界(§13.2#9):出画像/方案/面试题=咨询,走前端 BFF OK;真发 offer/定薪=产线,本卡不碰。
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import { withBasePath } from '@/lib/base-path';
import type { RecruitVerdict } from '@/core/courtos/runtime/recruit-verdict';
import { ConfidenceSourceBadge } from './confidence-source-badge';

const ACCENT = '#F0C66A';
const POLL_INTERVAL_MS = 8_000;
const MAX_POLLS = 14;

type Phase = 'idle' | 'running' | 'done' | 'fallback';

interface RecruitResult {
  sourceLabel?: string;
  status?: string;
  data?: Record<string, string> | null;
  qualityScore?: number | null;
  verdict?: RecruitVerdict | null;
  message?: string;
}

/** 处置色:准奏=帝金 / 缓奏=琥珀 / 不准=赤 / 待判=灰金。 */
const DISPOSITION_COLOR: Record<RecruitVerdict['disposition'], string> = {
  approve: '#F0C66A',
  hold: '#FB923C',
  reject: '#F43F5E',
  unknown: '#9AA3BD',
};

interface LiveRecruitPanelProps {
  defaultInput?: string;
}

export function LiveRecruitPanel({ defaultInput = '' }: LiveRecruitPanelProps) {
  const [input, setInput] = useState(defaultInput);
  const [phase, setPhase] = useState<Phase>('idle');
  const [result, setResult] = useState<RecruitResult | null>(null);
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
    setNote('吏部人才蜂群运算中(约 1 分钟)…');
    try {
      const fireRes = await fetch(withBasePath('/api/court/dept/li-bu/recruit'), {
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
          withBasePath(`/api/court/dept/li-bu/recruit/result?sid=${encodeURIComponent(traceId)}`),
        );
        const json = (await res.json()) as RecruitResult;
        if (json.status === 'completed' || polls >= MAX_POLLS) {
          setResult(json);
          const ok = json.sourceLabel === 'LIVE_SWARM' && Boolean(json.data);
          setPhase(ok ? 'done' : 'fallback');
          setNote(ok ? null : json.message ?? '蜂群未在预期内产出完整方案');
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

  const data = result?.data ?? null;
  const quality = result?.qualityScore ?? null;
  const verdict = result?.verdict ?? null;
  const verdictColor = verdict ? DISPOSITION_COLOR[verdict.disposition] : ACCENT;

  return (
    <div
      className="flex flex-col gap-3 rounded-md border p-4"
      style={{ borderColor: 'rgba(240,198,106,0.28)', background: 'rgba(20,22,30,0.5)' }}
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-[0.22em] text-[#8f835f]">真链 · 吏部人才蜂群</div>
          <div className="display-serif text-[15px] text-[#e7dcc0]">拟招聘方案(LIVE)</div>
        </div>
        {/* 首屏只一个把握度徽:done 态的徽随裁断句下沉(见下),此处只在 fallback 出 */}
        {phase === 'fallback' && <ConfidenceSourceBadge confidence={0.3} sourceLabel="FALLBACK" confidenceSource="default" />}
      </div>

      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="输入招聘需求,如:招聘储能BMS工程师,3年经验,薪资20-30K,熟悉SOC估算与CAN通信"
        rows={2}
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
        {phase === 'running' ? '蜂群运算中…' : '拟方案(真启蜂群)'}
      </button>

      {note && <div className="text-[11px] text-[#b6ab8c]">{note}</div>}

      {phase === 'done' && data && (
        <div className="flex flex-col gap-3">
          {/* ── 脊的主角:一句硬裁断(最大字号)+ 一个把握度徽(Jobs/张小龙:首屏只这两样)── */}
          {verdict ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-start justify-between gap-3">
                <p
                  className="display-serif font-semibold leading-snug"
                  style={{ color: verdictColor, fontSize: 22 }}
                >
                  {verdict.verdict}
                </p>
                <div className="shrink-0 pt-1">
                  <ConfidenceSourceBadge confidence={verdict.confidence} sourceLabel="LIVE_SWARM" confidenceSource={verdict.confidenceSource} />
                </div>
              </div>
              {/* 缓奏/不准时:准奏前必须补齐的硬缺口(从真 QA 门抬,非编造) */}
              {verdict.mustResolve.length > 0 && (
                <div
                  className="max-h-[120px] overflow-y-auto rounded border-l-2 py-1.5 pl-2.5 pr-2 text-[11px] leading-5"
                  style={{ borderColor: verdictColor, color: '#E8C49A', background: `${verdictColor}10` }}
                >
                  <span className="font-semibold" style={{ color: verdictColor }}>准奏前先补：</span>
                  {verdict.mustResolve.join('、')}
                </div>
              )}
            </div>
          ) : (
            <div className="text-[12px] text-[#c6bb9d]">
              已生成招聘方案 · <span style={{ color: ACCENT }}>验真已兑现</span>
              {typeof quality === 'number' && (
                <span className="text-[#8f835f]">（蜂群质量 {quality.toFixed(2)}/5）</span>
              )}
            </div>
          )}

          {/* ── 证据下沉:第二眼才看的方案字段,渐进披露(点 chip 才展全文)── */}
          <div className="text-[10px] uppercase tracking-[0.18em] text-[#6a6450]">蜂群方案 · 点开查证</div>
          <div className="flex flex-wrap gap-1.5">
            {Object.keys(data).map((field) => {
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
          {expanded && data[expanded] && (
            <div
              className="max-h-[300px] overflow-y-auto rounded border-l-2 pl-3 pr-1"
              style={{ borderColor: 'rgba(240,198,106,0.4)' }}
            >
              <div className="whitespace-pre-wrap text-[12px] leading-relaxed text-[#c6bb9d]">
                {data[expanded]}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
