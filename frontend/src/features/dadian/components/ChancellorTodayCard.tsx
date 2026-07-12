'use client';

/**
 * 丞相今日要务(2026-06-24 · 御前决策压缩器 / 丞相天才设计 #1 主动单一要务)。
 *
 * 主动顶出丞相今日一句话建议(真 callLLM)+ 理由 + 可裁决出口(下旨详议→决策 loop)。
 * 诚实分层源:真 LLM=LIVE / 引擎离线=诚实"待拟"(绝不演示冒充真)。接活大殿,非挂死面板。
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { withBasePath } from '@/lib/base-path';
import { DecisionJudgment } from '@/features/shared/components/DecisionJudgment';
import { ResponsibilityNotice } from '@/features/shared/components/ResponsibilityNotice';
import { DecisionTrustBar } from '@/features/shared/components/DecisionTrustBar';

interface Advice {
  todaySituation: string;
  chancellorRecommendation: string;
  reasons: string[];
}

const GOLD = '#F0C66A';

export function ChancellorTodayCard() {
  const [advice, setAdvice] = useState<Advice | null>(null);
  const [state, setState] = useState<'loading' | 'live' | 'derived' | 'unavailable'>('loading');

  useEffect(() => {
    let alive = true;
    fetch(withBasePath('/api/court/chancellor-advice?dept=overview'), { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((b) => {
        if (!alive) return;
        const d = b?.data;
        if ((d?.source === 'live' || d?.source === 'derived') && d.advice?.chancellorRecommendation) {
          setAdvice(d.advice);
          setState(d.source);
        } else {
          setState('unavailable');
        }
      })
      .catch(() => alive && setState('unavailable'));
    return () => { alive = false; };
  }, []);

  return (
    <div
      className="relative overflow-hidden rounded-2xl border p-5 backdrop-blur-sm"
      style={{ borderColor: `${GOLD}33`, background: `linear-gradient(135deg, ${GOLD}10, ${GOLD}04)` }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em]" style={{ color: GOLD }}>
          <span className="text-base leading-none">👑</span> 丞相 · 今日要务
        </div>
        <span
          className="rounded border px-1.5 py-0.5 font-mono text-[9px]"
          style={
            state === 'live' || state === 'derived'
              ? { borderColor: 'rgba(52,211,153,0.5)', color: '#34D399' }
              : { borderColor: 'rgba(240,198,106,0.34)', color: '#BDAA7C' }
          }
        >
          {state === 'loading' ? '丞相在线' : advice ? '丞相在线' : '暂无要务'}
        </span>
      </div>

      {(state === 'live' || state === 'derived') && advice ? (
        <>
          <p className="display-serif mt-3 text-[18px] leading-8" style={{ color: '#F5E9C9' }}>
            {advice.chancellorRecommendation}
          </p>
          {advice.todaySituation ? (
            <p className="mt-1.5 text-[12px] leading-5 text-[#C6BB9D]">{advice.todaySituation}</p>
          ) : null}
          <ul className="mt-2.5 space-y-1">
            {advice.reasons.slice(0, 3).map((r, i) => (
              <li key={i} className="flex gap-2 text-[12px] leading-5 text-[#C6BB9D]">
                <span className="mt-0.5 shrink-0 text-[11px]" style={{ color: GOLD }}>{i + 1}</span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex items-center gap-2">
            <Link
              href="/shangshufang"
              className="rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition hover:brightness-110"
              style={{ background: `${GOLD}1c`, border: `1px solid ${GOLD}55`, color: GOLD }}
            >
              下旨详议 →
            </Link>
            <span className="text-[10px] text-[#8A8470]">丞相建议·陛下裁决(采纳/追问/驳回 在上书房)</span>
          </div>
          <DecisionTrustBar accent={GOLD} />
          <DecisionJudgment question="丞相今日要务·御座" verdict={advice.chancellorRecommendation} accent={GOLD} />
          <ResponsibilityNotice variant="inline" accent={GOLD} />
        </>
      ) : (
        <p className="mt-3 text-[13px] leading-6 text-[#9AA3C4]">
          {state === 'loading'
            ? '丞相正在拟今日要务…'
            : '当前暂无可呈现的今日要务。'}
        </p>
      )}
    </div>
  );
}
